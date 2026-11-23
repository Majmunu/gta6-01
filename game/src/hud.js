// HUD: health, cash, wanted stars, weapon, objective, dialogue box,
// minimap, and the on-screen touch controls for mobile.
import { CFG, PLACES } from './config.js';
import { placePoint } from './city.js';
import { MISSIONS } from './missions.js';

export function drawHUD(ctx, S) {
  const w = S.view.w, h = S.view.h;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // --- Top-left: health bar, cash, weapon ---
  ctx.fillStyle = 'rgba(10,12,16,0.62)';
  roundRect(ctx, 12, 12, 218, 86, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('JAX MARLOWE', 24, 34);
  // Health bar.
  ctx.fillStyle = '#222';
  roundRect(ctx, 24, 42, 150, 12, 6);
  ctx.fill();
  const hp = Math.max(0, S.player.health / CFG.playerHealth);
  ctx.fillStyle = hp > 0.5 ? '#3ecf6e' : hp > 0.25 ? '#f0a13a' : '#e23b3b';
  roundRect(ctx, 24, 42, 150 * hp, 12, 6);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`$${S.cash.toLocaleString('en-US')}`, 24, 74);
  ctx.fillStyle = '#ffd21f';
  if (S.player.hasPistol) {
    ctx.fillText(`PISTOL  ${S.player.ammo} rds`, 110, 74);
  } else {
    ctx.fillText('FISTS', 110, 74);
  }
  ctx.fillStyle = '#cfd3da';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(S.player.inCar ? `${S.player.car.name}  •  ${Math.round(Math.abs(S.player.car.speed) * 0.24)} mph` : 'ON FOOT', 24, 90);

  // --- Wanted stars, top centre ---
  const stars = S.wanted;
  ctx.font = '28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < stars ? '#ffd21f' : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', w / 2 - 56 + i * 28, 44);
  }
  ctx.textAlign = 'left';
  if (stars > 0) {
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WANTED', w / 2, 62);
    ctx.textAlign = 'left';
  }

  // --- Mission objective, bottom centre ---
  if (S.objective) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = ctx.measureText(S.objective).width;
    ctx.fillStyle = 'rgba(10,12,16,0.66)';
    roundRect(ctx, w / 2 - tw / 2 - 16, h - 96, tw + 32, 34, 9);
    ctx.fill();
    ctx.fillStyle = '#ffd21f';
    ctx.textAlign = 'center';
    ctx.fillText(S.objective, w / 2, h - 73);
    ctx.textAlign = 'left';
  }

  // Mission toast after completion.
  if (S.missionToast > 0) {
    ctx.fillStyle = 'rgba(20,60,30,0.85)';
    ctx.font = 'bold 18px system-ui, sans-serif';
    const msg = 'MISSION COMPLETE';
    const tw = ctx.measureText(msg).width;
    roundRect(ctx, w / 2 - tw / 2 - 18, 76, tw + 36, 36, 10);
    ctx.fill();
    ctx.fillStyle = '#7ee787';
    ctx.textAlign = 'center';
    ctx.fillText(msg, w / 2, 100);
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, S);

  // --- Dialogue box ---
  if (S.dialogue) {
    const bw = Math.min(680, w - 40);
    const bx = (w - bw) / 2, by = h - 190;
    ctx.fillStyle = 'rgba(8,10,14,0.88)';
    roundRect(ctx, bx, by, bw, 78, 12);
    ctx.fill();
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 2;
    roundRect(ctx, bx, by, bw, 78, 12);
    ctx.stroke();
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(S.dialogue.speaker, bx + 18, by + 24);
    ctx.fillStyle = '#f2f2f2';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, S.dialogue.text, bx + 18, by + 48, bw - 36, 20);
    ctx.fillStyle = '#9aa0aa';
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('E / click to continue', bx + bw - 14, by + 66);
    ctx.textAlign = 'left';
  }

  // --- Mission info overlay (M) ---
  if (S.showMissionInfo) {
    const bw = Math.min(560, w - 40);
    const bx = (w - bw) / 2, by = 110;
    ctx.fillStyle = 'rgba(8,10,14,0.92)';
    roundRect(ctx, bx, by, bw, 300, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('SOLMAR HEAT — MISSIONS', bx + 22, by + 36);
    ctx.fillStyle = '#f2f2f2';
    ctx.font = '14px system-ui, sans-serif';
    let y = by + 66;
    MISSIONS.forEach((m, i) => {
      const state = i < S.missionCompleted ? '✓ DONE' : i === S.missionCompleted ? '▶ ACTIVE' : '· LOCKED';
      ctx.fillStyle = i === S.missionCompleted ? '#ffd21f' : i < S.missionCompleted ? '#7ee787' : '#8a8f98';
      ctx.fillText(`${i + 1}. ${m.name} — ${state}`, bx + 22, y);
      y += 24;
      ctx.fillStyle = '#b9bec7';
      ctx.font = '12px system-ui, sans-serif';
      wrapText(ctx, m.brief, bx + 40, y, bw - 70, 16);
      y += 30;
      ctx.font = '14px system-ui, sans-serif';
    });
    ctx.fillStyle = '#9aa0aa';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('WASD move/drive · E enter car / talk · F attack/shoot · Space handbrake · M missions · Esc pause', bx + 22, by + 282);
  }

  // --- Hurt flash / busted / wasted overlays ---
  if (S.hurtFlash > 0) {
    ctx.fillStyle = `rgba(220,30,30,${S.hurtFlash * 0.45})`;
    ctx.fillRect(0, 0, w, h);
  }

  drawTouchControls(ctx, S);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

function drawMinimap(ctx, S) {
  const size = 190;
  const x0 = S.view.w - size - 14, y0 = 14;
  const scale = size / CFG.worldSize;
  ctx.fillStyle = 'rgba(10,12,16,0.7)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = '#274d2e';
  ctx.fillRect(x0, y0, size, size);
  // Roads.
  ctx.strokeStyle = '#5a5e66';
  ctx.lineWidth = 3;
  for (let i = 0; i <= S.city.n; i++) {
    const p = i * CFG.block * scale;
    ctx.beginPath(); ctx.moveTo(x0 + p, y0); ctx.lineTo(x0 + p, y0 + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 + p); ctx.lineTo(x0 + size, y0 + p); ctx.stroke();
  }
  // Water: the bay along the south edge.
  ctx.fillStyle = '#2e6f8e';
  ctx.fillRect(x0, y0 + size - 12, size, 12);
  // Named places.
  ctx.fillStyle = '#ffd21f';
  for (const key of ['garage', 'safehouse', 'bank', 'docks', 'palms']) {
    const p = placePoint(key);
    ctx.fillRect(x0 + p.x * scale - 2, y0 + p.y * scale - 2, 4, 4);
  }
  // Mission marker.
  const marker = S.missionMarker ? S.missionMarker() : null;
  if (marker) {
    const mx = x0 + marker.x * scale, my = y0 + marker.y * scale;
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath();
    ctx.arc(mx, my, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Police blips.
  ctx.fillStyle = '#4da3ff';
  for (const cop of S.cops) {
    ctx.fillRect(x0 + cop.x * scale - 2, y0 + cop.y * scale - 2, 4, 4);
  }
  for (const car of S.cars) {
    if (car.kind === 'police') {
      ctx.fillRect(x0 + car.x * scale - 2, y0 + car.y * scale - 2, 4, 4);
    }
  }
  // Player arrow.
  const px = x0 + S.player.x * scale, py = y0 + S.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(S.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.stroke();
}

function drawTouchControls(ctx, S) {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch && !S.forceTouch) return;
  const w = S.view.w, h = S.view.h;
  const btn = (name, x, y, r, label) => {
    ctx.fillStyle = S.input.touch[name] ? 'rgba(255,210,31,0.55)' : 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + 6);
    ctx.textAlign = 'left';
  };
  const rects = {};
  const D = 46, gap = 8;
  const baseX = 24, baseY = h - 24 - D * 3 - gap * 2;
  const positions = {
    up: [baseX + D + gap, baseY],
    left: [baseX, baseY + D + gap],
    right: [baseX + D * 2 + gap * 2, baseY + D + gap],
    down: [baseX + D + gap, baseY + D * 2 + gap * 2],
  };
  for (const [name, [cx, cy]] of Object.entries(positions)) {
    btn(name, cx, cy, D / 2, { up: '▲', down: '▼', left: '◀', right: '▶' }[name]);
    rects[name] = { x: cx - D / 2, y: cy - D / 2, w: D, h: D };
  }
  const act = [
    ['e', w - 24 - D, h - 24 - D * 2 - gap, 'E'],
    ['f', w - 24 - D * 2 - gap, h - 24 - D, 'F'],
    ['brake', w - 24 - D, h - 24 - D, 'BRK'],
  ];
  for (const [name, cx, cy, label] of act) {
    btn(name, cx, cy, D / 2, label);
    rects[name] = { x: cx - D / 2, y: cy - D / 2, w: D, h: D };
  }
  S.input.touchRects = rects;
}
