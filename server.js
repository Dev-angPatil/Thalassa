import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// ─────────────────────────────────────────────────────────────
//  LIVE STATE: Updated by the frontend via POST /api/sync-state
//  This is the bridge between the Thalassa dashboard and the AI voice agent.
// ─────────────────────────────────────────────────────────────
let thalassaLiveState = {
  selectedCell: null,
  selectedPort: 'munambam',
  selectedSpecies: 'sardine',
  currentMode: 'fisherman',
  dayOfYear: 175,
  weatherCache: null,
  liveData: null,
  optimizedRoute: null,
  gridSummary: null
};

/**
 * Endpoint: Sync State from Frontend
 * The Thalassa frontend periodically pushes the current dashboard state here
 * so the AI voice agent can reference it during calls.
 */
app.post('/api/sync-state', (req, res) => {
  try {
    const state = req.body;
    if (state) {
      thalassaLiveState = { ...thalassaLiveState, ...state };
      console.log('[Sync] Dashboard state updated. Cell:', 
        state.selectedCell ? `(${state.selectedCell.lat?.toFixed(1)}, ${state.selectedCell.lng?.toFixed(1)})` : 'none');
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Sync] Error:', err);
    return res.status(500).json({ error: 'Failed to sync state' });
  }
});

// ─────────────────────────────────────────────────────────────
//  HELPER: Build rich context string from live state
// ─────────────────────────────────────────────────────────────
function buildLiveContext() {
  const s = thalassaLiveState;
  let context = '';

  // Project overview
  context += 'PROJECT: Thalassa is a marine digital twin platform for Kerala fishermen. ';
  context += 'It maps the entire Kerala coastline with real-time ocean data including sea surface temperature (SST), chlorophyll concentration, current patterns, and fishing zones. ';
  context += 'It helps fishermen find the best fishing spots while respecting marine conservation zones and spawning bans.\n\n';

  // Current dashboard mode
  context += `DASHBOARD MODE: ${s.currentMode === 'fisherman' ? 'Fisherman Dashboard (optimizing catch)' : 'Conservation Dashboard (protecting marine reserves)'}.\n`;
  context += `SELECTED PORT: ${s.selectedPort || 'munambam'}.\n`;
  context += `TARGET SPECIES: ${s.selectedSpecies || 'sardine'}.\n`;
  context += `DAY OF YEAR: ${s.dayOfYear} (${getDayDescription(s.dayOfYear)}).\n\n`;

  // Selected cell data
  if (s.selectedCell) {
    const c = s.selectedCell;
    context += 'SELECTED GRID CELL (currently selected location on map):\n';
    context += `  - Coordinates: Lat ${c.lat?.toFixed(2)}, Lng ${c.lng?.toFixed(2)}\n`;
    context += `  - Sea Surface Temperature: ${c.sst?.toFixed(1)}°C\n`;
    context += `  - Chlorophyll Concentration: ${c.chl?.toFixed(2)} mg/m³\n`;
    context += `  - Wave Height: ${c.waveHeight?.toFixed(1)} meters\n`;
    context += `  - Wind Speed: ${c.windSpeed?.toFixed(1)} km/h\n`;
    context += `  - Fishing Score: ${c.fishingScore}/100\n`;
    context += `  - Conservation Score: ${c.conservationScore}/100\n`;
    context += `  - Distance to Coast: ${c.minDistanceToCoast?.toFixed(1)} km\n`;
    if (c.favorabilityReasons?.length) {
      context += `  - Why it's good: ${c.favorabilityReasons.join(', ')}\n`;
    }
    if (c.sensitivityReasons?.length) {
      context += `  - Ecological sensitivity: ${c.sensitivityReasons.join(', ')}\n`;
    }
    if (c.isMPA) {
      context += `  - WARNING: This cell is inside a Marine Protected Area!\n`;
    }
    if (c.spawningBanActive) {
      context += `  - WARNING: Spawning ban is currently ACTIVE in this zone! Fishing is prohibited.\n`;
    }
    context += '\n';
  } else {
    context += 'SELECTED GRID CELL: None selected. The fisherman has not clicked any spot on the map yet.\n\n';
  }

  // Route data
  if (s.optimizedRoute) {
    const r = s.optimizedRoute;
    context += 'OPTIMIZED ROUTE:\n';
    context += `  - Distance: ${r.distanceKM || 'N/A'} km\n`;
    context += `  - Standard route distance: ${r.stdDistanceKM || 'N/A'} km\n`;
    if (r.cutsSpawningBan) {
      context += `  - Standard route CUTS THROUGH a spawning ban zone (₹50,000 fine risk)!\n`;
      context += `  - The optimized route safely avoids the ban zone.\n`;
    }
    context += '\n';
  }

  // Weather data
  if (s.weatherCache) {
    const w = s.weatherCache;
    context += 'LIVE WEATHER DATA:\n';
    context += `  - Temperature: ${w.temperature || w.current?.temperature_2m || 'N/A'}°C\n`;
    context += `  - Wind Speed: ${w.windspeed || w.current?.wind_speed_10m || 'N/A'} km/h\n`;
    context += `  - Wave Height: ${w.wave_height || 'N/A'} meters\n`;
    context += '\n';
  }

  // Safety assessment
  context += 'SAFETY ASSESSMENT:\n';
  if (s.selectedCell) {
    const c = s.selectedCell;
    const windSafe = (c.windSpeed || 0) < 25;
    const waveSafe = (c.waveHeight || 0) < 2.5;
    const overallSafe = windSafe && waveSafe && !c.spawningBanActive;
    context += `  - Wind conditions: ${windSafe ? 'SAFE' : 'DANGEROUS (>25 km/h)'}\n`;
    context += `  - Wave conditions: ${waveSafe ? 'SAFE' : 'DANGEROUS (>2.5m waves)'}\n`;
    context += `  - Overall: ${overallSafe ? 'SAFE to go fishing' : 'CAUTION - conditions may be unsafe'}\n`;
  } else {
    context += '  - No location selected, cannot assess safety.\n';
  }

  return context;
}

function getDayDescription(day) {
  if (day >= 1 && day <= 59) return 'Winter season - calm seas';
  if (day >= 60 && day <= 151) return 'Pre-monsoon season - warming waters';
  if (day >= 152 && day <= 273) return 'Monsoon season - rough seas, fishing bans likely';
  return 'Post-monsoon season - seas settling';
}

/**
 * Endpoint 1: Vapi Webhook (Inbound)
 * When the AI needs real-time data, Vapi sends a POST request here.
 */
app.post('/api/webhook', (req, res) => {
  try {
    const { message } = req.body;
    
    // We only care about tool calls from Vapi
    if (message && message.type === 'tool-calls') {
      const toolCalls = message.toolCalls;
      const responses = [];

      for (const call of toolCalls) {
        if (call.function.name === 'get_live_weather') {
          console.log('[Webhook] Vapi requested live weather data.');
          const context = buildLiveContext();
          responses.push({
            toolCallId: call.id,
            result: context
          });
        } else if (call.function.name === 'get_route_safety') {
          console.log('[Webhook] Vapi requested route safety data.');
          const context = buildLiveContext();
          responses.push({
            toolCallId: call.id,
            result: context
          });
        } else if (call.function.name === 'get_thalassa_info') {
          console.log('[Webhook] Vapi requested Thalassa project info.');
          const context = buildLiveContext();
          responses.push({
            toolCallId: call.id,
            result: context
          });
        } else {
          responses.push({
            toolCallId: call.id,
            result: "Data not available."
          });
        }
      }

      // Return the data back to Vapi so the AI can speak it
      return res.status(200).json({ results: responses });
    }

    // Acknowledge other webhook events (like status updates)
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling webhook:', error);
    return res.status(500).send('Internal Server Error');
  }
});

/**
 * Endpoint 2: Trigger Outbound Call
 * The Thalassa frontend calls this to tell Vapi to dial a fisherman.
 */
app.post('/api/outbound', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    if (!process.env.VAPI_API_KEY) {
      return res.status(500).json({ error: 'VAPI_API_KEY is not set in .env file.' });
    }

    const assistantId = process.env.VAPI_ASSISTANT_ID; 

    console.log(`[Outbound] Triggering call to ${phoneNumber}...`);

    // Call the Vapi REST API to initiate the call
    // We inject the LIVE stats directly into the prompt so it always works perfectly for the SOS!
    const liveStats = buildLiveContext();
    
    // Build a dynamic first message so the AI reads the stats immediately without waiting for the user to speak!
    const s = thalassaLiveState.selectedCell || {};
    const w = thalassaLiveState.weatherCache || {};
    
    let immediateSpokenWarning = "URGENT ALERT: This is Samudra, the AI marine safety system. We are calling to warn you about conditions at your selected location.";
    if (s.lat || w.temperature) {
      immediateSpokenWarning += ` The sea surface temperature is ${w.temperature || w.current?.temperature_2m || s.sst?.toFixed(1) || 'unknown'} degrees.`;
      immediateSpokenWarning += ` Wind speed is ${w.windspeed || w.current?.wind_speed_10m || s.windSpeed?.toFixed(1) || 'unknown'} kilometers per hour.`;
      immediateSpokenWarning += ` Wave height is ${s.waveHeight?.toFixed(1) || w.wave_height || 'unknown'} meters.`;
      if (s.fishingScore) {
        immediateSpokenWarning += ` The current fishing score for this zone is ${s.fishingScore} out of 100.`;
      }
      if (s.spawningBanActive) {
        immediateSpokenWarning += ` WARNING: There is an active spawning ban in this zone! You risk a fine of 50,000 rupees.`;
      }
    }
    immediateSpokenWarning += " Are you currently safe?";

    const response = await axios.post(
      'https://api.vapi.ai/call/phone',
      {
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        assistant: {
          firstMessage: immediateSpokenWarning,
          model: {
            provider: "openai",
            model: "gpt-4o-mini",
            messages: [{ 
              role: "system", 
              content: `You are Samudra, an AI safety agent. You are calling a fisherman to urgently warn them about their selected location on the map. \n\nHere are the exact live stats for their location right now:\n\n${liveStats}\n\nCRITICAL INSTRUCTION: You MUST explicitly read out the Temperature, Wind Speed, Wave Height, and Fishing Score in your first few sentences. Do not skip the numbers! Warn them clearly if any of the numbers are dangerous.` 
            }]
          },
          voice: {
            provider: "11labs",
            voiceId: "bIHbv24MWmeRgasZH58o"
          }
        },
        customer: {
          number: phoneNumber
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('[Outbound] Call initiated successfully!', response.data);
    return res.status(200).json({ success: true, callData: response.data });

  } catch (error) {
    console.error('Error triggering outbound call:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to trigger call.', details: error.response?.data });
  }
});

/**
 * Endpoint 3: Get current state (for debugging)
 */
app.get('/api/state', (req, res) => {
  return res.status(200).json({
    state: thalassaLiveState,
    context: buildLiveContext()
  });
});

app.listen(PORT, () => {
  console.log(`[Thalassa Backend] Webhook server running on http://localhost:${PORT}`);
  console.log(`Make sure to run 'ngrok http ${PORT}' to expose this to Vapi!`);
});
