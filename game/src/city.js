// Solara Bay's city: a seeded road grid with blocks, buildings, parks and a
// beach on the west edge. Generation is deterministic for a given seed.
import { WORLD, PALETTE, DISTRICTS, PLACES } from './config.js';
import { mulberry32, range, int, pick } from './random.js';

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const size = WORLD.size;
  const gap = WORLD.roadGap;
  const roads = [];
  for (let x = gap; x < size; x += gap) roads.push(x);
  for (let y = gap; y < size; y += gap) roads.push(y);
  const vertical = roads.slice();
  const horizontal = roads.slice();

  const buildings = [];
  const parks = [];
  // One building or park per block, with jitter inside the block.
  for (let gx = 0; gx < vertical.length; gx++) {
    for (let gy = 0; gy < horizontal.length; gy++) {
      const x0 = vertical[gx] + WORLD.roadWidth / 2 + WORLD.blockInset;
      const y0 = horizontal[gy] + WORLD.roadWidth / 2 + WORLD.blockInset;
      const bw = gap - WORLD.roadWidth - WORLD.blockInset * 2;
      const bh = gap - WORLD.roadWidth - WORLD.blockInset * 2;
      if (x0 + bw > size - 60 || y0 + bh > size - 60) continue;
      // Keep the marina plaza and the beach clear.
      if (gx === 0 && gy === 0) continue;
      if (gx === 0) continue; // west strip is beach
      const roll = rng();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: bw, h: bh, trees: int(rng, 3, 7) });
      } else {
        const w = range(rng, bw * 0.45, bw * 0.8);
        const h = range(rng, bh * 0.45, bh * 0.8);
        const x = x0 + range(rng, 0, bw - w);
        const y = y0 + range(rng, 0, bh - h);
        buildings.push({
          x, y, w, h,
          color: pick(rng, PALETTE.buildingRoof),
          tall: rng() < 0.22,
        });
      }
    }
  }

  // Decorative palm trees along the beach.
  const palms = [];
  for (let y = 120; y < size - 120; y += 130) {
    palms.push({ x: range(rng, 90, 210), y: y + range(rng, -30, 30) });
  }

  return {
    seed, size, vertical, horizontal, buildings, parks, palms,
    districts: DISTRICTS,
    places: PLACES,
  };
}

// Is a point on a road (within half the road width of a grid line)?
export function onRoad(city, x, y) {
  const half = WORLD.roadWidth / 2;
  const nearV = city.vertical.some((vx) => Math.abs(x - vx) <= half);
  const nearH = city.horizontal.some((hy) => Math.abs(y - hy) <= half);
  return nearV || nearH;
}

// Nearest road-grid intersection to a point.
export function nearestJunction(city, x, y) {
  let bx = city.vertical[0];
  let by = city.horizontal[0];
  for (const vx of city.vertical) if (Math.abs(vx - x) < Math.abs(bx - x)) bx = vx;
  for (const hy of city.horizontal) if (Math.abs(hy - y) < Math.abs(by - y)) by = hy;
  return { x: bx, y: by };
}

// A random point on a road, at least `minDist` from (fx, fy).
export function randomRoadPoint(city, rng, fx, fy, minDist) {
  for (let i = 0; i < 40; i++) {
    const vertical = rng() < 0.5;
    const line = pick(rng, vertical ? city.vertical : city.horizontal);
    const along = range(rng, 200, city.size - 200);
    const p = vertical ? { x: line, y: along } : { x: along, y: line };
    const dx = p.x - fx;
    const dy = p.y - fy;
    if (dx * dx + dy * dy >= minDist * minDist) return p;
  }
  return { x: city.vertical[2], y: city.horizontal[2] };
}

// Push a circle out of every building it overlaps; returns true on a hit.
export function collideBuildings(city, p, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - nx;
    const dy = p.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        p.x = nx + (dx / d) * radius;
        p.y = ny + (dy / d) * radius;
      } else {
        p.x = b.x - radius;
      }
    }
  }
  return hit;
}

// Is the point inside the sea (west of the beach)?
export function inWater(city, x) {
  return x < 70;
}
