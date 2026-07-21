/**
 * Thalassa Data Simulation and Analysis Engine
 * Calculates Fishing Favorability and Conservation Sensitivity grid matrices.
 */

import { 
  KERALA_COASTLINE, 
  FISHING_HARBORS, 
  CONSERVATION_ZONES, 
  DISTRICT_CATCH_DATA, 
  SPECIES_SPAWNING_CALENDAR 
} from '../data/kerala_spatial.js';

// Coordinates bounding box for Kerala coast grid
const LAT_MIN = 8.0;
const LAT_MAX = 12.8;
const LNG_MIN = 74.5;
const LNG_MAX = 77.5;

// Grid size configuration
const GRID_ROWS = 40;
const GRID_COLS = 30;

/**
 * Get current grid dimensions
 */
export function getGridDimensions() {
  return { rows: GRID_ROWS, cols: GRID_COLS };
}

/**
 * Determine if a point is inside a polygon using ray-casting algorithm
 */
export function isPointInPolygon(point, polygon) {
  let x = point.lng, y = point.lat;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].lng, yi = polygon[i].lat;
    let xj = polygon[j].lng, yj = polygon[j].lat;
    
    let intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Find distance in kilometers between two lat/lon coordinates
 */
export function getDistanceKM(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Main Grid Generator
 * Generates the unified spatial grid for a specific date (day of year)
 * Optionally incorporates live API data if available.
 */
export function generateDigitalTwinGrid(dayOfYear, liveData = null) {
  const grid = [];
  const latStep = (LAT_MAX - LAT_MIN) / GRID_ROWS;
  const lngStep = (LNG_MAX - LNG_MIN) / GRID_COLS;
  
  // Current month (approximate based on day of year 1-365)
  const currentMonth = Math.floor((dayOfYear / 365) * 12) + 1;

  for (let r = 0; r < GRID_ROWS; r++) {
    const lat = LAT_MAX - (r * latStep) - (latStep / 2);
    
    for (let c = 0; c < GRID_COLS; c++) {
      const lng = LNG_MIN + (c * lngStep) + (lngStep / 2);
      const point = { lat, lng };

      // 1. Calculate distance to coastline (to simulate shelf vs deep water)
      let minDistanceToCoast = Infinity;
      let nearestCoastPoint = null;
      for (const cpt of KERALA_COASTLINE) {
        const dist = getDistanceKM(lat, lng, cpt.lat, cpt.lng);
        if (dist < minDistanceToCoast) {
          minDistanceToCoast = dist;
          nearestCoastPoint = cpt;
        }
      }

      // Check if point is on land or too far out in the deep ocean (off shelf)
      // Kerala continental shelf extends roughly 40-80 km out
      const isLand = lng > (nearestCoastPoint ? nearestCoastPoint.lng : 76.5) + 0.05;
      const isDeepOcean = minDistanceToCoast > 120;

      // 2. Synthesize/Simulate Oceanographic Parameters (SST, Chlorophyll, Currents)
      let sst = 28.0;
      let chlorophyll = 1.2;
      let currentSpeed = 0.4;
      let currentDir = 180; // Degrees

      if (liveData && liveData.sst && liveData.sst.points) {
        // Interpolate from live data if present
        const matched = findNearestLivePoint(point, liveData.sst.points);
        if (matched) sst = matched.value;
      } else {
        // SST seasonal simulation (peaks in April-May, drops in monsoon July-August)
        const seasonalSstDiff = 2.5 * Math.sin((dayOfYear - 100) * (2 * Math.PI / 365));
        // Add spatial gradient (warmer near coast, cooler offshore)
        const coastalCooling = 0.5 * Math.sin(minDistanceToCoast / 10);
        sst = 27.5 + seasonalSstDiff - coastalCooling + (Math.sin(lat * 5) * 0.3);
      }

      if (liveData && liveData.chlorophyll && liveData.chlorophyll.points) {
        const matched = findNearestLivePoint(point, liveData.chlorophyll.points);
        if (matched) chlorophyll = matched.value;
      } else {
        // Chlorophyll-a simulation (spikes during monsoon upwelling in July-September)
        const seasonalChlDiff = 2.0 * Math.max(0, Math.sin((dayOfYear - 170) * (2 * Math.PI / 365)));
        // Much higher concentration closer to the coast (nutrient runoff)
        const coastalChlFactor = Math.max(0.2, 5.0 / (minDistanceToCoast + 1));
        chlorophyll = 0.3 + seasonalChlDiff * coastalChlFactor + (Math.cos(lng * 8) * 0.1);
      }

      // Current vectors (simulating typical monsoon currents flowing south, and winter flowing north)
      const currentSeasonalAngle = dayOfYear > 150 && dayOfYear < 270 ? 170 : 350; // South during monsoon, north during post-monsoon
      currentSpeed = 0.2 + 0.6 * Math.max(0, Math.sin((dayOfYear - 160) * (2 * Math.PI / 365))) + (Math.sin(lat * 3) * 0.1);
      currentDir = (currentSeasonalAngle + Math.sin(lng * 10) * 15) % 360;

      // 3. Evaluate Conservation Sensitivity
      let conservationScore = 0;
      let isRestrictedZone = false;
      let activeMPA = null;
      let sensitivityReasons = [];

      // Check if grid cell overlaps any defined conservation zone
      for (const zone of CONSERVATION_ZONES) {
        if (isPointInPolygon(point, zone.polygon)) {
          activeMPA = zone;
          // Check if seasonal restrictions apply this month
          if (zone.restrictedMonths.includes(currentMonth)) {
            isRestrictedZone = true;
            sensitivityReasons.push(`${zone.name}: Spawning Ban Period`);
            conservationScore += zone.severityLevel === 'high' ? 60 : 40;
          } else {
            conservationScore += zone.severityLevel === 'high' ? 30 : 15;
            sensitivityReasons.push(`${zone.name}: Protected Habitat Buffer`);
          }
        }
      }

      // Check for spawning schedules of key commercial species
      for (const species of SPECIES_SPAWNING_CALENDAR) {
        if (species.months.includes(currentMonth)) {
          // If SST is optimal for spawning, elevate vulnerability
          if (sst >= species.minSST && sst <= species.maxSST) {
            conservationScore += 10;
            if (sensitivityReasons.length < 3) {
              sensitivityReasons.push(`Active Spawning: ${species.name.split(' (')[0]}`);
            }
          }
        }
      }

      // Overlay historical fishing catch pressure (higher pressure increases sensitivity to collapse)
      let nearestDistrict = null;
      if (nearestCoastPoint) {
        const clat = nearestCoastPoint.lat;
        let districtName = "";
        if (clat <= 8.6) districtName = "Thiruvananthapuram";
        else if (clat <= 9.0) districtName = "Kollam";
        else if (clat <= 9.7) districtName = "Alappuzha";
        else if (clat <= 10.3) districtName = "Ernakulam";
        else if (clat <= 11.6) districtName = "Kozhikode";
        else districtName = "Kannur";

        nearestDistrict = DISTRICT_CATCH_DATA.find(d => d.district === districtName);
      }
      if (nearestDistrict) {
        const pressureWeight = nearestDistrict.historicalOverfishingIndex * 20;
        conservationScore += pressureWeight;
        if (nearestDistrict.historicalOverfishingIndex > 0.75) {
          sensitivityReasons.push(`High Historical Catch Pressure (${nearestDistrict.district})`);
        }
      }

      // Normalize conservation sensitivity score to 0-100
      conservationScore = Math.min(100, Math.max(0, isLand ? 0 : Math.round(conservationScore)));

      // 4. Evaluate Fishing Favorability Score
      let fishingScore = 0;
      let favorabilityReasons = [];

      if (!isLand && !isDeepOcean) {
        // Optimal SST ranges for pelagic fish (Sardines, Mackerel) is 26.5°C to 29.5°C
        const sstDiff = Math.abs(sst - 28.0);
        let sstFactor = Math.max(0, 1 - (sstDiff / 2.0)); // 1.0 at 28C, drops to 0 at 26C or 30C
        
        // Chlorophyll factor (primary production indicator)
        // Optimal range is 1.0 - 4.0 mg/m3. Too low = no food; too high = eutrophic / low oxygen
        let chlFactor = 0;
        if (chlorophyll >= 0.8 && chlorophyll <= 4.5) {
          chlFactor = 1.0;
        } else if (chlorophyll > 4.5) {
          chlFactor = 0.5; // Algal bloom / hypoxia potential
        } else {
          chlFactor = chlorophyll / 0.8;
        }

        // Currents speed factor (fish group in milder currents, avoid strong shear currents)
        let currentFactor = Math.max(0, 1 - (currentSpeed / 1.5));

        // Combined Formula
        fishingScore = (sstFactor * 0.4 + chlFactor * 0.4 + currentFactor * 0.2) * 100;
        
        // Contextual reasons
        if (sstFactor > 0.8) favorabilityReasons.push("Optimal Sea Surface Temperature");
        if (chlFactor > 0.8) favorabilityReasons.push("High Primary Food Availability (Chlorophyll)");
        if (currentSpeed < 0.5) favorabilityReasons.push("Mild Current Conditions");
        
        // If it's a restricted conservation zone during spawning ban, crash its favorability
        if (isRestrictedZone) {
          fishingScore = fishingScore * 0.15; // Reduce by 85%
        }
      }

      fishingScore = Math.min(100, Math.max(0, isLand ? 0 : Math.round(fishingScore)));

      grid.push({
        row: r,
        col: c,
        lat,
        lng,
        isLand,
        isDeepOcean,
        sst: isLand ? 0 : parseFloat(sst.toFixed(2)),
        chlorophyll: isLand ? 0 : parseFloat(chlorophyll.toFixed(2)),
        currentSpeed: isLand ? 0 : parseFloat(currentSpeed.toFixed(2)),
        currentDir: isLand ? 0 : Math.round(currentDir),
        fishingScore,
        conservationScore,
        isRestrictedZone,
        activeMPA,
        sensitivityReasons,
        favorabilityReasons,
        minDistanceToCoast: parseFloat(minDistanceToCoast.toFixed(1))
      });
    }
  }

  return grid;
}

/**
 * Route Optimization Engine
 * Calculates the best fishing path from a port to high-scoring fishing zones,
 * avoiding restricted conservation zones.
 */

/**
 * Helper to find nearest coordinate in live API datasets
 */
function findNearestLivePoint(point, points) {
  let nearest = null;
  let minDistance = Infinity;
  for (const pt of points) {
    const dist = getDistanceKM(point.lat, point.lng, pt.lat, pt.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = pt;
    }
  }
  // Clamp match to a reasonable spatial distance (e.g. 50km)
  return minDistance < 50 ? nearest : null;
}


export function calculateOptimizedRoute(portId, targetCell, grid, dayOfYear = 175) {
  const port = FISHING_HARBORS.find(h => h.id === portId);
  if (!port || !targetCell) return null;

  const currentMonth = Math.floor((dayOfYear / 365) * 12) + 1;

  // Function to find nearest grid cell
  function getNearestGridCell(lat, lng) {
    let nearest = null;
    let minDistance = Infinity;
    for (const cell of grid) {
      const dist = getDistanceKM(lat, lng, cell.lat, cell.lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = cell;
      }
    }
    return nearest;
  }

  const startGridCell = getNearestGridCell(port.lat, port.lng);
  const targetGridCell = getNearestGridCell(targetCell.lat, targetCell.lng);

  if (!startGridCell || !targetGridCell) return null;

  function heuristic(a, b) {
    return getDistanceKM(a.lat, a.lng, b.lat, b.lng);
  }

  function getNeighbors(cell) {
    const neighbors = [];
    const dirs = [
      [-1, 0], [1, 0], [0, -1], [0, 1],
      [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];
    for (const [dr, dc] of dirs) {
      const nr = cell.row + dr;
      const nc = cell.col + dc;
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
        neighbors.push(grid[nr * GRID_COLS + nc]);
      }
    }
    return neighbors;
  }

  function aStar(start, target, avoidRestricted) {
    const openSet = [start];
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const getGridId = (c) => `${c.row},${c.col}`;
    
    gScore.set(getGridId(start), 0);
    fScore.set(getGridId(start), heuristic(start, target));

    while (openSet.length > 0) {
      openSet.sort((a, b) => (fScore.get(getGridId(a)) ?? Infinity) - (fScore.get(getGridId(b)) ?? Infinity));
      const current = openSet.shift();

      if (current.row === target.row && current.col === target.col) {
        const path = [current];
        let curr = current;
        while (cameFrom.has(getGridId(curr))) {
          curr = cameFrom.get(getGridId(curr));
          path.unshift(curr);
        }
        return path;
      }

      const neighbors = getNeighbors(current);
      for (const neighbor of neighbors) {
        if (neighbor.isLand && (neighbor.row !== start.row || neighbor.col !== start.col) && (neighbor.row !== target.row || neighbor.col !== target.col)) continue;
        
        let penalty = 0;
        let isRestricted = false;
        
        for (const zone of CONSERVATION_ZONES) {
          if (zone.restrictedMonths.includes(currentMonth) && isPointInPolygon({ lat: neighbor.lat, lng: neighbor.lng }, zone.polygon)) {
            isRestricted = true;
            break;
          }
        }
        
        if (avoidRestricted && isRestricted) {
          continue;
        }

        const moveCost = getDistanceKM(current.lat, current.lng, neighbor.lat, neighbor.lng);
        const tentativeGScore = (gScore.get(getGridId(current)) ?? Infinity) + moveCost + penalty;

        if (tentativeGScore < (gScore.get(getGridId(neighbor)) ?? Infinity)) {
          cameFrom.set(getGridId(neighbor), current);
          gScore.set(getGridId(neighbor), tentativeGScore);
          fScore.set(getGridId(neighbor), tentativeGScore + heuristic(neighbor, target));

          if (!openSet.find(c => c.row === neighbor.row && c.col === neighbor.col)) {
            openSet.push(neighbor);
          }
        }
      }
    }
    return [];
  }

  function smoothPath(path) {
    if (path.length <= 2) return path.map(p => ({ lat: p.lat, lng: p.lng }));
    
    const smoothed = [{ lat: path[0].lat, lng: path[0].lng }];
    for (let i = 1; i < path.length - 1; i++) {
      const prev = smoothed[smoothed.length - 1];
      const curr = path[i];
      const next = path[i + 1];
      
      smoothed.push({
        lat: (prev.lat + curr.lat * 2 + next.lat) / 4,
        lng: (prev.lng + curr.lng * 2 + next.lng) / 4
      });
    }
    smoothed.push({ lat: path[path.length - 1].lat, lng: path[path.length - 1].lng });
    return smoothed;
  }

  const stdPathCells = aStar(startGridCell, targetGridCell, false);
  let optPathCells = aStar(startGridCell, targetGridCell, true);
  
  if (optPathCells.length === 0) {
      // do not fall back
  }

  const stdPath = smoothPath(stdPathCells);
  const optPath = optPathCells.length > 0 ? smoothPath(optPathCells) : [];

  let cutsSpawningBan = false;
  for (const cell of stdPathCells) {
    for (const zone of CONSERVATION_ZONES) {
      if (zone.restrictedMonths.includes(currentMonth) && isPointInPolygon({ lat: cell.lat, lng: cell.lng }, zone.polygon)) {
        cutsSpawningBan = true;
        break;
      }
    }
    if (cutsSpawningBan) break;
  }

  function getPathDistance(path) {
    let d = 0;
    for (let i = 0; i < path.length - 1; i++) {
      d += getDistanceKM(path[i].lat, path[i].lng, path[i+1].lat, path[i+1].lng);
    }
    return d;
  }

  const totalDist = optPath.length > 0 ? getPathDistance(optPath) : 0;
  const stdDist = getPathDistance(stdPath);

  return {
    portName: port.name,
    targetCell: { lat: targetCell.lat, lng: targetCell.lng },
    path: optPath,
    stdPath: stdPath,
    distanceKM: Math.round(totalDist),
    estTimeHours: parseFloat((totalDist / 18).toFixed(1)),
    stdDistanceKM: Math.round(stdDist),
    stdTimeHours: parseFloat((stdDist / 18).toFixed(1)),
    cutsSpawningBan: cutsSpawningBan
  };
}
