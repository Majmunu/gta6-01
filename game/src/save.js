// localStorage save: cash, mission progress, player state. Autosaves after
// every mission and on pause; loads from the title screen.
const KEY = 'solara-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      missionIndex: state.missionIndex,
      hp: state.player.hp,
      ammo: state.player.ammo,
      x: state.player.x,
      y: state.player.y,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode, sandbox): the game still plays.
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}
