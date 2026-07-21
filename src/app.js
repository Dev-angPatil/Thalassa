/**
 * Matsya Drishti Digital Twin Interface Controller
 * Manages native Leaflet map layers, telemetry sidebar, seasonal timeline, live API sync, scenario presets, and guided tours.
 */

import { KERALA_COASTLINE, FISHING_HARBORS, CONSERVATION_ZONES } from './data/kerala_spatial.js';
import { generateDigitalTwinGrid, calculateOptimizedRoute, getDistanceKM } from './lib/data_engine.js';
import { fetchIncoisErddapData, fetchOpenMeteoForecast } from './lib/api_client.js';
import { SamudraAssistant } from './lib/voice_assistant.js';

// Open-Meteo Cache & Debounce Globals
const openMeteoCache = new Map();
let mouseMoveDebounceTimer = null;

// Global state
let currentMode = 'fisherman'; // 'fisherman' or 'conservationist'
let currentTimeMode = 'realtime'; // 'realtime' or 'simulation'
let lastSimulationDay = 175;
let selectedPort = 'munambam';
let dayOfYear = 175; // Defaults to late June (Monsoon season)
let liveData = null;
let gridData = [];
let selectedCell = null;
let hoveredCell = null; // Currently hovered grid coordinate
let optimizedRoute = null;
let isPlaying = false;
let playInterval = null;
let map = null; // Leaflet map instance
let samudra = null; // Samudra AI Voice Assistant instance
let lastWeatherData = null; // Cache last weather data for Samudra
let weatherIntensity = 1.0;
let vesselMarkerStd = null;
let isTransiting = false;
let violationAlertActive = false;

// Animation helpers
let pulseState = 0;
let vesselProgress = 0;

// Active Overlay Layers
const activeOverlays = {
  sst: true,
  chl: true,
  currents: false,
  mpa: true
};

// Bounding box limits matching data_engine.js
const LAT_MIN = 8.0;
const LAT_MAX = 12.8;
const LNG_MIN = 74.5;
const LNG_MAX = 77.5;

// Leaflet Layer Groups
let gridLayerGroup = null;
let conservationLayerGroup = null;
let portsLayerGroup = null;
let currentsLayerGroup = null;
let gridLinesLayerGroup = null;
let clustersLayerGroup = null;

// Interactive Highlights & Vessel Layers
let hoverOutline = null;
let selectedOutline = null;
let routePolyline = null;
let stdRoutePolyline = null;
let vesselMarker = null;

// Guided Tour state
let tourActive = false;
let tourStep = 0;

const tourSteps = [
  {
    title: "Welcome to Matsya Drishti 🌊",
    desc: "This digital twin maps the Kerala coastline to balance sustainable fishing yields with marine reserve spawning bans. Let's take a 1-minute guided tour of its core capabilities.",
    highlightId: "btn-start-tour",
    position: "bottom"
  },
  {
    title: "Dual Perspective Dashboards 🔀",
    desc: "Switch between 'Fisherman Dashboard' (optimizing catches using sea surface temperature and chlorophyll indexes) and 'Conservation Dashboard' (restricting sensitive spawning zones). Try toggling this later!",
    highlightId: "mode-fisherman",
    position: "bottom"
  },
  {
    title: "Debounced Hover Telemetry 📊",
    desc: "Hovering over map grid cells queries Open-Meteo APIs for real-time wind and wave forecasts. Coordinate-rounded caching prevents API rate-limiting. Try hovering over cells!",
    highlightId: "telemetry-card",
    position: "left"
  },
  {
    title: "Dynamic Seasonal Timeline 🗓️",
    desc: "Scrub the calendar day slider or hit Play to animate monsoon seasonal variations, including chlorophyll upwellings and shifting conservation boundaries.",
    highlightId: "timeline-panel",
    position: "top"
  },
  {
    title: "INCOIS ERDDAP Live-Sync 🛰️",
    desc: "Click 'Trigger Live API Fetch' to request real-time satellite daily readings directly from federal servers via a CORS-bypassing Vite proxy.",
    highlightId: "btn-fetch-live",
    position: "bottom"
  }
];

// 2D Array to store 1200 cell layer references
const cellLayers = Array(40).fill(null).map(() => Array(30).fill(null));

// Initialize Application
function init() {
  // Initialize Leaflet Map
  map = L.map('map', {
    zoomControl: true, // Enable zoom buttons
    attributionControl: false
  }).setView([10.4, 76.0], 8);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 18,
    minZoom: 6
  }).addTo(map);

  // Add Leaflet's built-in scale bar in the bottom-left
  L.control.scale({
    position: 'bottomleft',
    metric: true,
    imperial: false
  }).addTo(map);

  // Constrain the map bounds to the Kerala region
  map.setMaxBounds([
    [LAT_MIN - 1.0, LNG_MIN - 1.0],
    [LAT_MAX + 1.0, LNG_MAX + 1.0]
  ]);

  // Instantiate Leaflet layer groups
  gridLayerGroup = L.layerGroup().addTo(map);
  conservationLayerGroup = L.layerGroup().addTo(map);
  portsLayerGroup = L.layerGroup().addTo(map);
  currentsLayerGroup = L.layerGroup().addTo(map);
  gridLinesLayerGroup = L.layerGroup().addTo(map);
  clustersLayerGroup = L.layerGroup().addTo(map);

  // Set up hover highlight layer
  hoverOutline = L.rectangle([[0, 0], [0, 0]], {
    color: 'var(--primary-color)',
    weight: 2.5,
    fillColor: 'var(--primary-color)',
    fillOpacity: 0.15,
    className: 'hover-outline-smooth',
    interactive: false
  });

  // Set up selection highlight layer
  selectedOutline = L.rectangle([[0, 0], [0, 0]], {
    color: 'var(--ink)',
    weight: 2.5,
    fillColor: 'rgba(0, 0, 0, 0)',
    fillOpacity: 0,
    interactive: false
  });

  // Set up vessel route path layer
  routePolyline = L.polyline([], {
    color: '#141413',
    weight: 3.5,
    lineCap: 'round',
    lineJoin: 'round',
    interactive: false
  });
  
  stdRoutePolyline = L.polyline([], {
    color: 'var(--error, #c64545)',
    weight: 2.5,
    dashArray: '8, 8',
    interactive: false
  });

  // Set up animated vessel marker
  vesselMarker = L.circleMarker([0, 0], {
    radius: 4.5,
    color: 'white',
    weight: 1.5,
    fillColor: '#141413',
    fillOpacity: 1,
    interactive: false
  });

  vesselMarkerStd = L.circleMarker([0, 0], {
    radius: 4.5,
    color: 'white',
    weight: 1.5,
    fillColor: 'var(--brand-error, #d45656)',
    fillOpacity: 1,
    interactive: false
  });

  // Create grid cell rectangles (40x30 = 1200 cells)
  const latStep = (LAT_MAX - LAT_MIN) / 40;
  const lngStep = (LNG_MAX - LNG_MIN) / 30;
  const canvasRenderer = L.canvas(); // High-performance canvas vector renderer

  for (let r = 0; r < 40; r++) {
    const lat = LAT_MAX - (r * latStep) - (latStep / 2);
    for (let c = 0; c < 30; c++) {
      const lng = LNG_MIN + (c * lngStep) + (lngStep / 2);
      
      const bounds = [
        [lat - latStep / 2, lng - lngStep / 2],
        [lat + latStep / 2, lng + lngStep / 2]
      ];
      
      const rect = L.rectangle(bounds, {
        renderer: canvasRenderer,
        fillColor: 'rgba(0, 0, 0, 0)',
        fillOpacity: 0,
        color: 'rgba(255, 255, 255, 0.08)',
        weight: 0.5,
        interactive: false // Mousemove is handled at map level for fast spatial lookups
      }).addTo(gridLayerGroup);
      
      cellLayers[r][c] = rect;
    }
  }

  // Draw grid lines and axis ticks
  initGridLines();

  setupEventListeners();
  updateGrid();

  // Set default telemetry selection (Munambam harbor)
  const munambamPort = FISHING_HARBORS.find(h => h.id === 'munambam');
  if (munambamPort) {
    const defaultCell = {
      lat: munambamPort.lat,
      lng: munambamPort.lng,
      isLand: false,
      isDeepOcean: false,
      sst: 28.1,
      chlorophyll: 1.8,
      currentSpeed: 0.5,
      currentDir: 180,
      fishingScore: 82,
      conservationScore: 35,
      minDistanceToCoast: 12,
      sensitivityReasons: ['Estuary nutrient zone'],
      favorabilityReasons: ['Optimal temperature', 'Strong food index']
    };
    updateTelemetryCard(defaultCell);
  }

  // Populate floating HTML legend
  updateMapLegend();

  // Expose global variables to window for easy debugging and evaluation
  window.map = map;
  window.gridData = gridData;
  window.selectedCell = selectedCell;
  window.liveData = liveData;
  window.calculateOptimizedRoute = calculateOptimizedRoute;
  window.FISHING_HARBORS = FISHING_HARBORS;

  showToast("Matsya Drishti workspace initialized. Native Leaflet layers active.");

  // Initialize default time mode to Real-Time
  currentTimeMode = 'simulation';
  switchTimeMode('realtime');
  
  // Initialize Samudra AI Voice Assistant
  initSamudra();

  // ─── Periodic State Sync to Backend for AI Voice Calls ───
  // Push live dashboard state to server.js every 5 seconds
  // so the Vapi AI agent can reference real map data during phone calls.
  setInterval(() => {
    try {
      const state = getThalassaState();
      // Only send a compact subset to avoid huge payloads
      const payload = {
        selectedCell: state.selectedCell ? {
          lat: state.selectedCell.lat,
          lng: state.selectedCell.lng,
          sst: state.selectedCell.sst,
          chl: state.selectedCell.chl,
          waveHeight: state.selectedCell.waveHeight,
          windSpeed: state.selectedCell.windSpeed,
          fishingScore: state.selectedCell.fishingScore,
          conservationScore: state.selectedCell.conservationScore,
          minDistanceToCoast: state.selectedCell.minDistanceToCoast,
          favorabilityReasons: state.selectedCell.favorabilityReasons,
          sensitivityReasons: state.selectedCell.sensitivityReasons,
          isMPA: state.selectedCell.isMPA,
          spawningBanActive: state.selectedCell.spawningBanActive
        } : null,
        selectedPort: state.selectedPort,
        selectedSpecies: state.selectedSpecies,
        currentMode: state.currentMode,
        dayOfYear: state.dayOfYear,
        weatherCache: state.weatherCache,
        optimizedRoute: state.optimizedRoute ? {
          distanceKM: state.optimizedRoute.distanceKM,
          stdDistanceKM: state.optimizedRoute.stdDistanceKM,
          cutsSpawningBan: state.optimizedRoute.cutsSpawningBan
        } : null
      };
      fetch('https://thalassa-pdcq.onrender.com/api/sync-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => {}); // Silent fail if server not running
    } catch (e) {
      // Ignore sync errors
    }
  }, 5000);

  // Start the animation frame loop
  requestAnimationFrame(tick);
}

// Tick loop for real-time visual pulses and vessel transit animation
function tick() {
  pulseState = (pulseState + 0.05) % (2 * Math.PI);
  
  if (isTransiting && optimizedRoute) {
    vesselProgress += 0.005; // speed of transit animation
    if (vesselProgress >= 1.0) {
      vesselProgress = 1.0;
      isTransiting = false;
      showToast("Transit simulation completed.", "green");
    }
    
    // Animate Eco-route vessel
    if (optimizedRoute.path && optimizedRoute.path.length > 0) {
      const vPos = getPositionAlongPath(optimizedRoute.path, vesselProgress);
      if (vPos) {
        if (!map.hasLayer(vesselMarker)) vesselMarker.addTo(map);
        vesselMarker.setLatLng([vPos.lat, vPos.lng]);
      }
    }
    
    // Animate Standard route vessel
    if (optimizedRoute.stdPath && optimizedRoute.stdPath.length > 0) {
      const vPosStd = getPositionAlongPath(optimizedRoute.stdPath, vesselProgress);
      if (vPosStd) {
        if (!map.hasLayer(vesselMarkerStd)) vesselMarkerStd.addTo(map);
        vesselMarkerStd.setLatLng([vPosStd.lat, vPosStd.lng]);
        
        // Check for Spawning Ban crossing in real-time
        let nearestCell = null;
        let minD = Infinity;
        for (const cell of gridData) {
          const d = getDistanceKM(vPosStd.lat, vPosStd.lng, cell.lat, cell.lng);
          if (d < minD) {
            minD = d;
            nearestCell = cell;
          }
        }
        if (nearestCell && nearestCell.isRestrictedZone && minD < 10) {
          showViolationAlert(nearestCell);
        }
      }
    }
  } else if (optimizedRoute && vesselMarker && map.hasLayer(vesselMarker)) {
    vesselProgress = (vesselProgress + 0.002) % 1.0;
    
    // Animate vessel coordinates along route path
    const vPos = getPositionAlongPath(optimizedRoute.path, vesselProgress);
    if (vPos) {
      vesselMarker.setLatLng([vPos.lat, vPos.lng]);
    }
    if (map.hasLayer(vesselMarkerStd)) map.removeLayer(vesselMarkerStd);
  }
  
  // Pulse selected port marker size
  if (map && portsLayerGroup) {
    portsLayerGroup.eachLayer(layer => {
      const latlng = layer.getLatLng();
      const port = FISHING_HARBORS.find(h => h.lat === latlng.lat && h.lng === latlng.lng);
      if (port && port.id === selectedPort) {
        layer.setRadius(5 + 3 * Math.sin(pulseState));
      }
    });
  }

  // Pulse conservation zones opacity
  if (map && conservationLayerGroup && activeOverlays.mpa) {
    const opacityScale = 0.5 + 0.2 * Math.sin(pulseState);
    conservationLayerGroup.eachLayer(layer => {
      layer.setStyle({
        opacity: opacityScale
      });
    });
  }

  requestAnimationFrame(tick);
}

// Initialize lat/lng coordinate lines and ticks in Leaflet
function initGridLines() {
  gridLinesLayerGroup.clearLayers();
  
  // Latitude grid lines
  for (let lat = 8.5; lat < 12.8; lat += 1.0) {
    const line = L.polyline([[lat, LNG_MIN], [lat, LNG_MAX]], {
      color: 'rgba(0, 0, 0, 0.04)',
      weight: 1,
      interactive: false
    });
    line.addTo(gridLinesLayerGroup);
    
    // Add grid axis label
    const labelMarker = L.marker([lat, LNG_MIN + 0.05], {
      icon: L.divIcon({
        className: 'grid-axis-label',
        html: `<span style="font-family: var(--font-mono); font-size: 8px; color: rgba(23, 23, 28, 0.4);">${lat.toFixed(1)}°N</span>`,
        iconSize: [40, 10],
        iconAnchor: [0, 5]
      }),
      interactive: false
    });
    labelMarker.addTo(gridLinesLayerGroup);
  }

  // Longitude grid lines
  for (let lng = 75.0; lng < 77.5; lng += 1.0) {
    const line = L.polyline([[LAT_MIN, lng], [LAT_MAX, lng]], {
      color: 'rgba(0, 0, 0, 0.04)',
      weight: 1,
      interactive: false
    });
    line.addTo(gridLinesLayerGroup);
    
    const labelMarker = L.marker([LAT_MIN + 0.05, lng], {
      icon: L.divIcon({
        className: 'grid-axis-label',
        html: `<span style="font-family: var(--font-mono); font-size: 8px; color: rgba(23, 23, 28, 0.4);">${lng.toFixed(1)}°E</span>`,
        iconSize: [40, 10],
        iconAnchor: [20, 0]
      }),
      interactive: false
    });
    labelMarker.addTo(gridLinesLayerGroup);
  }
}

// Regenerate grid matrices based on state
function updateGrid() {
  gridData = generateDigitalTwinGrid(dayOfYear, liveData);
  
  // Apply weather intensity multiplier to current speeds
  if (typeof weatherIntensity !== 'undefined' && weatherIntensity > 1.0) {
    gridData.forEach(cell => {
      if (!cell.isLand) {
        cell.currentSpeed = parseFloat((cell.currentSpeed * weatherIntensity).toFixed(2));
      }
    });
  }
  
  // Link gridData cell items to their respective layer shapes
  gridData.forEach(cell => {
    cell.rectLayer = cellLayers[cell.row][cell.col];
  });

  // Re-style grid cells and vector layers on Leaflet
  updateMapLayers();

  // Recalculate route if destination exists
  if (selectedCell) {
    const newCell = gridData.find(c => c.row === selectedCell.row && c.col === selectedCell.col);
    if (newCell) {
      selectedCell = newCell;
      optimizedRoute = calculateOptimizedRoute(selectedPort, selectedCell, gridData, dayOfYear);
      updateTelemetryCard(selectedCell);

      if (!optimizedRoute || !optimizedRoute.path) {
        if (map.hasLayer(routePolyline)) map.removeLayer(routePolyline);
        if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
        if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
        if (map.hasLayer(vesselMarker)) map.removeLayer(vesselMarker);
      } else {
        const pathCoords = optimizedRoute.path.map(pt => [pt.lat, pt.lng]);
        routePolyline.setLatLngs(pathCoords);
        if (!map.hasLayer(routePolyline)) {
          routePolyline.addTo(map);
        }
        
        const stdPathCoords = (optimizedRoute.stdPath || []).map(pt => [pt.lat, pt.lng]);
        stdRoutePolyline.setLatLngs(stdPathCoords);
        if (!map.hasLayer(stdRoutePolyline)) {
          stdRoutePolyline.addTo(map);
        }

        if (!map.hasLayer(vesselMarker)) {
          vesselMarker.addTo(map);
        }
      }
    }
  } else {
    if (map.hasLayer(routePolyline)) map.removeLayer(routePolyline);
        if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
    if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
    if (map.hasLayer(vesselMarker)) map.removeLayer(vesselMarker);
  }

  updateSidebarLists();
  updateFishClusters();
}

// Redraw styles of native Leaflet vectors
function updateMapLayers() {
  const currentMonth = Math.floor((dayOfYear / 365) * 12) + 1;

  // 1. Update Grid Cells
  gridData.forEach(cell => {
    const rect = cell.rectLayer;
    if (!rect) return;

    if (cell.isLand) {
      rect.setStyle({
        fillColor: 'rgba(0, 0, 0, 0)',
        fillOpacity: 0,
        color: 'rgba(0,0,0,0)',
        weight: 0
      });
      return;
    }

    let fillColor = 'rgba(0, 0, 0, 0)';
    let fillOpacity = 0;

    if (currentMode === 'fisherman') {
      if (activeOverlays.sst && !activeOverlays.chl) {
        // Temperature overlay: Warm orange/red shading
        const alpha = Math.max(0.1, Math.min(1.0, (cell.sst - 25) / 6.0));
        fillColor = '#ff7759'; // Coral orange
        fillOpacity = alpha * 0.6;
      } else if (activeOverlays.chl && !activeOverlays.sst) {
        // Chlorophyll/plankton food overlay: Dark green shading for visibility
        const alpha = Math.min(1.0, Math.max(0.1, cell.chlorophyll / 5.0));
        fillColor = '#005c47'; // Rich dark green
        fillOpacity = alpha * 0.65;
      } else if (activeOverlays.sst && activeOverlays.chl) {
        // Combined Fishing Favorability: Deep rich emerald green hotspots
        fillColor = '#004d3d'; // Deep green
        fillOpacity = (cell.fishingScore / 100) * 0.75;
      }
    } else {
      if (activeOverlays.mpa && cell.conservationScore > 30) {
        const alpha = Math.max(0.2, cell.conservationScore / 100);
        fillColor = cell.isRestrictedZone ? '#ff7759' : '#ffad9b';
        fillOpacity = cell.isRestrictedZone ? alpha * 0.6 : alpha * 0.35;
      }
    }

    rect.setStyle({
      fillColor: fillColor,
      fillOpacity: fillOpacity,
      color: fillColor !== 'rgba(0,0,0,0)' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0,0,0,0)',
      weight: fillColor !== 'rgba(0,0,0,0)' ? 0.5 : 0
    });
  });

  // 2. Update Conservation Zones
  conservationLayerGroup.clearLayers();
  if (activeOverlays.mpa) {
    CONSERVATION_ZONES.forEach(zone => {
      const latLngs = zone.polygon.map(pt => [pt.lat, pt.lng]);
      const isActiveBan = zone.restrictedMonths.includes(currentMonth);
      const color = zone.severityLevel === 'high' ? '#ff5436' : '#ff866a';
      
      const poly = L.polygon(latLngs, {
        color: color,
        weight: 1.5,
        dashArray: '4, 4',
        fillColor: color,
        fillOpacity: isActiveBan ? 0.25 : 0.08,
        interactive: true
      });
      
      poly.bindTooltip(`<strong>${zone.name}</strong><br>${zone.description}`, { sticky: true });
      poly.addTo(conservationLayerGroup);
    });
  }

  // 3. Update Harbors/Ports
  portsLayerGroup.clearLayers();
  FISHING_HARBORS.forEach(port => {
    const isSelected = port.id === selectedPort;
    const color = isSelected ? 'var(--primary-color)' : 'var(--ink)';
    
    const marker = L.circleMarker([port.lat, port.lng], {
      radius: isSelected ? 8 : 5,
      color: '#ffffff',
      weight: 1.5,
      fillColor: color,
      fillOpacity: 1,
      interactive: true
    });

    marker.bindTooltip(`<strong>${port.name}</strong><br>District: ${port.district}<br>Active Vessels: ${port.activeVessels}`, { sticky: true });
    
    marker.on('click', () => {
      const selectEl = document.getElementById('port-selector');
      selectEl.value = port.id;
      selectedPort = port.id;
      if (selectedCell) {
        optimizedRoute = calculateOptimizedRoute(selectedPort, selectedCell, gridData, dayOfYear);
        if (!optimizedRoute || !optimizedRoute.path) {
          showToast("No route found.", "red");
          document.getElementById('route-section').style.display = 'none';
          if (map.hasLayer(routePolyline)) map.removeLayer(routePolyline);
        if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
          if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
          if (map.hasLayer(vesselMarker)) map.removeLayer(vesselMarker);
        } else {
          updateRouteTelemetry();
        }
      }
      updateGrid();
    });

    marker.addTo(portsLayerGroup);
  });

  // 4. Update Currents Vectors
  currentsLayerGroup.clearLayers();
  if (activeOverlays.currents) {
    gridData.forEach(cell => {
      if (cell.isLand) return;
      
      const start = [cell.lat, cell.lng];
      
      // Calculate end point of current vector based on speed and dir
      const scale = 0.05 * cell.currentSpeed;
      const angleRad = (cell.currentDir * Math.PI) / 180;
      const end = [
        cell.lat - Math.cos(angleRad) * scale,
        cell.lng + Math.sin(angleRad) * scale
      ];
      
      const line = L.polyline([start, end], {
        color: 'rgba(24, 99, 220, 0.45)',
        weight: 1.2,
        interactive: false
      });
      line.addTo(currentsLayerGroup);
      
      // Draw arrowhead by adding short lines
      const headlen = scale * 0.25;
      const leftArrow = [
        end[0] + Math.cos(angleRad - Math.PI / 6) * headlen,
        end[1] - Math.sin(angleRad - Math.PI / 6) * headlen
      ];
      const rightArrow = [
        end[0] + Math.cos(angleRad + Math.PI / 6) * headlen,
        end[1] - Math.sin(angleRad + Math.PI / 6) * headlen
      ];
      
      L.polyline([end, leftArrow], { color: 'rgba(24, 99, 220, 0.45)', weight: 1.2 }).addTo(currentsLayerGroup);
      L.polyline([end, rightArrow], { color: 'rgba(24, 99, 220, 0.45)', weight: 1.2 }).addTo(currentsLayerGroup);
    });
  }
}

// Setup Interaction Listeners
function setupEventListeners() {
  // Time mode switch
  document.getElementById('time-mode-realtime').addEventListener('click', () => {
    switchTimeMode('realtime');
  });
  document.getElementById('time-mode-simulation').addEventListener('click', () => {
    switchTimeMode('simulation');
  });

  // Mode toggles
  document.getElementById('mode-fisherman').addEventListener('click', () => {
    switchPerspective('fisherman');
  });
  document.getElementById('mode-conservationist').addEventListener('click', () => {
    switchPerspective('conservationist');
  });

  // Layer badges
  setupLayerToggle('layer-sst', 'sst');
  setupLayerToggle('layer-chl', 'chl');
  setupLayerToggle('layer-currents', 'currents');
  setupLayerToggle('layer-mpa', 'mpa');

  // Port selector
  const portSelect = document.getElementById('port-selector');
  portSelect.addEventListener('change', (e) => {
    selectedPort = e.target.value;
    if (selectedCell) {
      optimizedRoute = calculateOptimizedRoute(selectedPort, selectedCell, gridData, dayOfYear);
      if (!optimizedRoute || !optimizedRoute.path) {
        showToast("No route found.", "red");
        document.getElementById('route-section').style.display = 'none';
        if (map.hasLayer(routePolyline)) map.removeLayer(routePolyline);
        if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
        if (map.hasLayer(vesselMarker)) map.removeLayer(vesselMarker);
      } else {
        updateRouteTelemetry();
      }
    }
    updateGrid();
  });

  const speciesSelect = document.getElementById('species-selector');
  if (speciesSelect) {
    speciesSelect.addEventListener('change', () => {
      if (optimizedRoute) {
        updateRouteTelemetry();
      }
    });
  }

  // Timeline slider
  const slider = document.getElementById('timeline-slider');
  slider.addEventListener('input', (e) => {
    dayOfYear = parseInt(e.target.value);
    updateTimelineLabel();
    updateGrid();
  });

  // Play Pause animation control
  document.getElementById('btn-play-pause').addEventListener('click', togglePlay);

  // Weather slider control
  const weatherSlider = document.getElementById('weather-intensity-slider');
  if (weatherSlider) {
    weatherSlider.addEventListener('input', (e) => {
      weatherIntensity = parseFloat(e.target.value);
      document.getElementById('weather-val').textContent = `${weatherIntensity.toFixed(1)}x`;
      updateGrid();
    });
  }

  // Simulate transit button control
  const simTransitBtn = document.getElementById('btn-simulate-transit');
  if (simTransitBtn) {
    simTransitBtn.addEventListener('click', () => {
      if (!optimizedRoute) {
        showToast("Please select a target grid cell on the map first to generate a route.", "orange");
        return;
      }
      isTransiting = true;
      vesselProgress = 0;
      showToast("Starting route transit simulation...", "blue");
    });
  }

  // Live API Fetch trigger
  document.getElementById('btn-fetch-live').addEventListener('click', triggerLiveApiFetch);

  // Global SOS Button trigger
  const btnGlobalSos = document.getElementById('btn-global-sos');
  if (btnGlobalSos) {
    btnGlobalSos.addEventListener('click', async () => {
      const phoneInput = "+918793791750";
      
      const originalText = btnGlobalSos.textContent;
      btnGlobalSos.textContent = "DIALING...";
      btnGlobalSos.disabled = true;
      
      try {
        const res = await fetch('https://thalassa-pdcq.onrender.com/api/outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phoneInput })
        });
        
        const data = await res.json();
        if (data.success) {
          showToast("🚨 SOS Call connected! AI is warning the fisherman.", "green");
        } else {
          showToast("SOS Call failed: " + (data.error || 'Unknown error'), "red");
        }
      } catch (err) {
        showToast("Could not reach backend server. Make sure server.js is running.", "red");
      } finally {
        setTimeout(() => {
          btnGlobalSos.disabled = false;
          btnGlobalSos.textContent = originalText;
        }, 5000);
      }
    });
  }

  // Vapi Outbound Call trigger
  const btnOutbound = document.getElementById('btn-outbound-call');
  if (btnOutbound) {
    btnOutbound.addEventListener('click', async () => {
      const phoneInput = document.getElementById('outbound-phone-input').value;
      const statusDiv = document.getElementById('outbound-call-status');
      if (!phoneInput) {
        showToast("Please enter a valid phone number.", "red");
        return;
      }
      
      btnOutbound.disabled = true;
      statusDiv.style.display = 'block';
      statusDiv.textContent = 'Initiating call...';
      
      try {
        const res = await fetch('https://thalassa-pdcq.onrender.com/api/outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phoneInput })
        });
        
        const data = await res.json();
        if (data.success) {
          statusDiv.style.color = 'var(--primary-color)';
          statusDiv.textContent = 'Call connected! Fisherman phone is ringing.';
          showToast("Outbound call successful.", "green");
        } else {
          statusDiv.style.color = 'var(--error)';
          statusDiv.textContent = 'Call failed. Check server logs.';
          showToast("Outbound call failed: " + (data.error || 'Unknown error'), "red");
        }
      } catch (err) {
        statusDiv.style.color = 'var(--error)';
        statusDiv.textContent = 'Server unreachable. Is server.js running?';
        showToast("Could not reach backend server.", "red");
      } finally {
        setTimeout(() => {
          btnOutbound.disabled = false;
          statusDiv.style.display = 'none';
        }, 5000);
      }
    });
  }

  // Preset Scenario selectors
  document.getElementById('preset-monsoon').addEventListener('click', () => {
    applyPresetScenario('monsoon');
  });
  document.getElementById('preset-winter').addEventListener('click', () => {
    applyPresetScenario('winter');
  });
  document.getElementById('preset-live').addEventListener('click', () => {
    applyPresetScenario('live');
  });
  document.getElementById('preset-heatwave').addEventListener('click', () => {
    applyPresetScenario('heatwave');
  });

  // Guided Map Tour buttons
  document.getElementById('btn-start-tour').addEventListener('click', startTour);
  document.getElementById('tour-close-btn').addEventListener('click', endTour);
  document.getElementById('tour-next-btn').addEventListener('click', nextTourStep);
  document.getElementById('tour-prev-btn').addEventListener('click', prevTourStep);

  // Leaflet Map events
  map.on('mousemove', handleMapMouseMove);
  map.on('click', handleMapClick);

  map.on('mouseout', () => {
    hoveredCell = null;
    lastHoveredCell = null;
    if (map.hasLayer(hoverOutline)) {
      map.removeLayer(hoverOutline);
    }
  });

  window.addEventListener('resize', () => {
    if (map) {
      map.invalidateSize();
    }
  });
}

// Apply Scenario Preset configurations
function applyPresetScenario(type) {
  document.getElementById('preset-monsoon').classList.remove('active');
  document.getElementById('preset-winter').classList.remove('active');
  document.getElementById('preset-live').classList.remove('active');
  
  if (type === 'monsoon') {
    document.getElementById('preset-monsoon').classList.add('active');
    dayOfYear = 200; // July
    document.getElementById('timeline-slider').value = dayOfYear;
    updateTimelineLabel();
    
    // Switch to Fisherman Dashboard
    switchPerspective('fisherman');
    
    // Enable SST + Chlorophyll Overlays
    activeOverlays.sst = true;
    activeOverlays.chl = true;
    activeOverlays.currents = false;
    activeOverlays.mpa = true;
    
    document.getElementById('layer-sst').classList.add('active');
    document.getElementById('layer-chl').classList.add('active');
    document.getElementById('layer-currents').classList.remove('active');
    document.getElementById('layer-mpa').classList.add('active');

    // Pan map to Kochi region
    map.setView([10.0, 76.0], 9);
    
    showToast("Scenario: July Monsoon Upwelling. Plankton blooms visible.", "green");
  } else if (type === 'winter') {
    document.getElementById('preset-winter').classList.add('active');
    dayOfYear = 350; // December
    document.getElementById('timeline-slider').value = dayOfYear;
    updateTimelineLabel();
    
    // Switch to Conservation Dashboard
    switchPerspective('conservationist');
    
    // Enable MPA only
    activeOverlays.sst = false;
    activeOverlays.chl = false;
    activeOverlays.currents = false;
    activeOverlays.mpa = true;
    
    document.getElementById('layer-sst').classList.remove('active');
    document.getElementById('layer-chl').classList.remove('active');
    document.getElementById('layer-currents').classList.remove('active');
    document.getElementById('layer-mpa').classList.add('active');

    // Pan map to Kadalundi turtle nesting zone (Kozhikode region)
    map.setView([11.15, 75.8], 9);
    
    showToast("Scenario: December Winter Spawning. Olive Ridley nesting protection active.", "green");
  } else if (type === 'heatwave') {
    document.getElementById('preset-heatwave').classList.add('active');
    dayOfYear = 140; // Mid May
    document.getElementById('timeline-slider').value = dayOfYear;
    updateTimelineLabel();
    
    // Switch to Conservation Dashboard
    switchPerspective('conservationist');
    
    // Enable SST overlay to see heatwave
    activeOverlays.sst = true;
    activeOverlays.chl = false;
    activeOverlays.currents = false;
    activeOverlays.mpa = true;
    
    document.getElementById('layer-sst').classList.add('active');
    document.getElementById('layer-chl').classList.remove('active');
    document.getElementById('layer-currents').classList.remove('active');
    document.getElementById('layer-mpa').classList.add('active');
    
    // Inject heatwave anomalies into grid
    gridData.forEach(cell => {
      if (!cell.isLand) {
        cell.sst = 31.5 + Math.random() * 1.5; // Extreme heat
        cell.chlorophyll = 0.1; // Hypoxia / low productivity
        cell.conservationScore = Math.min(100, cell.conservationScore + 40); // Stress
        cell.fishingScore = Math.max(0, cell.fishingScore - 60);
      }
    });

    map.setView([9.5, 76.2], 8);
    updateMapLayers();
    showToast("Scenario: Heatwave & Hypoxia Shock applied. Marine life under severe stress.", "orange");
  } else if (type === 'live') {
    document.getElementById('preset-live').classList.add('active');
    triggerLiveApiFetch();
  }
}

// Guided Map Tour State Machine
function startTour() {
  tourActive = true;
  tourStep = 0;
  document.getElementById('tour-card').style.display = 'flex';
  showTourStep();
  showToast("Guided tour started. Follow the highlighted panels.");
}

function endTour() {
  tourActive = false;
  document.getElementById('tour-card').style.display = 'none';
  
  // Clear highlights
  tourSteps.forEach(step => {
    const el = document.getElementById(step.highlightId);
    if (el) el.classList.remove('tour-highlight');
  });
  
  showToast("Guided tour completed.");
}

function showTourStep() {
  if (tourStep < 0 || tourStep >= tourSteps.length) {
    endTour();
    return;
  }
  
  const step = tourSteps[tourStep];
  
  // Update Tour Card text content
  document.getElementById('tour-step-label').textContent = `GUIDED TOUR: STEP ${tourStep + 1}/${tourSteps.length}`;
  document.getElementById('tour-title').textContent = step.title;
  document.getElementById('tour-description').textContent = step.desc;
  
  // Set button text states
  document.getElementById('tour-prev-btn').disabled = (tourStep === 0);
  document.getElementById('tour-next-btn').textContent = (tourStep === tourSteps.length - 1) ? "Finish" : "Next";
  
  // Manage CSS highlight classes
  tourSteps.forEach((s, idx) => {
    const el = document.getElementById(s.highlightId);
    if (el) {
      if (idx === tourStep) {
        el.classList.add('tour-highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        el.classList.remove('tour-highlight');
      }
    }
  });

  // Reposition Tour Overlay relative to target panel
  const targetEl = document.getElementById(step.highlightId);
  const tourCard = document.getElementById('tour-card');
  if (targetEl && tourCard) {
    const rect = targetEl.getBoundingClientRect();
    
    if (step.position === 'bottom') {
      tourCard.style.top = `${rect.bottom + window.scrollY + 12}px`;
      tourCard.style.left = `${rect.left + window.scrollX}px`;
      tourCard.style.bottom = 'auto';
      tourCard.style.right = 'auto';
    } else if (step.position === 'top') {
      tourCard.style.top = 'auto';
      tourCard.style.bottom = `${window.innerHeight - rect.top + 12}px`;
      tourCard.style.left = `${rect.left + window.scrollX}px`;
      tourCard.style.right = 'auto';
    } else if (step.position === 'left') {
      tourCard.style.top = `${rect.top + window.scrollY}px`;
      tourCard.style.left = 'auto';
      tourCard.style.right = `${window.innerWidth - rect.left + 12}px`;
      tourCard.style.bottom = 'auto';
    } else {
      tourCard.style.bottom = '80px';
      tourCard.style.left = '40px';
      tourCard.style.top = 'auto';
      tourCard.style.right = 'auto';
    }
  }
}

function nextTourStep() {
  tourStep++;
  if (tourStep >= tourSteps.length) {
    endTour();
  } else {
    showTourStep();
  }
}

function prevTourStep() {
  tourStep--;
  showTourStep();
}

// Toggle play timeline animation
function togglePlay() {
  const btn = document.getElementById('btn-play-pause');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const slider = document.getElementById('timeline-slider');

  if (isPlaying) {
    clearInterval(playInterval);
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    isPlaying = false;
    showToast("Animation paused.");
  } else {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    isPlaying = true;
    showToast("Animating timeline simulation...");
    
    playInterval = setInterval(() => {
      dayOfYear = (dayOfYear % 365) + 1;
      slider.value = dayOfYear;
      updateTimelineLabel();
      updateGrid();
    }, 100);
  }
}

// Update date label format
function updateTimelineLabel() {
  const label = document.getElementById('timeline-date-label');
  const date = dayOfYearToDate(dayOfYear);
  label.textContent = `${date} (Day ${dayOfYear})`;
}

// Approximate day of year to calendar date
function dayOfYearToDate(day) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  
  let temp = day;
  let mIndex = 0;
  
  while (temp > daysInMonth[mIndex]) {
    temp -= daysInMonth[mIndex];
    mIndex++;
    if (mIndex >= 12) break;
  }
  
  return `${months[mIndex]} ${Math.max(1, temp)}`;
}

// Helper to configure button visual states for map overlays
function setupLayerToggle(elementId, key) {
  const btn = document.getElementById(elementId);
  btn.addEventListener('click', () => {
    activeOverlays[key] = !activeOverlays[key];
    if (activeOverlays[key]) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    updateGrid();
    updateMapLegend();
  });
}

// // Global variables for mouse tracking
let lastHoveredCell = null;

// Handle map hover for telemetry updates
function handleMapMouseMove(e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;

  const cell = gridData.find(cell => {
    const latStep = (LAT_MAX - LAT_MIN) / 40;
    const lngStep = (LNG_MAX - LNG_MIN) / 30;
    return Math.abs(cell.lat - lat) <= (latStep / 2) && Math.abs(cell.lng - lng) <= (lngStep / 2);
  });

  if (cell !== lastHoveredCell) {
    lastHoveredCell = cell;
    hoveredCell = cell;
    if (cell) {
      updateTelemetryCard(cell);

      // Update hover outline rectangle bounds
      const latStep = (LAT_MAX - LAT_MIN) / 40;
      const lngStep = (LNG_MAX - LNG_MIN) / 30;
      const bounds = [
        [cell.lat - latStep/2, cell.lng - lngStep/2],
        [cell.lat + latStep/2, cell.lng + lngStep/2]
      ];
      hoverOutline.setBounds(bounds);
      if (!map.hasLayer(hoverOutline)) {
        hoverOutline.addTo(map);
      }

      if (!cell.isLand) {
        const cacheKey = `${cell.lat.toFixed(1)}_${cell.lng.toFixed(1)}`;
        if (!openMeteoCache.has(cacheKey)) {
          fetchAndCacheForecast(cell.lat, cell.lng, cacheKey);
        }
      }
    } else {
      if (map.hasLayer(hoverOutline)) {
        map.removeLayer(hoverOutline);
      }
    }
  }
};

// Map Selection interaction
function handleMapClick(e) {
  const lat = e.latlng.lat;
  const lng = e.latlng.lng;
  
  const cell = gridData.find(cell => {
    const latStep = (LAT_MAX - LAT_MIN) / 40;
    const lngStep = (LNG_MAX - LNG_MIN) / 30;
    return Math.abs(cell.lat - lat) <= (latStep / 2) && Math.abs(cell.lng - lng) <= (lngStep / 2);
  });

  if (cell) {
    if (cell.isLand) return; // Skip land clicks
    
    selectedCell = cell;
    optimizedRoute = calculateOptimizedRoute(selectedPort, selectedCell, gridData, dayOfYear);
    vesselProgress = 0; // Reset transit animation
    
    if (!optimizedRoute || !optimizedRoute.path) {
      showToast("No route found to this location.", "red");
      document.getElementById('route-section').style.display = 'none';
      if (map.hasLayer(routePolyline)) map.removeLayer(routePolyline);
        if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
      if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
      if (map.hasLayer(vesselMarker)) map.removeLayer(vesselMarker);
    } else {
      document.getElementById('route-section').style.display = 'block';
      updateRouteTelemetry();
      
      // Update selected outline bounds
      const latStep = (LAT_MAX - LAT_MIN) / 40;
      const lngStep = (LNG_MAX - LNG_MIN) / 30;
      const bounds = [
        [cell.lat - latStep/2, cell.lng - lngStep/2],
        [cell.lat + latStep/2, cell.lng + lngStep/2]
      ];
      selectedOutline.setBounds(bounds);
      if (!map.hasLayer(selectedOutline)) {
        selectedOutline.addTo(map);
      }

      // Set route coordinates
      const pathCoords = optimizedRoute.path.map(pt => [pt.lat, pt.lng]);
      routePolyline.setLatLngs(pathCoords);
      if (!map.hasLayer(routePolyline)) {
        routePolyline.addTo(map);
      }
      
      const stdPathCoords = (optimizedRoute.stdPath || []).map(pt => [pt.lat, pt.lng]);
      stdRoutePolyline.setLatLngs(stdPathCoords);
      if (!map.hasLayer(stdRoutePolyline)) {
        stdRoutePolyline.addTo(map);
      }
      
      if (!map.hasLayer(vesselMarker)) {
        vesselMarker.addTo(map);
      }
    }

    updateGrid();
    showToast(`Target coordinate locked at: ${cell.lat.toFixed(3)}°N, ${cell.lng.toFixed(3)}°E`);
  }
}

// Trigger real-time Live data fetch from INCOIS ERDDAP
async function triggerLiveApiFetch() {
  const btn = document.getElementById('btn-fetch-live');
  btn.disabled = true;
  btn.textContent = "Querying APIs...";
  showToast("Accessing INCOIS ERDDAP servers. Requesting latest chlorophyll and SST indices...");

  // Update timeline to today's date
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const todayDayOfYear = Math.floor(diff / oneDay);
  dayOfYear = todayDayOfYear;
  
  document.getElementById('timeline-slider').value = dayOfYear;
  updateTimelineLabel();

  try {
    const [sstApiData, chlApiData] = await Promise.all([
      fetchIncoisErddapData('sst').catch(() => null),
      fetchIncoisErddapData('chl').catch(() => null)
    ]);
    
    if (sstApiData || chlApiData) {
      liveData = {};
      if (sstApiData) {
        liveData.sst = sstApiData;
        showToast("Live ERDDAP SST dataset ingested successfully.", 'green');
        activeOverlays.sst = true;
        document.getElementById('layer-sst').classList.add('active');
      }
      if (chlApiData) {
        liveData.chlorophyll = chlApiData;
        showToast("Live ERDDAP Chlorophyll dataset ingested successfully.", 'green');
        activeOverlays.chl = true;
        document.getElementById('layer-chl').classList.add('active');
      }
    } else {
      showToast("Live servers uncontactable or blocked by CORS. Running local simulation for today.", 'orange');
    }
    
    updateGrid();
    
    // Update route calculation if a target cell is locked
    if (selectedCell) {
      optimizedRoute = calculateOptimizedRoute(selectedPort, selectedCell, gridData, dayOfYear);
      if (!optimizedRoute || !optimizedRoute.path) {
        showToast("No route found.", "red");
        document.getElementById('route-section').style.display = 'none';
        if (map.hasLayer(routePolyline)) map.removeLayer(routePolyline);
        if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
        if (map.hasLayer(vesselMarker)) map.removeLayer(vesselMarker);
      } else {
        document.getElementById('route-section').style.display = 'block';
        updateRouteTelemetry();
      }
    }
  } catch (err) {
    showToast("API synchronization error. Loaded offline simulator.", 'red');
  } finally {
    btn.disabled = false;
    btn.textContent = "Trigger Live API Fetch";
  }
}

// Handle switching Fisherman vs Conservation perspectives
function switchPerspective(mode) {
  currentMode = mode;
  
  const btnFish = document.getElementById('mode-fisherman');
  const btnCons = document.getElementById('mode-conservationist');
  const badge = document.getElementById('perspective-badge');
  const heading = document.getElementById('main-perspective-heading');
  const desc = document.getElementById('main-perspective-desc');
  const listTitle = document.getElementById('dynamic-list-title');

  if (mode === 'fisherman') {
    btnFish.classList.add('active');
    btnCons.classList.remove('active');
    badge.textContent = "FISHERMAN VIEW";
    badge.style.background = 'var(--pale-blue)';
    badge.style.color = 'var(--action-blue)';
    heading.textContent = "Optimized Fishing & Catch Advisories";
    desc.textContent = "Real-time oceanographic routing system prioritizing harvest yields based on sea surface temperature and primary productivity chlorophyll values.";
    listTitle.textContent = "HIGH YIELD FISHING ZONES";
  } else {
    btnFish.classList.remove('active');
    btnCons.classList.add('active');
    badge.textContent = "CONSERVATION VIEW";
    badge.style.background = 'var(--pale-green)';
    badge.style.color = 'var(--deep-green)';
    heading.textContent = "Marine Reserves & Spawning Warnings";
    desc.textContent = "Monitoring ecological stressors, spawning calendar bans, and historical overfishing indicators to preserve habitats and restrict sensitive zones.";
    listTitle.textContent = "CRITICAL HABITATS & ACTIVE RESTRICTIONS";
  }

  selectedCell = null;
  optimizedRoute = null;
  document.getElementById('route-section').style.display = 'none';

  if (map.hasLayer(selectedOutline)) map.removeLayer(selectedOutline);
  if (map.hasLayer(routePolyline)) map.removeLayer(routePolyline);
        if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
  if (map.hasLayer(vesselMarker)) map.removeLayer(vesselMarker);

  updateGrid();
  updateMapLegend();
  showToast(`Switched perspective: ${mode.toUpperCase()} mode.`);
}

// Handle switching Real-Time vs Simulation modes
function switchTimeMode(mode) {
  if (currentTimeMode === mode) return;
  currentTimeMode = mode;
  
  const rtBtn = document.getElementById('time-mode-realtime');
  const simBtn = document.getElementById('time-mode-simulation');
  const presetsBar = document.getElementById('presets-bar');
  const timelinePanel = document.getElementById('timeline-panel');
  const slider = document.getElementById('timeline-slider');
  
  if (!rtBtn || !simBtn || !presetsBar || !timelinePanel) return;
  
  if (mode === 'realtime') {
    rtBtn.classList.add('active');
    simBtn.classList.remove('active');
    
    // Hide presets & timeline
    presetsBar.style.display = 'none';
    timelinePanel.style.display = 'none';
    
    // Save last simulation day
    lastSimulationDay = parseInt(slider.value) || 175;
    
    // Compute current real day of year (July 20)
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now - start;
    const oneDay = 1000 * 60 * 60 * 24;
    dayOfYear = Math.floor(diff / oneDay);
    
    // Stop play animation if active
    if (isPlaying) {
      togglePlay();
    }
    
    showToast("Real-time live feed active.");
  } else {
    simBtn.classList.add('active');
    rtBtn.classList.remove('active');
    
    // Show presets & timeline
    presetsBar.style.display = 'block';
    timelinePanel.style.display = 'flex';
    
    // Restore last simulation day
    dayOfYear = lastSimulationDay;
    slider.value = dayOfYear;
    updateTimelineLabel();
    
    showToast("Simulation mode active.");
  }
  
  updateGrid();
  updateMapLegend();
}

// Update telemetry details panel
function updateTelemetryCard(cell) {
  document.getElementById('telemetry-coords').textContent = `${cell.lat.toFixed(3)}°N, ${cell.lng.toFixed(3)}°E`;
  document.getElementById('cell-type-badge').textContent = cell.isLand ? 'LAND' : (cell.isDeepOcean ? 'DEEP SEA' : 'SHELF');
  
  if (cell.isLand) {
    document.getElementById('telemetry-sst').textContent = '--';
    document.getElementById('telemetry-chl').textContent = '--';
    document.getElementById('telemetry-currents').textContent = '--';
    document.getElementById('telemetry-coast').textContent = '--';
    document.getElementById('telemetry-wind').textContent = '--';
    document.getElementById('telemetry-wave').textContent = '--';
    document.getElementById('score-favorability-label').textContent = '0%';
    document.getElementById('score-favorability-bar').style.width = '0%';
    document.getElementById('score-sensitivity-label').textContent = '0%';
    document.getElementById('score-sensitivity-bar').style.width = '0%';
    return;
  }

  document.getElementById('telemetry-sst').textContent = `${cell.sst.toFixed(1)} °C`;
  document.getElementById('telemetry-chl').textContent = `${cell.chlorophyll.toFixed(2)} mg/m³`;
  document.getElementById('telemetry-currents').textContent = `${cell.currentSpeed.toFixed(1)} m/s @ ${cell.currentDir}°`;
  document.getElementById('telemetry-coast').textContent = `${cell.minDistanceToCoast} km`;
  
  // Set wind and wave from cache if available, else show loading or fetch it
  const cacheKey = `${cell.lat.toFixed(1)}_${cell.lng.toFixed(1)}`;
  if (openMeteoCache.has(cacheKey)) {
    const forecast = openMeteoCache.get(cacheKey);
    displayForecastData(forecast);
  } else {
    document.getElementById('telemetry-wind').textContent = 'Fetching...';
    document.getElementById('telemetry-wave').textContent = 'Fetching...';
  }

  // Update scores
  document.getElementById('score-favorability-label').textContent = `${cell.fishingScore}%`;
  document.getElementById('score-favorability-bar').style.width = `${cell.fishingScore}%`;
  
  document.getElementById('score-sensitivity-label').textContent = `${cell.conservationScore}%`;
  document.getElementById('score-sensitivity-bar').style.width = `${cell.conservationScore}%`;

  // Draw mini historical line graph
  drawMiniTrendChart(cell);
}

function displayForecastData(forecast) {
  if (forecast && forecast.windSpeed !== null) {
    const wIntensity = typeof weatherIntensity !== 'undefined' ? weatherIntensity : 1.0;
    const scaledWind = parseFloat((forecast.windSpeed * wIntensity).toFixed(1));
    const scaledWave = parseFloat((forecast.waveHeight * wIntensity).toFixed(2));
    document.getElementById('telemetry-wind').textContent = `${scaledWind} ${forecast.windUnit} @ ${forecast.windDir}°`;
    document.getElementById('telemetry-wave').textContent = `${scaledWave} ${forecast.waveUnit} @ ${forecast.wavePeriod}s`;
    
    if (wIntensity > 1.0) {
      if (scaledWind > 20 || scaledWave > 1.5) {
        showToast(`⚠️ State Alert: Rough sea conditions (Wind: ${scaledWind} km/h, Wave: ${scaledWave}m)!`, "orange");
      }
    }
  } else {
    document.getElementById('telemetry-wind').textContent = '--';
    document.getElementById('telemetry-wave').textContent = '--';
  }
}

async function fetchAndCacheForecast(lat, lng, cacheKey) {
  try {
    const data = await fetchOpenMeteoForecast(lat, lng);
    if (data) {
      openMeteoCache.set(cacheKey, data);
      lastWeatherData = data; // Store for Samudra
      if (lastHoveredCell && `${lastHoveredCell.lat.toFixed(1)}_${lastHoveredCell.lng.toFixed(1)}` === cacheKey) {
        displayForecastData(data);
      }
    } else {
      if (lastHoveredCell && `${lastHoveredCell.lat.toFixed(1)}_${lastHoveredCell.lng.toFixed(1)}` === cacheKey) {
        document.getElementById('telemetry-wind').textContent = 'Error';
        document.getElementById('telemetry-wave').textContent = 'Error';
      }
    }
  } catch (err) {
    if (lastHoveredCell && `${lastHoveredCell.lat.toFixed(1)}_${lastHoveredCell.lng.toFixed(1)}` === cacheKey) {
      document.getElementById('telemetry-wind').textContent = 'Error';
      document.getElementById('telemetry-wave').textContent = 'Error';
    }
  }
}

// Draw mini historical sparkline for hovered grid coordinate (sidebar canvas)
function drawMiniTrendChart(cell) {
  const chartCanvas = document.getElementById('mini-trend-chart');
  if (!chartCanvas) return;
  const w = chartCanvas.width = chartCanvas.clientWidth;
  const h = chartCanvas.height = chartCanvas.clientHeight;
  const mctx = chartCanvas.getContext('2d');
  
  mctx.clearRect(0, 0, w, h);
  if (cell.isLand) return;

  // Generate 12 monthly points
  const sstValues = [];
  for (let m = 0; m < 12; m++) {
    const day = Math.round((m / 12) * 365) + 15;
    const seasonalSstDiff = 2.0 * Math.sin((day - 100) * (2 * Math.PI / 365));
    const coastalCooling = 0.5 * Math.sin(cell.minDistanceToCoast / 10);
    const sst = 27.5 + seasonalSstDiff - coastalCooling;
    sstValues.push(sst);
  }

  // Draw chart grids
  mctx.strokeStyle = '#eaece7';
  mctx.lineWidth = 1;
  mctx.beginPath();
  mctx.moveTo(0, h / 2);
  mctx.lineTo(w, h / 2);
  mctx.stroke();

  // Project points
  const minVal = 24.0;
  const maxVal = 32.0;
  const points = sstValues.map((val, idx) => {
    const x = (idx / 11) * w;
    const y = h - ((val - minVal) / (maxVal - minVal)) * h;
    return { x, y };
  });

  // Draw curve
  mctx.beginPath();
  mctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    mctx.lineTo(points[i].x, points[i].y);
  }
  mctx.strokeStyle = 'var(--action-blue)';
  mctx.lineWidth = 1.5;
  mctx.stroke();

  // Draw current active month marker
  const currentMonthIdx = Math.max(0, Math.min(11, Math.floor((dayOfYear / 365) * 12)));
  const activePt = points[currentMonthIdx];
  if (activePt) {
    mctx.beginPath();
    mctx.arc(activePt.x, activePt.y, 4, 0, 2 * Math.PI);
    mctx.fillStyle = 'var(--coral)';
    mctx.strokeStyle = 'white';
    mctx.lineWidth = 1.5;
    mctx.fill();
    mctx.stroke();

    // Text details
    mctx.fillStyle = 'var(--cohere-black)';
    mctx.font = '9px var(--font-mono)';
    mctx.fillText(`${sstValues[currentMonthIdx].toFixed(1)}°C`, activePt.x - 12, activePt.y - 8);
  }
}

function calculatePathFuelCost(path, gridData, fuelRatePerKm) {
  if (!path || path.length <= 1) return 0;
  let totalCost = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    const segmentDist = getDistanceKM(p1.lat, p1.lng, p2.lat, p2.lng);
    
    // Find nearest cell to p1
    let nearest = null;
    let minD = Infinity;
    for (const cell of gridData) {
      const d = getDistanceKM(p1.lat, p1.lng, cell.lat, cell.lng);
      if (d < minD) {
        minD = d;
        nearest = cell;
      }
    }
    
    let currentSpeed = 0.2;
    let currentDir = 180;
    if (nearest) {
      currentSpeed = nearest.currentSpeed !== undefined ? nearest.currentSpeed : 0.2;
      currentDir = nearest.currentDir !== undefined ? nearest.currentDir : 180;
    }
    
    const dLat = p2.lat - p1.lat;
    const dLng = p2.lng - p1.lng;
    const len = Math.hypot(dLat, dLng);
    
    let resistanceFactor = 1.0;
    if (len > 0 && currentSpeed > 0) {
      const vesselVector = { y: dLat / len, x: dLng / len };
      const currentRad = (currentDir * Math.PI) / 180;
      const currentVector = { y: Math.cos(currentRad) * currentSpeed, x: Math.sin(currentRad) * currentSpeed };
      
      const dot = vesselVector.x * currentVector.x + vesselVector.y * currentVector.y;
      // Head-current (dot < 0) increases fuel burn, tail-current (dot > 0) reduces it
      resistanceFactor = Math.max(0.7, Math.min(1.5, 1.0 - dot * 0.25));
    }
    
    totalCost += segmentDist * fuelRatePerKm * resistanceFactor;
  }
  return Math.round(totalCost);
}

// Update route text details with Standard vs Deflected Comparison
function updateRouteTelemetry() {
  if (!optimizedRoute) return;
  const title = document.getElementById('route-title');
  const activePort = FISHING_HARBORS.find(h => h.id === selectedPort);
  title.textContent = `${activePort.name.split(' ')[0]} to Target Grid`;

  // Financial Calculators
  const fuelRatePerKm = 80;
  const speciesSelect = document.getElementById('species-selector');
  const speciesVal = speciesSelect ? speciesSelect.value : 'sardine';
  let speciesMultiplier = 50;
  if (speciesVal === 'mackerel') speciesMultiplier = 80;
  if (speciesVal === 'shrimp') speciesMultiplier = 250;
  if (speciesVal === 'tuna') speciesMultiplier = 400;

  // Base expected catch volume (kg) modified by grid yield score
  const expectedCatchKg = (selectedCell.fishingScore / 100) * 800;

  // Std Route Finance
  const stdFuelCost = calculatePathFuelCost(optimizedRoute.stdPath, gridData, fuelRatePerKm);
  const stdCatchVal = Math.round(expectedCatchKg * speciesMultiplier);
  const stdFine = optimizedRoute.cutsSpawningBan ? 50000 : 0;
  const stdNetProfit = stdCatchVal - stdFuelCost - stdFine;

  // Opt Route Finance
  const optFuelCost = calculatePathFuelCost(optimizedRoute.path, gridData, fuelRatePerKm);
  const optCatchVal = Math.round(expectedCatchKg * speciesMultiplier);
  const optNetProfit = optCatchVal - optFuelCost;

  // Standard Route (Non-Compliant) Metrics
  document.getElementById('route-std-distance').textContent = `${optimizedRoute.stdDistanceKM} km`;
  document.getElementById('route-std-time').textContent = `${optimizedRoute.stdTimeHours} hrs`;
  document.getElementById('route-std-fuel').textContent = `${stdFuelCost.toLocaleString()} INR`;
  document.getElementById('route-std-catch').textContent = `${stdCatchVal.toLocaleString()} INR`;
  const stdProfitEl = document.getElementById('route-std-profit');
  stdProfitEl.textContent = `${stdNetProfit.toLocaleString()} INR`;
  stdProfitEl.style.color = stdNetProfit < 0 ? 'var(--error)' : 'var(--slate)';

  const stdStatus = document.getElementById('route-std-status');
  if (optimizedRoute.cutsSpawningBan) {
    stdStatus.textContent = "❌ Cuts Spawning Ban (Fine: 50,000 INR)";
    stdStatus.className = "comparison-status status-error";
  } else {
    stdStatus.textContent = "✅ Eco-Compliant";
    stdStatus.className = "comparison-status status-success";
  }

  // Matsya Drishti Route (Optimized Compliant) Metrics
  document.getElementById('route-opt-distance').textContent = `${optimizedRoute.distanceKM} km`;
  document.getElementById('route-opt-time').textContent = `${optimizedRoute.estTimeHours} hrs`;
  document.getElementById('route-opt-fuel').textContent = `${optFuelCost.toLocaleString()} INR`;
  document.getElementById('route-opt-catch').textContent = `${optCatchVal.toLocaleString()} INR`;
  const optProfitEl = document.getElementById('route-opt-profit');
  optProfitEl.textContent = `${optNetProfit.toLocaleString()} INR`;
  optProfitEl.style.color = optNetProfit < 0 ? 'var(--error)' : 'var(--action-blue)';
}

// Populate the sidebar list items dynamically
function updateSidebarLists() {
  const container = document.getElementById('dynamic-cards-list');
  container.innerHTML = '';

  if (currentMode === 'fisherman') {
    const topZones = gridData
      .filter(cell => !cell.isLand && !cell.isRestrictedZone)
      .sort((a, b) => b.fishingScore - a.fishingScore)
      .slice(0, 5);

    topZones.forEach((zone, idx) => {
      const card = document.createElement('div');
      card.className = 'info-card';
      card.style.cursor = 'pointer';
      
      const reasons = zone.favorabilityReasons.slice(0, 2).join(', ');
      
      card.innerHTML = `
        <div class="info-card-header">
          <span class="info-card-title">Zone #${idx + 1} (${zone.lat.toFixed(2)}°N, ${zone.lng.toFixed(2)}°E)</span>
          <span style="font-family: var(--font-mono); color: var(--action-blue); font-weight: 700;">${zone.fishingScore}% Yield</span>
        </div>
        <p class="caption" style="margin-top: 4px;">${reasons || 'Optimal biological conditions.'}</p>
      `;

      card.addEventListener('click', () => {
        selectedCell = zone;
        optimizedRoute = calculateOptimizedRoute(selectedPort, selectedCell, gridData, dayOfYear);
        vesselProgress = 0;
        
        if (!optimizedRoute || !optimizedRoute.path) {
          showToast("No route found to this location.", "red");
          document.getElementById('route-section').style.display = 'none';
          if (map.hasLayer(routePolyline)) map.removeLayer(routePolyline);
        if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
          if (map.hasLayer(vesselMarker)) map.removeLayer(vesselMarker);
        } else {
          document.getElementById('route-section').style.display = 'block';
          updateRouteTelemetry();
          updateTelemetryCard(zone);
          
          // Update selected outline bounds
          const latStep = (LAT_MAX - LAT_MIN) / 40;
          const lngStep = (LNG_MAX - LNG_MIN) / 30;
          const bounds = [
            [zone.lat - latStep/2, zone.lng - lngStep/2],
            [zone.lat + latStep/2, zone.lng + lngStep/2]
          ];
          selectedOutline.setBounds(bounds);
          if (!map.hasLayer(selectedOutline)) {
            selectedOutline.addTo(map);
          }

          // Set route coordinates
          const pathCoords = optimizedRoute.path.map(pt => [pt.lat, pt.lng]);
          routePolyline.setLatLngs(pathCoords);
          if (!map.hasLayer(routePolyline)) {
            routePolyline.addTo(map);
          }
          const stdPathCoords = (optimizedRoute.stdPath || []).map(pt => [pt.lat, pt.lng]);
          stdRoutePolyline.setLatLngs(stdPathCoords);
          if (!map.hasLayer(stdRoutePolyline)) {
            stdRoutePolyline.addTo(map);
          }
          if (!map.hasLayer(vesselMarker)) {
            vesselMarker.addTo(map);
          }
        }

        updateGrid();
        showToast(`Navigating to Zone #${idx + 1}`);
      });

      container.appendChild(card);
    });
  } else {
    const topSanctuaries = gridData
      .filter(cell => !cell.isLand && cell.conservationScore > 35)
      .sort((a, b) => b.conservationScore - a.conservationScore)
      .slice(0, 5);

    topSanctuaries.forEach((zone, idx) => {
      const card = document.createElement('div');
      card.className = 'info-card';
      card.style.cursor = 'pointer';
      
      const activeReason = zone.isRestrictedZone ? 'ACTIVE SPAWNING BAN' : 'Habitat Buffer';
      const detailText = zone.sensitivityReasons[0] || 'High risk ecological pressure.';

      card.innerHTML = `
        <div class="info-card-header">
          <span class="info-card-title">${zone.activeMPA ? zone.activeMPA.name : 'Sensitive Area'}</span>
          <span class="mono-label" style="color: ${zone.isRestrictedZone ? 'var(--coral)' : 'var(--slate)'}; font-weight: 600;">
            ${activeReason}
          </span>
        </div>
        <p class="caption" style="margin-top: 4px;">${detailText} | Sensitivity: <strong>${zone.conservationScore}%</strong></p>
      `;

      card.addEventListener('click', () => {
        selectedCell = zone;
        optimizedRoute = null;
        document.getElementById('route-section').style.display = 'none';
        updateTelemetryCard(zone);
        
        // Remove selection outlines and routes since it's a sanctuary inspection
        if (map.hasLayer(selectedOutline)) map.removeLayer(selectedOutline);
        if (map.hasLayer(routePolyline)) map.removeLayer(routePolyline);
        if (map.hasLayer(stdRoutePolyline)) map.removeLayer(stdRoutePolyline);
        if (map.hasLayer(vesselMarker)) map.removeLayer(vesselMarker);
        
        showToast(`Inspecting ecosystem bounds of: ${zone.activeMPA ? zone.activeMPA.name : 'Sensitive Cell'}`);
      });

      container.appendChild(card);
    });
  }
}

// Calculate position along path at fraction p (0-1)
function getPositionAlongPath(path, p) {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0];
  
  const totalSegments = path.length - 1;
  const rawIdx = p * totalSegments;
  const idx = Math.min(totalSegments - 1, Math.floor(rawIdx));
  const t = rawIdx - idx;
  
  const p1 = path[idx];
  const p2 = path[idx + 1];
  
  return {
    lat: p1.lat + (p2.lat - p1.lat) * t,
    lng: p1.lng + (p2.lng - p1.lng) * t
  };
}

// Toast alerts message manager
function showToast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let accentColor = 'white';
  if (type === 'green') accentColor = '#2e7d32';
  if (type === 'orange') accentColor = '#ef6c00';
  if (type === 'red') accentColor = '#c62828';

  toast.innerHTML = `
    <span class="status-dot" style="background: ${accentColor};"></span>
    <span style="font-family: var(--font-mono); font-size: 11px;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(100%) scale(0.9)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// Trigger initial build setup on window load
window.addEventListener('load', init);

// ═══════════════════════════════════════════════════════════════════════════
// SAMUDRA AI VOICE ASSISTANT — Integration
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns the current live state of the Thalassa app for Samudra to read.
 */
function getThalassaState() {
  const speciesSelect = document.getElementById('species-selector');
  const portSelect = document.getElementById('port-selector');

  // Find the latest weather data from the cache
  let weatherCache = lastWeatherData || null;
  if (!weatherCache) {
    // Try to get from openMeteoCache for current hovered/selected cell
    const refCell = selectedCell || hoveredCell;
    if (refCell) {
      const cacheKey = `${refCell.lat.toFixed(1)}_${refCell.lng.toFixed(1)}`;
      if (openMeteoCache.has(cacheKey)) {
        weatherCache = openMeteoCache.get(cacheKey);
      }
    }
  }

  return {
    gridData: gridData,
    selectedCell: selectedCell,
    hoveredCell: hoveredCell,
    optimizedRoute: optimizedRoute,
    selectedPort: portSelect ? portSelect.value : selectedPort,
    selectedSpecies: speciesSelect ? speciesSelect.value : 'sardine',
    currentMode: currentMode,
    dayOfYear: dayOfYear,
    weatherCache: weatherCache,
    liveData: liveData
  };
}

/**
 * Initialize Samudra and wire up all UI interactions
 */
function initSamudra() {
  samudra = new SamudraAssistant();
  samudra.setStateProvider(getThalassaState);

  // ── DOM References ──
  const fab = document.getElementById('samudra-fab');
  const panel = document.getElementById('samudra-panel');
  const closeBtn = document.getElementById('samudra-close-btn');
  const messagesDiv = document.getElementById('samudra-messages');
  const textInput = document.getElementById('samudra-text-input');
  const sendBtn = document.getElementById('samudra-send-btn');
  const micBtn = document.getElementById('samudra-mic-btn');
  const waveform = document.getElementById('samudra-waveform');
  const statusDot = document.getElementById('samudra-status-dot');
  const statusText = document.getElementById('samudra-status-text');
  const fabIconMic = document.getElementById('samudra-fab-icon-mic');
  const fabIconClose = document.getElementById('samudra-fab-icon-close');
  const chips = document.querySelectorAll('.samudra-chip');

  let panelOpen = false;
  let hasGreeted = false;

  // ── Drag Logic for Panel ──
  const header = panel.querySelector('.samudra-header');
  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    const rect = panel.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    
    // Switch to absolute positioning so it follows mouse exactly
    panel.style.left = `${initialLeft}px`;
    panel.style.top = `${initialTop}px`;
    panel.style.bottom = 'auto';
    panel.style.right = 'auto';
    panel.style.margin = '0';
    // Temporarily disable transitions so it doesn't lag while dragging
    panel.style.transition = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    panel.style.left = `${initialLeft + dx}px`;
    panel.style.top = `${initialTop + dy}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      // Re-enable transition for smooth closing/opening
      panel.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    }
  });

  // ── Render a message bubble ──
  function renderMessage(msg) {
    const bubble = document.createElement('div');
    bubble.className = `samudra-msg ${msg.sender}`;
    if (msg.type === 'emergency') bubble.classList.add('emergency');
    if (msg.type === 'warning') bubble.classList.add('warning');

    const timeStr = msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    bubble.innerHTML = `
      <div>${msg.text}</div>
      <div class="samudra-msg-time">${timeStr}</div>
    `;
    messagesDiv.appendChild(bubble);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // ── Message callback ──
  samudra.onMessage = (msg) => {
    renderMessage(msg);
    // Auto-open panel on emergency
    if (msg.type === 'emergency' && !panelOpen) {
      togglePanel(true);
    }
  };

  // ── State change callback ──
  samudra.onStateChange = (state) => {
    // Update waveform
    if (state.isListening) {
      waveform.classList.add('active');
      micBtn.classList.add('listening');
      statusDot.className = 'samudra-status-dot listening';
      statusText.textContent = 'LISTENING...';
    } else if (state.isSpeaking) {
      waveform.classList.add('active');
      micBtn.classList.remove('listening');
      statusDot.className = 'samudra-status-dot speaking';
      statusText.textContent = 'SPEAKING...';
    } else {
      waveform.classList.remove('active');
      micBtn.classList.remove('listening');
      statusDot.className = 'samudra-status-dot';
      statusText.textContent = 'IDLE';
    }
  };

  // ── Toggle panel ──
  function togglePanel(forceOpen) {
    panelOpen = forceOpen !== undefined ? forceOpen : !panelOpen;
    if (panelOpen) {
      panel.style.display = 'flex';
      // Trigger reflow for animation
      requestAnimationFrame(() => {
        panel.classList.add('open');
      });
      fab.classList.add('active');
      fabIconMic.style.display = 'none';
      fabIconClose.style.display = 'block';

      if (!hasGreeted) {
        hasGreeted = true;
        samudra.greet();
        samudra.startEmergencyMonitor();
      }
    } else {
      panel.classList.remove('open');
      fab.classList.remove('active');
      fabIconMic.style.display = 'block';
      fabIconClose.style.display = 'none';
      setTimeout(() => {
        if (!panelOpen) panel.style.display = 'none';
      }, 350);
    }
  }

  // ── Event Listeners ──
  fab.addEventListener('click', () => togglePanel());
  closeBtn.addEventListener('click', () => togglePanel(false));

  // Quick action chips
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const query = chip.getAttribute('data-query');
      if (query) {
        samudra.sendText(query);
      }
    });
  });

  // Text input — send on Enter
  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && textInput.value.trim()) {
      samudra.sendText(textInput.value.trim());
      textInput.value = '';
    }
  });

  // Send button
  sendBtn.addEventListener('click', () => {
    if (textInput.value.trim()) {
      samudra.sendText(textInput.value.trim());
      textInput.value = '';
    }
  });

  // Mic button — toggle listening
  micBtn.addEventListener('click', () => {
    if (samudra.isListening) {
      samudra.stopListening();
    } else {
      samudra.startListening();
    }
  });

  // ── Emergency Call Overlay ──
  const emergencyOverlay = document.getElementById('emergency-overlay');
  const emergencyClose = document.getElementById('emergency-close');
  const emergencyDangerText = document.getElementById('emergency-danger-text');

  samudra.onEmergencyCall = (data) => {
    // Show the full-screen emergency overlay
    if (emergencyOverlay) {
      // Update danger text
      if (data.dangers && data.dangers.length > 0) {
        emergencyDangerText.textContent = data.dangers.join(' • ');
      } else {
        emergencyDangerText.textContent = 'Dangerous sea conditions detected — call for assistance';
      }
      emergencyOverlay.style.display = 'flex';
    }
  };

  if (emergencyClose) {
    emergencyClose.addEventListener('click', () => {
      emergencyOverlay.style.display = 'none';
    });
  }

  console.log('[Thalassa] Samudra AI Voice Assistant initialized.');

  // ═══════════════════════════════════════════════════════════════════════════
  // PHONE CALL OVERLAY — Integration
  // ═══════════════════════════════════════════════════════════════════════════

  const phoneCallFab = document.getElementById('phone-call-fab');
  const phoneOverlay = document.getElementById('phone-call-overlay');
  const callStateDialing = document.getElementById('call-state-dialing');
  const callStateActive = document.getElementById('call-state-active');
  const callStateEnded = document.getElementById('call-state-ended');
  const callTimerEl = document.getElementById('call-timer');
  const callWaveform = document.getElementById('call-waveform');
  const callTranscriptScroll = document.getElementById('call-transcript-scroll');
  const callCancelBtn = document.getElementById('call-cancel-btn');
  const callEndBtn = document.getElementById('call-end-btn');
  const callMuteBtn = document.getElementById('call-mute-btn');
  const callSpeakerBtn = document.getElementById('call-speaker-btn');
  const callSosBtn = document.getElementById('call-sos-btn');
  const callAgainBtn = document.getElementById('call-again-btn');
  const callDismissBtn = document.getElementById('call-dismiss-btn');
  const callEndedDuration = document.getElementById('call-ended-duration');

  // Show/hide call state screens
  function setCallScreen(state) {
    callStateDialing.style.display = state === 'dialing' ? 'flex' : 'none';
    callStateActive.style.display = state === 'active' ? 'flex' : 'none';
    callStateEnded.style.display = state === 'ended' ? 'flex' : 'none';
  }

  // ── Call State Change Handler ──
  samudra.onCallStateChange = (state, data) => {
    if (state === 'dialing') {
      phoneOverlay.style.display = 'flex';
      // Force reflow then add visible class for animation
      requestAnimationFrame(() => {
        phoneOverlay.classList.add('visible');
      });
      setCallScreen('dialing');
      // Clear previous transcript
      callTranscriptScroll.innerHTML = '';
    } else if (state === 'active') {
      setCallScreen('active');
      callWaveform.classList.remove('active', 'speaking');
    } else if (state === 'ended') {
      setCallScreen('ended');
      callWaveform.classList.remove('active', 'speaking');
      if (data && data.duration) {
        callEndedDuration.textContent = `Duration: ${data.duration}`;
      }
    } else if (state === 'idle') {
      phoneOverlay.classList.remove('visible');
      setTimeout(() => {
        phoneOverlay.style.display = 'none';
      }, 400);
    }
  };

  // ── Call Timer Handler ──
  samudra.onCallTimer = (formatted) => {
    if (callTimerEl) callTimerEl.textContent = formatted;
  };

  // ── Call Transcript Handler ──
  samudra.onCallTranscript = (text, sender) => {
    const line = document.createElement('div');
    line.className = `call-transcript-line ${sender}`;
    line.textContent = text;
    callTranscriptScroll.appendChild(line);

    // Scroll to bottom
    const area = document.getElementById('call-transcript-area');
    if (area) area.scrollTop = area.scrollHeight;

    // Remove "thinking" lines when a real response comes
    if (sender === 'bot') {
      const thinkingLines = callTranscriptScroll.querySelectorAll('.thinking');
      thinkingLines.forEach(el => el.remove());
    }
  };

  // ── Waveform animation sync with listening/speaking state ──
  const originalOnStateChange = samudra.onStateChange;
  samudra.onStateChange = (state) => {
    // Call the original handler (chat panel)
    if (originalOnStateChange) originalOnStateChange(state);

    // Sync waveform for phone call
    if (samudra.callState === 'active' && callWaveform) {
      callWaveform.classList.remove('active', 'speaking');
      if (state.isListening) {
        callWaveform.classList.add('active');
      } else if (state.isSpeaking) {
        callWaveform.classList.add('speaking');
      }
    }
  };

  // ── Button Event Listeners ──

  // Start call from FAB
  if (phoneCallFab) {
    phoneCallFab.addEventListener('click', () => {
      samudra.startCall();
    });
  }

  // Cancel call (during dialing)
  if (callCancelBtn) {
    callCancelBtn.addEventListener('click', () => {
      samudra.endCall();
      setTimeout(() => samudra.dismissCall(), 100);
    });
  }

  // End call (during active call)
  if (callEndBtn) {
    callEndBtn.addEventListener('click', () => {
      samudra.endCall();
    });
  }

  // Mute toggle
  if (callMuteBtn) {
    callMuteBtn.addEventListener('click', () => {
      const muted = samudra.toggleMute();
      callMuteBtn.classList.toggle('active-toggle', muted);
      // Show/hide visual feedback
      if (muted) {
        const label = callMuteBtn.querySelector('.call-action-label');
        if (label) label.textContent = 'Muted';
      } else {
        const label = callMuteBtn.querySelector('.call-action-label');
        if (label) label.textContent = 'Mic';
      }
    });
  }

  // Speaker toggle
  if (callSpeakerBtn) {
    callSpeakerBtn.addEventListener('click', () => {
      const speaker = samudra.toggleSpeaker();
      callSpeakerBtn.classList.toggle('active-toggle', speaker);
    });
  }

  // SOS button during call
  if (callSosBtn) {
    callSosBtn.addEventListener('click', () => {
      samudra.sendText('emergency SOS - I need immediate help');
    });
  }

  // Call Again
  if (callAgainBtn) {
    callAgainBtn.addEventListener('click', () => {
      samudra.dismissCall();
      setTimeout(() => samudra.startCall(), 300);
    });
  }

  // Dismiss (close overlay)
  if (callDismissBtn) {
    callDismissBtn.addEventListener('click', () => {
      samudra.dismissCall();
    });
  }

  console.log('[Thalassa] Phone Call overlay wired up.');
}

// Floating HTML Map Legend Population functions
function updateMapLegend() {
  const title = document.getElementById('legend-title');
  const itemsContainer = document.getElementById('legend-items');
  if (!title || !itemsContainer) return;

  itemsContainer.innerHTML = '';

  if (currentMode === 'fisherman') {
    title.textContent = 'YIELD ANALYSIS LEGEND';

    if (activeOverlays.sst && !activeOverlays.chl) {
      addLegendItem('rgba(255, 119, 89, 0.6)', 'Sea Temp (Warm/High)');
      addLegendItem('rgba(255, 119, 89, 0.15)', 'Sea Temp (Cool/Low)');
    } else if (activeOverlays.chl && !activeOverlays.sst) {
      addLegendItem('rgba(0, 92, 71, 0.65)', 'Chlorophyll (High Food)');
      addLegendItem('rgba(0, 92, 71, 0.15)', 'Chlorophyll (Low Food)');
    } else if (activeOverlays.sst && activeOverlays.chl) {
      addLegendItem('rgba(0, 77, 62, 0.75)', 'Optimal Yield (High)');
      addLegendItem('rgba(0, 77, 62, 0.15)', 'Optimal Yield (Low)');
    } else {
      addLegendItem('rgba(0,0,0,0)', 'No Overlay Active (Map View)');
    }

    if (activeOverlays.currents) {
      addLegendItem('rgba(24, 99, 220, 0.45)', 'Currents Vector Arrow', 'arrow');
    }
    addLegendItem('var(--primary-color)', 'Anchor Fishing Harbors', 'circle');
  } else {
    title.textContent = 'CONSERVATION LEGEND';
    addLegendItem('rgba(255, 84, 54, 0.55)', 'Active Spawning Ban');
    addLegendItem('rgba(255, 134, 106, 0.35)', 'Marine Reserve Buffer');
    addLegendItem('rgba(255, 54, 54, 0.6)', 'Seasonal Spawning Line', 'dotted-line');
    addLegendItem('var(--ink)', 'Protected Harbors', 'circle');
  }
}

function addLegendItem(color, text, type = 'box') {
  const container = document.getElementById('legend-items');
  const item = document.createElement('div');
  item.style.display = 'flex';
  item.style.alignItems = 'center';
  item.style.gap = '8px';
  item.style.fontSize = '11px';

  let visualHTML = '';
  if (type === 'circle') {
    visualHTML = `<div style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; border: 1px solid white;"></div>`;
  } else if (type === 'arrow') {
    visualHTML = `
      <div style="width: 12px; height: 8px; display: flex; align-items: center; justify-content: center;">
        <svg width="12" height="6" viewBox="0 0 12 6" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 3H10M10 3L8 1M10 3L8 5" stroke="${color}" stroke-width="1.2"/>
        </svg>
      </div>`;
  } else if (type === 'dotted-line') {
    visualHTML = `<div style="width: 12px; height: 0px; border-top: 1.5px dashed ${color};"></div>`;
  } else {
    visualHTML = `<div style="width: 12px; height: 8px; background: ${color}; border: 1px solid rgba(0,0,0,0.1); border-radius: var(--radius-xs);"></div>`;
  }

  item.innerHTML = `
    ${visualHTML}
    <span style="color: var(--ink);">${text}</span>
  `;
  container.appendChild(item);
}

async function updateFishClusters() {
  if (!clustersLayerGroup) return;
  clustersLayerGroup.clearLayers();
  
  if (currentMode !== 'fisherman') return;
  
  const speciesSelect = document.getElementById('species-selector');
  const species = speciesSelect ? speciesSelect.value : 'sardine';
  const currentMonth = Math.floor((dayOfYear / 365) * 12) + 1;

  try {
    const res = await fetch(`/api/clusters?species=${species}&month=${currentMonth}`);
    const data = await res.json();

    if (data && data.clusters) {
      data.clusters.forEach(cluster => {
        if (cluster.hull_polygon && cluster.hull_polygon.length > 0) {
          const polygonCoords = cluster.hull_polygon.map(p => [p.lat, p.lng]);
          
          const poly = L.polygon(polygonCoords, {
            color: 'var(--action-blue, #1863dc)',
            weight: 1.5,
            dashArray: '4, 6',
            fillColor: 'var(--action-blue, #1863dc)',
            fillOpacity: 0.12,
            className: 'fish-cluster-hull'
          }).addTo(clustersLayerGroup);

          poly.bindTooltip(`
            <div style="font-family: var(--font-body); font-size: 11px; line-height: 1.4; padding: 4px;">
              <strong style="color: var(--action-blue); font-size: 12px;">Dynamic ML Cluster #${cluster.cluster_id}</strong><br>
              <strong>Density:</strong> ${cluster.points_count} catch reports<br>
              <strong>Avg SST:</strong> ${cluster.avg_sst.toFixed(1)} °C<br>
              <strong>Avg Chlorophyll:</strong> ${cluster.avg_chlorophyll.toFixed(2)} mg/m³<br>
              <strong>Est Yield:</strong> ${Math.round(cluster.avg_yield)} kg/day
            </div>
          `, { sticky: true });
        }
      });
    }
  } catch (err) {
    console.warn("Failed to fetch clusters from Python FastAPI ML service", err);
  }
}

function showViolationAlert(cell) {
  if (violationAlertActive) return;
  violationAlertActive = true;
  
  // Show high-contrast alert modal overlay
  const overlay = document.createElement('div');
  overlay.className = 'emergency-overlay';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(20, 5, 5, 0.95)';
  overlay.style.zIndex = '9999';
  
  overlay.innerHTML = `
    <div class="emergency-overlay-content" style="max-width: 450px; text-align: center; border: 2px solid var(--error, #d45656); border-radius: var(--radius-lg); padding: 32px; background: var(--surface-code); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
      <div style="margin: 0 auto 16px auto; width: 64px; height: 64px; border-radius: 50%; border: 2px solid var(--error, #d45656); display: flex; align-items: center; justify-content: center; background: rgba(212, 86, 86, 0.1);">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="var(--error, #d45656)">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
      </div>
      <h2 style="color: var(--error, #d45656); margin-bottom: 12px; font-family: var(--font-mono); letter-spacing: 1px;">🚨 REGULATORY VIOLATION</h2>
      <p style="color: var(--on-dark); font-size: 14px; line-height: 1.6; margin-bottom: 24px; font-family: var(--font-body);">
        Vessel is currently crossing an active **Spawning Ban Zone** near **${cell.lat.toFixed(2)}°N, ${cell.lng.toFixed(2)}°E**!<br><br>
        <strong>Penalty Level:</strong> Critical Regulatory Non-Compliance<br>
        <strong>Fine Applied:</strong> <span style="color: var(--error, #d45656); font-weight: 700;">50,000 INR</span> deducted from standard route margin projections.
      </p>
      <button id="violation-close-btn" style="background: var(--error, #d45656); color: white; border: none; font-weight: 600; font-family: var(--font-body); width: 100%; height: 44px; border-radius: 22px; cursor: pointer; transition: opacity 0.2s;">Acknowledge Fine</button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  document.getElementById('violation-close-btn').addEventListener('click', () => {
    overlay.remove();
    setTimeout(() => {
      violationAlertActive = false;
    }, 8000); // 8 second cooldown
  });
}

