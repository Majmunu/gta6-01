// Combat: fists on foot, the pistol when you have one, and what happens
// when a punch or a bullet lands on a pedestrian, a cop or a Breaker.
import { CFG } from './config.js';
import { makePickup, makeParticle } from './entities.js';
import { addWanted } from './police.js';

function allTargets(S) {
  const list = [];
  for (const p of S.peds) if (!p.dead) list.push(p);
  for (const c of S.cops) if (!c.dead) list.push(c);
  for (const t of S.thugs) if (!t.dead) list.push(t);
  return list;
}

function aimAngle(S) {
  // Mouse aim when the player has moved the mouse recently; otherwise face
  // the direction the player is walking or driving.
  if (S.input.mouseUsed && S.time - S.lastMouseMove < 4) {
    const wx = S.camera.x + S.input.mouseX - S.view.w / 2;
    const wy = S.camera.y + S.input.mouseY - S.view.h / 2;
    return Math.atan2(wy - S.player.y, wx - S.player.x);
  }
  return S.player.angle;
}

export function tryAttack(S) {
  if (S.player.attackCooldown > 0) return;
  S.player.attackCooldown = 0.32;
  const angle = aimAngle(S);
  S.player.angle = angle;

  if (S.player.hasPistol && S.player.ammo > 0) {
    shoot(S, angle);
  } else {
    punch(S, angle);
  }
}

function shoot(S, angle) {
  S.player.ammo--;
  S.audio.shot();
  S.muzzleFlash = 0.08;
  addWanted(S, 1, 'Shots fired');
  // Muzzle smoke.
  const mx = S.player.x + Math.cos(angle) * 22;
  const my = S.player.y + Math.sin(angle) * 22;
  S.particles.push(makeParticle(mx, my, Math.cos(angle) * 60, Math.sin(angle) * 60, 0.25, '#ffdf6b', 5));

  // Hitscan: nearest target inside a narrow cone and in range.
  let best = null, bestD = CFG.pistolRange;
  for (const t of allTargets(S)) {
    const dx = t.x - S.player.x, dy = t.y - S.player.y;
    const d = Math.hypot(dx, dy);
    if (d > CFG.pistolRange || d < 1) continue;
    const a = Math.atan2(dy, dx);
    let diff = Math.abs(a - angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 0.22 && d < bestD) { best = t; bestD = d; }
  }
  if (best) {
    damageTarget(S, best, CFG.pistolDamage, angle);
    // Tracer line.
    S.particles.push(makeParticle(best.x, best.y, 0, 0, 0.12, '#fff2a8', 2));
  }
}

function punch(S, angle) {
  S.audio.punch();
  let hit = false;
  for (const t of allTargets(S)) {
    const dx = t.x - S.player.x, dy = t.y - S.player.y;
    const d = Math.hypot(dx, dy);
    if (d > CFG.punchRange || d < 1) continue;
    const a = Math.atan2(dy, dx);
    let diff = Math.abs(a - angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 1.1) {
      damageTarget(S, t, CFG.punchDamage, a);
      hit = true;
    }
  }
  if (hit) {
    // Swinging at someone in public is a crime.
    addWanted(S, 1, 'Assault');
  }
}

export function damageTarget(S, t, amount, angle) {
  t.health -= amount;
  // Knockback and a red puff.
  t.x += Math.cos(angle) * 14;
  t.y += Math.sin(angle) * 14;
  S.particles.push(makeParticle(t.x, t.y, Math.cos(angle) * 120, Math.sin(angle) * 120, 0.4, '#c0392b', 4));
  if (t.kind === 'ped') t.flee = 3;
  if (t.kind === 'thug') t.aggro = true;
  if (t.health <= 0 && !t.dead) {
    t.dead = true;
    if (t.kind === 'thug') {
      S.mission.kills++;
      S.cash += 50;
      S.pickups.push(makePickup(t.x, t.y, 'cash', 50));
    } else if (t.kind === 'cop') {
      addWanted(S, 2, 'Cop down');
    } else {
      // A pedestrian down: heavy heat, and the body drops some cash.
      addWanted(S, 1, 'Pedestrian down');
      if (S.rng() < 0.5) S.pickups.push(makePickup(t.x, t.y, 'cash', 20 + Math.floor(S.rng() * 60)));
    }
  }
}

// Thugs fight back when the player gets close.
export function updateThugs(S, dt) {
  for (const t of S.thugs) {
    if (t.dead) continue;
    const dx = S.player.x - t.x, dy = S.player.y - t.y;
    const d = Math.hypot(dx, dy);
    t.punchTimer -= dt;
    if (d < 320) t.aggro = true;
    if (t.aggro && d > 30) {
      const sp = 165;
      t.x += (dx / d) * sp * dt;
      t.y += (dy / d) * sp * dt;
      t.angle = Math.atan2(dy, dx);
      const fixed = S.city.resolveCircle(t.x, t.y, 11);
      t.x = fixed.x; t.y = fixed.y;
    } else if (t.aggro && d <= 30 && t.punchTimer <= 0) {
      t.punchTimer = 1.0;
      S.player.health -= 9;
      S.hurtFlash = 0.3;
      S.audio.punch();
      if (S.player.health <= 0) {
        S.player.health = 0;
        S.wasted = true;
      }
    }
  }
  S.thugs = S.thugs.filter((t) => !t.dead);
}
