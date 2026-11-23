// The city of Solmar Bay: a road grid, building blocks, parks, parking
// lots and named places. Generated once from a seed; everything else in
// the game asks this module where things are and what is solid.
import { CFG, PLACES } from './config.js';
import { makeRng, range, rangeInt, pick, chance } from './random.js';

export function blockCenter(bx, by) {
  return { x: (bx + 0.5) * CFG.block, y: (by + 0.5) * CFG.block };
}

export function placePoint(key) {
  const p = PLACES[key];
  return blockCenter(p.bx, p.by);
}

// Distance from a point to the nearest road centreline (one axis at a time).
export function roadOffset(v) {
  const m = ((v % CFG.block) + CFG.block) % CFG.block;
  return Math.min(m, CFG.block - m);
}

export function isOnRoad(x, y) {
  return roadOffset(x) <= CFG.roadHalf + 4 || roadOffset(y) <= CFG.roadHalf + 4;
}

// Nearest intersection grid coordinates (ix, iy) in road units.
export function nearestIntersection(x, y) {
  return {
    ix: Math.round(x / CFG.block),
    iy: Math.round(y / CFG.block),
  };
}

export function generateCity(seed) {
  const rng = makeRng(seed);
  const n = Math.round(CFG.worldSize / CFG.block); // roads 0..n
  const buildings = [];
  const trees = [];
  const parks = [];
  const parkingLots = [];
  const specialCells = new Set(Object.values(PLACES).map((p) => `${p.bx},${p.by}`));

  for (let bx = 0; bx < n; bx++) {
    for (let by = 0; by < n; by++) {
      const key = `${bx},${by}`;
      const x0 = bx * CFG.block + CFG.roadHalf + 10;
      const y0 = by * CFG.block + CFG.roadHalf + 10;
      const x1 = (bx + 1) * CFG.block - CFG.roadHalf - 10;
      const y1 = (by + 1) * CFG.block - CFG.roadHalf - 10;
      if (specialCells.has(key)) {
        // Named places get one landmark building and a forecourt.
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        buildings.push({
          x: cx - 55, y: cy - 42, w: 110, h: 84,
          color: pick(rng, CFG.colors.buildingRoof), landmark: true,
        });
        continue;
      }
      const roll = rng();
      if (roll < 0.12) {
        // Park: grass and trees, no buildings.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const count = rangeInt(rng, 5, 9);
        for (let i = 0; i < count; i++) {
          trees.push({ x: range(rng, x0 + 12, x1 - 12), y: range(rng, y0 + 12, y1 - 12), r: range(rng, 7, 11) });
        }
        continue;
      }
      if (roll < 0.2) {
        // Parking lot: flat asphalt with painted bays.
        parkingLots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // Ordinary block: one tall slab, or a row of small shops.
      if (chance(rng, 0.45)) {
        const w = range(rng, 90, 150), h = range(rng, 70, 130);
        const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        buildings.push({ x: cx - w / 2, y: cy - h / 2, w, h, color: pick(rng, CFG.colors.buildingRoof) });
      } else {
        const rows = rangeInt(rng, 1, 2);
        for (let r = 0; r < rows; r++) {
          const cols = rangeInt(rng, 1, 2);
          for (let c = 0; c < cols; c++) {
            const w = range(rng, 46, 72), h = range(rng, 40, 64);
            const cx = x0 + ((c + 0.5) / cols) * (x1 - x0);
            const cy = y0 + ((r + 0.5) / rows) * (y1 - y0);
            buildings.push({ x: cx - w / 2, y: cy - h / 2, w, h, color: pick(rng, CFG.colors.buildingRoof) });
          }
        }
      }
      // Street trees along the block edge.
      if (chance(rng, 0.5)) {
        trees.push({ x: range(rng, x0, x1), y: y0 + 4, r: 8 });
        trees.push({ x: range(rng, x0, x1), y: y1 - 4, r: 8 });
      }
    }
  }

  const city = { seed, n, buildings, trees, parks, parkingLots };

  // Circle (player, car, ped) vs buildings: push the circle out.
  city.resolveCircle = function (x, y, r) {
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx, dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.001) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          y = cy + (dy / d) * r;
        } else {
          // Centre inside the rect: push out along the smallest overlap.
          const left = x - b.x, right = b.x + b.w - x;
          const top = y - b.y, bottom = b.y + b.h - y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) x = b.x - r;
          else if (m === right) x = b.x + b.w + r;
          else if (m === top) y = b.y - r;
          else y = b.y + b.h + r;
        }
      }
    }
    return { x, y };
  };

  city.hitsBuilding = function (x, y, r) {
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  };

  // A random point on a road, for spawning traffic and pedestrians.
  city.randomRoadPoint = function (rngFn) {
    const ix = rangeInt(rngFn, 1, n - 1);
    const iy = rangeInt(rngFn, 1, n - 1);
    const horizontal = rngFn() < 0.5;
    if (horizontal) return { x: ix * CFG.block + range(rngFn, -80, 80), y: iy * CFG.block };
    return { x: ix * CFG.block, y: iy * CFG.block + range(rngFn, -80, 80) };
  };

  // A random parked-car spot: a parking lot bay or a roadside kerb.
  city.randomParkedSpot = function (rngFn) {
    if (parkingLots.length && rngFn() < 0.6) {
      const lot = pick(rngFn, parkingLots);
      return {
        x: range(rngFn, lot.x + 16, lot.x + lot.w - 16),
        y: range(rngFn, lot.y + 16, lot.y + lot.h - 16),
        angle: pick(rngFn, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      };
    }
    const ix = rangeInt(rngFn, 1, n - 1);
    const iy = rangeInt(rngFn, 1, n - 1);
    const horizontal = rngFn() < 0.5;
    const off = rngFn() < 0.5 ? 26 : -26;
    if (horizontal) return { x: ix * CFG.block + range(rngFn, -90, 90), y: iy * CFG.block + off, angle: off > 0 ? 0 : Math.PI };
    return { x: ix * CFG.block + off, y: iy * CFG.block + range(rngFn, -90, 90), angle: off > 0 ? Math.PI / 2 : -Math.PI / 2 };
  };

  return city;
}
