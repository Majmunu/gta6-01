// Entity factories: cars, pedestrians, police, thugs, pickups, particles.
// All state is plain data; behaviour lives in traffic.js, police.js and
// combat.js.
import { PALETTE } from './config.js';
import { pick } from './random.js';

let nextId = 1;

export function makeCar(rng, x, y, angle, opts = {}) {
  return {
    id: nextId++,
    kind: 'car',
    x, y,
    angle,
    speed: 0,
    color: opts.color || pick(rng, PALETTE.carColors),
    model: opts.model || 'sedan',
    driver: opts.driver || null, // 'traffic' | 'player' | null (parked)
    police: !!opts.police,
    hp: 100,
    stuck: 0,
    target: null,
    brakeLight: false,
  };
}

export function makePed(rng, x, y, opts = {}) {
  return {
    id: nextId++,
    kind: 'ped',
    x, y,
    angle: rng() * Math.PI * 2,
    speed: 0,
    walkPhase: rng() * 6,
    color: pick(rng, ['#e86a6a', '#6a9fe8', '#e8d06a', '#7ad07a', '#d06ad8', '#e8e8e8']),
    scared: false,
    thug: !!opts.thug,
    cop: !!opts.cop,
    hp: opts.thug ? 60 : 100,
    target: null,
  };
}

export function makePickup(x, y, kind, amount) {
  return {
    id: nextId++,
    kind: 'pickup',
    pickupKind: kind, // 'cash' | 'health' | 'ammo'
    x, y,
    amount,
    bob: 0,
    taken: false,
  };
}

export function makeParticle(x, y, vx, vy, life, color, size) {
  return {
    id: nextId++,
    kind: 'particle',
    x, y, vx, vy, life, maxLife: life, color, size,
  };
}

export function makeFloatText(x, y, text, color) {
  return {
    id: nextId++,
    kind: 'floattext',
    x, y, text, color, life: 1.6, maxLife: 1.6,
  };
}
