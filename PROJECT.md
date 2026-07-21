# Project: Matsya Drishti Marine Digital Twin

## Architecture
Matsya Drishti is structured as a client-side web application leveraging Vanilla HTML5/CSS/JavaScript. It includes:
- **UI & CSS Layer** (`index.html`, `index.css`): Modern premium dark-mode dashboard styled based on Cohere design tokens. Telemetry and route details are structured into decluttered cards and visual tabs.
- **Application Controller** (`src/app.js`): Binds UI controls, initializes Leaflet, renders map grid overlays, handles user interactions, runs scenario presets, and coordinates routing and financial calculations.
- **Data Engine** (`src/lib/data_engine.js`): Coordinates 40x30 spatial grid modeling. Implements grid cell state calculations, spawning restrictions, A* eco-routing, spline path smoothing, and species/vessel financial optimization.
- **API Client** (`src/lib/api_client.js`): Fetches live weather, marine forecasts, and SST/Chlorophyll data with caching and CORS simulated fallbacks.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Premium Dark-Mode & UI Layout | CSS variable swap, metric grouping, tab/collapsible telemetry cards, CartoDB Dark Matter tile setup. | None | DONE (f1b347a0-5d51-402d-93bd-65be093600ba) |
| 2 | High-Resolution Grid Map | Transition grid to 40x30, scale coordinate grids, implement outline cell highlight and hover/selection telemetry sync. | M1 | PLANNED |
| 3 | A* Eco-Router with Path Smoothing | A* grid pathfinding, avoidance of land/ban zones, Bezier/spline smoothing, and rendering of dual paths (optimized in blue, standard in red). | M2 | PLANNED |
| 4 | Commercial Optimizer & Live-Sync Presets | Species selector dropdown, net profit/fuel cost/catch value calculations, current resistance, fine penalties, and Preset 4 (Heatwave & Hypoxia Shock) implementation. | M3 | PLANNED |
| 5 | E2E Testing Suite | Comprehensive test suite for verification of all tiers. | None | DONE (3f52e826-9a30-4e03-a098-ca0e10eeefa3) |
| 6 | Documentation & Handback | README.md update, Pitch/Devpost guide creation, final code compliance. | M4, M5 | PLANNED |

## Interface Contracts
### DataEngine ↔ UI / AppController
- `DataEngine.getGridDimensions()`: Returns `{ rows: 40, cols: 30 }`.
- `DataEngine.calculateOptimizedRoute(startCell, targetCell, currentMonth, targetSpecies)`:
  - Input: `startCell` (x, y), `targetCell` (x, y), `currentMonth` (0-11), `targetSpecies` (string name).
  - Output: `{ standardRoute: Array<{x, y, lat, lng, isViolation}>, optimizedRoute: Array<{x, y, lat, lng}>, financialBreakdown: { standard: { profit, fuel, catchValue, fine }, optimized: { profit, fuel, catchValue, fine } } }`.
- `DataEngine.smoothPath(coordinatePath)`:
  - Input: Array of Leaflet LatLng or grid coordinates.
  - Output: Smoothed array of Leaflet LatLng coordinates.

## Code Layout
- `index.html`: Main HTML file.
- `index.css`: Layout stylesheet.
- `src/app.js`: Main logic entrypoint.
- `src/lib/api_client.js`: Live weather/marine API client.
- `src/lib/data_engine.js`: Routing & profit optimizer.
- `src/data/kerala_spatial.js`: Kerala coastline geographic constants.
