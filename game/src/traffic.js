// Traffic cars and pedestrians: they follow the road grid and sidewalks,
// stop for the car ahead, and run when things get violent.
import { CFG } from './config.js';
import { makeCar, makePed } from './entities.js';
import { clamp, dist2, angleLerp, pick, range } from './random.js';

// Lane offset for right-hand traffic: moving east, drive south of the line.
function laneOffset(dir) {
  // dir: 0 east, 1 south, 2 west, 3 north
  if (dir === 0) return { dx: 0, dy: 16 };
  if (dir === 1) return { dx: -16, dy: 0 };
  if (dir === 2) return { dx: 0, dy: -16 };
  return { dx: 16, dy: 0 };
}

const DIR_VEC = [
  { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 },
];

export function spawnTraffic(S, count) {
  for (let i = 0; i < count; i++) {
    const p = S.city.randomRoadPoint(S.rng);
    const dir = Math.floor(S.rng() * 4);
    const car = makeCar(p.x, p.y, dir * Math.PI / 2, 'traffic', S.rng);
    car.targetSpeed = CFG.trafficSpeed * (0.8 + S.rng() * 0.4);
    // Head for a neighbouring intersection.
    const inter = { ix: Math.round(p.x / CFG.block), iy: Math.round(p.y / CFG.block) };
    car.fromIx = inter.ix; car.fromIy = inter.iy;
    pickNextTarget(S, car, dir);
    S.cars.push(car);
  }
}

export function spawnParked(S, count) {
  for (let i = 0; i < count; i++) {
    const spot = S.city.randomParkedSpot(S.rng);
    const car = makeCar(spot.x, spot.y, spot.angle, 'parked', S.rng);
    S.cars.push(car);
  }
}

export function spawnPeds(S, count) {
  for (let i = 0; i < count; i++) {
    const p = S.city.randomRoadPoint(S.rng);
    const ped = makePed(p.x + range(S.rng, -30, 30), p.y + range(S.rng, -30, 30), S.rng);
    pickPedTarget(S, ped);
    S.peds.push(ped);
  }
}

function pickNextTarget(S, car, dir) {
  const n = S.city.n;
  const ix = Math.round(car.tx / CFG.block) || car.fromIx;
  const iy = Math.round(car.ty / CFG.block) || car.fromIy;
  // From the intersection we are heading to, choose the next one.
  const options = [];
  const fromDir = (dir + 2) % 4; // the direction we came from
  for (let d = 0; d < 4; d++) {
    if (d === fromDir) continue;
    const nx = ix + DIR_VEC[d].x, ny = iy + DIR_VEC[d].y;
    if (nx < 0 || nx > n || ny < 0 || ny > n) continue;
    options.push({ d, nx, ny });
  }
  if (!options.length) {
    // Dead end at the city edge: turn around.
    const d = fromDir;
    const nx = ix + DIR_VEC[d].x, ny = iy + DIR_VEC[d].y;
    options.push({ d, nx, ny });
  }
  const next = pick(S.rng, options);
  const off = laneOffset(next.d);
  car.tx = next.nx * CFG.block + off.dx;
  car.ty = next.ny * CFG.block + off.dy;
  car.dir = next.d;
  car.fromIx = ix; car.fromIy = iy;
}

function pickPedTarget(S, ped) {
  const inter = { ix: Math.round(ped.x / CFG.block), iy: Math.round(ped.y / CFG.block) };
  const options = [];
  for (let d = 0; d < 4; d++) {
    const nx = inter.ix + DIR_VEC[d].x, ny = inter.iy + DIR_VEC[d].y;
    if (nx < 0 || nx > S.city.n || ny < 0 || ny > S.city.n) continue;
    options.push({ nx, ny });
  }
  const t = pick(S.rng, options);
  // Walk on the sidewalk, 48px off the road centreline.
  const dx = t.nx - inter.ix, dy = t.ny - inter.iy;
  ped.tx = t.nx * CFG.block + (dy !== 0 ? 48 : 0) * (dx === 0 ? (S.rng() < 0.5 ? 1 : -1) : 0) + (dx !== 0 ? 0 : 0);
  ped.ty = t.ny * CFG.block + (dx !== 0 ? 48 : 0) * (dy === 0 ? (S.rng() < 0.5 ? 1 : -1) : 0);
  // Simpler: offset perpendicular to the walking direction.
  if (dx !== 0) { ped.tx = t.nx * CFG.block; ped.ty = t.ny * CFG.block + 48; }
  else { ped.tx = t.nx * CFG.block + 48; ped.ty = t.ny * CFG.block; }
}

function carAhead(S, car) {
  const v = DIR_VEC[car.dir];
  let best = Infinity;
  for (const other of S.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const along = dx * v.x + dy * v.y;
    const side = Math.abs(dx * -v.y + dy * v.x);
    if (along > 0 && along < 78 && side < 26 && along < best) best = along;
  }
  // The player's car counts too.
  if (S.player.inCar && S.player.car) {
    const dx = S.player.car.x - car.x, dy = S.player.car.y - car.y;
    const along = dx * v.x + dy * v.y;
    const side = Math.abs(dx * -v.y + dy * v.x);
    if (along > 0 && along < 78 && side < 26 && along < best) best = along;
  }
  return best;
}

export function updateTraffic(S, dt) {
  // Traffic cars.
  for (const car of S.cars) {
    if (car.dead || car.kind !== 'traffic') continue;
    const v = DIR_VEC[car.dir];
    const gap = carAhead(S, car);
    let target = car.targetSpeed;
    if (gap < 78) target = 0;
    car.speed = clamp(car.speed + Math.sign(target - car.speed) * 220 * dt, 0, Math.max(target, 0));
    car.x += v.x * car.speed * dt;
    car.y += v.y * car.speed * dt;
    car.angle = angleLerp(car.angle, car.dir * Math.PI / 2, Math.min(1, dt * 6));
    const d = Math.hypot(car.tx - car.x, car.ty - car.y);
    if (d < 14) pickNextTarget(S, car, car.dir);
    const fixed = S.city.resolveCircle(car.x, car.y, 16);
    car.x = fixed.x; car.y = fixed.y;
    // Respawn far-away traffic near the player so the streets stay alive.
    const pd = dist2(car.x, car.y, S.player.x, S.player.y);
    if (pd > 1600 * 1600) {
      const p = S.city.randomRoadPoint(S.rng);
      // Keep it on a road near the player instead of anywhere.
      car.x = S.player.x + (p.x - S.player.x) * 0.4;
      car.y = S.player.y + (p.y - S.player.y) * 0.4;
      car.speed = 0;
    }
  }

  // Pedestrians.
  for (const ped of S.peds) {
    if (ped.dead) continue;
    const toPlayer = Math.hypot(S.player.x - ped.x, S.player.y - ped.y);
    if (S.crimeFlash > 0 && toPlayer < 260) ped.flee = 2.5;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const a = Math.atan2(ped.y - S.player.y, ped.x - S.player.x);
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
      ped.angle = a;
      const fixed = S.city.resolveCircle(ped.x, ped.y, 10);
      ped.x = fixed.x; ped.y = fixed.y;
      continue;
    }
    const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 10) { pickPedTarget(S, ped); continue; }
    const a = Math.atan2(dy, dx);
    ped.angle = angleLerp(ped.angle, a, Math.min(1, dt * 8));
    ped.x += Math.cos(a) * ped.targetSpeed * dt;
    ped.y += Math.sin(a) * ped.targetSpeed * dt;
    const fixed = S.city.resolveCircle(ped.x, ped.y, 10);
    ped.x = fixed.x; ped.y = fixed.y;
  }

  S.cars = S.cars.filter((c) => !c.dead);
  S.peds = S.peds.filter((p) => !p.dead);
}
