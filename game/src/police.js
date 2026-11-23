// Wanted level and the Bay PD: foot cops who chase and arrest, and
// cruisers that ram. Heat rises with crime and cools off when the player
// lies low and out of sight.
import { CFG } from './config.js';
import { makeCop, makeCar, makeParticle } from './entities.js';
import { clamp, dist2, angleLerp } from './random.js';

export function addWanted(S, stars, reason) {
  if (S.wanted >= CFG.maxWanted) return;
  S.wanted = clamp(S.wanted + stars, 0, CFG.maxWanted);
  S.lastCrimeAt = S.time;
  S.crimeFlash = Math.max(S.crimeFlash, 1.2);
  if (reason) S.lastCrime = reason;
}

export function updateWanted(S, dt) {
  // Cool off: no crime for a while and no cop close by.
  if (S.wanted > 0 && S.time - S.lastCrimeAt > CFG.wantedDecayDelay) {
    let copNear = false;
    for (const cop of S.cops) {
      if (dist2(cop.x, cop.y, S.player.x, S.player.y) < 500 * 500) { copNear = true; break; }
    }
    if (!copNear) {
      for (const car of S.cars) {
        if (car.kind === 'police' && dist2(car.x, car.y, S.player.x, S.player.y) < 500 * 500) { copNear = true; break; }
      }
    }
    if (!copNear) {
      S.wantedTimer += dt;
      if (S.wantedTimer >= CFG.wantedDecayStep) {
        S.wantedTimer = 0;
        S.wanted = Math.max(0, S.wanted - 1);
      }
    } else {
      S.wantedTimer = 0;
    }
  }

  // Keep the right number of cops on the street.
  const wantFoot = S.wanted > 0 ? Math.min(S.wanted + 1, 4) : 0;
  const wantCars = S.wanted >= 2 ? Math.min(S.wanted - 1, 4) : 0;
  while (S.cops.length < wantFoot) spawnCop(S);
  while (S.cops.length > wantFoot) S.cops.pop();
  const policeCars = S.cars.filter((c) => c.kind === 'police' && !c.dead);
  let guard = 0;
  while (policeCars.length < wantCars && guard++ < 4) {
    spawnPoliceCar(S);
    policeCars.push(S.cars[S.cars.length - 1]);
  }
  // Extra cruisers drive off when heat drops.
  if (policeCars.length > wantCars) {
    for (let i = policeCars.length - 1; i >= wantCars; i--) policeCars[i].dead = true;
  }
}

function spawnCop(S) {
  const a = S.rng() * Math.PI * 2;
  const r = 420 + S.rng() * 200;
  const x = clamp(S.player.x + Math.cos(a) * r, 60, CFG.worldSize - 60);
  const y = clamp(S.player.y + Math.sin(a) * r, 60, CFG.worldSize - 60);
  S.cops.push(makeCop(x, y));
}

function spawnPoliceCar(S) {
  const a = S.rng() * Math.PI * 2;
  const r = 520 + S.rng() * 220;
  const x = clamp(S.player.x + Math.cos(a) * r, 60, CFG.worldSize - 60);
  const y = clamp(S.player.y + Math.sin(a) * r, 60, CFG.worldSize - 60);
  const car = makeCar(x, y, a, 'police', S.rng);
  car.targetSpeed = CFG.policeSpeed;
  S.cars.push(car);
}

export function updatePolice(S, dt) {
  // Foot cops: run at the player, punch, and arrest if they hold on.
  for (const cop of S.cops) {
    if (cop.dead) continue;
    const dx = S.player.x - cop.x, dy = S.player.y - cop.y;
    const d = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    cop.punchTimer -= dt;
    if (d > 26) {
      cop.arrestTimer = 0;
      const sp = 205;
      cop.x += (dx / d) * sp * dt;
      cop.y += (dy / d) * sp * dt;
      const fixed = S.city.resolveCircle(cop.x, cop.y, 11);
      cop.x = fixed.x; cop.y = fixed.y;
    } else if (!S.player.inCar) {
      // On foot and cornered: the arrest clock runs.
      cop.arrestTimer += dt;
      if (cop.punchTimer <= 0) {
        cop.punchTimer = 0.9;
        damagePlayer(S, 7, 'Beaten by a cop');
        S.audio.punch();
      }
      if (cop.arrestTimer > 1.6) {
        S.busted = true;
        return;
      }
    } else {
      // Player is in a car: the cop tries to drag them out by smashing.
      if (cop.punchTimer <= 0) {
        cop.punchTimer = 1.1;
        if (S.player.car) S.player.car.speed *= 0.55;
        S.audio.punch();
      }
    }
  }

  // Police cruisers: steer straight at the player and ram.
  for (const car of S.cars) {
    if (car.dead || car.kind !== 'police') continue;
    const dx = S.player.x - car.x, dy = S.player.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) continue;
    const want = Math.atan2(dy, dx);
    car.angle = angleLerp(car.angle, want, Math.min(1, dt * 2.2));
    const target = d > 320 ? CFG.policeSpeed : CFG.policeSpeed * 0.85;
    car.speed = clamp(car.speed + 300 * dt, 0, target);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = S.city.resolveCircle(car.x, car.y, 16);
    // A ram that clips a building slows the cruiser hard.
    if (fixed.x !== car.x || fixed.y !== car.y) car.speed *= 0.5;
    car.x = fixed.x; car.y = fixed.y;

    // Ram the player's car or knock the player down.
    if (S.player.inCar && S.player.car) {
      const pd = Math.hypot(S.player.car.x - car.x, S.player.car.y - car.y);
      if (pd < 42) {
        S.player.car.speed *= 0.6;
        car.speed *= 0.7;
        damagePlayer(S, 4, 'Ram by a cruiser');
        S.audio.crash();
        spark(S, car.x, car.y);
      }
    } else {
      const pd = Math.hypot(S.player.x - car.x, S.player.y - car.y);
      if (pd < 30 && car.speed > 60) {
        damagePlayer(S, 12, 'Run down by a cruiser');
        S.player.x += (S.player.x - car.x) / pd * 40;
        S.player.y += (S.player.y - car.y) / pd * 40;
        S.audio.crash();
      }
    }
  }

  S.cops = S.cops.filter((c) => !c.dead);
}

function spark(S, x, y) {
  for (let i = 0; i < 6; i++) {
    S.particles.push(makeParticle(x, y, (S.rng() - 0.5) * 220, (S.rng() - 0.5) * 220, 0.35, '#ffd21f', 3));
  }
}

export function damagePlayer(S, amount, cause) {
  if (S.godTimer > 0 || S.mode !== 'playing') return;
  S.player.health -= amount;
  S.lastDamageCause = cause;
  S.hurtFlash = 0.35;
  if (S.player.health <= 0) {
    S.player.health = 0;
    S.wasted = true;
  }
}
