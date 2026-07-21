/**
 * Samudra — Thalassa AI Voice Assistant
 * A context-aware marine voice bot using free browser-native Web Speech APIs.
 * Supports both chat mode and full-screen phone call mode.
 */

// ─── Default Voice Config (overridden by Voice.json) ────────────────────────
const DEFAULT_VOICE_CONFIG = {
  voice: { rate: 0.95, pitch: 1.0, volume: 0.9, preferredLang: 'en-IN', preferGender: 'female', emergencyRate: 1.15, emergencyPitch: 1.25, emergencyVolume: 1.0 },
  recognition: { language: 'en-IN', continuous: true, interimResults: true, maxAlternatives: 1, silenceTimeout: 3000, autoRestartDelay: 500 },
  call: { dialDuration: 2500, ringtonePulses: 3, maxCallDuration: 600, autoListenAfterSpeak: true, showLiveTranscript: true, subtitleDisplayTime: 8000 },
  assistant: { name: 'Samudra', callGreeting: 'Call connected. Samudra at your service, Captain. How can I assist you today?', callEndMessage: 'Signing off, Captain. Stay safe on the waters. Samudra out.' },
  emergencyKeywords: ['help', 'emergency', 'SOS', 'mayday', 'rescue', 'sinking', 'capsized', 'man overboard', 'fire', 'distress', 'danger', 'coast guard']
};

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

    // ── Voice Config (loaded from Voice.json) ──
    this.voiceConfig = DEFAULT_VOICE_CONFIG;

    // ── Phone Call Mode State ──
    this.callState = 'idle'; // 'idle' | 'dialing' | 'active' | 'ended'
    this.callStartTime = null;
    this.callTimerInterval = null;
    this.callDurationSeconds = 0;
    this.isMuted = false;
    this.isSpeakerOn = false;
    this.callTranscriptHistory = [];

    // ── Callbacks for Phone Call UI ──
    this.onCallStateChange = null; // (state, data) => {}
    this.onCallTranscript = null; // (text, sender) => {} — live subtitle
    this.onCallTimer = null; // (formattedTime) => {}

    this._initRecognition();
    this._selectVoice();
    this._loadVoiceConfig();
  }

  // ── Load Voice.json Config ─────────────────────────────────────────────────
  async _loadVoiceConfig() {
    try {
      const resp = await fetch('/Voice.json');
      if (resp.ok) {
        const config = await resp.json();
        this.voiceConfig = { ...DEFAULT_VOICE_CONFIG, ...config };
        console.log('[Samudra] Voice config loaded from Voice.json');
      }
    } catch (e) {
      console.warn('[Samudra] Could not load Voice.json, using defaults:', e.message);
    }
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

      // If in call mode, send transcript to the call UI
      if (this.callState === 'active' && this.onCallTranscript) {
        this.onCallTranscript(transcript, 'user');
      }

      this._processInput(transcript);
    };

    this.recognition.onerror = (event) => {
      console.warn(`[Samudra] Recognition error: ${event.error}`);
      if (event.error === 'no-speech') {
        // In call mode, silently restart listening
        if (this.callState === 'active' && !this.isMuted) {
          setTimeout(() => this._autoRestartListening(), this.voiceConfig.recognition.autoRestartDelay || 500);
          return;
        }
        this._addMessage('bot', "I didn't catch that. Could you try again?");
      }
      this.isListening = false;
      this._emitStateChange();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this._emitStateChange();

      // In call mode, auto-restart listening after recognition ends (continuous conversation)
      if (this.callState === 'active' && !this.isSpeaking && !this.isMuted) {
        setTimeout(() => this._autoRestartListening(), this.voiceConfig.recognition.autoRestartDelay || 500);
      }
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

    const vc = this.voiceConfig.voice || {};
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.selectedVoice;
    utterance.rate = priority === 'emergency' ? (vc.emergencyRate || 1.1) : (vc.rate || 0.95);
    utterance.pitch = priority === 'emergency' ? (vc.emergencyPitch || 1.2) : (vc.pitch || 1.0);
    utterance.volume = priority === 'emergency' ? (vc.emergencyVolume || 1.0) : (vc.volume || 0.9);

    utterance.onstart = () => {
      this.isSpeaking = true;
      this._emitStateChange();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this._emitStateChange();

      // In call mode, auto-listen after AI finishes speaking
      if (this.callState === 'active' && !this.isMuted && this.voiceConfig.call.autoListenAfterSpeak) {
        setTimeout(() => this._autoRestartListening(), this.voiceConfig.recognition.autoRestartDelay || 500);
      }
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PHONE CALL MODE — Full-Screen AI Call Experience
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start a phone call with Samudra AI.
   * Flow: dialing → connected → auto-listen
   */
  startCall() {
    if (this.callState !== 'idle' && this.callState !== 'ended') {
      console.warn('[Samudra] Call already in progress');
      return;
    }

    console.log('[Samudra] 📞 Starting AI phone call...');
    this.callState = 'dialing';
    this.callTranscriptHistory = [];
    this.isMuted = false;
    this.isSpeakerOn = false;
    this._emitCallStateChange('dialing');

    // Simulate dialing delay, then connect
    const dialDuration = this.voiceConfig.call?.dialDuration || 2500;
    setTimeout(() => {
      this._connectCall();
    }, dialDuration);
  }

  /**
   * Connect the call — transition from dialing to active.
   */
  _connectCall() {
    this.callState = 'active';
    this.callStartTime = Date.now();
    this.callDurationSeconds = 0;

    // Start call timer
    this.callTimerInterval = setInterval(() => {
      this.callDurationSeconds = Math.floor((Date.now() - this.callStartTime) / 1000);
      const formatted = this._formatCallTime(this.callDurationSeconds);
      if (this.onCallTimer) this.onCallTimer(formatted);
    }, 1000);

    this._emitCallStateChange('active');

    // Greet the user
    const greeting = this.voiceConfig.assistant?.callGreeting || "Call connected. Samudra here. How can I assist you, Captain?";
    this._addMessage('bot', greeting);
    if (this.onCallTranscript) this.onCallTranscript(greeting, 'bot');
    this.speak(greeting);
  }

  /**
   * End the call gracefully.
   */
  endCall() {
    if (this.callState === 'idle') return;

    console.log('[Samudra] 📞 Ending call...');

    // Stop everything
    this.stopListening();
    this.synthesis.cancel();
    this.isSpeaking = false;

    // Stop timer
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
      this.callTimerInterval = null;
    }

    const duration = this._formatCallTime(this.callDurationSeconds);
    this.callState = 'ended';
    this._emitCallStateChange('ended', { duration, seconds: this.callDurationSeconds });
  }

  /**
   * Dismiss the call overlay and return to idle.
   */
  dismissCall() {
    this.callState = 'idle';
    this.callDurationSeconds = 0;
    this.callStartTime = null;
    this._emitCallStateChange('idle');
  }

  /**
   * Toggle mute during call.
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopListening();
    } else if (this.callState === 'active' && !this.isSpeaking) {
      this._autoRestartListening();
    }
    return this.isMuted;
  }

  /**
   * Toggle speaker (visual only — we always use device speaker).
   */
  toggleSpeaker() {
    this.isSpeakerOn = !this.isSpeakerOn;
    return this.isSpeakerOn;
  }

  // ── Auto-Restart Listening (continuous conversation) ──
  _autoRestartListening() {
    if (this.callState !== 'active') return;
    if (this.isListening) return;
    if (this.isMuted) return;
    if (this.isSpeaking) return;

    try {
      this.recognition.start();
      this.isListening = true;
      this._emitStateChange();
    } catch (e) {
      // Already started, ignore
    }
  }

  _formatCallTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  _emitCallStateChange(state, data = {}) {
    if (this.onCallStateChange) {
      this.onCallStateChange(state, data);
    }
  }

  // ── Intent Processing ─────────────────────────────────────────────────────

  async _processInput(text) {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    
    if (!apiKey) {
      const response = "Groq API key not found. Please add VITE_GROQ_API_KEY to the .env file.";
      this._addMessage('bot', response);
      this.speak(response);
      return;
    }

    try {
      // Indicate we are thinking
      const statusTextElement = document.getElementById('samudra-status-text');
      if (statusTextElement) statusTextElement.textContent = 'THINKING...';

      // Show thinking in call mode
      if (this.callState === 'active' && this.onCallTranscript) {
        this.onCallTranscript('Thinking...', 'thinking');
      }

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

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
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
        throw new Error(`Groq API error: ${response.status}`);
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

        // Send to call transcript
        if (this.callState === 'active' && this.onCallTranscript) {
          this.onCallTranscript(botText, 'bot');
        }

        this.speak(botText, 'emergency');
      } else {
        this._addMessage('bot', botText);

        // Send to call transcript
        if (this.callState === 'active' && this.onCallTranscript) {
          this.onCallTranscript(botText, 'bot');
        }

        this.speak(botText);
      }
    } catch (err) {
      console.error("[Samudra] AI Error:", err);
      const errorMsg = "Sorry, I am having trouble connecting to my AI brain right now.";
      this._addMessage('bot', errorMsg);

      if (this.callState === 'active' && this.onCallTranscript) {
        this.onCallTranscript(errorMsg, 'bot');
      }

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
    if (this.callTimerInterval) clearInterval(this.callTimerInterval);
  }
}
