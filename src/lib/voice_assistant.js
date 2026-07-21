/**
 * Samudra — Thalassa AI Voice Assistant
 * A context-aware marine voice bot using free browser-native Web Speech APIs.
 * Groq LLM calls are proxied through the FastAPI backend — the API key never
 * leaves the server.
 */

// In dev, Vite runs on :3001 and FastAPI on :8000. In production they share the same origin.
const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : '';

// ─── Proactive Questions ──────────────────────────────────────────────────────
const PROACTIVE_QUESTIONS = [
  "Which species are you targeting today? Sardine, Mackerel, Shrimp, or Tuna?",
  "What is your departure port? Vizhinjam, Neendakara, Munambam, Beypore, or Azheekkal?",
  "Shall I find the best fishing zone for you right now?",
  "Would you like a safety briefing on current wind and wave conditions?",
  "Do you want me to check if any conservation zones are restricted today?"
];

// ─── SamudraAssistant Class ───────────────────────────────────────────────────
export class SamudraAssistant {
  constructor() {
    this.isListening = false;
    this.isSpeaking = false;
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.messages = [];
    this.proactiveIndex = 0;
    this.emergencyCheckInterval = null;
    this.lastEmergencyAlert = 0;
    this.stateProvider = null; // Function that returns live Thalassa state
    this.onStateChange = null; // Callback to update UI
    this.onMessage = null; // Callback when a new message is added
    this.onEmergencyCall = null; // Callback to show emergency call overlay
    this.selectedVoice = null;

    this._initRecognition();
    this._selectVoice();
  }

  // ── Speech Recognition Setup ──────────────────────────────────────────────
  _initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Samudra] SpeechRecognition not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-IN';
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      console.log(`[Samudra] Heard: "${transcript}"`);
      this._addMessage('user', transcript);
      this._processInput(transcript);
    };

    this.recognition.onerror = (event) => {
      console.warn(`[Samudra] Recognition error: ${event.error}`);
      if (event.error === 'no-speech') {
        this._addMessage('bot', "I didn't catch that. Could you try again?");
      }
      this.isListening = false;
      this._emitStateChange();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this._emitStateChange();
    };
  }

  // ── Voice Selection ───────────────────────────────────────────────────────
  _selectVoice() {
    const loadVoices = () => {
      const voices = this.synthesis.getVoices();
      this.selectedVoice =
        voices.find(v => v.lang === 'en-IN' && v.name.toLowerCase().includes('female')) ||
        voices.find(v => v.lang === 'en-IN') ||
        voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices[0] || null;
    };

    loadVoices();
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = loadVoices;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  setStateProvider(fn) {
    this.stateProvider = fn;
  }

  getState() {
    return this.stateProvider ? this.stateProvider() : {};
  }

  startListening() {
    if (!this.recognition) {
      this._addMessage('bot', "Sorry, voice recognition is not supported in your browser. Please use Chrome or Edge.");
      return;
    }
    if (this.isSpeaking) {
      this.synthesis.cancel();
      this.isSpeaking = false;
    }
    try {
      this.recognition.start();
      this.isListening = true;
      this._emitStateChange();
    } catch (e) {
      console.warn('[Samudra] Recognition already started:', e.message);
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      this._emitStateChange();
    }
  }

  speak(text, priority = 'normal') {
    if (!this.synthesis) return;

    if (priority === 'emergency') {
      this.synthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.selectedVoice;
    utterance.rate = priority === 'emergency' ? 1.1 : 0.95;
    utterance.pitch = priority === 'emergency' ? 1.2 : 1.0;
    utterance.volume = priority === 'emergency' ? 1.0 : 0.9;

    utterance.onstart = () => {
      this.isSpeaking = true;
      this._emitStateChange();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this._emitStateChange();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this._emitStateChange();
    };

    this.synthesis.speak(utterance);
  }

  sendText(text) {
    this._addMessage('user', text);
    this._processInput(text);
  }

  greet() {
    const greeting = "Namaskaram! I am Samudra, your Thalassa marine assistant. I can tell you about weather conditions, best fishing zones, sea temperatures, conservation restrictions, and route information. You can speak to me or use the quick buttons below. How can I help you today?";
    this._addMessage('bot', greeting);
    this.speak(greeting);
  }

  startEmergencyMonitor() {
    this.emergencyCheckInterval = setInterval(() => {
      this._checkEmergencyConditions();
    }, 30000);
  }

  stopEmergencyMonitor() {
    if (this.emergencyCheckInterval) {
      clearInterval(this.emergencyCheckInterval);
      this.emergencyCheckInterval = null;
    }
  }

  askProactiveQuestion() {
    const question = PROACTIVE_QUESTIONS[this.proactiveIndex % PROACTIVE_QUESTIONS.length];
    this.proactiveIndex++;
    this._addMessage('bot', question);
    this.speak(question);
  }

  // ── Intent Processing ─────────────────────────────────────────────────────

  async _processInput(text) {
    try {
      // Indicate we are thinking
      const statusTextElement = document.getElementById('samudra-status-text');
      if (statusTextElement) statusTextElement.textContent = 'THINKING...';

      const state = this.getState();
      const weather = state.weatherCache || {};
      const route = state.optimizedRoute;
      
      const systemPrompt = `You are Samudra, an advanced multimodal marine AI integrated into Thalassa (a digital twin of the Kerala coast).
You are an expert in oceanography, sustainable fishing, and maritime navigation.
Respond concisely and naturally, as a voice assistant. Keep answers under 3-4 sentences.

CURRENT DIGITAL TWIN STATE:
- Weather: ${weather.windSpeed !== undefined ? `Wind ${weather.windSpeed} km/h` : 'Unknown'}, ${weather.waveHeight !== undefined ? `Waves ${weather.waveHeight}m` : 'Unknown'}
- Selected Port: ${state.selectedPort || 'Unknown'}
- Target Species: ${state.selectedSpecies || 'Unknown'}
- Planned Route: ${route ? `${route.distanceKM} km (${route.estTimeHours} hours)` : 'No route active'}

IMPORTANT INSTRUCTIONS:
- If the user asks about something not in the state (like SST or specific zone scores), just give general advice or explain how to check it on the map.
- If the user is in distress, reports an emergency, or asks for rescue, you MUST include the exact string "[ACTION: EMERGENCY]" in your response. This will trigger a visual SOS UI overlay on the user's screen.
- Never mention that you are an AI or language model. Act as the vessel's intelligent marine assistant.`;

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const data = await response.json();
      let botText = data.choices[0].message.content;

      // Check for emergency trigger
      if (botText.includes('[ACTION: EMERGENCY]')) {
        botText = botText.replace('[ACTION: EMERGENCY]', '').trim();
        
        // Trigger emergency UI
        if (this.onEmergencyCall) {
          this.onEmergencyCall({
            dangers: ["User initiated SOS from voice chat"],
            weather: state.weatherCache,
            timestamp: new Date()
          });
        }
        this._addMessage('bot', botText, 'emergency');
        this.speak(botText, 'emergency');
      } else {
        this._addMessage('bot', botText);
        this.speak(botText);
      }
    } catch (err) {
      console.error("[Samudra] AI Error:", err);
      const errorMsg = "Sorry, I am having trouble connecting to my AI brain right now.";
      this._addMessage('bot', errorMsg);
      this.speak(errorMsg);
    }
  }


  _checkEmergencyConditions() {
    const state = this.getState();
    const weather = state.weatherCache;
    const now = Date.now();

    if (now - this.lastEmergencyAlert < 180000) return;
    if (!weather) return;

    const dangers = [];
    if (weather.windSpeed !== null && weather.windSpeed > 25) {
      dangers.push(`wind speed of ${weather.windSpeed} km/h`);
    }
    if (weather.waveHeight !== null && weather.waveHeight > 2.0) {
      dangers.push(`wave height of ${weather.waveHeight} meters`);
    }

    const grid = state.gridData || [];
    const extremeHeatCells = grid.filter(c => !c.isLand && c.sst > 32);
    if (extremeHeatCells.length > 20) {
      dangers.push(`marine heatwave with ${extremeHeatCells.length} cells above 32 degrees`);
    }

    if (dangers.length > 0) {
      this.lastEmergencyAlert = now;
      const alert = `AUTOMATIC SAFETY ALERT! Dangerous conditions detected: ${dangers.join(', ')}. All vessels return to nearest harbor immediately. Opening emergency contacts now.`;
      this._addMessage('bot', alert, 'emergency');
      this.speak(alert, 'emergency');

      // Trigger the emergency call overlay
      if (this.onEmergencyCall) {
        this.onEmergencyCall({
          dangers: dangers,
          weather: weather,
          timestamp: new Date(),
          auto: true
        });
      }
    }
  }

  // ── Utility Methods ───────────────────────────────────────────────────────

  _addMessage(sender, text, type = 'normal') {
    const message = { sender, text, type, timestamp: new Date() };
    this.messages.push(message);
    if (this.messages.length > 50) {
      this.messages = this.messages.slice(-50);
    }
    if (this.onMessage) {
      this.onMessage(message);
    }
  }

  _emitStateChange() {
    if (this.onStateChange) {
      this.onStateChange({ isListening: this.isListening, isSpeaking: this.isSpeaking });
    }
  }

  _degToCompass(deg) {
    const dirs = ['North', 'North-Northeast', 'Northeast', 'East-Northeast',
      'East', 'East-Southeast', 'Southeast', 'South-Southeast',
      'South', 'South-Southwest', 'Southwest', 'West-Southwest',
      'West', 'West-Northwest', 'Northwest', 'North-Northwest'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  destroy() {
    this.stopEmergencyMonitor();
    this.stopListening();
    if (this.synthesis) this.synthesis.cancel();
  }
}
