// Melee and pistol combat. The player punches up close or shoots toward the
// mouse (or the nearest threat on touch). Hitting the innocent raises heat.
import { TUNING } from './config.js';
import { makeParticle, makeFloatText } from './entities.js';
import { addWanted, wastePlayer } from './police.js';

export function playerPunch(state) {
  const { player, audio } = state;
  audio.punch();
  player.attackCooldown = 0.45;
  const ax = player.x + Math.cos(player.angle) * 34;
  const ay = player.y + Math.sin(player.angle) * 34;
  let hitAny = false;
  for (const ped of state.peds) {
    if (ped.hp <= 0) continue;
    const d = Math.hypot(ped.x - ax, ped.y - ay);
    if (d < 52) {
      damagePed(state, ped, TUNING.punchDamage, false);
      hitAny = true;
    }
  }
  for (let i = 0; i < 5; i++) {
    state.particles.push(makeParticle(ax, ay, (Math.random() - 0.5) * 160, (Math.random() - 0.5) * 160, 0.3, '#ffe08a', 4));
  }
  return hitAny;
}

export function playerShoot(state, tx, ty) {
  const { player, audio } = state;
  if (player.ammo <= 0) {
    audio.denied();
    state.floaters.push(makeFloatText(player.x, player.y - 34, 'No ammo', '#ff6a5e'));
    player.attackCooldown = 0.3;
    return;
  }
  player.ammo -= 1;
  player.attackCooldown = 0.32;
  audio.shot();
  state.playerShooting = true;
  state.shootFlash = 0.08;
  const aim = Math.atan2(ty - player.y, tx - player.x);
  player.angle = aim;
  // Hitscan: nearest living ped or car along the aim within range.
  let best = null;
  let bestD = TUNING.pistolRange;
  const consider = (obj, radius) => {
    const dx = obj.x - player.x;
    const dy = obj.y - player.y;
    const along = dx * Math.cos(aim) + dy * Math.sin(aim);
    if (along < 10 || along > bestD) return;
    const side = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
    if (side < radius + 14) {
      best = obj;
      bestD = along;
    }
  };
  for (const ped of state.peds) if (ped.hp > 0) consider(ped, 16);
  for (const car of state.cars) {
    if (car === state.playerCar) continue;
    consider(car, 34);
  }
  const ex = player.x + Math.cos(aim) * bestD;
  const ey = player.y + Math.sin(aim) * bestD;
  state.particles.push(makeParticle(ex, ey, 0, 0, 0.25, '#ffd34d', 6));
  if (best) {
    if (best.kind === 'ped') damagePed(state, best, TUNING.pistolDamage, true);
    else if (best.kind === 'car') {
      best.hp -= TUNING.pistolDamage;
      state.particles.push(makeParticle(ex, ey, 0, -40, 0.4, '#ffb14d', 5));
      if (best.driver === 'traffic') {
        best.driver = null;
        best.speed = 0;
        addWanted(state, 1);
      }
    }
  }
}

export function damagePed(state, ped, amount, loud) {
  ped.hp -= amount;
  state.particles.push(makeParticle(ped.x, ped.y, 0, -50, 0.4, '#ff5e4d', 5));
  if (ped.hp <= 0) {
    ped.dead = true;
    state.floaters.push(makeFloatText(ped.x, ped.y - 30, ped.thug ? '+$120' : 'Down', ped.thug ? '#7dff8a' : '#ff6a5e'));
    if (ped.thug) {
      state.cash += 120;
      state.missionKills = (state.missionKills || 0) + 1;
    } else {
      addWanted(state, 1);
    }
    if (ped.cop) addWanted(state, 1);
  } else if (loud) {
    ped.scared = true;
    if (!ped.thug && !ped.cop) addWanted(state, 1);
  }
  if (ped.thug) {
    // Thugs fight back at close range.
    ped.target = state.player;
  }
}

export function updateThugs(state, dt) {
  for (const thug of state.peds.filter((p) => p.thug && !p.dead)) {
    const dx = state.player.x - thug.x;
    const dy = state.player.y - thug.y;
    const d = Math.hypot(dx, dy);
    if (d > 500) continue;
    thug.angle = Math.atan2(dy, dx);
    if (d > 44) {
      thug.speed = 175;
      thug.x += Math.cos(thug.angle) * thug.speed * dt;
      thug.y += Math.sin(thug.angle) * thug.speed * dt;
      thug.walkPhase += dt * 10;
    } else {
      thug.attackTimer = (thug.attackTimer || 0) - dt;
      if (thug.attackTimer <= 0) {
        thug.attackTimer = 0.9;
        state.player.hp -= 9;
        state.audio.punch();
        state.particles.push(makeParticle(state.player.x, state.player.y, 0, -40, 0.3, '#ff5e4d', 5));
        if (state.player.hp <= 0) {
          state.player.hp = 0;
          wastePlayer(state);
        }
      }
    }
  }
  // Sweep the dead out of the way.
  state.peds = state.peds.filter((p) => !p.dead || p.thug);
  for (const p of state.peds) if (p.dead && p.thug) p.fade = (p.fade || 0) + dt;
  state.peds = state.peds.filter((p) => !p.dead || (p.fade || 0) < 2);
}
