// Deterministic staging for screenshots: ?shot=start|drive|chase|mission
// with &seed=1 builds the same scene every time, freezes the world, and
// lets the shot script capture a fixed, good-looking frame.
import { CFG, PLACES } from './config.js';
import { placePoint } from './city.js';
import { makeCar, makeThug } from './entities.js';
import { startMission } from './missions.js';
import { spawnTraffic, spawnParked, spawnPeds } from './traffic.js';
import { addWanted } from './police.js';

export function applyShot(S, name) {
  S.shotMode = name;
  S.mode = 'playing';
  S.frozen = true;
  S.dialogue = null;
  S.showMissionInfo = false;

  if (name === 'start') {
    // Title screen over a sunny downtown view, player on foot by a sedan.
    S.mode = 'title';
    S.timeOfDay = 0.45;
    const c = placePoint('start');
    S.player.x = c.x + 40;
    S.player.y = c.y + 10;
    S.player.angle = -Math.PI / 2;
    const car = makeCar(c.x + 90, c.y + 24, Math.PI / 2, 'parked', S.rng);
    S.cars.push(car);
    spawnTraffic(S, 10);
    spawnPeds(S, 14);
    S.camera.x = S.player.x - S.view.w / 2;
    S.camera.y = S.player.y - S.view.h / 2;
    return;
  }

  if (name === 'drive') {
    S.timeOfDay = 0.5;
    const c = placePoint('garage');
    const roadY = 2 * CFG.block;
    const car = makeCar(c.x, roadY + 16, 0, 'player', S.rng);
    car.speed = 260;
    S.cars.push(car);
    S.player.inCar = true;
    S.player.car = car;
    S.player.x = car.x;
    S.player.y = car.y;
    S.player.angle = 0;
    spawnTraffic(S, 12);
    spawnParked(S, 6);
    spawnPeds(S, 12);
    S.objective = "Meet Dee at Dee's Garage";
    S.mission = { index: 0, step: 1, holdTimer: 0, kills: 0, active: true, done: false };
    S.camera.x = S.player.x - S.view.w / 2 + 120;
    S.camera.y = S.player.y - S.view.h / 2;
    return;
  }

  if (name === 'chase') {
    S.timeOfDay = 0.62;
    const roadY = 6 * CFG.block;
    const car = makeCar(6 * CFG.block, roadY + 16, 0, 'player', S.rng);
    car.speed = 380;
    S.cars.push(car);
    S.player.inCar = true;
    S.player.car = car;
    S.player.x = car.x;
    S.player.y = car.y;
    S.player.angle = 0;
    addWanted(S, 3, 'Staged chase');
    // Cruisers right on the player's tail and alongside.
    for (const [dx, dy] of [[-160, 30], [-260, -20], [140, -40]]) {
      const pc = makeCar(car.x + dx, car.y + dy, 0, 'police', S.rng);
      pc.speed = 330;
      S.cars.push(pc);
    }
    spawnTraffic(S, 10);
    spawnPeds(S, 8);
    S.objective = 'Lose the wanted level (hide until the stars fade)';
    S.mission = { index: 3, step: 1, holdTimer: 0, kills: 0, active: true, done: false };
    S.camera.x = S.player.x - S.view.w / 2 + 100;
    S.camera.y = S.player.y - S.view.h / 2;
    return;
  }

  if (name === 'mission') {
    S.timeOfDay = 0.55;
    const c = placePoint('rivalTurf');
    S.player.x = c.x - 60;
    S.player.y = c.y + 40;
    S.player.angle = Math.PI / 4;
    S.player.hasPistol = true;
    S.player.ammo = 28;
    startMission(S, 2);
    S.mission.step = 1; // already on the turf, thugs out
    S.mission.spawned = true;
    S.dialogue = null;
    S.objective = 'Take down the Breakers (1/3)';
    S.mission.kills = 1;
    // Thugs mid-fight, one already down (frozen world, so stage them by hand).
    S.thugs = [];
    const t1 = makeThug(c.x + 40, c.y - 20);
    t1.aggro = true;
    const t2 = makeThug(c.x + 95, c.y + 35);
    t2.aggro = true;
    const t3 = makeThug(c.x - 10, c.y + 90);
    t3.aggro = true;
    S.thugs.push(t1, t2, t3);
    spawnTraffic(S, 6);
    spawnPeds(S, 6);
    S.camera.x = S.player.x - S.view.w / 2 + 60;
    S.camera.y = S.player.y - S.view.h / 2 + 20;
    return;
  }
}
