// Deterministic screenshot staging: ?shot=start|drive|chase|mission&seed=1
// puts the game into a fixed, readable scene so the screenshots reproduce.
import { makeCar, makePed } from './entities.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';

export function applyShot(state, name, seed) {
  const { city, rng } = state;
  const plaza = city.places.plaza;
  const marina = city.places.marina;

  if (name === 'start') {
    state.mode = 'title';
    state.player.x = 2400;
    state.player.y = 1200;
    return;
  }

  if (name === 'drive') {
    startMission(state, 0);
    state.dialogue = null;
    state.dialogueQueue = [];
    // Show the driving leg of mission 1, not the talk step.
    state.missionStep = 1;
    state.objective = 'Drive the package to the Marina.';
    state.marker = { x: 600, y: 600, name: 'Marina' };
    state.player.x = 2000;
    state.player.y = 2000;
    const car = makeCar(rng, 2000, 2000, 0, { color: '#d8443c', driver: 'player' });
    state.cars.push(car);
    state.playerInCar = true;
    state.playerCar = car;
    state.player.x = car.x;
    state.player.y = car.y;
    // A few neighbours on the road.
    for (let i = 0; i < 3; i++) {
      const t = makeCar(rng, 2000 + 260 + i * 180, 2000 + (i % 2 ? -18 : 18), 0, { driver: 'traffic' });
      t.speed = 150;
      state.cars.push(t);
    }
    state.mode = 'play';
    return;
  }

  if (name === 'chase') {
    startMission(state, 3);
    state.dialogue = null;
    state.dialogueQueue = [];
    state.missionStep = 0;
    state.missionTimer = 0;
    // startMission's hold step already set wanted to 3.
    const car = makeCar(rng, 3200, 1600, 0, { color: '#e8b73c', driver: 'player' });
    state.cars.push(car);
    state.playerInCar = true;
    state.playerCar = car;
    state.player.x = car.x;
    state.player.y = car.y;
    for (let i = 0; i < 3; i++) {
      const cop = makeCar(rng, 3200 - 220 - i * 130, 1600 + (i - 1) * 70, 0, { police: true, driver: 'police', color: '#22303e' });
      cop.speed = 380;
      state.cars.push(cop);
      state.cops.push(cop);
    }
    state.mode = 'play';
    return;
  }

  if (name === 'mission') {
    startMission(state, 2);
    state.dialogue = null;
    state.dialogueQueue = [];
    // Jump to the fight step and bring its crew in.
    state.missionStep = 1;
    state.missionKills = 0;
    const docks = city.places.docks;
    for (let i = 0; i < 3; i++) {
      const thug = makePed(state.rng, docks.x + (i - 1) * 70, docks.y + 60, { thug: true });
      state.peds.push(thug);
    }
    state.objective = 'Deal with the Tide Kings crew (0/3).';
    state.marker = { x: docks.x, y: docks.y, name: 'Pier 9' };
    state.player.x = docks.x + 40;
    state.player.y = docks.y + 260;
    state.player.angle = -Math.PI / 2;
    state.player.ammo = 24;
    state.mode = 'play';
    return;
  }

  // Unknown shot: just play at the Marina.
  state.player.x = marina.x;
  state.player.y = marina.y;
  state.mode = 'play';
}
