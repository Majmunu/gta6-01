// Solara Bay — game loop, player driving and walking, camera, collisions,
// pickups, mode machine (title / play / pause / busted / wasted).
import { TUNING, PLACES } from './config.js';
import { mulberry32, clamp, circleRect } from './random.js';
import { buildCity, collideBuildings, inWater, onRoad } from './city.js';
import { makeCar, makePed, makeParticle, makePickup, makeFloatText } from './entities.js';
import { createInput } from './input.js';
import { AudioSys } from './audio.js';
import { spawnTraffic, spawnPeds, spawnParkedCars, updateTraffic } from './traffic.js';
import { updatePolice, bustPlayer, wastePlayer, respawnPlayer, addWanted, ejectPlayer } from './police.js';
import { playerPunch, playerShoot, updateThugs } from './combat.js';
import { startMission, updateMission, advanceDialogue, MISSIONS } from './missions.js';
import { drawWorld, drawLighting } from './render.js';
import { drawHUD, drawTitle, drawPause, drawMissionList, drawEnd } from './hud.js';
import { applyShot } from './shots.js';
import { saveGame, loadGame, hasSave } from './save.js';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || '1') || 1;

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const input = createInput(canvas);
  const audio = new AudioSys();
  const rng = mulberry32(SEED);
  const city = buildCity(SEED);

  const state = {
    city, rng, input, audio,
    time: 0,
    mode: 'title',
    modeTimer: 0,
    player: {
      x: PLACES.diner.x, y: PLACES.diner.y + 80, angle: -Math.PI / 2,
      hp: TUNING.playerHealth, ammo: TUNING.pistolAmmoStart,
      walkPhase: 0, attackCooldown: 0,
    },
    cars: [], peds: [], cops: [], particles: [], floaters: [], pickups: [],
    wanted: 0, wantedTimer: 0, bustedTimer: 0,
    cash: 0,
    playerInCar: false, playerCar: null, playerShooting: false, shootFlash: 0,
    missionIndex: 0, missionStep: 0, missionKills: 0, missionTimer: 0,
    missionTargetCar: null, missionCaseTaken: false,
    currentMissionTitle: MISSIONS[0].title,
    objective: '', marker: null, dialogue: null, dialogueQueue: [],
    missionBanner: null,
    bustedMessage: '', wastedMessage: '',
    saveExists: hasSave(),
    showMissions: false,
    camera: { x: 0, y: 0 },
    shot: params.get('shot') || null,
    shotReady: false,
  };
  state.saveGame = () => saveGame(state);

  spawnTraffic(state, TUNING.trafficCount);
  spawnPeds(state, TUNING.pedCount);
  spawnParkedCars(state, 14);
  // A couple of useful pickups near the start.
  state.pickups.push(makePickup(PLACES.diner.x + 60, PLACES.diner.y + 120, 'health', 40));
  state.pickups.push(makePickup(PLACES.diner.x - 60, PLACES.diner.y + 120, 'ammo', 24));

  // Mute toggle.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyN') {
      audio.setMuted(!audio.muted);
      state.floaters.push(makeFloatText(state.player.x, state.player.y - 30, audio.muted ? 'Muted' : 'Sound on', '#fff'));
    }
  });

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function newGame() {
    state.cash = 0;
    state.wanted = 0;
    state.player.hp = TUNING.playerHealth;
    state.player.ammo = TUNING.pistolAmmoStart;
    state.player.x = PLACES.diner.x;
    state.player.y = PLACES.diner.y + 80;
    state.mode = 'play';
    startMission(state, 0);
    audio.ensure();
  }

  function continueGame() {
    const data = loadGame();
    if (data) {
      state.cash = data.cash;
      state.player.hp = data.hp;
      state.player.ammo = data.ammo;
      state.player.x = data.x;
      state.player.y = data.y;
    }
    state.mode = 'play';
    startMission(state, Math.min(data ? data.missionIndex : 0, MISSIONS.length - 1));
    audio.ensure();
  }

  // --- Player on foot -----------------------------------------------------
  function updateOnFoot(dt) {
    const p = state.player;
    let mx = 0;
    let my = 0;
    if (input.isDown('up')) my -= 1;
    if (input.isDown('down')) my += 1;
    if (input.isDown('left')) mx -= 1;
    if (input.isDown('right')) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      p.x += mx * TUNING.walkSpeed * dt;
      p.y += my * TUNING.walkSpeed * dt;
      p.angle = Math.atan2(my, mx);
      p.walkPhase += dt * 10;
    }
    if (p.x < 80) p.x = 80;
    p.x = clamp(p.x, 80, city.size - 40);
    p.y = clamp(p.y, 40, city.size - 40);
    collideBuildings(city, p, 14);

    // Enter a car.
    if (input.wasPressed('action')) {
      let best = null;
      let bestD = 80;
      for (const car of state.cars) {
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        if (d < bestD) { best = car; bestD = d; }
      }
      if (best) stealCar(state, best);
    }
    // Punch or shoot.
    p.attackCooldown = Math.max(0, p.attackCooldown - dt);
    if (input.wasPressed('attack') && p.attackCooldown <= 0) {
      playerPunch(state);
    }
    if (input.mouseClicked && p.attackCooldown <= 0) {
      const wx = state.camera.x + input.mouseX;
      const wy = state.camera.y + input.mouseY;
      playerShoot(state, wx, wy);
    }
    if (input.mouseDown && p.ammo > 0) {
      p.angle = Math.atan2(state.camera.y + input.mouseY - p.y, state.camera.x + input.mouseX - p.x);
    }
  }

  function stealCar(state, car) {
    const p = state.player;
    if (car.driver === 'traffic') {
      const driver = makePed(state.rng, car.x + 30, car.y + 30);
      driver.scared = true;
      state.peds.push(driver);
      car.driver = null;
      addWanted(state, 1);
      state.floaters.push(makeFloatText(p.x, p.y - 34, 'Car stolen! +★', '#ffd34d'));
    }
    car.driver = 'player';
    state.playerInCar = true;
    state.playerCar = car;
    p.x = car.x;
    p.y = car.y;
    audio.ensure();
  }

  // --- Player driving -----------------------------------------------------
  function updateDriving(dt) {
    const car = state.playerCar;
    if (!car) { state.playerInCar = false; return; }
    const accel = input.isDown('up') ? TUNING.carAccel : input.isDown('down') ? -TUNING.carReverseAccel : 0;
    const steer = (input.isDown('left') ? -1 : 0) + (input.isDown('right') ? 1 : 0);
    if (accel !== 0) car.speed += accel * dt;
    if (input.isDown('brake')) {
      car.speed -= Math.sign(car.speed) * TUNING.carBrake * dt;
      if (Math.abs(car.speed) < 20) car.speed = 0;
      car.brakeLight = true;
      if (Math.abs(car.speed) > 120 && Math.random() < dt * 20) {
        state.particles.push(makeParticle(car.x - Math.cos(car.angle) * 24, car.y - Math.sin(car.angle) * 24, 0, 0, 0.4, '#888', 4));
      }
    } else {
      car.brakeLight = false;
    }
    car.speed -= car.speed * TUNING.carDrag * dt;
    car.speed = clamp(car.speed, -TUNING.carMaxReverse, TUNING.carMaxSpeed);
    const turnRate = TUNING.carTurn * clamp(Math.abs(car.speed) / 200, 0, 1);
    car.angle += steer * turnRate * Math.sign(car.speed) * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (collideBuildings(city, car, 26)) {
      car.speed *= -0.25;
      state.particles.push(makeParticle(car.x, car.y, 0, 0, 0.3, '#ffb14d', 5));
    }
    if (inWater(city, car.x)) {
      car.x = 90;
      car.speed *= 0.4;
    }
    car.x = clamp(car.x, 80, city.size - 40);
    car.y = clamp(car.y, 40, city.size - 40);
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    // Car-car bumps.
    for (const other of state.cars) {
      if (other === car) continue;
      const dx = car.x - other.x;
      const dy = car.y - other.y;
      const d = Math.hypot(dx, dy);
      if (d < 58 && d > 0.01) {
        const push = (58 - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        car.x += nx * push;
        car.y += ny * push;
        if (other.driver === 'traffic') {
          other.x -= nx * push;
          other.y -= ny * push;
          other.speed *= 0.5;
        }
        if (Math.abs(car.speed) > 260) {
          car.hp -= 4;
          other.hp -= 4;
        }
      }
    }
    if (car.hp <= 0) ejectPlayer(state, 'Your car was wrecked.');
    // Exit the car.
    if (input.wasPressed('action')) {
      car.driver = null;
      car.speed = 0;
      state.playerInCar = false;
      state.playerCar = null;
      state.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 44;
      state.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 44;
    }
    audio.engine(Math.abs(car.speed) / TUNING.carMaxSpeed);
  }

  function updatePickups(dt) {
    const p = state.player;
    for (const k of state.pickups) {
      if (k.taken) continue;
      k.bob += dt;
      if (Math.hypot(k.x - p.x, k.y - p.y) < 40) {
        k.taken = true;
        state.audio.pickup();
        if (k.pickupKind === 'cash') {
          state.cash += k.amount;
          state.floaters.push(makeFloatText(p.x, p.y - 34, `+$${k.amount}`, '#7dff8a'));
        } else if (k.pickupKind === 'health') {
          state.player.hp = Math.min(TUNING.playerHealth, state.player.hp + k.amount);
          state.floaters.push(makeFloatText(p.x, p.y - 34, `+${k.amount} HP`, '#ff8a94'));
        } else if (k.pickupKind === 'ammo') {
          state.player.ammo += k.amount;
          state.floaters.push(makeFloatText(p.x, p.y - 34, `+${k.amount} ammo`, '#ffd34d'));
        } else if (k.pickupKind === 'case') {
          // Handled by the mission step.
        }
      }
    }
    state.pickups = state.pickups.filter((k) => !k.taken || k.pickupKind === 'case');
  }

  function updateParticles(dt) {
    for (const pt of state.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    for (const f of state.floaters) f.life -= dt;
    state.floaters = state.floaters.filter((f) => f.life > 0);
    if (state.missionBanner) {
      state.missionBanner.timer -= dt;
      if (state.missionBanner.timer <= 0) state.missionBanner = null;
    }
    state.shootFlash = Math.max(0, state.shootFlash - dt);
    state.playerShooting = false;
  }

  function updateCamera(dt) {
    const w = canvas.width;
    const h = canvas.height;
    const tx = clamp(state.player.x - w / 2, 0, Math.max(0, city.size - w));
    const ty = clamp(state.player.y - h / 2, 0, Math.max(0, city.size - h));
    state.camera.x += (tx - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (ty - state.camera.y) * Math.min(1, dt * 5);
  }

  function update(dt) {
    state.time += dt;
    if (state.mode === 'play') {
      // While a dialogue box is up, the same press only advances it.
      if (state.dialogue) {
        updateParticles(dt);
        updateCamera(dt);
        if (input.wasPressed('action') || input.mouseClicked) {
          advanceDialogue(state);
        }
        input.endFrame();
        return;
      }
      if (state.playerInCar) updateDriving(dt);
      else updateOnFoot(dt);
      updateTraffic(state, dt);
      updatePolice(state, dt);
      updateThugs(state, dt);
      updateMission(state, dt);
      updatePickups(dt);
      updateParticles(dt);
      updateCamera(dt);
      if (state.player.hp <= 0 && state.mode === 'play') wastePlayer(state);
      audio.siren(state.wanted >= 2 && state.cops.length > 0);
      // Pause / missions overlay.
      if (input.wasPressed('pause')) {
        state.mode = 'pause';
        state.saveGame();
      }
      if (input.wasPressed('missions')) state.showMissions = !state.showMissions;
    } else if (state.mode === 'pause') {
      if (input.wasPressed('pause')) state.mode = 'play';
      if (input.wasPressed('missions')) state.showMissions = !state.showMissions;
    } else if (state.mode === 'title') {
      updateTraffic(state, dt * 0.4);
      updateParticles(dt);
      updateCamera(dt);
      if (input.wasPressed('confirm')) {
        if (state.saveExists) continueGame();
        else newGame();
      }
    } else if (state.mode === 'busted' || state.mode === 'wasted') {
      state.modeTimer += dt;
      if (input.wasPressed('confirm') && state.modeTimer > 0.6) {
        respawnPlayer(state);
      }
    }
    input.endFrame();
  }

  function render() {
    const w = canvas.width;
    const h = canvas.height;
    const view = { camX: state.camera.x, camY: state.camera.y, w, h };
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-state.camera.x, -state.camera.y);
    drawWorld(ctx, state, view);
    ctx.restore();
    drawLighting(ctx, w, h, state.time);
    if (state.mode === 'play' || state.mode === 'pause') {
      drawHUD(ctx, state, view);
      if (state.showMissions) drawMissionList(ctx, state, view);
      if (state.mode === 'pause') drawPause(ctx, state, view);
    } else if (state.mode === 'title') {
      drawTitle(ctx, state, view);
    } else if (state.mode === 'busted' || state.mode === 'wasted') {
      drawHUD(ctx, state, view);
      drawEnd(ctx, state, view, state.mode);
    }
  }

  // Screenshot staging: settle the scene, then flag ready.
  let frames = 0;
  if (state.shot) {
    applyShot(state, state.shot, SEED);
    updateCamera(1);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    frames += 1;
    if (state.shot && frames > 45 && !state.shotReady) {
      state.shotReady = true;
      window.__shotReady = true;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__game = {
    state,
    newGame,
    continueGame,
    startMission: (i) => startMission(state, i),
    bust: () => bustPlayer(state),
    waste: () => wastePlayer(state),
  };
  return state;
}

// Boot.
const canvas = document.getElementById('game');
if (canvas) createGame(canvas);
