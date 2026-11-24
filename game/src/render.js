// Canvas rendering: the city, the sea, the people, the cars, particles and
// the golden-hour light. Everything is drawn from shapes — no images.
import { WORLD, PALETTE } from './config.js';
import { clamp } from './random.js';

export function drawWorld(ctx, state, view) {
  const { city } = state;
  const { camX, camY, w, h } = view;

  // Ground and sea.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(camX, camY, w, h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(camX, camY, Math.max(0, 70 - camX), h);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let y = camY; y < camY + h; y += 90) {
    ctx.fillRect(camX, y + ((y / 90) % 2) * 20, Math.max(0, 40 - camX), 3);
  }
  // Beach strip.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(camX, 70), camY, Math.min(w, 190 - Math.max(camX, 70)), h);

  // Grass blocks.
  ctx.fillStyle = PALETTE.grass;
  for (let gx = 0; gx < city.vertical.length; gx++) {
    for (let gy = 0; gy < city.horizontal.length; gy++) {
      const x0 = city.vertical[gx] + WORLD.roadWidth / 2;
      const y0 = city.horizontal[gy] + WORLD.roadWidth / 2;
      ctx.fillRect(x0, y0, WORLD.roadGap - WORLD.roadWidth, WORLD.roadGap - WORLD.roadWidth);
    }
  }

  // Parks.
  for (const park of city.parks) {
    if (!inView(park, view)) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = PALETTE.tree;
    for (let i = 0; i < park.trees; i++) {
      const tx = park.x + ((i * 67) % park.w);
      const ty = park.y + ((i * 41) % park.h);
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Roads.
  ctx.fillStyle = PALETTE.asphalt;
  for (const vx of city.vertical) ctx.fillRect(vx - WORLD.roadWidth / 2, camY, WORLD.roadWidth, h);
  for (const hy of city.horizontal) ctx.fillRect(camX, hy - WORLD.roadWidth / 2, w, WORLD.roadWidth);
  // Centre dashes.
  ctx.fillStyle = PALETTE.asphaltLine;
  for (const vx of city.vertical) {
    for (let y = Math.floor(camY / 60) * 60; y < camY + h; y += 60) {
      ctx.fillRect(vx - 2, y, 4, 26);
    }
  }
  for (const hy of city.horizontal) {
    for (let x = Math.floor(camX / 60) * 60; x < camX + w; x += 60) {
      ctx.fillRect(x, hy - 2, 26, 4);
    }
  }

  // Sidewalks.
  ctx.strokeStyle = PALETTE.sidewalk;
  ctx.lineWidth = 10;
  for (const vx of city.vertical) {
    ctx.beginPath(); ctx.moveTo(vx - WORLD.roadWidth / 2 - 6, camY); ctx.lineTo(vx - WORLD.roadWidth / 2 - 6, camY + h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vx + WORLD.roadWidth / 2 + 6, camY); ctx.lineTo(vx + WORLD.roadWidth / 2 + 6, camY + h); ctx.stroke();
  }
  for (const hy of city.horizontal) {
    ctx.beginPath(); ctx.moveTo(camX, hy - WORLD.roadWidth / 2 - 6); ctx.lineTo(camX + w, hy - WORLD.roadWidth / 2 - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(camX, hy + WORLD.roadWidth / 2 + 6); ctx.lineTo(camX + w, hy + WORLD.roadWidth / 2 + 6); ctx.stroke();
  }

  // Palms on the beach.
  ctx.fillStyle = PALETTE.tree;
  for (const palm of city.palms) {
    if (palm.x < camX - 20 || palm.x > camX + w + 20 || palm.y < camY - 20 || palm.y > camY + h + 20) continue;
    ctx.beginPath();
    ctx.arc(palm.x, palm.y, 11, 0, Math.PI * 2);
    ctx.fill();
  }

  // Buildings with a soft shadow side.
  for (const b of city.buildings) {
    if (!inView(b, view)) continue;
    ctx.fillStyle = PALETTE.buildingSide;
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, b.h * 0.15);
    }
    // Windows.
    ctx.fillStyle = 'rgba(20,30,50,0.55)';
    for (let wx = b.x + 12; wx < b.x + b.w - 14; wx += 26) {
      for (let wy = b.y + 16; wy < b.y + b.h - 14; wy += 26) {
        ctx.fillRect(wx, wy, 12, 10);
      }
    }
  }

  // Mission marker.
  if (state.marker) {
    const m = state.marker;
    const bob = Math.sin(state.time * 3) * 6;
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y - 46 + bob);
    ctx.lineTo(m.x - 12, m.y - 70 + bob);
    ctx.lineTo(m.x + 12, m.y - 70 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d1d1d';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.name || '', m.x, m.y - 78 + bob);
  }

  // Pickups.
  for (const k of state.pickups) {
    if (k.taken) continue;
    const bob = Math.sin(state.time * 4 + k.id) * 4;
    ctx.fillStyle = k.pickupKind === 'case' ? '#ffcf3d' : k.pickupKind === 'health' ? '#ff5e6a' : '#7dff8a';
    ctx.beginPath();
    ctx.arc(k.x, k.y + bob, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d1d1d';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(k.pickupKind === 'case' ? '$' : k.pickupKind === 'health' ? '+' : 'A', k.x, k.y + bob + 5);
  }

  // Cars.
  for (const car of state.cars) drawCar(ctx, car, view);
  // People.
  for (const ped of state.peds) drawPed(ctx, ped, view);
  // Player.
  drawPlayer(ctx, state, view);
  // Particles and floating text.
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function inView(b, view) {
  return b.x + (b.w || 0) > view.camX - 40 && b.x < view.camX + view.w + 40 &&
    b.y + (b.h || 0) > view.camY - 40 && b.y < view.camY + view.h + 40;
}

export function drawCar(ctx, car, view) {
  if (car.x < view.camX - 80 || car.x > view.camX + view.w + 80 || car.y < view.camY - 80 || car.y > view.camY + view.h + 80) return;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-26, -13, 52, 28);
  ctx.fillStyle = car.color;
  ctx.fillRect(-26, -14, 52, 28);
  ctx.fillStyle = 'rgba(20,30,50,0.75)';
  ctx.fillRect(-8, -11, 16, 22);
  ctx.fillStyle = car.police ? PALETTE.policeTrim : 'rgba(255,255,255,0.35)';
  ctx.fillRect(-26, -14, 6, 28);
  if (car.police) {
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-2, -14, 8, 5);
    ctx.fillStyle = '#2f7bff';
    ctx.fillRect(-2, 9, 8, 5);
  }
  if (car.missionTarget) {
    ctx.fillStyle = '#ffcf3d';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2e2e';
    ctx.fillRect(car.x - Math.cos(car.angle) * 27 - 3, car.y - Math.sin(car.angle) * 27 - 3, 6, 6);
  }
}

function drawPed(ctx, ped, view) {
  if (ped.x < view.camX - 40 || ped.x > view.camX + view.w + 40 || ped.y < view.camY - 40 || ped.y > view.camY + view.h + 40) return;
  const bob = Math.sin(ped.walkPhase) * 2;
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.cop ? '#22303e' : ped.thug ? '#3d1f2b' : ped.color;
  ctx.beginPath();
  ctx.arc(0, bob * 0.3, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.cop ? '#ffffff' : '#e8c39a';
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4 + bob * 0.3, 5, 0, Math.PI * 2);
  ctx.fill();
  if (ped.cop) {
    ctx.fillStyle = '#2f7bff';
    ctx.fillRect(-6, -14, 12, 3);
  }
  ctx.restore();
}

function drawPlayer(ctx, state, view) {
  const p = state.player;
  if (state.playerInCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  const bob = Math.sin(p.walkPhase) * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 7, 11, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b73c';
  ctx.beginPath();
  ctx.arc(0, bob * 0.3, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2b30';
  ctx.fillRect(-8, -4 + bob * 0.3, 16, 5);
  ctx.fillStyle = '#e8c39a';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 5, Math.sin(p.angle) * 5 + bob * 0.3, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (state.shootFlash > 0) {
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Warm golden-hour wash over the whole frame.
export function drawLighting(ctx, w, h, time) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, 'rgba(255,190,90,0.10)');
  g.addColorStop(0.6, 'rgba(255,150,60,0.05)');
  g.addColorStop(1, 'rgba(40,20,80,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}
