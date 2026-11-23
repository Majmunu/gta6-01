// World rendering: camera, streets, buildings, cars, people, particles
// and the day/night light that washes over Solmar Bay.
import { CFG } from './config.js';
import { clamp, lerp } from './random.js';

export function updateCamera(S, dt) {
  const targetX = S.player.x - S.view.w / 2;
  const targetY = S.player.y - S.view.h / 2;
  const k = Math.min(1, dt * 4.5);
  S.camera.x = lerp(S.camera.x, targetX, k);
  S.camera.y = lerp(S.camera.y, targetY, k);
  S.camera.x = clamp(S.camera.x, -80, CFG.worldSize - S.view.w + 80);
  S.camera.y = clamp(S.camera.y, -80, CFG.worldSize - S.view.h + 80);
}

// Time of day 0..1 (0.25 dawn, 0.5 noon, 0.75 dusk, 0.95 night).
export function lightTint(t) {
  if (t < 0.2) return { color: 'rgba(20,30,70,0.42)', sun: 0.7 };
  if (t < 0.3) return { color: 'rgba(255,150,80,0.10)', sun: 0.9 };
  if (t < 0.65) return { color: 'rgba(255,240,200,0.0)', sun: 1.0 };
  if (t < 0.78) return { color: 'rgba(255,120,60,0.16)', sun: 0.85 };
  if (t < 0.88) return { color: 'rgba(40,30,70,0.28)', sun: 0.6 };
  return { color: 'rgba(8,10,30,0.48)', sun: 0.4 };
}

export function drawWorld(ctx, S) {
  const cam = S.camera;
  const vw = S.view.w, vh = S.view.h;
  const x0 = cam.x, y0 = cam.y, x1 = cam.x + vw, y1 = cam.y + vh;

  // Ground.
  ctx.fillStyle = CFG.colors.grass;
  ctx.fillRect(x0, y0, vw, vh);
  // Mown checkerboard on the grass for texture.
  ctx.fillStyle = CFG.colors.grassDark;
  const tile = 130;
  const tx0 = Math.floor(x0 / tile) * tile, ty0 = Math.floor(y0 / tile) * tile;
  for (let gx = tx0; gx < x1; gx += tile) {
    for (let gy = ty0; gy < y1; gy += tile) {
      if (((gx / tile) + (gy / tile)) % 2 === 0) ctx.fillRect(gx, gy, tile, tile);
    }
  }

  // The bay along the south edge.
  if (y1 > CFG.worldSize - 60) {
    ctx.fillStyle = CFG.colors.water;
    ctx.fillRect(x0, CFG.worldSize - 60, vw, 60 + (y1 - CFG.worldSize));
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x0, CFG.worldSize - 60, vw, 3);
  }

  drawParks(ctx, S, x0, y0, x1, y1);
  drawRoads(ctx, S, x0, y0, x1, y1);
  drawBuildings(ctx, S, x0, y0, x1, y1);
  drawTrees(ctx, S, x0, y0, x1, y1);
  drawPickups(ctx, S);
  drawCars(ctx, S);
  drawPeople(ctx, S);
  drawPlayer(ctx, S);
  drawParticles(ctx, S);

  // Mission marker beacon.
  const marker = S.missionMarker ? S.missionMarker() : null;
  if (marker && S.mode === 'playing') {
    const pulse = 1 + Math.sin(S.time * 4) * 0.15;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.strokeStyle = 'rgba(255,210,31,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(9, -18);
    ctx.lineTo(-9, -18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Daylight wash.
  const light = lightTint(S.timeOfDay);
  ctx.fillStyle = light.color;
  ctx.fillRect(x0, y0, vw, vh);
}

function drawRoads(ctx, S, x0, y0, x1, y1) {
  const n = S.city.n;
  const half = CFG.roadHalf;
  ctx.fillStyle = CFG.colors.road;
  for (let i = 0; i <= n; i++) {
    const p = i * CFG.block;
    if (p + half >= x0 && p - half <= x1) ctx.fillRect(p - half, y0, half * 2, y1 - y0);
    if (p + half >= y0 && p - half <= y1) ctx.fillRect(x0, p - half, x1 - x0, half * 2);
  }
  // Sidewalk edging.
  ctx.fillStyle = CFG.colors.sidewalk;
  for (let i = 0; i <= n; i++) {
    const p = i * CFG.block;
    if (p + half + 8 >= x0 && p - half - 8 <= x1) {
      ctx.fillRect(p - half - 8, y0, 4, y1 - y0);
      ctx.fillRect(p + half + 4, y0, 4, y1 - y0);
    }
    if (p + half + 8 >= y0 && p - half - 8 <= y1) {
      ctx.fillRect(x0, p - half - 8, x1 - x0, 4);
      ctx.fillRect(x0, p + half + 4, x1 - x0, 4);
    }
  }
  // Centre dashes.
  ctx.strokeStyle = CFG.colors.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (let i = 0; i <= n; i++) {
    const p = i * CFG.block;
    if (p >= x0 && p <= x1) {
      ctx.beginPath(); ctx.moveTo(p, y0); ctx.lineTo(p, y1); ctx.stroke();
    }
    if (p >= y0 && p <= y1) {
      ctx.beginPath(); ctx.moveTo(x0, p); ctx.lineTo(x1, p); ctx.stroke();
    }
  }
  ctx.setLineDash([]);
}

function drawParks(ctx, S, x0, y0, x1, y1) {
  ctx.fillStyle = CFG.colors.park;
  for (const p of S.city.parks) {
    if (p.x + p.w < x0 || p.x > x1 || p.y + p.h < y0 || p.y > y1) continue;
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  ctx.fillStyle = '#33373d';
  for (const lot of S.city.parkingLots) {
    if (lot.x + lot.w < x0 || lot.x > x1 || lot.y + lot.h < y0 || lot.y > y1) continue;
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    for (let bx = lot.x + 14; bx < lot.x + lot.w - 10; bx += 34) {
      ctx.beginPath(); ctx.moveTo(bx, lot.y + 8); ctx.lineTo(bx, lot.y + 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, lot.y + lot.h - 8); ctx.lineTo(bx, lot.y + lot.h - 34); ctx.stroke();
    }
  }
}

function drawBuildings(ctx, S, x0, y0, x1, y1) {
  for (const b of S.city.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    // Drop shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    // Walls and roof.
    ctx.fillStyle = CFG.colors.buildingWall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // Roof details: vents and a lighter inner slab.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
    if (b.landmark) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', b.x + b.w / 2, b.y + b.h / 2 + 5);
      ctx.textAlign = 'left';
    }
  }
}

function drawTrees(ctx, S, x0, y0, x1, y1) {
  for (const t of S.city.trees) {
    if (t.x < x0 - 20 || t.x > x1 + 20 || t.y < y0 - 20 || t.y > y1 + 20) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f6b2a';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a8a3d';
    ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-19, -10, 40, 24);
  // Body.
  ctx.fillStyle = car.color;
  roundRectPath(ctx, -21, -11, 42, 22, 6);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  roundRectPath(ctx, -4, -8, 16, 16, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.7)';
  ctx.fillRect(10, -8, 4, 16);
  // Headlights and tail lights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(19, -9, 2, 4);
  ctx.fillRect(19, 5, 2, 4);
  ctx.fillStyle = '#e23b3b';
  ctx.fillRect(-21, -9, 2, 4);
  ctx.fillRect(-21, 5, 2, 4);
  if (car.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    ctx.textAlign = 'left';
    // Light bar.
    const blink = Math.floor(Date.now() / 260) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2e2e' : '#2e7bff';
    ctx.fillRect(-2, -11, 6, 4);
    ctx.fillStyle = blink ? '#2e7bff' : '#ff2e2e';
    ctx.fillRect(-2, 7, 6, 4);
  }
  if (car.kind === 'special') {
    ctx.fillStyle = '#7a5c00';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GT', 0, 3);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(ctx, S) {
  for (const car of S.cars) {
    if (car.dead) continue;
    drawCarShape(ctx, car);
  }
}

function drawPerson(ctx, x, y, angle, shirt, skin, walkPhase) {
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(1, 2, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(angle);
  const swing = Math.sin(walkPhase) * 3;
  // Legs.
  ctx.fillStyle = '#2c3440';
  ctx.fillRect(-4, -5 + swing * 0.4, 8, 4);
  ctx.fillRect(-4, 1 - swing * 0.4, 8, 4);
  // Body.
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPeople(ctx, S) {
  for (const ped of S.peds) {
    if (ped.dead) continue;
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, S.time * 6 + ped.id);
  }
  for (const cop of S.cops) {
    if (cop.dead) continue;
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#1c2f4a', cop.skin, S.time * 9 + cop.id);
    // Badge dot and cap.
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath(); ctx.arc(cop.x, cop.y, 2, 0, Math.PI * 2); ctx.fill();
  }
  for (const t of S.thugs) {
    if (t.dead) continue;
    drawPerson(ctx, t.x, t.y, t.angle, '#7a1f1f', t.skin, S.time * 8 + t.id);
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', t.x, t.y - 16);
    ctx.textAlign = 'left';
  }
}

function drawPlayer(ctx, S) {
  const p = S.player;
  if (p.inCar) return;
  drawPerson(ctx, p.x, p.y, p.angle, '#e8b23a', '#e8b98a', S.time * 7);
  // Muzzle flash.
  if (S.muzzleFlash > 0) {
    ctx.fillStyle = 'rgba(255,223,107,0.9)';
    const mx = p.x + Math.cos(p.angle) * 26;
    const my = p.y + Math.sin(p.angle) * 26;
    ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPickups(ctx, S) {
  for (const pk of S.pickups) {
    if (pk.dead) continue;
    const bob = Math.sin(S.time * 4 + pk.id) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#2fae4e';
      ctx.fillRect(-9, -6, 18, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 4);
      ctx.textAlign = 'left';
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#e23b3b';
      ctx.fillRect(-2.5, -7, 5, 14);
      ctx.fillRect(-7, -2.5, 14, 5);
    } else {
      ctx.fillStyle = '#ffd21f';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#7a5c00';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A', 0, 4);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
}

function drawParticles(ctx, S) {
  for (const pt of S.particles) {
    const a = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * a + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
