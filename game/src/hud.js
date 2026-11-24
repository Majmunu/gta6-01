// HUD, minimap, menus, dialogue and touch controls. All drawn on the same
// canvas, above the world.
import { CONTROLS_TEXT, PEOPLE } from './config.js';

export function drawHUD(ctx, state, view) {
  const { w, h } = view;
  const p = state.player;

  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(18, 18, 220, 44);
  ctx.fillStyle = '#222';
  ctx.fillRect(28, 28, 200, 12);
  ctx.fillStyle = p.hp > 40 ? '#5ec95e' : '#e84c3c';
  ctx.fillRect(28, 28, 200 * Math.max(0, p.hp / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${state.cash}`, 28, 56);
  ctx.fillText(`Ammo ${p.ammo}`, 120, 56);

  // Wanted stars.
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'left';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < state.wanted ? '★' : '☆';
  ctx.fillStyle = state.wanted > 0 ? '#ffd34d' : 'rgba(255,255,255,0.35)';
  ctx.fillText(stars, 250, 48);

  // Objective.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const objW = Math.min(w - 420, 520);
  ctx.fillRect(18, h - 64, objW, 46);
  ctx.fillStyle = '#ffcf3d';
  ctx.font = 'bold 14px sans-serif';
  const missionName = state.missionIndex < 5 && state.missionIndex >= 0 && state.currentMissionTitle
    ? `${state.currentMissionTitle} — ` : '';
  ctx.fillText(missionName + (state.objective || ''), 30, h - 36);

  // Minimap.
  drawMinimap(ctx, state, w - 208, 18, 190);

  // Mission banner.
  if (state.missionBanner && state.missionBanner.timer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(w / 2 - 200, 70, 400, 56);
    ctx.fillStyle = '#7dff8a';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.missionBanner.title, w / 2, 94);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    ctx.fillText(state.missionBanner.text, w / 2, 116);
  }

  // Dialogue box.
  if (state.dialogue) {
    ctx.fillStyle = 'rgba(10,12,20,0.82)';
    ctx.fillRect(w / 2 - 320, h - 190, 640, 110);
    ctx.strokeStyle = '#ffcf3d';
    ctx.lineWidth = 2;
    ctx.strokeRect(w / 2 - 320, h - 190, 640, 110);
    ctx.fillStyle = '#ffcf3d';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.dialogue.who, w / 2 - 300, h - 158);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    wrapText(ctx, state.dialogue.text, w / 2 - 300, h - 130, 600, 22);
    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.fillText('E / click — continue', w / 2 + 170, h - 96);
  }

  // Touch controls.
  if (state.input.usingTouch) drawTouch(ctx, state, view);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lh;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

export function drawMinimap(ctx, state, x, y, size) {
  const { city } = state;
  const scale = size / city.size;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 6, y - 6, size + 12, size + 12);
  ctx.fillStyle = '#2e4a3a';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#3d3d46';
  for (const vx of city.vertical) ctx.fillRect(x + vx * scale - 1, y, 2, size);
  for (const hy of city.horizontal) ctx.fillRect(x, y + hy * scale - 1, size, 2);
  ctx.fillStyle = '#2e7f9e';
  ctx.fillRect(x, y, 8, size);
  // Mission marker.
  if (state.marker) {
    ctx.fillStyle = '#ffcf3d';
    ctx.beginPath();
    ctx.arc(x + state.marker.x * scale, y + state.marker.y * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops.
  ctx.fillStyle = '#5ea8ff';
  for (const c of state.cops) {
    ctx.fillRect(x + c.x * scale - 2, y + c.y * scale - 2, 4, 4);
  }
  // Player.
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(x + state.player.x * scale, y + state.player.y * scale, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawTouch(ctx, state, view) {
  const { w, h } = view;
  const btn = (x, y, r, label, key) => {
    ctx.fillStyle = state.input.touch[key] ? 'rgba(255,207,61,0.7)' : 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 6);
  };
  btn(70, h - 90, 34, '◀', 'left');
  btn(150, h - 90, 34, '▶', 'right');
  btn(110, h - 150, 34, '▲', 'up');
  btn(110, h - 40, 34, '▼', 'down');
  btn(w - 70, h - 90, 34, 'E', 'action');
  btn(w - 150, h - 90, 34, 'F', 'attack');
  btn(w - 70, h - 160, 30, 'BRK', 'brake');
}

export function drawTitle(ctx, state, view) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcf3d';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLARA BAY', w / 2, h / 2 - 120);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText('An open-world crime story in the sun', w / 2, h / 2 - 80);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#ccc';
  CONTROLS_TEXT.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 - 40 + i * 26));
  ctx.fillStyle = '#ffcf3d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(state.saveExists ? 'ENTER — Continue' : 'ENTER — New game', w / 2, h / 2 + 130);
  ctx.fillStyle = '#999';
  ctx.font = '14px sans-serif';
  ctx.fillText('Missions pay. The Tide Kings collect. The PD collects harder.', w / 2, h / 2 + 162);
}

export function drawPause(ctx, state, view) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(10,14,24,0.66)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2 - 60);
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.fillText('P / Esc — resume    M — missions    Mute: press N', w / 2, h / 2 - 16);
  ctx.fillText(`Cash $${state.cash}   Missions done: ${Math.min(state.missionIndex, 5)} / 5`, w / 2, h / 2 + 18);
  ctx.fillText('Your progress saves after every mission.', w / 2, h / 2 + 52);
}

export function drawMissionList(ctx, state, view) {
  const { w, h } = view;
  ctx.fillStyle = 'rgba(10,14,24,0.8)';
  ctx.fillRect(w / 2 - 300, 90, 600, 380);
  ctx.strokeStyle = '#ffcf3d';
  ctx.lineWidth = 2;
  ctx.strokeRect(w / 2 - 300, 90, 600, 380);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffcf3d';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Missions — Solara Bay', w / 2 - 270, 130);
  ctx.font = '16px sans-serif';
  const names = ['First Fare', 'Midnight Runner', 'Dockside Debt', 'The Getaway', 'The Meridian Job'];
  const rewards = [500, 900, 1200, 1500, 4000];
  names.forEach((name, i) => {
    const done = i < state.missionIndex;
    const current = i === state.missionIndex;
    ctx.fillStyle = done ? '#7dff8a' : current ? '#ffcf3d' : '#888';
    ctx.fillText(`${done ? '✓' : current ? '►' : '·'} ${name} — $${rewards[i]}`, w / 2 - 270, 170 + i * 36);
  });
  ctx.fillStyle = '#ccc';
  ctx.font = '14px sans-serif';
  ctx.fillText('M — close', w / 2 - 270, 430);
}

export function drawEnd(ctx, state, view, kind) {
  const { w, h } = view;
  ctx.fillStyle = kind === 'busted' ? 'rgba(20,40,90,0.78)' : 'rgba(60,10,10,0.78)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', w / 2, h / 2 - 40);
  ctx.font = '19px sans-serif';
  ctx.fillText(kind === 'busted' ? state.bustedMessage : state.wastedMessage, w / 2, h / 2 + 4);
  ctx.fillStyle = '#ffcf3d';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('ENTER — back on the streets', w / 2, h / 2 + 52);
}
