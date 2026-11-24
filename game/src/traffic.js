// Traffic cars that follow the road grid, and pedestrians who walk the
// sidewalks and run when frightened. Pure movement AI; collisions with the
// player are handled in main.js.
import { TUNING } from './config.js';
import { nearestJunction, randomRoadPoint, onRoad } from './city.js';
import { makeCar, makePed } from './entities.js';
import { angleLerp, clamp } from './random.js';

export function spawnTraffic(state, count) {
  const { city, rng } = state;
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(city, rng, state.player.x, state.player.y, 500);
    const vertical = rng() < 0.5;
    const angle = vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const car = makeCar(rng, p.x + (vertical ? (rng() < 0.5 ? -18 : 18) : 0), p.y + (vertical ? 0 : (rng() < 0.5 ? -18 : 18)), angle, { driver: 'traffic' });
    car.speed = 130 + rng() * 90;
    car.target = pickNextJunction(city, rng, car);
    state.cars.push(car);
  }
}

export function spawnPeds(state, count) {
  const { city, rng } = state;
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(city, rng, state.player.x, state.player.y, 300);
    const ped = makePed(rng, p.x + 70, p.y + 70);
    ped.target = randomRoadPoint(city, rng, p.x, p.y, 100);
    state.peds.push(ped);
  }
}

export function spawnParkedCars(state, count) {
  const { city, rng } = state;
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(city, rng, state.player.x, state.player.y, 350);
    const vertical = rng() < 0.5;
    const angle = vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const off = rng() < 0.5 ? -62 : 62;
    const car = makeCar(rng, p.x + (vertical ? off : 0), p.y + (vertical ? 0 : off), angle, { driver: null });
    state.cars.push(car);
  }
}

function pickNextJunction(city, rng, car) {
  const j = nearestJunction(city, car.x + Math.cos(car.angle) * 220, car.y + Math.sin(car.angle) * 220);
  // Keep going straight most of the time; sometimes turn.
  const options = [];
  const vertical = Math.abs(Math.cos(car.angle)) < 0.5;
  if (vertical) {
    options.push({ x: car.x, y: j.y + (car.angle > 0 ? 400 : -400) });
    options.push({ x: j.x + 400, y: j.y });
    options.push({ x: j.x - 400, y: j.y });
  } else {
    options.push({ x: j.x + (car.angle < Math.PI / 2 && car.angle > -Math.PI / 2 ? 400 : -400), y: car.y });
    options.push({ x: j.x, y: j.y + 400 });
    options.push({ x: j.x, y: j.y - 400 });
  }
  const t = options[Math.floor(rng() * options.length)];
  return { x: clamp(t.x, 150, city.size - 150), y: clamp(t.y, 150, city.size - 150) };
}

export function updateTraffic(state, dt) {
  const { city, rng, player } = state;
  const px = player.x;
  const py = player.y;

  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    if (!car.target) car.target = pickNextJunction(city, rng, car);
    const dx = car.target.x - car.x;
    const dy = car.target.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 30) {
      car.target = pickNextJunction(city, rng, car);
      continue;
    }
    const want = Math.atan2(dy, dx);
    car.angle = angleLerp(car.angle, want, Math.min(1, dt * 3));
    // Slow down when the player is right ahead.
    const ahead = (player.x - car.x) * Math.cos(car.angle) + (player.y - car.y) * Math.sin(car.angle);
    const side = Math.abs((player.x - car.x) * -Math.sin(car.angle) + (player.y - car.y) * Math.cos(car.angle));
    let speed = 150;
    if (ahead > 0 && ahead < 120 && side < 40) speed = 0;
    car.speed += (speed - car.speed) * Math.min(1, dt * 2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 120, city.size - 120);
    car.y = clamp(car.y, 120, city.size - 120);
    // Despawn far away, respawn near the player.
    if (Math.hypot(car.x - px, car.y - py) > 1500) {
      const p = randomRoadPoint(city, rng, px, py, 600);
      car.x = p.x;
      car.y = p.y;
      car.target = null;
    }
  }

  for (const ped of state.peds) {
    if (ped.cop || ped.thug) continue;
    const dx = player.x - ped.x;
    const dy = player.y - ped.y;
    const d = Math.hypot(dx, dy);
    const danger = state.wanted >= 3 || (state.playerShooting && d < 260);
    if (d < 200 && (danger || state.playerInCar)) ped.scared = true;
    if (ped.scared) {
      ped.angle = Math.atan2(-dy, -dx);
      ped.speed = 190;
      if (d > 520) ped.scared = false;
    } else {
      if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 40) {
        ped.target = randomRoadPoint(city, rng, ped.x, ped.y, 120);
      }
      const tx = ped.target.x - ped.x;
      const ty = ped.target.y - ped.y;
      ped.angle = angleLerp(ped.angle, Math.atan2(ty, tx), Math.min(1, dt * 4));
      ped.speed = 55;
    }
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    ped.walkPhase += dt * (ped.speed > 100 ? 11 : 6);
    ped.x = clamp(ped.x, 100, city.size - 100);
    ped.y = clamp(ped.y, 100, city.size - 100);
    if (!onRoad(city, ped.x, ped.y) && rng() < dt * 0.05) {
      ped.target = randomRoadPoint(city, rng, ped.x, ped.y, 80);
    }
  }
}
