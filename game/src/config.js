// Solmar Heat — central tuning and world constants.
// One place for every number that shapes how the city plays.
export const CFG = {
  // World geometry (pixels). Roads sit on a grid; blocks hold buildings.
  worldSize: 3640,
  block: 260,
  roadHalf: 36,
  // Player on foot.
  walkSpeed: 185,
  playerRadius: 13,
  playerHealth: 100,
  // Cars.
  carAccel: 320,
  carMaxSpeed: 430,
  carReverseMax: 150,
  carBrake: 520,
  carTurn: 2.6,
  carRadius: 17,
  trafficSpeed: 120,
  policeSpeed: 350,
  // Combat.
  punchDamage: 22,
  punchRange: 40,
  pistolDamage: 34,
  pistolRange: 460,
  pistolStartAmmo: 36,
  // Wanted.
  wantedDecayDelay: 10,
  wantedDecayStep: 7,
  maxWanted: 5,
  // Time of day: 0..1, 0.5 is noon. A full cycle is 6 minutes of play.
  dayLength: 360,
  // Colours.
  colors: {
    grass: '#5d8a4a',
    grassDark: '#527c41',
    road: '#3a3d44',
    roadEdge: '#2c2f36',
    lane: '#d8c95a',
    sidewalk: '#8f8a7c',
    buildingRoof: ['#b0563a', '#7a6a58', '#4f6b8a', '#8a4f6b', '#5a7a52', '#9a8a4f', '#6b5a8a', '#a87a3a'],
    buildingWall: '#6e6258',
    water: '#2e6f8e',
    park: '#4a7a3d',
  },
  carPalette: [
    '#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50', '#e67e22',
    '#8e44ad', '#16a085', '#d35400', '#7f8c8d', '#27ae60', '#c0c0c0',
  ],
  // Save slot.
  saveKey: 'solmar-heat-save-v1',
};

export const CITY_NAME = 'Solmar Bay';
export const GAME_TITLE = 'SOLMAR HEAT';
export const GAME_SUBTITLE = 'An open-world crime story in Solmar Bay';

// Named places, placed on block coordinates (bx, by) of the city grid.
export const PLACES = {
  start:      { name: 'Marlowe Flats',  bx: 4, by: 4 },
  garage:     { name: "Dee's Garage",   bx: 2, by: 2 },
  docks:      { name: 'Solmar Docks',   bx: 11, by: 10 },
  palms:      { name: 'The Palms Hotel', bx: 9, by: 3 },
  bank:       { name: 'Solmar Bank',    bx: 6, by: 6 },
  safehouse:  { name: 'Safehouse',      bx: 3, by: 9 },
  police:     { name: 'Bay PD Precinct', bx: 10, by: 6 },
  hospital:   { name: 'St. Mara Hospital', bx: 5, by: 10 },
  rivalTurf:  { name: 'Breaker Turf',   bx: 8, by: 8 },
  dealer:     { name: 'Mara’s Corner',  bx: 7, by: 11 },
};
