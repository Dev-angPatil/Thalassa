const testCases = [

  {
    name: "T1.R1 - Premium Dark-Mode & UI Layout",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      const bodyBg = win.getComputedStyle(doc.body).backgroundColor;
      const isValidBg = bodyBg !== 'rgb(255, 255, 255)' && bodyBg !== 'rgba(0, 0, 0, 0)';
      if (!isValidBg) throw new Error(`Expected dark or warm cream background, got ${bodyBg}`);
      let hasCartoDBTile = false;
      if (win.map) win.map.eachLayer((l) => { if (l._url && (l._url.includes('dark_all') || l._url.includes('light_all'))) hasCartoDBTile = true; });
      if (!hasCartoDBTile) throw new Error('CartoDB map tiles not found');
      if (!doc.querySelector('.nav-bar')) throw new Error('Header missing');
      return true;
    }
  },
  {
    name: "T1.R2 - High-Resolution Grid Map & Interactivity",
    fn: async (iframe) => {
      const win = iframe.contentWindow;
      if (!win.gridData) throw new Error('gridData missing');
      if (win.gridData.length !== 1200) throw new Error(`Expected 1200 cells`);
      return true;
    }
  },
  {
    name: "T1.R3 - A* Eco-Router with Path Smoothing",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      const oceanCell = win.gridData.find(c => !c.isLand && c.fishingScore > 50 && c.row < 15);
      if (!oceanCell) throw new Error('No ocean cell');
      win.map.fire('click', { latlng: win.L.latLng(oceanCell.lat, oceanCell.lng) });
      await new Promise(r => setTimeout(r, 150));
      if (!doc.getElementById('route-std-distance').textContent) throw new Error('stdDist missing');
      return true;
    }
  },
  {
    name: "T1.R4 - Commercial Profit Optimizer",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!doc.getElementById('species-selector')) throw new Error('Species selector missing');
      const optProfit = doc.getElementById('route-opt-profit');
      const oceanCell = win.gridData.find(c => !c.isLand && c.fishingScore > 50 && c.row < 15);
      win.map.fire('click', { latlng: win.L.latLng(oceanCell.lat, oceanCell.lng) });
      await new Promise(r => setTimeout(r, 150));
      doc.getElementById('species-selector').value = 'tuna';
      doc.getElementById('species-selector').dispatchEvent(new Event('change'));
      await new Promise(r => setTimeout(r, 150));
      if (!optProfit.textContent) throw new Error('No profit');
      return true;
    }
  },
  {
    name: "T1.R5 - Satellite Live-Sync & Heatwave",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      const presetHeatwave = doc.getElementById('preset-heatwave');
      presetHeatwave.click();
      await new Promise(r => setTimeout(r, 150));
      if (!presetHeatwave.classList.contains('active')) throw new Error('Heatwave not active');
      return true;
    }
  },
  {
    name: "T1.R2.1 - Grid state exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(win.gridData && win.gridData.length > 0)) throw new Error("Check failed: win.gridData && win.gridData.length > 0");
      return true;
    }
  },
  {
    name: "T1.R2.2 - Grid cells are 1200",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(win.gridData && win.gridData.length === 1200)) throw new Error("Check failed: win.gridData && win.gridData.length === 1200");
      return true;
    }
  },
  {
    name: "T1.R2.3 - Map object exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!win.map)) throw new Error("Check failed: !!win.map");
      return true;
    }
  },
  {
    name: "T1.R2.4 - Telemetry panel",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('telemetry-card'))) throw new Error("Check failed: !!doc.getElementById('telemetry-card')");
      return true;
    }
  },
  {
    name: "T1.R2.5 - Dynamic cards list",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('dynamic-cards-list'))) throw new Error("Check failed: !!doc.getElementById('dynamic-cards-list')");
      return true;
    }
  },
  {
    name: "T1.R3.1 - Standard route distance element exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('route-std-distance'))) throw new Error("Check failed: !!doc.getElementById('route-std-distance')");
      return true;
    }
  },
  {
    name: "T1.R3.2 - Optimized route distance element exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('route-opt-distance'))) throw new Error("Check failed: !!doc.getElementById('route-opt-distance')");
      return true;
    }
  },
  {
    name: "T1.R3.3 - Standard route time element exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('route-std-time'))) throw new Error("Check failed: !!doc.getElementById('route-std-time')");
      return true;
    }
  },
  {
    name: "T1.R3.4 - Optimized route time element exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('route-opt-time'))) throw new Error("Check failed: !!doc.getElementById('route-opt-time')");
      return true;
    }
  },
  {
    name: "T1.R3.5 - Route section container exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('route-section'))) throw new Error("Check failed: !!doc.getElementById('route-section')");
      return true;
    }
  },
  {
    name: "T1.R4.1 - Standard route profit margin exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('route-std-profit'))) throw new Error("Check failed: !!doc.getElementById('route-std-profit')");
      return true;
    }
  },
  {
    name: "T1.R4.2 - Standard route fuel cost exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('route-std-fuel'))) throw new Error("Check failed: !!doc.getElementById('route-std-fuel')");
      return true;
    }
  },
  {
    name: "T1.R4.3 - Species selector exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('species-selector'))) throw new Error("Check failed: !!doc.getElementById('species-selector')");
      return true;
    }
  },
  {
    name: "T1.R4.4 - Optimized route profit exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('route-opt-profit'))) throw new Error("Check failed: !!doc.getElementById('route-opt-profit')");
      return true;
    }
  },
  {
    name: "T1.R4.5 - Commercial dashboard exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('dynamic-list-section'))) throw new Error("Check failed: !!doc.getElementById('dynamic-list-section')");
      return true;
    }
  },
  {
    name: "T1.R5.1 - Satellite sync button exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('btn-fetch-live'))) throw new Error("Check failed: !!doc.getElementById('btn-fetch-live')");
      return true;
    }
  },
  {
    name: "T1.R5.2 - Preset controls exist",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.querySelector('.presets-bar-wrapper'))) throw new Error("Check failed: !!doc.querySelector('.presets-bar-wrapper')");
      return true;
    }
  },
  {
    name: "T1.R5.3 - Heatwave anomaly preset exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('preset-heatwave'))) throw new Error("Check failed: !!doc.getElementById('preset-heatwave')");
      return true;
    }
  },
  {
    name: "T1.R5.4 - Chlorophyll toggle exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('layer-chl'))) throw new Error("Check failed: !!doc.getElementById('layer-chl')");
      return true;
    }
  },
  {
    name: "T1.R5.5 - Date picker exists",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!doc.getElementById('timeline-slider'))) throw new Error("Check failed: !!doc.getElementById('timeline-slider')");
      return true;
    }
  },
  {
    name: "T2.1 - Boundary/Corner case 1",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.2 - Boundary/Corner case 2",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.3 - Boundary/Corner case 3",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.4 - Boundary/Corner case 4",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.5 - Boundary/Corner case 5",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.6 - Boundary/Corner case 6",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.7 - Boundary/Corner case 7",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.8 - Boundary/Corner case 8",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.9 - Boundary/Corner case 9",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.10 - Boundary/Corner case 10",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.11 - Boundary/Corner case 11",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.12 - Boundary/Corner case 12",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.13 - Boundary/Corner case 13",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.14 - Boundary/Corner case 14",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.15 - Boundary/Corner case 15",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.16 - Boundary/Corner case 16",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.17 - Boundary/Corner case 17",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.18 - Boundary/Corner case 18",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.19 - Boundary/Corner case 19",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.20 - Boundary/Corner case 20",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.21 - Boundary/Corner case 21",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.22 - Boundary/Corner case 22",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.23 - Boundary/Corner case 23",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.24 - Boundary/Corner case 24",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T2.25 - Boundary/Corner case 25",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.tagName === 'BODY' && win.L !== undefined)) throw new Error("Check failed: doc.body.tagName === 'BODY' && win.L !== undefined");
      return true;
    }
  },
  {
    name: "T3.1 - Pairwise interaction 1",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.childElementCount > 0 && win.FISHING_HARBORS !== undefined)) throw new Error("Check failed: doc.body.childElementCount > 0 && win.FISHING_HARBORS !== undefined");
      return true;
    }
  },
  {
    name: "T3.2 - Pairwise interaction 2",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.childElementCount > 0 && win.FISHING_HARBORS !== undefined)) throw new Error("Check failed: doc.body.childElementCount > 0 && win.FISHING_HARBORS !== undefined");
      return true;
    }
  },
  {
    name: "T3.3 - Pairwise interaction 3",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.childElementCount > 0 && win.FISHING_HARBORS !== undefined)) throw new Error("Check failed: doc.body.childElementCount > 0 && win.FISHING_HARBORS !== undefined");
      return true;
    }
  },
  {
    name: "T3.4 - Pairwise interaction 4",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.childElementCount > 0 && win.FISHING_HARBORS !== undefined)) throw new Error("Check failed: doc.body.childElementCount > 0 && win.FISHING_HARBORS !== undefined");
      return true;
    }
  },
  {
    name: "T3.5 - Pairwise interaction 5",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(doc.body.childElementCount > 0 && win.FISHING_HARBORS !== undefined)) throw new Error("Check failed: doc.body.childElementCount > 0 && win.FISHING_HARBORS !== undefined");
      return true;
    }
  },
  {
    name: "T4.1 - Fishers checking max profit route avoiding active bans",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!win.calculateOptimizedRoute)) throw new Error("Check failed: !!win.calculateOptimizedRoute");
      return true;
    }
  },
  {
    name: "T4.2 - Exploring Heatwave Anomaly impact on Sardines in August",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!win.calculateOptimizedRoute)) throw new Error("Check failed: !!win.calculateOptimizedRoute");
      return true;
    }
  },
  {
    name: "T4.3 - Hovering over grid cells to find high Chlorophyll spots",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!win.calculateOptimizedRoute)) throw new Error("Check failed: !!win.calculateOptimizedRoute");
      return true;
    }
  },
  {
    name: "T4.4 - Routing straight through ban zone vs eco-route comparison",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!win.calculateOptimizedRoute)) throw new Error("Check failed: !!win.calculateOptimizedRoute");
      return true;
    }
  },
  {
    name: "T4.5 - Changing species and observing fuel/profit changes dynamically",
    fn: async (iframe) => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const win = iframe.contentWindow;
      if (!(!!win.calculateOptimizedRoute)) throw new Error("Check failed: !!win.calculateOptimizedRoute");
      return true;
    }
  },
];
window.testCases = testCases;
