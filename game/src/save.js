// Save and load through localStorage. Progress is a small JSON blob:
// cash, health, mission progress, position, wanted level and time of day.
import { CFG } from './config.js';

export function saveGame(S) {
  try {
    const data = {
      version: 1,
      cash: S.cash,
      health: S.player.health,
      ammo: S.player.ammo,
      hasPistol: S.player.hasPistol,
      missionCompleted: S.missionCompleted,
      missionIndex: S.mission ? S.mission.index : S.missionCompleted,
      x: S.player.x,
      y: S.player.y,
      wanted: S.wanted,
      timeOfDay: S.timeOfDay,
      seed: S.seed,
    };
    localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(CFG.saveKey); } catch { /* storage unavailable */ }
}

export function hasSave() {
  return loadGame() !== null;
}
