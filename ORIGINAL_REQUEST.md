# Original User Request

## Initial Request — 2026-07-19T21:12:19Z

Thalassa is a Marine Digital Twin for the Kerala Coastline that balances sustainable fishing yields with marine conservation. It features a sleek dark-mode mission control UI, real-time satellite data fusion, an A* eco-routing engine, and a commercial profit optimizer to help fishers maximize revenue while protecting critical spawning zones.

Working directory: /home/deu/Coding Repos/Archive/Thalassa
Integrity mode: development

## Requirements

### R1. Decluttered Mission Control UI & Premium Dark-Mode
- Redesign the dashboard interface to be clean, modern, and uncluttered. Avoid cramming too many inputs or boxes in one view.
- Group the telemetry details into logical, clean sections with visual tabs or a collapsible detailed view (e.g. basic catch advisories vs advanced weather telemetry) to avoid visual overload.
- Apply a high-end dark mode based on `DESIGN.md` tokens, using `#071829` (dark navy) and `#17171c` (near-black) as base canvas colors.
- Use precise glowing accents: `#1863dc` (action-blue) for vessel routes, `#ff7759` (coral) for conservation zones/warning elements, and `#003c33` (deep-green) or vibrant emerald for high fishing favorability.

### R2. High-Resolution Map & Improved Interactivity
- Increase the grid density (make squares smaller) by upgrading the resolution (e.g. from 24x18 to 40x30 or similar) to make the map look detailed and professional.
- Improve map interactivity: ensure hovering and selection are highly responsive, displaying smooth hover highlight outlines and instantly updating the telemetry.
- Upgrade the base map to CartoDB Dark Matter tiles (`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`) for a stark, technical visual layout.

### R3. A* Eco-Vessel Router with Smooth Paths
- Implement a real A* pathfinding algorithm on the new high-resolution grid.
- Land cells and active spawning ban zones (determined by the current month) must be treated as absolute obstacles for the eco-compliant route.
- Visually smooth the final A* coordinate path using Bezier or spline interpolation before drawing it on the Leaflet map to represent a realistic shipping route.
- Animate a marker along the route to simulate vessel transit.
- Render both the straight standard route (in red, flagging spawning ban crossings) and the A* optimized safe route (in blue) for visual comparison.

### R4. Commercial Profit Optimizer with Target Species Selector
- Add a clean, low-profile Target Species dropdown (Sardines, Mackerel, Prawns, Breams) to the Sidebar telemetry card.
- Selecting a species dynamically alters the catch market price per ton and highlights species-specific spawning vulnerability.
- Calculate fuel cost based on route length (distance) and current-speed resistance (opposing current vector increases fuel burn).
- Display a side-by-side financial breakdown: **Net Profit Margin**, **Fuel Cost**, and **Projected Catch Value** for both routes. Flag the standard route with a regulatory penalty (fine) if it violates a spawning ban.

### R5. Satellite Live-Sync (with Anomaly Preset)
- Ensure real-time weather (wind speed/dir) and marine data (wave height/period) are fetched dynamically from Open-Meteo for hovered/selected cells, using the coordinate-based caching system.
- Ensure the 'Trigger Live API Fetch' queries INCOIS ERDDAP for current day's SST and Chlorophyll values, with a robust, instant simulated fallback if servers are unreachable or blocked by CORS.
- Add a 4th Preset Scenario called "Marine Heatwave & Algal Bloom Shock" to demonstrate how the digital twin warns fishers of toxic hypoxia (chlorophyll > 5.0 mg/m³) and low-yield warm pools (SST rising by 3.5°C).

### R6. Hackathon-Ready Documentation
- Produce high-impact, Devpost-ready documentation (`README.md` and a pitch guide) explaining the digital twin's impact on sustainable blue economies, ocean data accessibility, and maritime safety.

## Acceptance Criteria

### UI & Map
- [ ] Base map is set to CartoDB Dark Matter tiles.
- [ ] Interface uses a dark-navy background, rounded card surfaces, and hairline borders, with a clean layout that is not visually crowded.
- [ ] Telemetry parameters are organized neatly (collapsible or tabbed) rather than showing a large cluster of boxes.
- [ ] Grid cell resolution is high-density (smaller squares) with highly responsive hover states and tooltips.
- [ ] Active perspective toggle (Fisherman vs. Conservationist) updates overlay styles and legends.

### Eco-Routing & Optimizer
- [ ] A* pathfinding successfully routes around land and active conservation zones on the high-resolution grid.
- [ ] Eco-route path is visually smoothed using interpolation (no rigid square grid angles).
- [ ] Spawning ban violation displays a high-contrast warning with a simulated regulatory fine.
- [ ] Vessel route card displays comparison metrics: distance, duration, fuel cost, catch valuation, and net profit margin.
- [ ] Play/Pause timeline scrub animates monthly spawning cycles, dynamically opening/closing protected polygons.

### Scenarios & Simulator
- [ ] Selecting the "Marine Heatwave & Algal Bloom Shock" preset triggers a visual and telemetry shift showing toxic hypoxia warnings.
