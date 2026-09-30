'use strict';
// Tunnel scenes (garden paths, stairwells, corridors), shop interior, handlebars, phone, overlays.

// ---------- phone state ----------
const phone = { mode: 'idle', g: 0, gt: 0, offer: null, timer: 1, tap: null, tapT: 0, earn: 0, trips: 0, order: '', status: '', amount: 0, target: '', sub: '', t: 0 };

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const money = v => '£' + v.toFixed(2);

function phoneScreen(c, W, H) {
  const t = phone.t, m = phone.mode;
  c.fillStyle = '#11171d'; c.fillRect(0, 0, W, H);
  c.textBaseline = 'alphabetic';
  const txt = (s, x, y, size, col, weight, align) => { c.font = (weight || 500) + ' ' + size + 'px system-ui,Segoe UI,Roboto,sans-serif'; c.fillStyle = col || '#fff'; c.textAlign = align || 'left'; c.fillText(s, x, y); };
  // status bar
  txt(clockStr(), 10, 15, 10, '#9fb0bd', 600);
  c.fillStyle = '#9fb0bd'; rr(c, W - 28, 7, 18, 8, 2); c.fill(); c.fillStyle = '#11171d'; c.fillRect(W - 26, 9, 8, 4);
  const map = (h, route) => {
    c.save(); c.beginPath(); c.rect(0, 22, W, h); c.clip();
    c.fillStyle = '#1a252e'; c.fillRect(0, 22, W, h);
    c.strokeStyle = '#2a3a47'; c.lineWidth = 5; const off = (R.dist * 1.3) % 60;
    for (let i = -1; i < 8; i++) { c.beginPath(); c.moveTo(-10, 22 + i * 60 + off); c.lineTo(W + 10, 22 + i * 60 + off + (i % 2 ? 14 : -10)); c.stroke(); }
    c.lineWidth = 4; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(i * 52 - 6, 22); c.lineTo(i * 52 + 18, 22 + h); c.stroke(); }
    c.fillStyle = '#1c3a30'; c.fillRect(120, 60 + off * .5, 50, 36);
    if (route) {
      const S = world.street, nx = nav.queue[0], py = 22 + h - 34, parking = R.parkZ != null;
      const rem = Math.max(0, parking ? R.parkZ - R.z : (S ? S.len - R.z : 100));
      const ty = Math.max(92, py - 14 - Math.min(rem, 220) * .55);
      c.strokeStyle = '#1fbf8f'; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(100, py);
      if (parking) { c.lineTo(100, ty); c.stroke(); const sd = S.dest.side; c.fillStyle = '#ff5a5f'; c.beginPath(); c.arc(100 + sd * 9, ty, 7, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(100 + sd * 9, ty, 2.5, 0, TAU); c.fill(); }
      else if (nx && nx.turn !== 'S') { const sg = nx.turn === 'L' ? -1 : 1; c.lineTo(100, ty); c.lineTo(100 + sg * 22, ty - 22); c.lineTo(100 + sg * 22, 40); c.stroke(); }
      else { c.lineTo(100, 40); c.stroke(); }
    }
    c.restore();
    const py = route ? 22 + h - 34 : 22 + h * .55, pr = 7 + Math.sin(t * 3) * 1.5;
    c.fillStyle = 'rgba(70,150,255,.25)'; c.beginPath(); c.arc(100, py, pr * 2.2, 0, TAU); c.fill();
    c.fillStyle = '#4b9bff'; c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(100, py, 6, 0, TAU); c.fill(); c.stroke();
  };
  if (m === 'idle') {
    map(270, false);
    c.fillStyle = 'rgba(255,140,60,.18)'; c.beginPath(); c.arc(60, 120, 46, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,140,60,.14)'; c.beginPath(); c.arc(60, 120, 26, 0, TAU); c.fill();
    txt('Busy area', 60, 123, 9, '#ffb98a', 600, 'center');
    c.fillStyle = '#161e26'; c.fillRect(0, 292, W, H - 292);
    c.fillStyle = '#1fbf8f'; c.beginPath(); c.arc(16, 312, 4 + Math.sin(t * 3) * 1, 0, TAU); c.fill();
    txt('Online' , 28, 316, 13, '#fff', 700);
    txt('Looking for orders' + '.'.repeat(1 + ((t * 1.5) | 0) % 3), 12, 338, 11, '#9fb0bd');
    c.fillStyle = '#222d37'; rr(c, 10, 352, W - 20, 52, 8); c.fill();
    txt(money(phone.earn), 20, 384, 24, '#fff', 700); txt(phone.trips + (phone.trips === 1 ? ' trip' : ' trips') + ' today', W - 16, 384, 10, '#9fb0bd', 500, 'right');
  } else if (m === 'offer' && phone.offer) {
    const o = phone.offer;
    c.fillStyle = '#1fbf8f'; c.fillRect(0, 22, W, 34); txt('New delivery', 12, 45, 14, '#04241c', 800);
    c.strokeStyle = '#04241c'; c.lineWidth = 3; c.beginPath(); c.arc(W - 22, 39, 10, -Math.PI / 2, -Math.PI / 2 + TAU * phone.timer); c.stroke();
    txt(money(o.pay), 14, 108, 44, '#fff', 800);
    txt('estimated', 16, 124, 10, '#7f93a3');
    c.fillStyle = '#222d37'; rr(c, 10, 138, W - 20, 64, 8); c.fill();
    txt(o.mi.toFixed(1) + ' mi', 20, 168, 22, '#fff', 700); txt(Math.round(o.min) + ' min', W - 18, 168, 16, '#c8d4dd', 600, 'right');
    txt('total distance', 20, 188, 10, '#7f93a3'); txt('est. time', W - 18, 188, 10, '#7f93a3', 500, 'right');
    c.fillStyle = '#4b9bff'; c.beginPath(); c.arc(18, 226, 4, 0, TAU); c.fill();
    txt(o.rest, 30, 231, 14, '#fff', 700); txt(o.cuisine + ' · ' + o.street, 30, 246, 10, '#7f93a3');
    c.fillStyle = '#1fbf8f'; c.fillRect(15, 250, 2, 16); c.beginPath(); c.arc(18, 280, 4, 0, TAU); c.fill();
    txt('Drop-off', 30, 285, 13, '#fff', 700); txt(o.district, 30, 300, 10, '#7f93a3');
    // timer bar
    c.fillStyle = '#26323d'; c.fillRect(10, 330, W - 20, 4); c.fillStyle = '#1fbf8f'; c.fillRect(10, 330, (W - 20) * phone.timer, 4);
    const acc = phone.tap === 'accept', dec = phone.tap === 'decline';
    c.fillStyle = dec ? '#3a4652' : '#26323d'; rr(c, 10, 346, 72, 42, 10); c.fill(); txt('Decline', 46, 372, 12, '#e6edf2', 700, 'center');
    c.fillStyle = acc ? '#3fe0b0' : '#1fbf8f'; rr(c, 90, 346, 100, 42, 10); c.fill(); txt('Accept', 140, 372, 14, '#04241c', 800, 'center');
    if (phone.tap) {
      const bx = acc ? 140 : 46, by = 367, p = clamp(phone.tapT / .35, 0, 1);
      c.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - Math.abs(p - .5) * 2)).toFixed(2) + ')'; c.beginPath(); c.arc(bx, by + (1 - p) * 26, 15, 0, TAU); c.fill();
    }
  } else if (m === 'nav') {
    map(236, true);
    const nx = nav.queue[0], S = world.street; let instr = 'Continue straight', arrow = 0, sub = S ? S.name : '';
    if (S && R.parkZ != null) { instr = 'Stop ' + (S.dest.side < 0 ? 'left' : 'right'); sub = S.name; }
    else if (nx && nx.turn !== 'S') { instr = 'Turn ' + (nx.turn === 'L' ? 'left' : 'right'); arrow = nx.turn === 'L' ? -1 : 1; sub = 'onto ' + nx.name; }
    else if (nx) { instr = 'Continue'; sub = 'onto ' + nx.name; }
    c.fillStyle = '#0f6b53'; c.fillRect(0, 22, W, 48);
    c.strokeStyle = '#fff'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
    if (arrow === 0) { c.moveTo(22, 58); c.lineTo(22, 32); c.moveTo(14, 40); c.lineTo(22, 32); c.lineTo(30, 40); }
    else { c.moveTo(22, 60); c.lineTo(22, 40); c.lineTo(22 + arrow * 14, 40); c.moveTo(22 + arrow * 6, 32); c.lineTo(22 + arrow * 14, 40); c.lineTo(22 + arrow * 6, 48); }
    c.stroke();
    txt(instr, 44, 42, 13, '#fff', 800); txt(sub, 44, 60, 10, '#c9efe3', 500);
    const rem = S ? Math.max(0, (S.len - R.z)) : 0; txt(R.parkZ != null ? Math.max(0, Math.round((R.parkZ - R.z) / 10) * 10) + ' m' : Math.round(rem / 10) * 10 + ' m', W - 8, 62, 11, '#fff', 700, 'right');
    c.fillStyle = '#161e26'; c.fillRect(0, 258, W, H - 258);
    txt(phone.target, 12, 284, 10, '#7f93a3', 700); txt(phone.sub, 12, 306, 15, '#fff', 800);
    txt(phone.sub2 || '', 12, 324, 10, '#9fb0bd');
    c.fillStyle = '#222d37'; rr(c, 10, 346, W - 20, 42, 8); c.fill(); txt('Order #' + phone.order, 20, 372, 12, '#c8d4dd', 700); txt(money(phone.amount), W - 18, 372, 15, '#1fbf8f', 800, 'right');
  } else if (m === 'arrived') {
    c.fillStyle = '#161e26'; c.fillRect(0, 22, W, H - 22);
    txt('You have arrived', 12, 60, 13, '#1fbf8f', 800); txt(phone.sub, 12, 92, 18, '#fff', 800); txt(phone.sub2 || '', 12, 112, 10, '#9fb0bd');
    c.fillStyle = '#222d37'; rr(c, 10, 130, W - 20, 82, 10); c.fill();
    txt('Order', 20, 152, 10, '#7f93a3'); txt('#' + phone.order, 20, 182, 28, '#fff', 800);
    txt(phone.status, 20, 202, 11, phone.status.indexOf('Ready') === 0 ? '#1fbf8f' : '#ffb98a', 700);
    if (phone.items) { phone.items.forEach((s, i) => txt('• ' + s, 14, 244 + i * 18, 11, '#c8d4dd')); }
    c.fillStyle = phone.status.indexOf('Ready') === 0 ? '#1fbf8f' : '#2a3540'; rr(c, 10, 346, W - 20, 42, 10); c.fill();
    txt(phone.btn || 'Confirm pickup', W / 2, 372, 13, phone.status.indexOf('Ready') === 0 ? '#04241c' : '#8a9aa7', 800, 'center');
  } else if (m === 'done') {
    c.fillStyle = '#0f6b53'; c.fillRect(0, 22, W, H - 22);
    c.strokeStyle = '#fff'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(66, 136); c.lineTo(92, 162); c.lineTo(140, 104); c.stroke();
    txt('Delivered', W / 2, 220, 22, '#fff', 800, 'center'); txt(money(phone.amount), W / 2, 274, 40, '#fff', 800, 'center');
    txt(phone.sub || '', W / 2, 304, 11, '#c9efe3', 500, 'center');
  } else if (m === 'cancel') {
    c.fillStyle = '#4a1f24'; c.fillRect(0, 22, W, H - 22);
    txt('Order cancelled', W / 2, 190, 18, '#fff', 800, 'center'); txt(phone.sub || '', W / 2, 218, 11, '#f2c4c8', 500, 'center');
    if (phone.amount > 0) txt('+' + money(phone.amount), W / 2, 290, 34, '#fff', 800, 'center');
  } else if (m === 'scan') {
    const bg = c.createLinearGradient(0, 22, 0, H); bg.addColorStop(0, '#302d28'); bg.addColorStop(1, '#131211'); c.fillStyle = bg; c.fillRect(0, 22, W, H - 22);
    const qx = 48, qy = 118, qs = 104, n = 13, cs = qs / n;
    c.fillStyle = '#f4f4f0'; c.fillRect(qx - 6, qy - 6, qs + 12, qs + 12); c.fillStyle = '#111';
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const fin = (i < 4 && j < 4) || (i > n - 5 && j < 4) || (i < 4 && j > n - 5); if (!fin && hash(i, j, 7) < .5) c.fillRect(qx + i * cs, qy + j * cs, cs + .3, cs + .3); }
    for (const [fx, fy] of [[0, 0], [n - 4, 0], [0, n - 4]]) { c.fillStyle = '#111'; c.fillRect(qx + fx * cs, qy + fy * cs, 4 * cs, 4 * cs); c.fillStyle = '#f4f4f0'; c.fillRect(qx + (fx + .7) * cs, qy + (fy + .7) * cs, 2.6 * cs, 2.6 * cs); c.fillStyle = '#111'; c.fillRect(qx + (fx + 1.3) * cs, qy + (fy + 1.3) * cs, 1.4 * cs, 1.4 * cs); }
    c.strokeStyle = phone.scanOk ? '#1fbf8f' : '#fff'; c.lineWidth = 3; c.lineCap = 'round';
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const px = qx + qs / 2 + sx * (qs / 2 + 14), py = qy + qs / 2 + sy * (qs / 2 + 14); c.beginPath(); c.moveTo(px, py - sy * 18); c.lineTo(px, py); c.lineTo(px - sx * 18, py); c.stroke(); }
    if (!phone.scanOk) { const yy = qy + (.5 + .5 * Math.sin(t * 5)) * qs; c.fillStyle = 'rgba(255,70,70,.85)'; c.fillRect(qx - 10, yy, qs + 20, 2); }
    txt('Scan the order code', W / 2, 72, 14, '#fff', 700, 'center');
    if (phone.scanOk) { c.fillStyle = '#1fbf8f'; rr(c, 14, 300, W - 28, 52, 12); c.fill(); txt('Order confirmed', W / 2, 332, 15, '#04241c', 800, 'center'); } else txt('Hold steady…', W / 2, 330, 11, '#9fb0bd', 500, 'center');
  } else if (m === 'code') {
    c.fillStyle = '#161e26'; c.fillRect(0, 22, W, H - 22);
    txt("Customer's code", W / 2, 60, 15, '#fff', 800, 'center'); txt('Ask them for their 4-digit code', W / 2, 78, 10, '#9fb0bd', 500, 'center');
    for (let i = 0; i < 4; i++) { c.fillStyle = '#222d37'; rr(c, 24 + i * 38, 96, 32, 44, 8); c.fill(); c.strokeStyle = phone.codeOk ? '#1fbf8f' : (i === (phone.digits || '').length ? '#4b9bff' : '#33414d'); c.lineWidth = 2; c.stroke(); const d = (phone.digits || '')[i]; if (d) txt(d, 40 + i * 38, 128, 26, '#fff', 800, 'center'); }
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    keys.forEach((k, i) => { const kx = 18 + (i % 3) * 56, ky = 160 + Math.floor(i / 3) * 44; if (!k) return; c.fillStyle = phone.key === k && !phone.codeOk ? '#3a4a58' : '#222d37'; rr(c, kx, ky, 50, 38, 9); c.fill(); txt(k, kx + 25, ky + 26, 18, '#e6edf2', 700, 'center'); });
    if (phone.codeOk) { c.fillStyle = '#1fbf8f'; rr(c, 14, 348, W - 28, 40, 12); c.fill(); txt('Code correct', W / 2, 374, 14, '#04241c', 800, 'center'); }
  } else if (m === 'call') {
    c.fillStyle = '#161e26'; c.fillRect(0, 22, W, H - 22);
    c.fillStyle = 'rgba(31,191,143,' + (0.15 + 0.1 * Math.sin(t * 4)).toFixed(2) + ')'; c.beginPath(); c.arc(100, 150, 46 + Math.sin(t * 4) * 4, 0, TAU); c.fill();
    c.fillStyle = '#2a3a47'; c.beginPath(); c.arc(100, 150, 34, 0, TAU); c.fill(); txt((phone.sub || '?')[0], 100, 162, 34, '#fff', 800, 'center');
    txt(phone.sub || '', W / 2, 224, 18, '#fff', 800, 'center'); txt(phone.status || 'Calling…', W / 2, 246, 11, '#9fb0bd', 500, 'center');
    c.fillStyle = '#d93a45'; c.beginPath(); c.arc(100, 350, 24, 0, TAU); c.fill();
  }
}

function drawPhone(dt, mounted) {
  phone.t += dt; phone.g += (phone.gt - phone.g) * (1 - Math.exp(-dt * 5));
  if (phone.tap) phone.tapT += dt;
  const g = phone.g * phone.g * (3 - 2 * phone.g);
  const Ph = SH * lerp(.31, .62, g), Pw = Ph * .49, cx = lerp(mounted ? SW * .5 : SW * .16, SW * (mounted ? .5 : .3), g);
  const top = SH - Ph * lerp(.98, 1.0, g) + SH * lerp(.02, .0, g);
  const x = cx - Pw / 2, y = top;
  ctx.save();
  if (!mounted) ctx.translate(0, Math.sin(scene.wph) * 2);
  if (mounted) { ctx.fillStyle = '#15181c'; rr(ctx, cx - Pw * .3, y + Ph * .9, Pw * .6, Ph * .3, 6); ctx.fill(); }
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 16;
  ctx.fillStyle = '#0b0d10'; rr(ctx, x, y, Pw, Ph, Pw * .09); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#2b3036'; ctx.lineWidth = 1.5; ctx.stroke();
  const bz = Pw * .045, sw = Pw - bz * 2, sh = Ph - bz * 2, s = sw / 200;
  ctx.save(); ctx.translate(x + bz, y + bz); rr(ctx, 0, 0, sw, sh, Pw * .06); ctx.clip(); ctx.scale(s, s);
  phoneScreen(ctx, 200, sh / s);
  ctx.restore();
  // glare
  const gl = ctx.createLinearGradient(x, y, x + Pw, y + Ph); gl.addColorStop(0, 'rgba(255,255,255,.07)'); gl.addColorStop(.4, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl; rr(ctx, x, y, Pw, Ph, Pw * .09); ctx.fill();
  ctx.restore();
}

// ---------- handlebars ----------
function drawBike(dt) {
  const w = SW, h = SH, v = R.v, t = world.time;
  const vib = Math.min(1, v / 8) * (Math.sin(t * 61) * .7 + Math.sin(t * 37) * .5) * h * .0012 + (R.filter ? 0 : 0);
  ctx.save(); ctx.translate(0, vib);
  const lightK = clamp(.35 + env.amb * .9, .3, 1);
  const body = (a, b) => { const g = ctx.createLinearGradient(0, h * .78, 0, h); g.addColorStop(0, `rgb(${a * lightK | 0},${(a + 6) * lightK | 0},${(a + 12) * lightK | 0})`); g.addColorStop(1, `rgb(${b * lightK | 0},${b * lightK | 0},${(b + 4) * lightK | 0})`); return g; };
  // mirrors & stalks
  for (const sd of [-1, 1]) {
    const bx = w * (.5 + sd * .40), by = h * .84;
    ctx.strokeStyle = `rgb(${18 * lightK},${20 * lightK},${24 * lightK})`; ctx.lineWidth = h * .012; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + sd * w * .012, h * .63); ctx.stroke();
    const mx = bx + sd * w * .022, my = h * .585;
    ctx.fillStyle = `rgb(${24 * lightK},${26 * lightK},${30 * lightK})`; ctx.beginPath(); ctx.ellipse(mx, my, h * .07, h * .052, sd * .25, 0, TAU); ctx.fill();
    const mg = ctx.createLinearGradient(mx - h * .06, my - h * .04, mx + h * .06, my + h * .04);
    mg.addColorStop(0, shade(env.skyBot, 0, .9)); mg.addColorStop(1, shade([80, 84, 90], 0, .8));
    ctx.fillStyle = mg; ctx.beginPath(); ctx.ellipse(mx, my, h * .058, h * .042, sd * .25, 0, TAU); ctx.fill();
  }
  // fairing / dash body
  ctx.fillStyle = body(38, 14);
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * .92); ctx.bezierCurveTo(w * .2, h * .88, w * .3, h * .83, w * .5, h * .815); ctx.bezierCurveTo(w * .7, h * .83, w * .8, h * .88, w, h * .92); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, h * .92); ctx.bezierCurveTo(w * .2, h * .88, w * .3, h * .83, w * .5, h * .815); ctx.bezierCurveTo(w * .7, h * .83, w * .8, h * .88, w, h * .92); ctx.stroke();
  // handlebar tubes
  for (const sd of [-1, 1]) {
    const gx = w * (.5 + sd * .36), gy = h * .875;
    ctx.strokeStyle = `rgb(${26 * lightK},${28 * lightK},${32 * lightK})`; ctx.lineWidth = h * .028; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w * (.5 + sd * .14), h * .9); ctx.lineTo(gx - sd * w * .04, gy); ctx.stroke();
    // glove
    const gg = ctx.createLinearGradient(0, gy - h * .06, 0, gy + h * .08); gg.addColorStop(0, `rgb(${58 * lightK | 0},${52 * lightK | 0},${48 * lightK | 0})`); gg.addColorStop(1, `rgb(${22 * lightK | 0},${20 * lightK | 0},${20 * lightK | 0})`);
    ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(gx, gy, w * .05, h * .062, sd * -.18, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(gx - sd * w * .052 + sd * k * w * .001, gy - h * .04 + k * h * .022); ctx.lineTo(gx - sd * w * .012, gy - h * .045 + k * h * .022); ctx.stroke(); }
    ctx.fillStyle = `rgb(${30 * lightK | 0},${34 * lightK | 0},${38 * lightK | 0})`; ctx.beginPath(); ctx.ellipse(gx + sd * w * .055, gy + h * .01, w * .014, h * .038, 0, 0, TAU); ctx.fill();
  }
  // dash cluster (left of phone)
  { const cx = w * .5 - Math.min(w * .17, h * .32), cy = h * .915, r = h * .05;
    ctx.fillStyle = '#05080a'; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.5, r * 1.02, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7ce9ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 ' + (r * 1.05 | 0) + 'px system-ui,sans-serif';
    ctx.fillText(Math.round(v * 2.237), cx, cy - r * .12); ctx.font = '600 ' + (r * .32 | 0) + 'px system-ui,sans-serif'; ctx.fillStyle = '#4fa8b8'; ctx.fillText('mph', cx, cy + r * .5);
    ctx.fillStyle = '#4ade80'; ctx.fillRect(cx - r * 1.2, cy - r * .85, r * 2.4 * (0.78 - (phone.trips * .012)), r * .12);
    if ((scene.headlight || 0) > .5) { ctx.strokeStyle = '#4da3ff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; const ix = cx + r * 1.35, iy = cy + r * .55; ctx.beginPath(); ctx.arc(ix, iy, r * .17, -Math.PI / 2, Math.PI / 2); ctx.stroke(); for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(ix - r * .06, iy + k * r * .12); ctx.lineTo(ix - r * .3, iy + k * r * .12); ctx.stroke(); } }
    if (R.ind && Math.floor(t * 2.6) % 2 === 0) { ctx.fillStyle = '#5cff8a'; ctx.beginPath(); const ax = cx + R.ind * r * 1.25, ay = cy - r * .5; ctx.moveTo(ax + R.ind * r * .3, ay); ctx.lineTo(ax - R.ind * r * .1, ay - r * .22); ctx.lineTo(ax - R.ind * r * .1, ay + r * .22); ctx.fill(); }
  }
  ctx.restore();
}

// ---------- weather on the lens ----------
const drops = []; const rain = []; for (let i = 0; i < 200; i++) rain.push({ x: Math.random(), y: Math.random(), s: .6 + Math.random() * .8 });
function drawWeatherFx(dt, lens) {
  if (env.rain > .04) {
    ctx.strokeStyle = 'rgba(200,215,230,' + (.22 * Math.min(1, env.rain * 1.3)).toFixed(2) + ')'; ctx.lineWidth = 1; ctx.beginPath();
    const n = Math.floor(rain.length * Math.min(1, env.rain + .15)), sp = lens ? R.v : 1.2;
    for (let i = 0; i < n; i++) {
      const r = rain[i]; r.y += dt * (1.3 + r.s) * .9; r.x -= dt * (.04 + sp * .012);
      if (r.y > 1) { r.y = -.05; r.x = Math.random() * 1.2; } if (r.x < -.1) r.x += 1.2;
      const x = r.x * SW, y = r.y * SH; ctx.moveTo(x, y); ctx.lineTo(x - (.006 + sp * .002) * SW, y + SH * .03 * r.s);
    }
    ctx.stroke();
  }
  if (lens && env.rain > .15) {
    if (Math.random() < dt * env.rain * 4 && drops.length < 16) drops.push({ x: Math.random() * SW, y: Math.random() * SH * .7, r: 2 + Math.random() * 5, life: 1 });
    for (let i = drops.length - 1; i >= 0; i--) {
      const p = drops[i]; p.life -= dt * .12; p.y += dt * (R.v * 1.5 + 3); p.x -= dt * R.v * .8;
      if (p.life <= 0 || p.y > SH || p.x < 0) { drops.splice(i, 1); continue; }
      ctx.fillStyle = 'rgba(210,225,240,' + (p.life * .16).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 1.25, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,' + (p.life * .3).toFixed(2) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x - p.r * .2, p.y - p.r * .3, p.r * .6, 3.4, 4.6); ctx.stroke();
    }
  } else drops.length = 0;
}
let vig = null;
function drawVignette() {
  if (!vig || vig.w !== SW || vig.h !== SH) { const g = ctx.createRadialGradient(SW / 2, SH * .5, Math.min(SW, SH) * .45, SW / 2, SH * .5, Math.max(SW, SH) * .8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)'); vig = { g, w: SW, h: SH }; }
  ctx.fillStyle = vig.g; ctx.fillRect(0, 0, SW, SH);
}

// bag carried in hand while walking
// Kraft-paper takeaway bag held by its twisted handles (x, y = bag centre, s = bag height in px)
function drawBag(x, y, s, col, skin) {
  col = col || [200, 50, 40];
  const k = LIGHT ? clamp(LIGHT.amb[0] * 1.1, .35, 1) : clamp(.3 + env.amb * .85, .3, 1), L = c => 'rgb(' + (c[0] * k | 0) + ',' + (c[1] * k | 0) + ',' + (c[2] * k | 0) + ')';
  const sway = Math.sin(scene.wph - .6) * .07;   // pendulum: lags the stride
  ctx.save(); ctx.translate(x, y - s * .62); ctx.rotate(sway); ctx.translate(0, s * .62);
  const w = s * .66, top = -s * .4, bot = s * .42, gus = w * .2;
  // soft shadow the bag casts on itself / the air behind
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(s * .04, bot + s * .02, w * .55, s * .04, 0, 0, TAU); ctx.fill();
  // handles (behind the front panel): twisted paper rope
  for (const hx of [-w * .2, w * .2]) {
    ctx.strokeStyle = L([150, 118, 80]); ctx.lineWidth = s * .035; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - w * .1, top + s * .03); ctx.bezierCurveTo(hx - w * .12, top - s * .2, hx * .3, -s * .64, 0, -s * .63); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + w * .1, top + s * .03); ctx.bezierCurveTo(hx + w * .12, top - s * .2, hx * .3, -s * .64, 0, -s * .63); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,210,' + (.25 * k).toFixed(2) + ')'; ctx.lineWidth = s * .01; ctx.beginPath(); ctx.moveTo(hx - w * .1, top); ctx.bezierCurveTo(hx - w * .12, top - s * .2, hx * .3, -s * .63, 0, -s * .62); ctx.stroke();
  }
  // side gusset (right), darker, with its centre fold
  ctx.fillStyle = L([160, 128, 88]); ctx.beginPath(); ctx.moveTo(w / 2, top); ctx.lineTo(w / 2 + gus, top + s * .03); ctx.lineTo(w / 2 + gus, bot - s * .01); ctx.lineTo(w / 2, bot); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(70,50,30,.35)'; ctx.lineWidth = Math.max(1, s * .006); ctx.beginPath(); ctx.moveTo(w / 2 + gus * .5, top + s * .02); ctx.lineTo(w / 2 + gus * .45, bot - s * .08); ctx.lineTo(w / 2, bot); ctx.stroke();
  // front panel: lit from the upper left, paper grain, crumple creases
  const pg = ctx.createLinearGradient(-w / 2, top, w / 2, bot); pg.addColorStop(0, L([226, 198, 156])); pg.addColorStop(.55, L([206, 176, 132])); pg.addColorStop(1, L([176, 144, 102]));
  ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(-w / 2, top); ctx.lineTo(w / 2, top); ctx.lineTo(w / 2, bot); ctx.lineTo(-w / 2, bot); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = 'rgba(90,64,36,.10)'; ctx.lineWidth = 1; for (let i = 0; i < 16; i++) { const gx = -w / 2 + w * hash(i, 3); ctx.beginPath(); ctx.moveTo(gx, top); ctx.lineTo(gx + w * .02, bot); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(80,56,30,.22)'; ctx.lineWidth = Math.max(1, s * .005); ctx.beginPath(); ctx.moveTo(-w * .3, top + s * .1); ctx.lineTo(-w * .12, top + s * .22); ctx.lineTo(w * .05, top + s * .16); ctx.moveTo(w * .1, bot - s * .2); ctx.lineTo(w * .32, bot - s * .12); ctx.stroke();
  const gr = ctx.createRadialGradient(w * .18, bot - s * .18, 0, w * .18, bot - s * .18, s * .09); gr.addColorStop(0, 'rgba(120,80,30,.22)'); gr.addColorStop(1, 'rgba(120,80,30,0)'); ctx.fillStyle = gr; ctx.fillRect(-w / 2, top, w, bot - top);  // grease spot
  ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(-w / 2, bot - s * .06, w, s * .06);
  ctx.restore();
  // folded rim
  ctx.fillStyle = L([196, 164, 120]); ctx.fillRect(-w / 2, top, w, s * .05); ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(-w / 2, top + s * .05, w, s * .012);
  // restaurant sticker
  const cx = -w * .04, cy = -s * .02, cr = s * .13;
  ctx.fillStyle = L(col); ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill();
  ctx.strokeStyle = L([250, 246, 236]); ctx.lineWidth = s * .012; ctx.beginPath(); ctx.arc(cx, cy, cr * .78, 0, TAU); ctx.stroke();
  ctx.fillStyle = L([250, 246, 236]); ctx.fillRect(cx - cr * .45, cy - cr * .12, cr * .9, cr * .1); ctx.fillRect(cx - cr * .32, cy + cr * .1, cr * .64, cr * .08);
  // receipt stapled over the rim
  ctx.save(); ctx.translate(w * .22, top - s * .02); ctx.rotate(.06);
  ctx.fillStyle = L([246, 244, 238]); ctx.fillRect(0, 0, w * .2, s * .2); ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(w * .2, s * .01, s * .008, s * .2);
  ctx.fillStyle = 'rgba(40,40,40,.55)'; for (let i = 0; i < 6; i++) ctx.fillRect(w * .025, s * (.05 + i * .024), w * (.1 + hash(i, 7) * .05), s * .007);
  ctx.fillStyle = 'rgba(120,120,126,.9)'; ctx.fillRect(w * .06, s * .015, w * .08, s * .008);
  ctx.restore();
  ctx.restore();
  const hx = x, hy = y - s * .64;
  if (skin) { // someone else's bare hand holding it
    ctx.fillStyle = L(skin); ctx.beginPath(); ctx.ellipse(hx, hy, s * .11, s * .075, -.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = Math.max(1, s * .005); for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx - s * .09 + i * s * .045, hy - s * .05); ctx.lineTo(hx - s * .095 + i * s * .045, hy + s * .05); ctx.stroke(); }
    return;
  }
  // gloved hand gripping the handles
  const hg = ctx.createLinearGradient(hx, hy - s * .08, hx, hy + s * .08); hg.addColorStop(0, L([70, 64, 60])); hg.addColorStop(1, L([22, 20, 20]));
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(hx, hy, s * .16, s * .085, -.08, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = Math.max(1, s * .006); for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(hx - s * .13 + i * s * .065, hy - s * .07); ctx.lineTo(hx - s * .14 + i * s * .065, hy + s * .06); ctx.stroke(); }
  ctx.fillStyle = L([34, 30, 30]); ctx.beginPath(); ctx.ellipse(hx - s * .15, hy + s * .02, s * .05, s * .06, .4, 0, TAU); ctx.fill();
}

// ---------- tunnel scenes ----------
function newTun(o) {
  return Object.assign({ items: [], L: 6, hw: 1.1, out: false, bright: .8, H: () => 0, doorPanels: [], lookMax: 0 }, o);
}
function tq(t, layer, zc, col, pts, o) { t.items.push(Object.assign({ k: zc - layer * .02, col, q: pts, layer }, o || {})); }
function finishTun(t) { t.items.sort((a, b) => b.k - a.k); return t; }

function buildGarden(o) { // o: {L, num, doorCol, cust, hedge}
  const t = newTun({ L: o.L, out: true, hw: 1.1, eye: 1.6, gate: true, kind: 'garden', num: o.num });
  const L = t.L, stepZ = L - 1.3, hw = t.hw;
  t.H = z => z < stepZ ? 0 : .17 * Math.min(4, Math.floor((z - stepZ) / .3) + 1);
  const brick = mixc(o.wall || [150, 84, 62], [0, 0, 0], 0);
  for (let z = 0; z < L; z += .6) {
    const h0 = t.H(z + .01), h1 = h0;
    tq(t, 0, z + .3, ((z / .6) | 0) % 2 ? [150, 146, 138] : [136, 132, 126], [-hw, h0, z, hw, h0, z, hw, h0, z + .6, -hw, h0, z + .6]);
    if (z >= stepZ - .01) tq(t, 1, z, [170, 166, 158], [-hw, t.H(z - .1), z, hw, t.H(z - .1), z, hw, h0, z, -hw, h0, z]);
    for (const sd of [-1, 1]) {
      const hedge = o.hedge !== false && !o.short;
      if (hedge) {
        tq(t, 1, z + .3, [46, 88, 42], [sd * hw, 0, z, sd * hw, 0, z + .6, sd * hw, 1.15, z + .6, sd * hw, 1.15, z], { b: .9 });
        tq(t, 2, z + .3, [58, 104, 50], [sd * hw, 1.15, z, sd * hw, 1.15, z + .6, sd * (hw + .55), 1.15, z + .6, sd * (hw + .55), 1.15, z], {});
      }
      tq(t, 0, z + .3, [70, 108, 56], [sd * hw, 0, z, sd * hw, 0, z + .6, sd * 5, 0, z + .6, sd * 5, 0, z]); // lawn
      tq(t, 0, z + .3, mixc(brick, [255, 255, 255], .05), [sd * 5, 0, z, sd * 5, 0, z + .6, sd * 5, 7, z + .6, sd * 5, 7, z], { b: .85 });
    }
  }
  // house front
  tq(t, 0, L + .05, brick, [-5, 0, L, 5, 0, L, 5, 7, L, -5, 7, L]);
  for (const wx of [-3.4, 2.4]) for (const wy of [.9, 4]) {
    tq(t, 1, L, [40, 46, 58], [wx, wy, L, wx + 1.3, wy, L, wx + 1.3, wy + 1.6, L, wx, wy + 1.6, L], { lit: env.winLit * .9, warm: [255, 206, 140] });
    tq(t, 2, L, [236, 236, 230], [wx - .1, wy - .1, L, wx + 1.4, wy - .1, L, wx + 1.4, wy, L, wx - .1, wy, L], {});
  }
  const dh = t.H(L) + 0, dcol = o.doorCol || [30, 50, 90];
  tq(t, 1, L, [236, 236, 230], [-.62, dh, L, .62, dh, L, .62, dh + 2.5, L, -.62, dh + 2.5, L], {});
  tq(t, 3, L, dcol, [-.5, dh, L, .5, dh, L, .5, dh + 2.2, L, -.5, dh + 2.2, L], { door: true, spec: true });
  tq(t, 4, L, [255, 226, 170], [-.35, dh + 1.6, L, .35, dh + 1.6, L, .35, dh + 2.1, L, -.35, dh + 2.1, L], { emit: .3 + .5 * env.lamp, door: true });
  tq(t, 4, L, [230, 230, 224], [.6 - 1.05, dh + 1.5, L, .6 - .8, dh + 1.5, L, .6 - .8, dh + 1.75, L, .6 - 1.05, dh + 1.75, L], { emit: .5 });
  t.doorRect = { x0: -.5, x1: .5, y0: dh, y1: dh + 2.2, z: L };
  t.numPos = { x: 1.0, y: dh + 1.7, z: L };
  return finishTun(t);
}

function buildIndoor(o) { // o: {L, stairs:[{z0,n}], doors:[{z,side,num}], end:{type,num,col}, mail:bool, wall, floor, lift}
  const t = newTun({ L: o.L, hw: 1.1, ch: 2.7, eye: 1.62, kind: 'indoor', bright: .78, num: o.end && o.end.num });
  const hw = t.hw, L = t.L, st = o.stairs || [];
  const run = .28, rise = .18;
  t.H = z => { let h = 0; for (const s of st) { if (z >= s.z0) h += rise * Math.min(s.n, Math.floor((z - s.z0) / run) + 1); } return h; };
  const wall = o.wall || [204, 198, 180], floor = o.floor || [130, 126, 120];
  const stepAt = z => st.some(s => z >= s.z0 - .001 && z < s.z0 + s.n * run - .001);
  let z = 0, i = 0;
  while (z < L - .001) {
    const inSt = stepAt(z), seg = inSt ? run : 1.0; const z1 = Math.min(z + seg, L);
    const h = t.H(z + .001), hp = inSt ? t.H(z - .01) : h, ch = t.ch;
    tq(t, 0, (z + z1) / 2, inSt ? (i % 2 ? [176, 170, 162] : [190, 184, 176]) : (i % 2 ? floor : mulc(floor, .92)), [-hw, h, z, hw, h, z, hw, h, z1, -hw, h, z1]);
    if (inSt) tq(t, 1, z, [120, 114, 108], [-hw, hp, z, hw, hp, z, hw, h, z, -hw, h, z]);
    for (const sd of [-1, 1]) {
      tq(t, 0, (z + z1) / 2, sd < 0 ? wall : mulc(wall, .94), [sd * hw, hp, z, sd * hw, hp, z1, sd * hw, h + ch, z1, sd * hw, h + ch, z], {});
      tq(t, 1, (z + z1) / 2, mulc(wall, .55), [sd * hw, hp, z, sd * hw, hp, z1, sd * hw, hp + .12, z1, sd * hw, hp + .12, z], {});
    }
    tq(t, 0, (z + z1) / 2, [236, 234, 228], [-hw, h + ch, z, hw, h + ch, z, hw, h + ch, z1, -hw, h + ch, z1], { b: 1.05 });
    if (Math.floor(z / 3.1) !== Math.floor(z1 / 3.1) || z === 0) tq(t, 1, z + .3, [255, 250, 230], [-.3, h + ch - .01, z + .2, .3, h + ch - .01, z + .2, .3, h + ch - .01, z + .8, -.3, h + ch - .01, z + .8], { emit: .95 });
    z = z1; i++;
  }
  // banister on stairs
  for (const s of st) for (let k = 0; k < s.n; k++) { const zz = s.z0 + k * run, h = t.H(zz + .01); tq(t, 3, zz + .14, [70, 50, 40], [-hw + .05, h + .88, zz, -hw + .05, h + .88, zz + run, -hw + .05, h + .95, zz + run, -hw + .05, h + .95, zz], { b: .7 }); if (k % 3 === 0) tq(t, 3, zz + .14, [70, 50, 40], [-hw + .05, h, zz + .1, -hw + .05, h, zz + .14, -hw + .05, h + .95, zz + .14, -hw + .05, h + .95, zz + .1], { b: .7 }); }
  // doors
  for (const d of (o.doors || [])) {
    const h = t.H(d.z), x = d.side * hw;
    tq(t, 2, d.z, mulc(d.col || [90, 70, 60], .8), [x, h, d.z - .52, x, h, d.z + .52, x, h + 2.15, d.z + .52, x, h + 2.15, d.z - .52]);
    tq(t, 3, d.z, d.col || [96, 74, 62], [x, h, d.z - .45, x, h, d.z + .45, x, h + 2.05, d.z + .45, x, h + 2.05, d.z - .45], {});
    tq(t, 4, d.z, [230, 226, 200], [x, h + 1.62, d.z - .08, x, h + 1.62, d.z + .08, x, h + 1.78, d.z + .08, x, h + 1.78, d.z - .08], { emit: .8 });
    t.items.push({ k: d.z - .1, layer: 5, txt: String(d.num), x, y: h + 1.7, z: d.z, side: d.side });
  }
  if (o.mail) for (let m = 0; m < 12; m++) { const zz = o.mail[0] + (m % 6) * .28, yy = 1.0 + Math.floor(m / 6) * .3; tq(t, 3, zz, [120, 124, 128], [-hw, yy, zz, -hw, yy, zz + .24, -hw, yy + .26, zz + .24, -hw, yy + .26, zz], { b: .9 }); }
  if (o.buzzer) {
    tq(t, 3, L - .9, [70, 74, 80], [hw, 1.05, L - 1.3, hw, 1.05, L - .6, hw, 1.65, L - .6, hw, 1.65, L - 1.3], { b: .9 });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const zz = L - 1.22 + c * .3, yy = 1.12 + r * .12; tq(t, 4, L - .9, [220, 224, 230], [hw, yy, zz, hw, yy, zz + .22, hw, yy + .08, zz + .22, hw, yy + .08, zz], { emit: .6 + (r === 1 && c === 0 ? .3 : 0) }); }
  }
  // end wall + door
  const eh = t.H(L), e = o.end || { type: 'flat', num: 12 };
  tq(t, 0, L + .05, wall, [-hw, eh, L, hw, eh, L, hw, eh + t.ch, L, -hw, eh + t.ch, L], { b: .9 });
  if (e.type === 'lift') {
    tq(t, 1, L, [150, 154, 158], [-.55, eh, L, .55, eh, L, .55, eh + 2.1, L, -.55, eh + 2.1, L], { b: 1 });
    tq(t, 2, L, [110, 114, 118], [0, eh, L, 0, eh, L, 0, eh + 2.1, L, 0, eh + 2.1, L], {});
    tq(t, 3, L, [255, 220, 140], [.75, eh + 1.1, L, .85, eh + 1.1, L, .85, eh + 1.2, L, .75, eh + 1.2, L], { emit: 1 });
  } else if (e.type === 'glass') {
    tq(t, 1, L, [50, 60, 70], [-.62, eh, L, .62, eh, L, .62, eh + 2.3, L, -.62, eh + 2.3, L]);
    tq(t, 2, L, [230, 240, 235], [-.55, eh, L, .55, eh, L, .55, eh + 2.2, L, -.55, eh + 2.2, L], { emit: .9, door: true });
  } else {
    tq(t, 1, L, [236, 236, 230], [-.62, eh, L, .62, eh, L, .62, eh + 2.25, L, -.62, eh + 2.25, L], {});
    tq(t, 3, L, e.col || [40, 60, 100], [-.5, eh, L, .5, eh, L, .5, eh + 2.1, L, -.5, eh + 2.1, L], { door: true, spec: true });
    tq(t, 4, L, [230, 226, 200], [.55, eh + 1.0, L, .85, eh + 1.0, L, .85, eh + 1.2, L, .55, eh + 1.2, L], { emit: .7 });
    t.doorRect = { x0: -.5, x1: .5, y0: eh, y1: eh + 2.1, z: L };
    t.numPos = { x: .0, y: eh + 1.72, z: L };
  }
  if (e.type === 'glass' || e.type === 'lift') t.doorRect = null;
  return finishTun(t);
}

let tunLast = 0;
function renderTunnel(dt) {
  const t = scene.tun; if (!t) return;
  const z = scene.wz;
  setHeading(0); setFrame(IDENT); cam.x = scene.wx; cam.z = z; setFrame(IDENT); cam.h = t.H(z) + (t.eye || 1.62) + Math.sin(scene.wph * 2) * .025;
  cam.yawPx = scene.look * SW * .3;
  HZ = HZ0 - Math.sin(scene.wph) * 2 - (t.pitch || 0) * SH + (t.kind === 'indoor' ? -SH * .01 : 0);
  if (t.out) {
    drawSky(); ctx.fillStyle = shade([90, 100, 80], 60); ctx.fillRect(0, HZ, SW, SH - HZ);
  } else { ctx.fillStyle = '#1a1a1c'; ctx.fillRect(0, 0, SW, SH); }
  const skipDoor = scene.door && scene.door.open > .04;
  for (const it of t.items) {
    const rz = it.k - z; if (rz < NEAR - .3) continue;
    if (it.txt !== undefined) {
      if (it.z - z < .8 || it.z - z > 9) continue;
      const A = P(it.x - cam.x, it.y + .12, it.z - z - .12 * 0), Bp = P(it.x - cam.x, it.y - .05, it.z - z);
      ctx.save(); ctx.fillStyle = 'rgba(255,240,200,.95)'; ctx.font = '700 ' + Math.max(6, .11 * F / (it.z - z)) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const s = F / (it.z - z); ctx.transform(1, 0, 0, 1, 0, 0); ctx.fillText(it.txt, A[0] - it.side * .0 * s, A[1] + (Bp[1] - A[1]) * .5); ctx.restore(); continue;
    }
    if (it.door && skipDoor && it.spec) continue;
    let f;
    const cc = it.col, k = it.b || 1;
    if (it.emit !== undefined) f = emit(cc, rz, it.emit);
    else if (t.out) f = shade(cc, rz, k);
    else { const br = t.bright * k * (1 - .35 * (1 - Math.exp(-rz * .07))); f = 'rgb(' + (cc[0] * br | 0) + ',' + (cc[1] * br | 0) + ',' + (cc[2] * br | 0) + ')'; }
    poly(f, it.q);
    if (it.lit) { ctx.globalAlpha = it.lit; poly(emit(it.warm, rz, .8), it.q); ctx.globalAlpha = 1; }
  }
  if (t.numPos && t.doorRect) {
    const rz = t.numPos.z - z; if (rz > .5 && rz < 8) {
      const p = P(t.numPos.x - cam.x, t.numPos.y, rz), fs = Math.max(6, .13 * F / rz);
      ctx.fillStyle = 'rgba(30,30,30,.9)'; ctx.font = '700 ' + fs + 'px Georgia,serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.num, p[0], p[1]);
    }
  }
  if (scene.extra) scene.extra(dt, z);
  if (t.out) { /* night dim */ if (env.night > .3) { ctx.fillStyle = 'rgba(6,8,20,' + ((env.night - .3) * .3).toFixed(2) + ')'; ctx.fillRect(0, 0, SW, SH); } }
  HZ = HZ0;
}

// customer at a door (called from scene.extra)
function drawDoorway(t, z, open, cust, arm, bagT) {
  const r = t.doorRect; if (!r || open < .02) return;
  const rz = r.z - z; if (rz < .5) return;
  const tl = P(r.x0 - cam.x, r.y1, rz), br = P(r.x1 - cam.x, r.y0, rz);
  ctx.save(); ctx.beginPath(); ctx.rect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]); ctx.clip();
  const g = ctx.createLinearGradient(0, tl[1], 0, br[1]); g.addColorStop(0, '#f3d9a8'); g.addColorStop(1, '#b98b58'); ctx.fillStyle = g; ctx.fillRect(tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]);
  ctx.fillStyle = 'rgba(60,40,30,.25)'; ctx.fillRect(tl[0] + (br[0] - tl[0]) * .75, tl[1], (br[0] - tl[0]) * .25, br[1] - tl[1]);
  ctx.fillStyle = 'rgba(70,50,40,.5)'; ctx.fillRect(tl[0] + (br[0] - tl[0]) * .05, tl[1] + (br[1] - tl[1]) * .2, (br[0] - tl[0]) * .16, (br[1] - tl[1]) * .35);
  // hallway floor running back from the threshold, with a skirting line where it meets the back wall
  { const fx0 = r.x0 - cam.x - .8, fx1 = r.x1 - cam.x + .8, zb = rz + 3.2, q = [P(fx0, r.y0, rz), P(fx1, r.y0, rz), P(fx1, r.y0, zb), P(fx0, r.y0, zb)];
    const fg = ctx.createLinearGradient(0, q[2][1], 0, q[0][1]); fg.addColorStop(0, '#6e5238'); fg.addColorStop(1, '#8a6a48');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,26,16,.35)'; ctx.lineWidth = 1; for (let k = 1; k < 6; k++) { const a = P(fx0 + (fx1 - fx0) * k / 6, r.y0, rz), b = P(fx0 + (fx1 - fx0) * k / 6, r.y0, zb); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    const s0 = P(fx0, r.y0 + .1, zb), s1 = P(fx1, r.y0, zb); ctx.fillStyle = 'rgba(240,232,214,.8)'; ctx.fillRect(s0[0], s0[1], s1[0] - s0[0], Math.max(1, s1[1] - s0[1])); }
  if (cust) {
    const s = F / (rz + .7), base = P(0 - cam.x, r.y0, rz + .7), h = 1.7 * s;
    const bx = base[0], by = base[1];
    ctx.fillStyle = 'rgba(30,18,10,.35)'; ctx.beginPath(); ctx.ellipse(bx, by, h * .16, h * .035, 0, 0, TAU); ctx.fill();
    person(Object.assign({}, cust.look, { x: bx, y: by, h, view: 'front', raw: true, noShadow: true, reach: arm || 0, reachSide: 1, mood: (arm || 0) > .3 ? 'happy' : 'ok', noStubble: false }));
    if (cust.dog) { ctx.fillStyle = 'rgb(120,86,54)'; ctx.beginPath(); ctx.ellipse(bx - h * .22, by - h * .1, h * .12, h * .08, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(bx - h * .3, by - h * .17, h * .05, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  // door leaf swung open
  const lw = (br[0] - tl[0]) * .9 * (1 - open * .85);
  ctx.fillStyle = rgb(mulc(t.doorCol || [40, 60, 100], .9));
  ctx.beginPath(); ctx.moveTo(tl[0], tl[1]); ctx.lineTo(tl[0] + lw * .35, tl[1] - (br[1] - tl[1]) * .02 * open); ctx.lineTo(tl[0] + lw * .35, br[1] + 2); ctx.lineTo(tl[0], br[1]); ctx.closePath(); ctx.fill();
}

// ---------- shop interior ----------
function renderShop(dt) {
  const S = scene.shop; if (!S) return;
  const w = SW, h = SH, t = scene.t, cu = S.cu;
  const lit = .8 + .2 * Math.sin(t * 40) * 0;
  const bob = Math.sin(scene.wph * 2) * 2;
  ctx.save(); ctx.translate(0, bob);
  const wall = cu.wall;
  let g = ctx.createLinearGradient(0, 0, 0, h * .7); g.addColorStop(0, rgb(mulc(wall, .55))); g.addColorStop(1, rgb(mulc(wall, .9))); ctx.fillStyle = g; ctx.fillRect(-10, -10, w + 20, h * .72);
  // ceiling strip lights
  ctx.fillStyle = 'rgba(255,250,230,.9)'; for (let i = 0; i < 4; i++) ctx.fillRect(w * (.12 + i * .24), h * .02, w * .12, h * .012);
  // menu boards
  for (let i = 0; i < 3; i++) {
    const bx = w * (.16 + i * .27), by = h * .09, bw = w * .22, bh = h * .2;
    ctx.fillStyle = '#15171a'; rr(ctx, bx, by, bw, bh, 4); ctx.fill();
    ctx.fillStyle = rgb(cu.col); ctx.fillRect(bx, by, bw, bh * .16);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; for (let k = 0; k < 6; k++) { ctx.fillRect(bx + bw * .06, by + bh * (.26 + k * .12), bw * (.4 + hash(i, k) * .35), bh * .04); ctx.fillRect(bx + bw * .82, by + bh * (.26 + k * .12), bw * .1, bh * .04); }
  }
  // kitchen pass
  const kx = w * .58, ky = h * .33, kw = w * .3, kh = h * .2;
  ctx.fillStyle = '#231a14'; ctx.fillRect(kx - 8, ky - 8, kw + 16, kh + 16);
  const kg = ctx.createLinearGradient(0, ky, 0, ky + kh); kg.addColorStop(0, '#ffb45c'); kg.addColorStop(1, '#a5522a'); ctx.fillStyle = kg; ctx.fillRect(kx, ky, kw, kh);
  ctx.fillStyle = 'rgba(40,20,10,.7)'; const cx = kx + kw * (.3 + .25 * Math.sin(t * .6)); ctx.beginPath(); ctx.arc(cx, ky + kh * .45, kh * .16, 0, TAU); ctx.fill(); ctx.fillRect(cx - kh * .2, ky + kh * .55, kh * .4, kh * .5);
  if (cu.k === 'Chinese' || cu.k === 'Thai') { glow(kx + kw * .75, ky + kh * .8, kh * .9, [255, 140, 40], .5 + .3 * Math.sin(t * 9)); }
  ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(kx + kw * (.2 + i * .3) + Math.sin(t + i) * 6, ky - ((t * 20 + i * 30) % 50), 10, 18, 0, 0, TAU); ctx.fill(); }
  // shelf with bags
  const sx = w * .04, sy = h * .38, sw = w * .16;
  ctx.fillStyle = '#2b2f33'; ctx.fillRect(sx, sy + h * .11, sw, 5); ctx.fillRect(sx, sy + h * .23, sw, 5);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgb(210,184,144)'; ctx.fillRect(sx + sw * (.05 + i * .32), sy + h * .02, sw * .24, h * .09); }
  for (let i = 0; i < 2; i++) { ctx.fillStyle = 'rgb(200,176,138)'; ctx.fillRect(sx + sw * (.15 + i * .4), sy + h * .14, sw * .24, h * .09); }
  // floor
  const fg = ctx.createLinearGradient(0, h * .7, 0, h); fg.addColorStop(0, '#3b3a3a'); fg.addColorStop(1, '#232323'); ctx.fillStyle = fg; ctx.fillRect(-10, h * .7, w + 20, h * .3 + 10);
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(w / 2, h * .66); ctx.lineTo(w * (i / 8) * 1.6 - w * .3, h); ctx.stroke(); }
  // staff (behind the counter)
  for (const p of S.staff) {
    const px = w * p.x + Math.sin(t * p.sp + p.ph) * w * p.amp, py = h * .74 + h * p.hh * .4;
    person(Object.assign({}, p.look, { x: px, y: py + (p.bow || 0), h: h * p.hh, view: 'front', raw: true, noShadow: true, mood: p.mood, reach: p.reach || 0, reachSide: 1, apron: cu.col, outfit: 'apron' }));
  }
  // counter
  const cy = h * .74;
  const cg = ctx.createLinearGradient(0, cy, 0, h); cg.addColorStop(0, rgb(mulc(cu.col, .8))); cg.addColorStop(1, rgb(mulc(cu.col, .45))); ctx.fillStyle = cg; ctx.fillRect(-10, cy, w + 20, h - cy + 10);
  ctx.fillStyle = '#cfcac0'; ctx.fillRect(-10, cy - h * .018, w + 20, h * .028); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-10, cy - h * .018, w + 20, 2);
  // till, tip jar, sanitiser
  ctx.fillStyle = '#26292e'; ctx.fillRect(w * .68, cy - h * .09, w * .09, h * .075); ctx.fillStyle = '#7fe0c0'; ctx.fillRect(w * .69, cy - h * .082, w * .07, h * .025);
  ctx.fillStyle = 'rgba(200,220,230,.7)'; ctx.fillRect(w * .82, cy - h * .06, w * .03, h * .045);
  ctx.fillStyle = '#d9d2c4'; ctx.fillRect(w * .87, cy - h * .05, w * .025, h * .035);
  // tablet flashing orders
  ctx.fillStyle = '#101418'; ctx.fillRect(w * .55, cy - h * .11, w * .07, h * .085); ctx.fillStyle = (Math.floor(t * 1.5) % 2) ? '#4ade80' : '#facc15'; ctx.fillRect(w * .555, cy - h * .105, w * .06, h * .015);
  // the bag on the counter
  if (S.bag > 0) {
    const b = S.bag, s = h * .2, bx = w * lerp(.42, .55, S.bagGrab || 0) + 0, by = cy - h * .0 - (S.bagGrab || 0) * h * .12 + (1 - Math.min(1, b)) * h * .06;
    ctx.save(); ctx.globalAlpha = Math.min(1, b * 2); ctx.translate(bx, by + s * .4); ctx.scale(1, 1);
    ctx.fillStyle = 'rgb(214,188,148)'; ctx.fillRect(-s * .3, -s * .8, s * .6, s * .8); ctx.fillStyle = 'rgb(190,162,122)'; ctx.beginPath(); ctx.moveTo(s * .3, -s * .8); ctx.lineTo(s * .36, 0); ctx.lineTo(s * .3, 0); ctx.fill();
    ctx.fillStyle = rgb(cu.col); ctx.fillRect(-s * .3, -s * .5, s * .6, s * .14); ctx.fillStyle = '#fff'; ctx.fillRect(-s * .22, -s * .2, s * .26, s * .1); ctx.fillStyle = '#222'; ctx.fillRect(-s * .2, -s * .18, s * .2, s * .015);
    ctx.strokeStyle = 'rgb(160,130,90)'; ctx.lineWidth = s * .03; ctx.beginPath(); ctx.arc(-s * .12, -s * .82, s * .12, Math.PI, 0); ctx.arc(s * .12, -s * .82, s * .12, Math.PI, 0); ctx.stroke(); ctx.restore();
  }
  // another rider waiting, seen from behind
  S.others.forEach((o, i) => {
    if (i > 0) return;
    if (o.chat) {
      const oh = h * 1.0, ox = w * .84 + Math.sin(t * .5) * 4, oy = h * 1.06;
      person(Object.assign({}, o.look, { x: ox, y: oy, h: oh, view: 'front', raw: true, noShadow: true, helmet: null, outfit: 'hiviz', top: [30, 34, 40], mood: 'happy', act: Math.sin(t * .8) > .4 ? 'talk' : null, actT: t }));
    } else {
      const oh = h * .8, ox = w * .9 + Math.sin(t * .4) * 3, oy = h * 1.06;
      person({ x: ox, y: oy, h: oh, view: 'back', raw: true, noShadow: true, skin: [60, 44, 36], top: mulc(o.col, .3), bot: [16, 16, 20], helmet: mulc(o.col, .3), outfit: 'hiviz', pack: [20, 64, 60] });
    }
  });
  ctx.restore();
  // warm tone
  ctx.fillStyle = 'rgba(255,190,120,.05)'; ctx.fillRect(0, 0, w, h);
}
function makeShop(cu, busy) {
  const look = () => randomLook(G, 'staff');
  const staff = [{ x: .34, hh: .86, sp: .5, ph: 0, amp: .01, look: look(), mood: 'ok' }, { x: .64, hh: .78, sp: .8, ph: 2, amp: .035, look: look() }];
  return { cu, staff, others: Array.from({ length: busy }, (_, i) => ({ x: i ? .93 : .06, col: G.p([[30, 170, 150], [220, 60, 60], [60, 90, 200]]), look: randomLook(G, 'rider') })), bag: 0, bagGrab: 0 };
}

// ---------- the bottle he holds up to the camera ----------
function drawMerch(dt) {
  scene.merch = (scene.merch || 0) + ((scene.merchTarget || 0) - (scene.merch || 0)) * (1 - Math.exp(-dt * 4));
  const m = scene.merch; if (m < .01) return;
  const w = SW, h = SH, s = h * .34, cx = w * .72, cy = h * (1.12 - m * .5);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-.1 + Math.sin(world.time * 2.1) * .025);
  const lk = clamp(.4 + env.amb * .8, .4, 1);
  // glove
  ctx.fillStyle = 'rgb(' + (50 * lk | 0) + ',' + (44 * lk | 0) + ',' + (40 * lk | 0) + ')'; ctx.beginPath(); ctx.ellipse(s * .02, s * .5, s * .27, s * .17, 0, 0, TAU); ctx.fill();
  // bottle
  const bw = s * .42, bh = s * .64;
  const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0); g.addColorStop(0, 'rgb(150,90,20)'); g.addColorStop(.35, 'rgb(236,166,52)'); g.addColorStop(1, 'rgb(120,68,14)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-bw / 2, -bh / 2, bw, bh, s * .08) : ctx.rect(-bw / 2, -bh / 2, bw, bh); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-bw / 2 + s * .04, -bh / 2 + s * .05, s * .05, bh * .8);
  // label
  ctx.fillStyle = '#f7f5ee'; ctx.fillRect(-bw / 2 + s * .02, -bh * .16, bw - s * .04, bh * .5);
  ctx.strokeStyle = '#2a6fb8'; ctx.lineWidth = Math.max(1, s * .012); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-bw / 2 + s * .03, -bh * .02 + i * s * .035); ctx.bezierCurveTo(-bw * .2, -bh * .05 + i * s * .035, bw * .2, bh * .01 + i * s * .035, bw / 2 - s * .03, -bh * .02 + i * s * .035); ctx.stroke(); }
  ctx.fillStyle = '#12437d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 ' + Math.round(s * .085) + 'px system-ui,sans-serif'; ctx.fillText('HOLY', 0, -bh * .09); ctx.fillText('WATER', 0, -bh * .09 + s * .09);
  ctx.fillStyle = '#c7601a'; ctx.font = '700 ' + Math.round(s * .038) + 'px system-ui,sans-serif'; ctx.fillText('FLAVOUR DROPS', 0, bh * .22);
  // dropper cap
  ctx.fillStyle = '#17181b'; ctx.fillRect(-bw * .3, -bh / 2 - s * .07, bw * .6, s * .08);
  ctx.beginPath(); ctx.ellipse(0, -bh / 2 - s * .17, bw * .2, s * .12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(-bw * .07, -bh / 2 - s * .2, bw * .05, s * .05, 0, 0, TAU); ctx.fill();
  // thumb over the front
  ctx.fillStyle = 'rgb(' + (58 * lk | 0) + ',' + (52 * lk | 0) + ',' + (48 * lk | 0) + ')'; ctx.beginPath(); ctx.ellipse(bw * .38, bh * .34, s * .07, s * .13, .4, 0, TAU); ctx.fill();
  ctx.restore();
}
