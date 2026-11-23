// Entity factories: cars, pedestrians, cops, thugs, pickups, particles.
// Plain data objects; the systems in traffic.js, police.js and combat.js
// move them around.
import { CFG } from './config.js';
import { pick } from './random.js';

let nextId = 1;

export function makeCar(x, y, angle, kind, rng) {
  const palette = kind === 'police' ? ['#1c2f4a'] : CFG.carPalette;
  return {
    id: nextId++,
    kind, // 'traffic' | 'parked' | 'police' | 'player' | 'special'
    x, y, angle,
    speed: 0,
    targetSpeed: 0,
    color: kind === 'special' ? '#ffd21f' : pick(rng, palette),
    name: kind === 'special' ? 'Comet GT' : kind === 'police' ? 'Bay PD Cruiser' : pick(rng, ['Sedan', 'Hatch', 'Coupe', 'Van', 'Pickup']),
    driver: kind === 'traffic' ? 'ped' : null, // traffic cars carry a driver
    // Traffic waypoint state (intersection grid coords we are heading to).
    tx: 0, ty: 0, fromIx: 0, fromIy: 0,
    stuck: 0,
    dead: false,
    siren: kind === 'police',
  };
}

export function makePed(x, y, rng) {
  const shirts = ['#d94f3d', '#3d7ad9', '#e8b23a', '#5cb85c', '#9b59b6', '#ecf0f1', '#f39c12'];
  return {
    id: nextId++,
    kind: 'ped',
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 0,
    targetSpeed: 38 + rng() * 22,
    shirt: pick(rng, shirts),
    skin: pick(rng, ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0']),
    // Sidewalk waypoint state.
    tx: x, ty: y,
    flee: 0,
    health: 30,
    dead: false,
    panic: 0,
  };
}

export function makeCop(x, y) {
  return {
    id: nextId++,
    kind: 'cop',
    x, y,
    angle: 0,
    speed: 0,
    shirt: '#1c2f4a',
    skin: '#e8b98a',
    health: 60,
    dead: false,
    punchTimer: 0,
    arrestTimer: 0,
    onFoot: true,
  };
}

export function makeThug(x, y) {
  return {
    id: nextId++,
    kind: 'thug',
    x, y,
    angle: 0,
    speed: 0,
    shirt: '#7a1f1f',
    skin: '#c98d5f',
    health: 70,
    dead: false,
    punchTimer: 0,
    aggro: false,
  };
}

export function makePickup(x, y, kind, amount) {
  return { id: nextId++, kind, x, y, amount, bob: 0, dead: false }; // kind: 'cash' | 'health' | 'ammo'
}

export function makeParticle(x, y, vx, vy, life, color, size) {
  return { x, y, vx, vy, life, maxLife: life, color, size };
}

export function resetIds() { nextId = 1; }
