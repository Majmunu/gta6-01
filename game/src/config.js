// Solara Bay — tuning, palette, names and world constants.
// Everything in this file was written for this game; no values are borrowed
// from any other game.
export const WORLD = {
  size: 4800,
  roadGap: 400,
  roadWidth: 92,
  blockInset: 46,
};

export const PALETTE = {
  ground: '#c9b183',
  grass: '#7fae62',
  sand: '#e8d5a2',
  water: '#2e7f9e',
  waterDeep: '#1f5f7d',
  asphalt: '#3d3d46',
  asphaltLine: '#d8c95a',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#b5674e', '#7d8aa0', '#c2a05e', '#8a6f9e', '#5e8a7a', '#a05e6e'],
  buildingSide: 'rgba(0,0,0,0.28)',
  park: '#6da35c',
  tree: '#3f7a3a',
  carColors: ['#d8443c', '#3c78d8', '#e8b73c', '#e8e8e8', '#2b2b30', '#4caf7d', '#c96fd8'],
  policeColor: '#22303e',
  policeTrim: '#ffffff',
  playerColor: '#e8b73c',
  marker: '#ffcf3d',
};

export const DISTRICTS = [
  { name: 'Marina', x: 600, y: 600 },
  { name: 'Old Town', x: 2400, y: 900 },
  { name: 'Neon Row', x: 4000, y: 1500 },
  { name: 'The Docks', x: 900, y: 3600 },
  { name: 'Palm Hills', x: 3600, y: 3600 },
  { name: 'Beachfront', x: 2400, y: 4300 },
];

export const PLACES = {
  marina: { name: 'Marina', x: 600, y: 600 },
  chopShop: { name: "Rook's Chop Shop", x: 1050, y: 3650 },
  safehouse: { name: 'Safehouse', x: 3600, y: 3850 },
  diner: { name: "Mara's Diner", x: 2350, y: 950 },
  bank: { name: 'Meridian Bank', x: 3950, y: 1400 },
  docks: { name: 'Pier 9', x: 850, y: 3550 },
  plaza: { name: 'Neon Plaza', x: 4050, y: 1550 },
};

export const TUNING = {
  walkSpeed: 230,
  carAccel: 620,
  carReverseAccel: 380,
  carMaxSpeed: 560,
  carMaxReverse: 180,
  carTurn: 2.6,
  carDrag: 0.6,
  carBrake: 900,
  playerHealth: 100,
  pistolDamage: 34,
  punchDamage: 18,
  pistolAmmoStart: 24,
  pistolRange: 420,
  copFootSpeed: 205,
  copRamDamage: 12,
  thugHealth: 60,
  copHealth: 80,
  wantedDecaySeconds: 26,
  bustFine: 250,
  wasteCost: 200,
  trafficCount: 26,
  pedCount: 34,
  copCarMax: 5,
  copFootMax: 6,
};

export const PEOPLE = {
  player: 'Jace Marlowe',
  fixer: 'Mara Voss',
  rival: 'Vince Kroll',
  crew: 'the Tide Kings',
};

export const CONTROLS_TEXT = [
  'WASD / arrows — move or drive',
  'E — enter / exit a car, talk',
  'F or click — punch / shoot',
  'Space — handbrake',
  'M — missions   P / Esc — pause',
];
