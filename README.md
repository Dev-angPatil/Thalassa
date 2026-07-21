# 🌊 Matsya Drishti: Kerala Marine Digital Twin

> **Bridging the Blue Economy & Marine Biodiversity Conservation with Real-Time AI, True A* Eco-Routing, and Satellite Data Fusion.**
> 
> *A Premium Dark-Mode Mission Control for Sustainable Fishing and Marine Resource Stewardship.*

---

## 🚀 The Pitch (Hackathon-Ready)

Ocean stewardship is a delicate balance: small-to-medium scale fishers need to maximize their economic yields, while marine biologists must protect fragile spawning habitats. Current maritime navigation tools offer basic route planning but lack oceanographic intelligence.

**Matsya Drishti** is a next-generation Marine Digital Twin for the Kerala Coastline. It merges live satellite oceanography (SST, Chlorophyll, currents) and real-time weather forecasts (wind speed, wave height) with a **True A* Eco-Routing engine** and a **Commercial Profit Optimizer**. 

By calculating optimal routes that strictly deflect around active seasonal spawning bans and calculating actual fuel cost adjustments from opposing sea-current vectors, Matsya Drishti empowers fishers to make high-yield, legally compliant, and resource-efficient trips.

---

## 🌟 Key Features

### 1. Premium Dark-Mode Mission Control (R1)
*   Refined **Cohere-style dark aesthetic** (`#071829` deep navy and `#17171c` near-black) with high-contrast glowing overlays (emerald for fishing yields, coral for conservation zones, action-blue for paths).
*   Decluttered dashboard using **tabs and collapsible panels** to organize complex weather telemetry (SST, Chlorophyll, currents, wind, waves) without cognitive overload.

### 2. High-Resolution Spatial Grid (R2)
*   Upgraded spatial density from a standard 24x18 grid to a **high-resolution 40x30 grid** of the Kerala Coastline, containing 1,200 unique interactive cells.
*   Smooth, hardware-accelerated **CartoDB Dark Matter tile integration** for Leaflet.
*   Highly responsive mouse hover highlights and interactive anchor port bindings.

### 3. True A* Eco-Vessel Router with Spline Smoothing (R3)
*   Runs a native **A\*** pathfinding search across the high-density grid.
*   Treats landmass and **seasonally restricted spawning zones** as absolute obstacles.
*   Applies a **cubic window interpolation spline** (`smoothPath`) to eliminate rigid grid angles and draw realistic vessel routes.
*   Renders a side-by-side visual comparison between the straight **Standard Route** (red dashed, flagging violation crossings) and the **Matsya Drishti Eco-Route** (blue, eco-compliant).

### 4. Commercial Profit Optimizer (R4)
*   **Target Species Selector** (Indian Oil Sardine, Indian Mackerel, Penaeid Shrimp, Yellowfin Tuna) which dynamically alters market pricing and spawning sensitivity curves.
*   **Opposing Current Resistance**: Vector math checks the alignment of current vectors (`currentSpeed`/`currentDir`) against the vessel's segment trajectory, modifying fuel burn by up to 50% for head-currents.
*   **Violation Penalty**: Standard routes crossing restricted areas are slapped with a **50,000 INR regulatory fine** deducted from their projected net margins.

### 5. Live Satellite & Weather Sync (R5)
*   Debounced caching client that queries live **Open-Meteo forecasts** for wave/wind telemetry and mimics queries to **INCOIS ERDDAP** for SST and Chlorophyll.
*   **Scenario Presets**:
    1.  *Monsoon Upwelling (July)*: Showcases high chlorophyll upwelling and high coastal favorability.
    2.  *Spawning Peak (December)*: Restricts key coastal zones to protect breeding stock.
    3.  *Live Satellite Sync*: Live sync mode.
    4.  *Marine Heatwave & Hypoxia Shock*: Simulates an extreme anomaly (SST +3.5°C, Chlorophyll > 5.0 mg/m³) to warn fishers of warm, oxygen-deprived low-yield pools.

---

## 🛠️ Technology Stack

*   **Frontend**: HTML5, Vanilla JavaScript (ES Modules), Vanilla CSS
*   **Mapping**: Leaflet.js with CartoDB Dark Matter vector layers
*   **Build System / Dev Server**: Vite
*   **Testing Infrastructure**: Puppeteer E2E validation test suite running 60 automated assertions

---

## 📈 E2E Test Suite & Code Quality

Matsya Drishti contains a robust, programmatically generated automated test suite running 60 distinct E2E verification points checking:
*   **T1 UI/UX & Layout**: Base canvas dark style, CartoDB integration, telemetry panel layout.
*   **T2 Grid Density**: Verification of the 1,200 grid cells (40x30 density).
*   **T3/T4 Router & Optimizer**: Asserting that clicks calculate valid paths, species selection alters margins, and state variables are properly bound.
*   **T5 Live-Sync & Heatwave Preset**: Testing state transitions when presets are activated.

---

## 🚀 How to Run the Project Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
*Vite will start the server (defaulting to port `3000` or `5179` based on configuration).*

### 3. Run the Automated Tests
Ensure your dev server is active, and execute the E2E verification test script:
```bash
node check_tests.cjs
```
This spins up a headless browser, executes all 60 test suites, and asserts that they pass with 100% success.

---

## 📜 Pitch Deck Narrative: The Digital Twin Impact

1.  **Safety First**: High winds (>25 km/h) and waves (>2.0m) dynamically trigger harbor warnings on the sidebar, protecting traditional fishers from hazardous seas.
2.  **Compliance Simplified**: Traditional spawning bans are often ignored because fishers cannot calculate manual bypass routes. Matsya Drishti does it automatically in real time.
3.  **Economic Vitality**: Opposing current vector compensation helps fishers select paths with minimal hydrodynamic drag, saving thousands of liters of fuel.
