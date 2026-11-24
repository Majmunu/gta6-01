// Wanted level, police pursuit, arrest (busted) and death (wasted).
import { TUNING } from './config.js';
import { makeCar, makePed, makeParticle } from './entities.js';
import { randomRoadPoint } from './city.js';
import { angleLerp, clamp } from './random.js';

export function addWanted(state, stars) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + stars, 0, 5);
  state.wantedTimer = 0;
  // First heat gets an immediate visible response instead of waiting on the trickle.
  if (before === 0 && state.wanted > 0 && state.cops.length === 0) {
    if (state.playerInCar) {
      const p = randomRoadPoint(state.city, state.rng, state.player.x, state.player.y, 700);
      const car = makeCar(state.rng, p.x, p.y, 0, { police: true, driver: 'police', color: '#22303e' });
      car.speed = 200;
      state.cars.push(car);
      state.cops.push(car);
    } else {
      const p = randomRoadPoint(state.city, state.rng, state.player.x, state.player.y, 420);
      const cop = makePed(state.rng, p.x, p.y, { cop: true });
      state.peds.push(cop);
      state.cops.push(cop);
    }
  }
}

export function updatePolice(state, dt) {
  const { city, rng, player } = state;

  // Wanted decays when the player stays out of sight of the police.
  if (state.wanted === 0 && state.cops.length > 0) {
    state.cars = state.cars.filter((c) => !c.police);
    state.peds = state.peds.filter((p) => !p.cop);
    state.cops = [];
  }
  if (state.wanted > 0) {
    const seen = state.cops.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 420);
    if (!seen) {
      state.wantedTimer += dt;
      if (state.wantedTimer > TUNING.wantedDecaySeconds) {
        state.wanted -= 1;
        state.wantedTimer = 0;
      }
    } else {
      state.wantedTimer = 0;
    }
  }

  // Spawn pressure scales with the wanted level.
  const wantCars = state.wanted >= 2 ? Math.min(TUNING.copCarMax, state.wanted) : 0;
  const wantFoot = state.wanted >= 1 ? Math.min(TUNING.copFootMax, state.wanted + 1) : 0;
  const copCars = state.cops.filter((c) => c.kind === 'car' && c.police);
  const copFeet = state.cops.filter((c) => c.kind === 'ped' && c.cop);
  if (copCars.length < wantCars && rng() < dt * 2.5) {
    const p = randomRoadPoint(city, rng, player.x, player.y, 700);
    const car = makeCar(rng, p.x, p.y, 0, { police: true, driver: 'police', color: '#22303e' });
    car.speed = 200;
    state.cars.push(car);
    state.cops.push(car);
  }
  if (copFeet.length < wantFoot && rng() < dt * 5 && !state.playerInCar) {
    const p = randomRoadPoint(city, rng, player.x, player.y, 320);
    const cop = makePed(rng, p.x, p.y, { cop: true });
    state.peds.push(cop);
    state.cops.push(cop);
  }

  // Cruiser pursuit: steer at the player and ram.
  for (const car of state.cops.filter((c) => c.kind === 'car')) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const d = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    car.angle = angleLerp(car.angle, want, Math.min(1, dt * 2.4));
    const targetSpeed = d > 260 ? 520 : 380;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.6);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (d < 70) {
      // Ram: damage the player or their car.
      if (state.playerInCar) {
        state.playerCar.hp -= TUNING.copRamDamage * dt * 2;
        if (state.playerCar.hp <= 0) ejectPlayer(state, 'Your car was wrecked by the police.');
      } else {
        state.player.hp -= TUNING.copRamDamage * dt * 2;
      }
      state.particles.push(makeParticle(player.x, player.y, 0, 0, 0.3, '#ffd34d', 5));
    }
    if (d > 1800) {
      state.cars = state.cars.filter((c) => c !== car);
      state.cops = state.cops.filter((c) => c !== car);
    }
  }

  // Foot cops: chase; arrest when close and the player is slow or on foot.
  for (const cop of state.cops.filter((c) => c.kind === 'ped')) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const d = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    cop.speed = TUNING.copFootSpeed;
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    cop.walkPhase += dt * 10;
    if (d < 34 && !state.playerInCar) {
      state.bustedTimer += dt;
      if (state.bustedTimer > 1.1) bustPlayer(state);
    } else if (d > 60) {
      state.bustedTimer = Math.max(0, state.bustedTimer - dt);
    }
    if (d > 1600) {
      state.peds = state.peds.filter((p) => p !== cop);
      state.cops = state.cops.filter((c) => c !== cop);
    }
  }
}

export function ejectPlayer(state, reason) {
  const { player } = state;
  if (state.playerInCar && state.playerCar) {
    state.playerCar.driver = null;
    state.playerCar.speed = 0;
    player.x = state.playerCar.x + Math.cos(state.playerCar.angle + Math.PI / 2) * 40;
    player.y = state.playerCar.y + Math.sin(state.playerCar.angle + Math.PI / 2) * 40;
    state.playerInCar = false;
    state.playerCar = null;
  }
  state.floaters.push({ x: player.x, y: player.y - 30, text: reason, color: '#ff6a5e', life: 2, maxLife: 2, kind: 'floattext' });
}

export function bustPlayer(state) {
  if (state.mode !== 'play') return;
  const fine = Math.min(state.cash, TUNING.bustFine);
  state.cash -= fine;
  state.mode = 'busted';
  state.modeTimer = 0;
  state.bustedMessage = `BUSTED — the Solara Bay PD took $${fine} in fines.`;
  state.wanted = 0;
  state.cops = [];
  state.cars = state.cars.filter((c) => !c.police);
  state.audio.siren(false);
}

export function wastePlayer(state) {
  if (state.mode !== 'play') return;
  const cost = Math.min(state.cash, TUNING.wasteCost);
  state.cash -= cost;
  state.mode = 'wasted';
  state.modeTimer = 0;
  state.wastedMessage = `WASTED — the hospital patched you up for $${cost}.`;
  state.wanted = Math.max(0, state.wanted - 2);
  state.cops = [];
  state.cars = state.cars.filter((c) => !c.police);
  state.audio.siren(false);
}

export function respawnPlayer(state) {
  const { city } = state;
  const home = city.places.safehouse;
  state.player.x = home.x;
  state.player.y = home.y;
  state.player.hp = TUNING.playerHealth;
  state.playerInCar = false;
  state.playerCar = null;
  state.bustedTimer = 0;
  state.mode = 'play';
}
