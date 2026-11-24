// The story: five chained missions for Jace Marlowe, new driver in Solara
// Bay, working for fixer Mara Voss against Vince Kroll's Tide Kings.
// Steps: goto | talk | steal | deliver | defeat | hold | escape.
import { PLACES, PEOPLE } from './config.js';
import { makeCar, makePed, makePickup, makeFloatText } from './entities.js';
import { addWanted } from './police.js';

export const MISSIONS = [
  {
    id: 'first-fare',
    title: 'First Fare',
    reward: 500,
    intro: [
      { who: PEOPLE.fixer, text: 'Jace. You drive, I pay. No questions, no cops, no problem.' },
      { who: PEOPLE.player, text: 'I just got to Solara Bay. What do you need moved?' },
      { who: PEOPLE.fixer, text: 'A package. Meet me at my diner first — then take any car and run it to the Marina.' },
    ],
    steps: [
      { type: 'talk', place: 'diner', npc: PEOPLE.fixer, text: 'The package is in the trunk of the blue sedan out front. Take it to the Marina drop-off.' },
      { type: 'goto', place: 'marina', needCar: true, text: 'Drive the package to the Marina.' },
    ],
  },
  {
    id: 'midnight-runner',
    title: 'Midnight Runner',
    reward: 900,
    intro: [
      { who: PEOPLE.fixer, text: 'The Tide Kings left a Comet GT parked at Neon Plaza. Vince Kroll wants it back by midnight.' },
      { who: PEOPLE.fixer, text: 'You get there first. Bring it to the chop shop — no scratches, or no pay.' },
    ],
    steps: [
      { type: 'steal', place: 'plaza', carModel: 'comet', text: 'Steal the Comet GT at Neon Plaza.' },
      { type: 'deliver', place: 'chopShop', text: 'Deliver the Comet GT to the chop shop.' },
    ],
  },
  {
    id: 'dockside-debt',
    title: 'Dockside Debt',
    reward: 1200,
    intro: [
      { who: PEOPLE.fixer, text: 'Kroll’s boys at Pier 9 owe me twelve hundred. They stopped answering my calls.' },
      { who: PEOPLE.fixer, text: 'Go remind them. Fists work. The pistol works faster.' },
    ],
    steps: [
      { type: 'goto', place: 'docks', text: 'Head to Pier 9 at the Docks.' },
      { type: 'defeat', count: 3, text: 'Deal with the Tide Kings crew (0/3).' },
      { type: 'goto', place: 'diner', text: 'Collect the cash and bring it back to Mara.' },
    ],
  },
  {
    id: 'the-getaway',
    title: 'The Getaway',
    reward: 1500,
    intro: [
      { who: PEOPLE.fixer, text: 'The PD is all over Neon Row tonight. Kroll tipped them off — he wants you in a cell.' },
      { who: PEOPLE.fixer, text: 'Get in a car, get them chasing, and lose them. Then lay low at the safehouse.' },
    ],
    steps: [
      { type: 'hold', seconds: 40, text: 'Stay ahead of the police — keep them chasing for 40 seconds.' },
      { type: 'escape', place: 'safehouse', text: 'Lose the heat, then get to the safehouse.' },
    ],
  },
  {
    id: 'the-meridian-job',
    title: 'The Meridian Job',
    reward: 4000,
    intro: [
      { who: PEOPLE.fixer, text: 'One last job, Jace. The Meridian Bank moves a case at noon. You take it, we split it, and Kroll’s crew is finished in this town.' },
      { who: PEOPLE.player, text: 'And if the whole PD shows up?' },
      { who: PEOPLE.fixer, text: 'Then drive like the bay is on fire.' },
    ],
    steps: [
      { type: 'goto', place: 'bank', text: 'Get to Meridian Bank.' },
      { type: 'grab', text: 'Grab the case.' },
      { type: 'escape', place: 'marina', text: 'Lose the heat and bring the case to the Marina boat.' },
    ],
  },
];

export function startMission(state, idx) {
  const m = MISSIONS[idx];
  if (!m) {
    state.missionIndex = idx;
    state.missionStep = 0;
    state.objective = 'Solara Bay is yours. Free roam — cause trouble, or don’t.';
    state.marker = null;
    return;
  }
  state.missionIndex = idx;
  state.missionStep = 0;
  state.currentMissionTitle = m.title;
  state.missionKills = 0;
  state.missionTimer = 0;
  state.missionTargetCar = null;
  state.missionCaseTaken = false;
  state.dialogueQueue = m.intro.slice();
  state.dialogue = null;
  advanceDialogue(state);
  setupStep(state);
}

export function advanceDialogue(state) {
  if (state.dialogueQueue && state.dialogueQueue.length > 0) {
    state.dialogue = state.dialogueQueue.shift();
  } else {
    state.dialogue = null;
  }
}

function setupStep(state) {
  const m = MISSIONS[state.missionIndex];
  if (!m) return;
  const step = m.steps[state.missionStep];
  if (!step) return;
  const place = step.place ? state.city.places[step.place] : null;
  state.objective = step.text;
  state.marker = place ? { x: place.x, y: place.y, name: place.name } : null;
  if (step.type === 'steal') {
    const p = state.city.places[step.place];
    const car = makeCar(state.rng, p.x + 40, p.y, 0, { model: 'comet', color: '#e8b73c', driver: null });
    car.missionTarget = true;
    state.cars.push(car);
    state.missionTargetCar = car;
    state.marker = { x: car.x, y: car.y, name: 'Comet GT' };
  }
  if (step.type === 'defeat') {
    const p = state.city.places[step.place || 'docks'];
    for (let i = 0; i < step.count; i++) {
      const thug = makePed(state.rng, p.x + (i - 1) * 70, p.y + 60, { thug: true });
      state.peds.push(thug);
    }
    state.missionKills = 0;
  }
  if (step.type === 'hold') {
    addWanted(state, 3);
    state.missionTimer = 0;
  }
  if (step.type === 'grab') {
    const p = state.city.places.bank;
    const pickup = makePickup(p.x, p.y + 40, 'case', 4000);
    state.pickups.push(pickup);
    state.marker = { x: p.x, y: p.y + 40, name: 'The case' };
  }
}

function nextStep(state) {
  const m = MISSIONS[state.missionIndex];
  state.missionStep += 1;
  if (state.missionStep >= m.steps.length) {
    completeMission(state);
  } else {
    setupStep(state);
  }
}

function completeMission(state) {
  const m = MISSIONS[state.missionIndex];
  state.cash += m.reward;
  state.audio.sting();
  state.floaters.push(makeFloatText(state.player.x, state.player.y - 40, `Mission complete +$${m.reward}`, '#7dff8a'));
  state.missionBanner = { title: m.title, text: `Complete — $${m.reward}`, timer: 3 };
  state.missionIndex += 1;
  state.missionStep = 0;
  if (state.missionIndex < MISSIONS.length) {
    startMission(state, state.missionIndex);
  } else {
    state.objective = 'All missions done. Solara Bay is yours — free roam.';
    state.marker = null;
  }
  state.saveGame();
}

export function updateMission(state, dt) {
  const m = MISSIONS[state.missionIndex];
  if (!m || state.mode !== 'play') return;
  const step = m.steps[state.missionStep];
  if (!step) return;
  const p = state.player;

  const near = (x, y, r) => Math.hypot(p.x - x, p.y - y) < r;

  if (step.type === 'goto') {
    const place = state.city.places[step.place];
    if (near(place.x, place.y, 90) && (!step.needCar || state.playerInCar)) {
      if (step.needCar && !state.playerInCar) {
        state.objective = 'You need a car for this run.';
      } else {
        nextStep(state);
      }
    }
  } else if (step.type === 'talk') {
    const place = state.city.places[step.place];
    if (near(place.x, place.y, 110) && state.input.wasPressed('action')) {
      state.dialogue = { who: step.npc, text: step.text };
      nextStep(state);
    }
  } else if (step.type === 'steal') {
    if (state.playerInCar && state.playerCar === state.missionTargetCar) {
      state.floaters.push(makeFloatText(p.x, p.y - 40, 'Got it — lose any heat and go!', '#7dff8a'));
      nextStep(state);
    }
  } else if (step.type === 'deliver') {
    const place = state.city.places[step.place];
    if (state.playerInCar && state.playerCar === state.missionTargetCar && near(place.x, place.y, 110)) {
      state.missionTargetCar.driver = null;
      state.missionTargetCar = null;
      nextStep(state);
    }
  } else if (step.type === 'defeat') {
    state.objective = `Deal with the Tide Kings crew (${Math.min(state.missionKills, step.count)}/${step.count}).`;
    if (state.missionKills >= step.count) {
      const cash = makePickup(p.x, p.y + 50, 'cash', 1200);
      state.pickups.push(cash);
      nextStep(state);
    }
  } else if (step.type === 'hold') {
    if (state.wanted >= 2) {
      state.missionTimer += dt;
      state.objective = `Stay ahead of the police — ${Math.ceil(step.seconds - state.missionTimer)}s to go.`;
      if (state.missionTimer >= step.seconds) nextStep(state);
    } else {
      state.objective = 'Get the police chasing you — steal a car or cause trouble.';
    }
  } else if (step.type === 'grab') {
    const pickup = state.pickups.find((k) => k.pickupKind === 'case' && !k.taken);
    if (pickup && near(pickup.x, pickup.y, 60)) {
      pickup.taken = true;
      state.missionCaseTaken = true;
      addWanted(state, 4);
      state.floaters.push(makeFloatText(p.x, p.y - 40, 'Case secured — RUN!', '#ffd34d'));
      nextStep(state);
    }
  } else if (step.type === 'escape') {
    const place = state.city.places[step.place];
    if (state.wanted === 0 && near(place.x, place.y, 110)) {
      nextStep(state);
    } else if (state.wanted > 0) {
      state.objective = `Lose the heat (wanted ${'★'.repeat(state.wanted)}), then reach ${place.name}.`;
    }
  }
}
