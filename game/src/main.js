// Solmar Heat — game entry point. Owns the state object, the main loop,
// player movement and driving, interactions, menus and the busted/wasted
// flow. The systems in the other modules do the specialised work.
import { CFG, GAME_TITLE, GAME_SUBTITLE, CITY_NAME, PLACES } from './config.js';
import { makeRng, clamp, dist2, angleLerp, range } from './random.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { generateCity, placePoint, isOnRoad } from './city.js';
import { makeCar, makePed, makePickup, makeParticle, resetIds } from './entities.js';
import { spawnTraffic, spawnParked, spawnPeds, updateTraffic } from './traffic.js';
import { updateWanted, updatePolice, addWanted, damagePlayer } from './police.js';
import { MISSIONS, startMission, updateMission, missionMarker, advanceDialogue } from './missions.js';
import { tryAttack, updateThugs } from './combat.js';
import { drawHUD } from './hud.js';
import { drawWorld, updateCamera } from './render.js';
import { saveGame, loadGame, clearSave, hasSave } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

export function createState(seed) {
  resetIds();
  const rng = makeRng(seed);
  const city = generateCity(seed);
  const start = placePoint('start');
  const S = {
    seed, rng, city,
    mode: 'title', // title | playing | paused | busted | wasted
    time: 0,
    timeOfDay: 0.32,
    view: { w: window.innerWidth, h: window.innerHeight },
    camera: { x: start.x - window.innerWidth / 2, y: start.y - window.innerHeight / 2 },
    player: {
      x: start.x, y: start.y, angle: -Math.PI / 2,
      health: CFG.playerHealth, cash: 0,
      inCar: false, car: null,
      hasPistol: false, ammo: 0,
      attackCooldown: 0,
    },
    cash: 120,
    cars: [],
    peds: [],
    cops: [],
    thugs: [],
    pickups: [],
    particles: [],
    wanted: 0,
    wantedTimer: 0,
    lastCrimeAt: -100,
    lastCrime: '',
    crimeFlash: 0,
    hurtFlash: 0,
    muzzleFlash: 0,
    mission: null,
    missionCompleted: 0,
    objective: '',
    missionToast: 0,
    nextMissionTimer: -1,
    dialogue: null,
    talkDone: false,
    showMissionInfo: false,
    busted: false,
    wasted: false,
    lastDamageCause: '',
    godTimer: 0,
    frozen: false,
    shotMode: null,
    forceTouch: false,
    lastMouseMove: -10,
    lastMouseX: 0,
    lastMouseY: 0,
    saveGame: null,
    missionMarker: null,
    audio: new AudioEngine(),
    input: new Input(canvas),
    shake: 0,
  };
  S.saveGame = () => saveGame(S);
  S.missionMarker = () => missionMarker(S);
  return S;
}

let S = createState(20261124);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  S.view.w = window.innerWidth;
  S.view.h = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

// ---------- world setup ----------

function populateWorld() {
  spawnTraffic(S, 14);
  spawnParked(S, 10);
  spawnPeds(S, 26);
  // The gold Comet GT for mission 4, parked near the bank.
  const bank = placePoint('bank');
  const comet = makeCar(bank.x + 70, bank.y + 30, Math.PI / 2, 'special', S.rng);
  S.cars.push(comet);
  // Cash and health scattered around the start.
  S.pickups.push(makePickup(S.player.x + 60, S.player.y - 40, 'cash', 80));
  S.pickups.push(makePickup(S.player.x - 50, S.player.y + 60, 'health', 30));
}

populateWorld();

// ---------- player actions ----------

function nearestCar(maxD) {
  let best = null, bestD = maxD;
  for (const car of S.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - S.player.x, car.y - S.player.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function enterCar(car) {
  if (car.kind === 'traffic' && car.driver) {
    // Drag the driver out and take the car.
    const driver = makePed(car.x + 24, car.y + 24, S.rng);
    driver.flee = 4;
    S.peds.push(driver);
    car.driver = null;
    addWanted(S, 1, 'Stole a car');
  }
  if (car.kind === 'police') addWanted(S, 1, 'Stole a police cruiser');
  car.kind = car.kind === 'special' ? 'special' : 'player';
  car.driver = 'player';
  S.player.inCar = true;
  S.player.car = car;
  S.player.x = car.x;
  S.player.y = car.y;
  S.audio.door();
}

function exitCar() {
  const car = S.player.car;
  if (!car) return;
  const side = S.player.angle + Math.PI / 2;
  S.player.x = car.x + Math.cos(side) * 30;
  S.player.y = car.y + Math.sin(side) * 30;
  const fixed = S.city.resolveCircle(S.player.x, S.player.y, CFG.playerRadius);
  S.player.x = fixed.x; S.player.y = fixed.y;
  car.speed = 0;
  car.kind = car.kind === 'special' ? 'special' : 'parked';
  car.driver = null;
  S.player.inCar = false;
  S.player.car = null;
  S.audio.door();
}

function updatePlayerOnFoot(dt) {
  const axis = S.input.moveAxis();
  const len = Math.hypot(axis.x, axis.y);
  if (len > 0) {
    const nx = axis.x / len, ny = axis.y / len;
    S.player.x += nx * CFG.walkSpeed * dt;
    S.player.y += ny * CFG.walkSpeed * dt;
    S.player.angle = Math.atan2(ny, nx);
  }
  const fixed = S.city.resolveCircle(S.player.x, S.player.y, CFG.playerRadius);
  S.player.x = fixed.x; S.player.y = fixed.y;
  // Do not walk through cars.
  for (const car of S.cars) {
    if (car.dead) continue;
    const dx = S.player.x - car.x, dy = S.player.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d < 26 && d > 0.01) {
      S.player.x = car.x + (dx / d) * 26;
      S.player.y = car.y + (dy / d) * 26;
    }
  }
  S.player.x = clamp(S.player.x, 20, CFG.worldSize - 20);
  S.player.y = clamp(S.player.y, 20, CFG.worldSize - 20);

  if (S.input.interact) {
    if (S.dialogue) { advanceDialogue(S); return; }
    // Talk step of a mission.
    if (S.mission && S.mission.active) {
      const step = MISSIONS[S.mission.index].steps[S.mission.step];
      if (step && step.type === 'talk') {
        const p = placePoint(step.place);
        if (Math.hypot(S.player.x - p.x, S.player.y - p.y) < step.r) {
          S.talkDone = true;
          if (step.onTalk === 'wanted1') addWanted(S, 1, 'Seen at the docks');
          return;
        }
      }
    }
    const car = nearestCar(52);
    if (car) enterCar(car);
  }
  if (S.input.attack) tryAttack(S);
}

function updatePlayerDriving(dt) {
  const car = S.player.car;
  if (!car) { S.player.inCar = false; return; }
  const axis = S.input.moveAxis();
  const forward = axis.y < 0; // W / up
  const back = axis.y > 0;    // S / down
  const steer = axis.x;       // A/D

  if (forward) car.speed += CFG.carAccel * dt;
  else if (back) {
    if (car.speed > 20) car.speed -= CFG.carBrake * dt;
    else car.speed -= CFG.carAccel * 0.6 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 90 * dt;
    if (Math.abs(car.speed) < 12) car.speed = 0;
  }
  if (S.input.handbrake) {
    car.speed -= Math.sign(car.speed) * 420 * dt;
    if (Math.abs(car.speed) > 60) {
      // Skid smoke and a slide.
      S.particles.push(makeParticle(
        car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18,
        (S.rng() - 0.5) * 40, (S.rng() - 0.5) * 40, 0.5, '#bbbbbb', 5));
    }
  }
  car.speed = clamp(car.speed, -CFG.carReverseMax, CFG.carMaxSpeed);
  const turnRate = CFG.carTurn * clamp(Math.abs(car.speed) / 140, 0.15, 1) * Math.sign(car.speed || 1);
  car.angle += steer * turnRate * dt;
  const prevX = car.x, prevY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const fixed = S.city.resolveCircle(car.x, car.y, CFG.carRadius);
  if (fixed.x !== car.x || fixed.y !== car.y) {
    // Hit a building: lose speed, and a hard hit hurts.
    const impact = Math.abs(car.speed);
    car.x = fixed.x; car.y = fixed.y;
    car.speed *= 0.35;
    if (impact > 240) {
      damagePlayer(S, Math.round((impact - 240) / 22), 'Crashed into a building');
      S.audio.crash();
      S.shake = 0.3;
    }
  }
  // Bump other cars.
  for (const other of S.cars) {
    if (other === car || other.dead) continue;
    const dx = car.x - other.x, dy = car.y - other.y;
    const d = Math.hypot(dx, dy);
    if (d < 40 && d > 0.01) {
      const push = (40 - d) / 2;
      car.x += (dx / d) * push;
      car.y += (dy / d) * push;
      other.x -= (dx / d) * push;
      other.y -= (dy / d) * push;
      if (Math.abs(car.speed) > 120) {
        car.speed *= 0.7;
        other.speed = car.speed * 0.4;
        if (other.kind === 'traffic') { other.kind = 'parked'; other.driver = null; }
        S.audio.crash();
      }
    }
  }
  // Run over pedestrians at speed: a crime, and the street notices.
  if (Math.abs(car.speed) > 90) {
    for (const ped of S.peds) {
      if (ped.dead) continue;
      if (dist2(ped.x, ped.y, car.x, car.y) < 24 * 24) {
        ped.dead = true;
        addWanted(S, 1, 'Hit a pedestrian');
        S.audio.crash();
        S.particles.push(makeParticle(ped.x, ped.y, 0, 0, 0.5, '#c0392b', 5));
      }
    }
  }
  // Exhaust puffs while accelerating.
  if (forward && Math.abs(car.speed) > 40 && S.rng() < 0.5) {
    S.particles.push(makeParticle(
      car.x - Math.cos(car.angle) * 22, car.y - Math.sin(car.angle) * 22,
      -Math.cos(car.angle) * 30 + (S.rng() - 0.5) * 20,
      -Math.sin(car.angle) * 30 + (S.rng() - 0.5) * 20,
      0.6, '#999999', 3));
  }
  S.player.x = car.x;
  S.player.y = car.y;
  S.player.angle = car.angle;

  if (S.input.interact) {
    if (S.dialogue) { advanceDialogue(S); return; }
    exitCar();
  }
  if (S.input.attack) tryAttack(S);
  car.x = clamp(car.x, 20, CFG.worldSize - 20);
  car.y = clamp(car.y, 20, CFG.worldSize - 20);
}

function updatePickups(dt) {
  for (const pk of S.pickups) {
    if (pk.dead) continue;
    pk.bob += dt;
    if (Math.hypot(pk.x - S.player.x, pk.y - S.player.y) < 30) {
      pk.dead = true;
      if (pk.kind === 'cash') { S.cash += pk.amount; S.audio.cash(); }
      else if (pk.kind === 'health') {
        S.player.health = Math.min(CFG.playerHealth, S.player.health + pk.amount);
        S.audio.pickup();
      } else if (pk.kind === 'ammo') {
        S.player.ammo += pk.amount;
        S.audio.pickup();
      }
    }
  }
  S.pickups = S.pickups.filter((p) => !p.dead);
}

function updateParticles(dt) {
  for (const pt of S.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
    pt.life -= dt;
  }
  S.particles = S.particles.filter((p) => p.life > 0);
}

// ---------- flow ----------

function newGame() {
  const seed = S.seed;
  S = createState(seed);
  resize();
  populateWorld();
  S.mode = 'playing';
  S.objective = 'Press M for missions — first job starts shortly';
  S.nextMissionTimer = 1.5;
  announce('New game started in Solmar Bay.');
}

function continueGame() {
  const data = loadGame();
  if (!data) { newGame(); return; }
  const seed = data.seed || 20261124;
  S = createState(seed);
  resize();
  populateWorld();
  S.cash = data.cash;
  S.player.health = data.health;
  S.player.ammo = data.ammo;
  S.player.hasPistol = data.hasPistol;
  S.missionCompleted = data.missionCompleted;
  S.player.x = data.x;
  S.player.y = data.y;
  S.wanted = data.wanted;
  S.timeOfDay = data.timeOfDay;
  S.mode = 'playing';
  S.nextMissionTimer = 2;
  S.objective = 'Welcome back to Solmar Bay';
  announce('Save loaded.');
}

function respawnAfter(kind) {
  const spot = placePoint(kind === 'busted' ? 'police' : 'hospital');
  S.player.x = spot.x + 40;
  S.player.y = spot.y + 40;
  S.player.health = CFG.playerHealth;
  S.player.inCar = false;
  S.player.car = null;
  S.wanted = 0;
  S.cops = [];
  S.cash = Math.max(0, S.cash - (kind === 'busted' ? 150 : 100));
  S.busted = false;
  S.wasted = false;
  S.godTimer = 3;
  S.mode = 'playing';
  S.objective = kind === 'busted' ? 'Busted — the cops let you off with a fine' : 'Patched up at St. Mara Hospital';
  announce(kind === 'busted' ? 'Busted. Released with a fine.' : 'Wasted. Patched up at the hospital.');
}

function update(dt) {
  S.time += dt;
  S.timeOfDay = (0.32 + S.time / CFG.dayLength) % 1;
  S.crimeFlash = Math.max(0, S.crimeFlash - dt);
  S.hurtFlash = Math.max(0, S.hurtFlash - dt);
  S.muzzleFlash = Math.max(0, S.muzzleFlash - dt);
  S.missionToast = Math.max(0, S.missionToast - dt);
  S.godTimer = Math.max(0, S.godTimer - dt);
  S.shake = Math.max(0, S.shake - dt);
  S.player.attackCooldown = Math.max(0, S.player.attackCooldown - dt);

  // Mouse aim freshness.
  if (S.input.mouseX !== S.lastMouseX || S.input.mouseY !== S.lastMouseY) {
    S.lastMouseMove = S.time;
    S.lastMouseX = S.input.mouseX;
    S.lastMouseY = S.input.mouseY;
  }

  // Dialogue freezes the world.
  if (S.dialogue) {
    if (S.input.interact || S.input.attack || S.input.justPressed('Enter')) advanceDialogue(S);
    return;
  }

  if (S.input.justPressed('KeyM')) S.showMissionInfo = !S.showMissionInfo;
  if (S.input.justPressed('Escape') || S.input.justPressed('KeyP')) {
    S.mode = 'paused';
    S.audio.setEngine(0, false);
    return;
  }

  // Chain the next mission a few seconds after the last one ends.
  if (S.nextMissionTimer > 0) {
    S.nextMissionTimer -= dt;
    if (S.nextMissionTimer <= 0 && S.missionCompleted < MISSIONS.length) {
      startMission(S, S.missionCompleted);
    }
  }

  if (S.player.inCar) updatePlayerDriving(dt);
  else updatePlayerOnFoot(dt);

  updateTraffic(S, dt);
  updatePolice(S, dt);
  updateWanted(S, dt);
  updateThugs(S, dt);
  updateMission(S, dt);
  updatePickups(dt);
  updateParticles(dt);
  updateCamera(S, dt);

  // Audio follows the action.
  const driving = S.player.inCar && S.player.car;
  S.audio.setEngine(driving ? Math.abs(S.player.car.speed) / CFG.carMaxSpeed : 0, !!driving);
  S.audio.setSiren(S.wanted >= 2, dt);

  // Keep the streets populated.
  if (S.cars.filter((c) => c.kind === 'traffic').length < 10) spawnTraffic(S, 2);
  if (S.peds.length < 18) spawnPeds(S, 3);

  if (S.busted) { S.mode = 'busted'; S.audio.busted(); return; }
  if (S.wasted) { S.mode = 'wasted'; S.audio.busted(); return; }
  if (S.mission && S.mission.done && S.mission.index === MISSIONS.length - 1 && !S.storyComplete) {
    S.storyComplete = true;
    S.objective = 'STORY COMPLETE — Solmar Bay is yours. Free roam!';
  }
}

// ---------- drawing ----------

function drawTitle() {
  const w = S.view.w, h = S.view.h;
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,14,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(GAME_TITLE, w / 2, h * 0.32);
  ctx.fillStyle = '#fff';
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText(GAME_SUBTITLE, w / 2, h * 0.32 + 36);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#cfd3da';
  ctx.fillText('Steal cars. Outrun the Bay PD. Take back Solmar Bay, one job at a time.', w / 2, h * 0.32 + 66);

  const save = hasSave();
  const lines = [
    save ? 'ENTER — Continue your story' : 'ENTER — New game',
    'N — New game',
    'H — How to play',
  ];
  ctx.font = 'bold 18px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? '#ffd21f' : '#f2f2f2';
    ctx.fillText(line, w / 2, h * 0.52 + i * 34);
  });
  if (S.showHelp) {
    ctx.fillStyle = 'rgba(8,10,14,0.9)';
    const bw = 560, bx = w / 2 - bw / 2;
    ctx.fillRect(bx, h * 0.62, bw, 170);
    ctx.fillStyle = '#f2f2f2';
    ctx.font = '14px system-ui, sans-serif';
    const help = [
      'WASD / arrows — move on foot, drive in a car',
      'E — enter / exit a car, talk, advance dialogue',
      'F or click — punch, or shoot with the pistol',
      'Space — handbrake   M — mission list   Esc — pause',
      'Steal cars, finish 5 story missions, watch the stars.',
      'Progress saves automatically after each mission.',
    ];
    help.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.62 + 30 + i * 24));
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawPaused() {
  const w = S.view.w, h = S.view.h;
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,14,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h * 0.4);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#cfd3da';
  ctx.fillText('Esc — resume    S — save game    Q — quit to title', w / 2, h * 0.4 + 44);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawEndScreen(kind) {
  const w = S.view.w, h = S.view.h;
  ctx.save();
  ctx.fillStyle = kind === 'busted' ? 'rgba(10,20,60,0.72)' : 'rgba(60,10,10,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', w / 2, h * 0.4);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#cfd3da';
  const cause = kind === 'busted'
    ? 'The Bay PD caught up with you. Fine: $150.'
    : `Taken out — ${S.lastDamageCause || 'the streets got you'}. Hospital bill: $100.`;
  ctx.fillText(cause, w / 2, h * 0.4 + 40);
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('Press ENTER to get back on the streets', w / 2, h * 0.4 + 84);
  ctx.textAlign = 'left';
  ctx.restore();
}

function draw() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (S.shake > 0) {
    ctx.translate((S.rng() - 0.5) * 10 * S.shake, (S.rng() - 0.5) * 10 * S.shake);
  }
  // The world always renders in world coordinates under the camera.
  ctx.translate(-S.camera.x, -S.camera.y);
  drawWorld(ctx, S);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (S.mode === 'title') drawTitle();
  else if (S.mode === 'paused') { drawHUD(ctx, S); drawPaused(); }
  else if (S.mode === 'busted') drawEndScreen('busted');
  else if (S.mode === 'wasted') drawEndScreen('wasted');
  else drawHUD(ctx, S);
  ctx.restore();
}

// ---------- main loop ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  S.audio.ensure();

  if (S.mode === 'title') {
    if (S.input.justPressed('Enter')) {
      if (hasSave()) continueGame();
      else newGame();
    } else if (S.input.justPressed('KeyN')) newGame();
    else if (S.input.justPressed('KeyH')) S.showHelp = !S.showHelp;
    updateCamera(S, dt);
    // Idle drift so the title view stays alive.
    S.time += dt;
    S.timeOfDay = (0.32 + S.time / CFG.dayLength) % 1;
  } else if (S.mode === 'paused') {
    if (S.input.justPressed('Escape') || S.input.justPressed('KeyP') || S.input.justPressed('Enter')) {
      S.mode = 'playing';
    } else if (S.input.justPressed('KeyS')) {
      saveGame(S);
      S.objective = 'Game saved';
    } else if (S.input.justPressed('KeyQ')) {
      S.mode = 'title';
      S.showHelp = false;
    }
  } else if (S.mode === 'busted' || S.mode === 'wasted') {
    if (S.input.justPressed('Enter')) respawnAfter(S.mode);
  } else if (S.mode === 'playing' && !S.frozen) {
    update(dt);
  }

  draw();
  S.input.endFrame();
  requestAnimationFrame(frame);
}

// ---------- screenshot staging ----------

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  const seed = Number(params.get('seed') || 1);
  S = createState(seed);
  resize();
  populateWorld();
  applyShot(S, shot);
  // Stage the world for one frame so the shot is deterministic.
  updateCamera(S, 0.016);
  announce(`Staged screenshot: ${shot}`);
}

// Expose the live state for headless play-testing.
window.__game = () => S;
window.__newGame = newGame;

requestAnimationFrame(frame);
