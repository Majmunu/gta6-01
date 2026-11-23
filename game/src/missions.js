// The story of Solmar Bay: five chained missions for Jax Marlowe, a
// wheelman trying to buy his way out of the Breakers' debt. Each mission
// is a list of steps; a step completes when its condition is met.
import { CFG, PLACES } from './config.js';
import { placePoint } from './city.js';
import { makeThug, makePickup } from './entities.js';
import { addWanted } from './police.js';
//  goto   — reach a radius around a place
//  talk   — reach a person and press E
//  steal  — get into any car (or the named special car)
//  defeat — take down N spawned enemies
//  hold   — stay inside a radius for T seconds
//  escape — bring the wanted level to zero
export const MISSIONS = [
  {
    name: 'Borrowed Wheels',
    brief: "Dee needs a wheelman. Steal a car and bring it to Dee's Garage.",
    dialogue: [
      ['DEE', "Jax! You're late. The Breakers want their money, and I need wheels."],
      ['JAX', "I just got out of the flats, Dee. Give me a minute."],
      ['DEE', "No minutes. Grab any car off the street — E to take it — and bring it to my garage."],
    ],
    steps: [
      { type: 'goto', place: 'garage', r: 90, label: "Meet Dee at Dee's Garage" },
      { type: 'steal', label: 'Steal a car (press E near one)' },
      { type: 'goto', place: 'garage', r: 80, label: 'Bring the car back to the garage', inCar: true },
    ],
    reward: 500,
  },
  {
    name: 'The Drop',
    brief: 'Pick up a package from Mara at the docks, then deliver it to The Palms Hotel. The cops are watching the docks.',
    dialogue: [
      ['MARA', "Package is in the crate. Don't open it, don't drop it, don't get cute."],
      ['JAX', "And if the cops stop me?"],
      ['MARA', "Then you drive faster. The Palms Hotel. Valet knows the room."],
    ],
    steps: [
      { type: 'goto', place: 'docks', r: 90, label: 'Meet Mara at the Solmar Docks' },
      { type: 'talk', place: 'docks', r: 60, label: 'Pick up the package (press E)', onTalk: 'wanted1' },
      { type: 'goto', place: 'palms', r: 90, label: 'Deliver the package to The Palms Hotel' },
    ],
    reward: 800,
  },
  {
    name: 'Street Justice',
    brief: 'Three Breakers are shaking down shops on their turf. Take them down — Dee slipped you a pistol.',
    dialogue: [
      ['DEE', "The Breakers think this block is theirs. Show them it isn't."],
      ['JAX', "Three of them? With what, my winning smile?"],
      ['DEE', "With this. Pistol, 36 rounds. F to shoot, or get close and use your fists."],
    ],
    steps: [
      { type: 'goto', place: 'rivalTurf', r: 110, label: 'Go to Breaker Turf', onEnter: 'spawnThugs' },
      { type: 'defeat', count: 3, label: 'Take down the 3 Breakers (0/3)' },
    ],
    reward: 1200,
  },
  {
    name: 'Hot Wheels',
    brief: 'A gold Comet GT is parked near the bank. Steal it — then lose the heat before the cops box you in.',
    dialogue: [
      ['DEE', "Gold Comet GT, parked by the bank. Worth more than both our debts."],
      ['JAX', "And the cops?"],
      ['DEE', "They'll come. Lose them — hide, or drive till the stars fade — then bring it home."],
    ],
    steps: [
      { type: 'steal', special: true, label: 'Steal the gold Comet GT near the bank' },
      { type: 'escape', label: 'Lose the wanted level (hide until the stars fade)' },
      { type: 'goto', place: 'safehouse', r: 90, label: 'Bring the Comet to the Safehouse', inCar: true },
    ],
    reward: 2000,
  },
  {
    name: 'The Big Score',
    brief: 'Rob the Solmar Bank and get out clean. Hold the bank forecourt while the alarm screams, then run for the safehouse.',
    dialogue: [
      ['JAX', "One bank, one crew, one way out. This pays everything off."],
      ['DEE', "Alarm goes off the second you step in. Hold the forecourt, ten seconds, then run."],
      ['MARA', "Don't get arrested, Jax. I don't visit people in cells."],
    ],
    steps: [
      { type: 'goto', place: 'bank', r: 100, label: 'Reach the Solmar Bank' },
      { type: 'hold', place: 'bank', r: 110, seconds: 10, label: 'Hold the forecourt while the alarm sounds' },
      { type: 'goto', place: 'safehouse', r: 90, label: 'Escape to the Safehouse' },
    ],
    reward: 5000,
  },
];

export function startMission(S, index) {
  const m = MISSIONS[index];
  if (!m) return;
  S.mission = { index, step: 0, holdTimer: 0, kills: 0, active: true, done: false };
  S.dialogue = { lines: m.dialogue, idx: 0, speaker: m.dialogue[0][0], text: m.dialogue[0][1] };
  S.objective = m.steps[0].label;
  S.thugs = [];
  // Dee hands Jax the pistol as mission 3 starts, so the fight is winnable.
  if (index === 2 && !S.player.hasPistol) {
    S.player.hasPistol = true;
    S.player.ammo = CFG.pistolStartAmmo;
  }
  S.audio.missionDone();
}

export function missionMarker(S) {
  if (!S.mission || !S.mission.active) return null;
  const step = MISSIONS[S.mission.index].steps[S.mission.step];
  if (!step) return null;
  if (step.type === 'steal' && step.special) return { ...placePoint('bank'), label: 'Comet GT' };
  if (step.place) return { ...placePoint(step.place), label: step.label };
  return null;
}

function spawnThugs(S) {
  const c = placePoint('rivalTurf');
  for (let i = 0; i < 3; i++) {
    const t = makeThug(c.x + (S.rng() - 0.5) * 140, c.y + (S.rng() - 0.5) * 140);
    S.thugs.push(t);
  }
  S.mission.spawned = true;
}

export function updateMission(S, dt) {
  if (!S.mission || !S.mission.active) return;
  const m = MISSIONS[S.mission.index];
  const step = m.steps[S.mission.step];
  if (!step) return;

  // Step entry hooks.
  if (step.type === 'goto' && step.onEnter === 'spawnThugs' && !S.mission.spawned) {
    const c = placePoint(step.place);
    if (Math.hypot(S.player.x - c.x, S.player.y - c.y) < 260) spawnThugs(S);
  }

  const atPlace = (place, r) => {
    const p = placePoint(place);
    return Math.hypot(S.player.x - p.x, S.player.y - p.y) < r;
  };

  let complete = false;
  switch (step.type) {
    case 'goto':
      if (atPlace(step.place, step.r) && (!step.inCar || S.player.inCar)) complete = true;
      break;
    case 'talk':
      if (S.talkDone) { complete = true; S.talkDone = false; }
      break;
    case 'steal':
      if (S.player.inCar) {
        if (step.special && S.player.car && S.player.car.kind === 'special') complete = true;
        else if (!step.special) complete = true;
      }
      break;
    case 'defeat':
      if (S.mission.kills >= step.count) complete = true;
      break;
    case 'hold': {
      if (atPlace(step.place, step.r)) {
        S.mission.holdTimer += dt;
        if (S.mission.holdTimer >= step.seconds) complete = true;
      } else {
        S.mission.holdTimer = Math.max(0, S.mission.holdTimer - dt * 2);
      }
      break;
    }
    case 'escape':
      if (S.wanted === 0) complete = true;
      break;
  }

  if (complete) {
    S.mission.step++;
    S.mission.holdTimer = 0;
    S.audio.pickup();
    if (S.mission.step >= m.steps.length) {
      completeMission(S);
    } else {
      const next = m.steps[S.mission.step];
      S.objective = next.label;
      // Step start hooks.
      if (next.type === 'defeat' && !S.mission.spawned) spawnThugs(S);
      if (S.mission.index === 1 && S.mission.step === 1) {
        // The drop: taking the package draws the cops.
      }
      if (S.mission.index === 3 && S.mission.step === 1) {
        addWanted(S, 3, 'Stole the Comet GT');
      }
      if (S.mission.index === 4 && S.mission.step === 1) {
        addWanted(S, 3, 'Bank alarm');
      }
    }
  }

  // Live objective text (defeat counter, hold progress).
  if (step.type === 'defeat') {
    S.objective = `Take down the Breakers (${S.mission.kills}/${step.count})`;
  } else if (step.type === 'hold') {
    S.objective = `${step.label} — ${Math.ceil(step.seconds - S.mission.holdTimer)}s`;
  }
}

function completeMission(S) {
  const m = MISSIONS[S.mission.index];
  S.cash += m.reward;
  S.mission.active = false;
  S.mission.done = true;
  S.missionCompleted = S.mission.index + 1;
  S.objective = `Mission complete: ${m.name}  +$${m.reward}`;
  S.missionToast = 4;
  S.audio.missionDone();
  // Drop a health pickup at the player's feet as a breather.
  S.pickups.push(makePickup(S.player.x + 30, S.player.y + 20, 'health', 25));
  // Chain the next mission a few seconds later.
  if (S.mission.index < MISSIONS.length - 1) S.nextMissionTimer = 3;
  // Save progress.
  if (S.saveGame) S.saveGame();
}

export function nextMissionAvailable(S) {
  return S.missionCompleted < MISSIONS.length;
}

// Advance the dialogue box; returns true when the dialogue just finished.
export function advanceDialogue(S) {
  if (!S.dialogue) return false;
  S.dialogue.idx++;
  if (S.dialogue.idx >= S.dialogue.lines.length) {
    S.dialogue = null;
    return true;
  }
  const [speaker, text] = S.dialogue.lines[S.dialogue.idx];
  S.dialogue.speaker = speaker;
  S.dialogue.text = text;
  return false;
}
