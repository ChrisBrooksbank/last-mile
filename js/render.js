'use strict';
// Pseudo-3D canvas renderer: perspective projection, streets, traffic, people.
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let SW = 1, SH = 1, F = 1, HZ = 1, HZ0 = 1, CXs = 1, DPR = 1;
const NEAR = 0.7, FARZ = 150;
const cam = { x: 0, z: 0, h: 1.25, dir: 1, yawPx: 0, bend: 0, roll: 0 };
const scene = {
  mode: 'street', rideActive: true, walking: false, fade: 0, carry: null, t: 0, tun: null, shop: null,
  pitch: 0, wz: 0, wx: 0, wdir: 1, wph: 0, look: 0, lookT: 0, indoor: false, door: null, extra: null,
};

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  SW = window.innerWidth; SH = window.innerHeight;
  cv.width = Math.round(SW * DPR); cv.height = Math.round(SH * DPR);
  F = Math.max(SW * 0.68, SH * 0.95); HZ0 = HZ = SH * 0.44; CXs = SW / 2;
}
window.addEventListener('resize', resize);

// ---------- projection helpers ----------
function pathPoly(tgt, a, ox, oz) {
  ox = ox || 0; oz = oz || 0;
  for (let i = 0; i < a.length; i += 3) {
    let z = a[i + 2] - oz; if (z < NEAR) z = NEAR;
    const s = F / z, X = CXs + cam.yawPx + (a[i] - ox + cam.bend * z * z) * s, Y = HZ + (cam.h - a[i + 1]) * s;
    if (i) tgt.lineTo(X, Y); else tgt.moveTo(X, Y);
  }
  tgt.closePath();
}
function poly(fill, a, ox, oz) { ctx.fillStyle = fill; ctx.beginPath(); pathPoly(ctx, a, ox, oz); ctx.fill(); }
function P(rx, y, rz) {
  if (rz < NEAR) rz = NEAR; const s = F / rz;
  return [CXs + cam.yawPx + (rx + cam.bend * rz * rz) * s, HZ + (cam.h - y) * s];
}
function emit(c, z, k) { // self-lit colour, only fogged
  k = k === undefined ? 1 : k; const f = 1 - Math.exp(-z * env.fog), fc = env.fogC;
  return 'rgb(' + ((c[0] * k + (fc[0] - c[0] * k) * f) | 0) + ',' + ((c[1] * k + (fc[1] - c[1] * k) * f) | 0) + ',' + ((c[2] * k + (fc[2] - c[2] * k) * f) | 0) + ')';
}
const glowCache = {};
function glow(x, y, r, c, a) {
  if (a <= .01 || r < 1.5 || x < -r || x > SW + r || y < -r || y > SH + r) return;
  const key = c[0] + ',' + c[1] + ',' + c[2];
  let s = glowCache[key];
  if (!s) {
    s = glowCache[key] = document.createElement('canvas'); s.width = s.height = 64;
    const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + key + ',1)'); gr.addColorStop(.25, 'rgba(' + key + ',.45)'); gr.addColorStop(1, 'rgba(' + key + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
function groundGrad(c) {
  const g = ctx.createLinearGradient(0, HZ, 0, SH), H = Math.max(1, SH - HZ);
  g.addColorStop(0, shade(c, FARZ));
  for (const z of [90, 50, 28, 15, 8, 4]) { const t = cam.h * F / z / H; if (t < 1) g.addColorStop(clamp(t, .001, 1), shade(c, z)); }
  g.addColorStop(1, shade(c, 2));
  return g;
}
const ZS = []; for (let i = 0; i < 40; i++) ZS.push(NEAR * Math.pow(FARZ / NEAR, i / 39));
function strip(x0, x1, y, fill, zA, zB) {
  const d = cam.dir, a = (x0 - cam.x) * d, b = (x1 - cam.x) * d;
  ctx.fillStyle = fill; ctx.beginPath();
  for (let i = 0; i < ZS.length; i++) { const p = P(a, y, ZS[i]); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
  for (let i = ZS.length - 1; i >= 0; i--) { const p = P(b, y, ZS[i]); ctx.lineTo(p[0], p[1]); }
  ctx.closePath(); ctx.fill();
}
function wrect(rx, zw0, zw1, y0, y1, fill) {
  let a = (zw0 - cam.z) * cam.dir, b = (zw1 - cam.z) * cam.dir; if (a > b) { const t = a; a = b; b = t; }
  if (b < NEAR || a > FARZ + 20) return; if (a < NEAR) a = NEAR;
  poly(fill, [rx, y0, a, rx, y0, b, rx, y1, b, rx, y1, a]);
}
const twCache = {};
function wallText(txt, rx, zw0, zw1, y0, y1, color, dm) {
  let a = (zw0 - cam.z) * cam.dir, b = (zw1 - cam.z) * cam.dir; if (a > b) { const t = a; a = b; b = t; }
  if (b < 1 || a > 70) return; a = Math.max(a, 0.9);
  const zs = rx < 0 ? a : b, ze = rx < 0 ? b : a;
  const A = P(rx, y1, zs), B = P(rx, y1, ze), C = P(rx, y0, zs);
  if (Math.abs(B[0] - A[0]) < 12 || Math.abs(C[1] - A[1]) < 5) return;
  const font = 'bold 100px Arial, sans-serif'; ctx.font = font;
  let tw = twCache[txt]; if (!tw) tw = twCache[txt] = ctx.measureText(txt).width;
  const Lw = tw + 60, Lh = 120;
  ctx.save(); ctx.transform((B[0] - A[0]) / Lw, (B[1] - A[1]) / Lw, (C[0] - A[0]) / Lh, (C[1] - A[1]) / Lh, A[0], A[1]);
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font;
  ctx.fillText(txt, Lw / 2, Lh / 2 + 4); ctx.restore();
}

function box(x0, x1, y0, y1, z0, z1, col, k) {
  const d = cam.dir; k = k || 1;
  let a = (x0 - cam.x) * d, b = (x1 - cam.x) * d; if (a > b) { const t = a; a = b; b = t; }
  let c = (z0 - cam.z) * d, e = (z1 - cam.z) * d; if (c > e) { const t = c; c = e; e = t; }
  if (e < NEAR || c > FARZ) return null;
  const dm = Math.max(c, NEAR), info = { a, b, c, e, dm, fz: false, fx: 0 };
  if (cam.h > y1) poly(shade(col, dm, 1.12 * k), [a, y1, c, b, y1, c, b, y1, e, a, y1, e]);
  if (b < 0) { poly(shade(col, dm, .72 * k), [b, y0, c, b, y0, e, b, y1, e, b, y1, c]); info.fx = b; }
  else if (a > 0) { poly(shade(col, dm, .72 * k), [a, y0, c, a, y0, e, a, y1, e, a, y1, c]); info.fx = a; }
  if (c >= NEAR) { poly(shade(col, dm, .92 * k), [a, y0, c, b, y0, c, b, y1, c, a, y1, c]); info.fz = true; }
  return info;
}
function fr(axis, plane, h0, h1, y0, y1, fill) {
  if (axis === 'z') poly(fill, [h0, y0, plane, h1, y0, plane, h1, y1, plane, h0, y1, plane]);
  else poly(fill, [plane, y0, h0, plane, y0, h1, plane, y1, h1, plane, y1, h0]);
}

// ---------- people ----------
function person(o) {
  const x = o.x, y = o.y, h = o.h, dm = o.dm || 10;
  const S = c => o.raw ? rgb(c) : shade(c, dm, .95);
  const sw = o.walk ? Math.sin(o.ph || 0) * .1 * h : 0;
  ctx.save();
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y, h * .13, h * .028, 0, 0, TAU); ctx.fill(); }
  ctx.lineCap = 'round';
  // legs
  ctx.strokeStyle = S(o.bot); ctx.lineWidth = h * .078;
  const hipY = y - h * .47;
  if (o.front) {
    ctx.beginPath(); ctx.moveTo(x - h * .045, hipY); ctx.lineTo(x - h * .05 - sw * .2, y - h * .03); ctx.moveTo(x + h * .045, hipY); ctx.lineTo(x + h * .05 + sw * .2, y - h * .03); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x, hipY); ctx.lineTo(x + sw, y - h * .03); ctx.moveTo(x, hipY); ctx.lineTo(x - sw, y - h * .03); ctx.stroke();
  }
  ctx.strokeStyle = S([24, 24, 28]); ctx.lineWidth = h * .06;
  ctx.beginPath(); ctx.moveTo(x + (o.front ? -h * .05 : sw) - h * .02, y - h * .015); ctx.lineTo(x + (o.front ? -h * .05 : sw) + h * .03, y - h * .015);
  ctx.moveTo(x + (o.front ? h * .05 : -sw) - h * .02, y - h * .015); ctx.lineTo(x + (o.front ? h * .05 : -sw) + h * .03, y - h * .015); ctx.stroke();
  // torso
  const tw = o.front ? h * .27 : h * .19;
  ctx.fillStyle = S(o.top);
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - tw / 2, y - h * .84, tw, h * .4, h * .05) : ctx.rect(x - tw / 2, y - h * .84, tw, h * .4); ctx.fill();
  if (o.long) { ctx.fillStyle = S(o.top); ctx.fillRect(x - tw / 2, y - h * .5, tw, h * .3); }
  // arms
  ctx.strokeStyle = S(o.sleeve || o.top); ctx.lineWidth = h * .06;
  if (o.arms) o.arms(x, y, h, tw); else {
    ctx.beginPath();
    if (o.front) { ctx.moveTo(x - tw / 2, y - h * .8); ctx.lineTo(x - tw / 2 - h * .02, y - h * .52); ctx.moveTo(x + tw / 2, y - h * .8); ctx.lineTo(x + tw / 2 + h * .02, y - h * .52); }
    else { ctx.moveTo(x, y - h * .8); ctx.lineTo(x - sw * .8, y - h * .52); }
    ctx.stroke();
  }
  // head
  const hr = h * .066;
  ctx.fillStyle = S(o.skin); ctx.fillRect(x - hr * .35, y - h * .87, hr * .7, hr * .6);
  ctx.beginPath(); ctx.arc(x, y - h * .925, hr, 0, TAU); ctx.fill();
  if (o.helmet) { ctx.fillStyle = S(o.helmet); ctx.beginPath(); ctx.arc(x, y - h * .935, hr * 1.12, Math.PI, 0); ctx.fill(); ctx.fillRect(x - hr * 1.12, y - h * .935, hr * 2.24, hr * .35); }
  else if (o.hair) {
    ctx.fillStyle = S(o.hair); ctx.beginPath(); ctx.arc(x, y - h * .935, hr * 1.06, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
    if (o.longHair) ctx.fillRect(x - hr * 1.05, y - h * .93, hr * .5, hr * 1.9), ctx.fillRect(x + hr * .55, y - h * .93, hr * .5, hr * 1.9);
  }
  if (o.front && !o.helmet && h > 120) {
    ctx.fillStyle = 'rgba(30,20,20,.8)'; ctx.fillRect(x - hr * .45, y - h * .93, hr * .18, hr * .18); ctx.fillRect(x + hr * .27, y - h * .93, hr * .18, hr * .18);
    ctx.strokeStyle = 'rgba(80,30,30,.7)'; ctx.lineWidth = Math.max(1, hr * .07); ctx.beginPath();
    if (o.mood === 'sour') { ctx.moveTo(x - hr * .3, y - h * .875); ctx.lineTo(x + hr * .3, y - h * .885); } else ctx.arc(x, y - h * .9, hr * .3, .2, Math.PI - .2);
    ctx.stroke();
  }
  if (o.umb) {
    ctx.strokeStyle = 'rgba(20,20,20,.8)'; ctx.lineWidth = Math.max(1, h * .012);
    ctx.beginPath(); ctx.moveTo(x + h * .05, y - h * .62); ctx.lineTo(x + h * .05, y - h * 1.12); ctx.stroke();
    ctx.fillStyle = S(o.umb); ctx.beginPath(); ctx.ellipse(x + h * .05, y - h * 1.12, h * .3, h * .1, 0, Math.PI, 0); ctx.fill();
  }
  ctx.restore();
}
function drawPed(p, S, dm) {
  const q = P(((p.x) - cam.x) * cam.dir, 0, dm); if (q[0] < -40 || q[0] > SW + 40) return;
  const h = p.h * F / dm; if (h < 4) return;
  person({ x: q[0], y: q[1], h, dm, skin: p.skin, hair: p.hair, top: p.top, bot: p.bot, walk: true, ph: p.ph, umb: env.rain > .2 ? p.umb : null, front: false, noShadow: h < 14 });
  if (env.lamp > .3 && h > 8) glow(q[0], q[1] - h * .5, h * .5, [255, 200, 140], .05 * env.lamp);
}

// ---------- sky ----------
let clouds = null;
function drawSky() {
  if (!clouds) { const r = new RNG(7); clouds = []; for (let i = 0; i < 9; i++) clouds.push({ x: r.n() * 1.6, y: r.r(.04, .34), w: r.r(.15, .34), s: r.r(.4, 1) }); }
  const g = ctx.createLinearGradient(0, 0, 0, HZ + 2);
  g.addColorStop(0, rgb(env.skyTop)); g.addColorStop(1, rgb(env.skyBot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, HZ + 2);
  if (env.night > .55 && env.cloud < .7) {
    ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * (env.night - .55) * (1 - env.cloud)).toFixed(2) + ')';
    for (let i = 0; i < 50; i++) ctx.fillRect(hash(i, 1) * SW, hash(i, 2) * HZ * .8, 1.3, 1.3);
  }
  if (env.twi > .05) { const gr = ctx.createRadialGradient(SW * .72, HZ, 0, SW * .72, HZ, SW * .6); gr.addColorStop(0, 'rgba(255,170,90,' + (env.twi * .55).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, SW, HZ + 2); }
  const cl = mixc(mixc(env.skyBot, [255, 255, 255], .5 * env.day), [90, 96, 110], env.cloud * .45 * env.day);
  const sh = mulc(cl, .6 + .4 * env.day);
  for (const c of clouds) {
    const x = ((c.x * SW + world.time * 3 * c.s + cam.yawPx * .5) % (SW * 1.6)) - SW * .3;
    ctx.fillStyle = rgba(sh, clamp(env.cloud * .5 * c.s + .04, 0, .6));
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x + k * c.w * SW * .22, c.y * HZ + (k % 2) * 8, c.w * SW * .3, c.w * SW * .05, 0, 0, TAU); ctx.fill(); }
  }
}
function drawSkyline(S) {
  if (!S.sky) {
    const r = new RNG(S.seed ^ 55), tall = S.D.kind === 'towers' ? 2.4 : 1; S.sky = [];
    for (let i = 0; i < 44; i++) S.sky.push({ x: -.3 + i * .04 + r.r(0, .02), w: r.r(.025, .06), h: r.r(.012, .06) * tall * SH * (r.c(.08) ? 2.2 : 1) });
  }
  const off = cam.yawPx + cam.bend * FARZ * F * .8;
  ctx.fillStyle = shade([120, 124, 134], 220, .8);
  for (const b of S.sky) ctx.fillRect(b.x * SW + off, HZ - b.h, b.w * SW, b.h + 2);
  if (env.night > .4) { ctx.fillStyle = 'rgba(255,214,150,' + (env.night * .35).toFixed(2) + ')'; for (const b of S.sky) for (let k = 0; k < b.h / 9; k++) ctx.fillRect(b.x * SW + off + hash(k, b.x * 99) * b.w * SW, HZ - b.h + k * 8, 1.5, 1.5); }
}

// ---------- the street ----------
const DOORS = [[30, 50, 90], [120, 30, 30], [30, 30, 34], [40, 90, 60], [220, 220, 216], [130, 96, 50]];
function drawLot(S, l) {
  const d = cam.dir;
  let za = (l.z0 - cam.z) * d, zb = (l.z1 - cam.z) * d; if (za > zb) { const t = za; za = zb; zb = t; }
  if (zb < NEAR || za > FARZ + 10) return;
  const rx = (l.x - cam.x) * d, sg = rx < 0 ? -1 : 1;
  const zn = Math.max(za, NEAR), zf = Math.min(zb, FARZ + 25), dm = (zn + Math.min(zf, zn + 30)) / 2, h = l.h;
  const px = ((l.side * (S.halfW + S.pav)) - cam.x) * d;
  if (l.setback > .05) poly(shade(l.gcol, dm), [px, .01, zn, rx, .01, zn, rx, .01, zf, px, .01, zf]);
  if (za >= NEAR) poly(shade(l.col, dm, .7), [rx, 0, za, rx + sg * 9, 0, za, rx + sg * 9, h, za, rx, h, za]);
  poly(shade(l.col, dm), [rx, 0, zn, rx, 0, zf, rx, h, zf, rx, h, zn]);
  const zc = (l.z1 - l.z0), doorC = l.z0 + l.doorU * zc;
  const dz0 = doorC - (l.kind === 'shop' ? .55 : l.kind === 'block' || l.kind === 'glass' ? .9 : .5), dz1 = doorC + (l.kind === 'shop' ? .55 : l.kind === 'block' || l.kind === 'glass' ? .9 : .5);
  const winLitK = env.winLit;
  const near = dm < 55;
  if (l.kind === 'shop') {
    const add = mulc(l.shopCol, (l.dest ? .55 : .25) * env.lamp + .1 * (l.dest ? 1 : 0));
    wrect(rx, l.z0 + .15, l.z1 - .15, 3.0, 3.75, shade(l.shopCol, dm, 1, add));
    const glass = shade([88, 108, 122], dm);
    wrect(rx, l.z0 + .3, dz0 - .1, .35, 2.75, glass); wrect(rx, dz1 + .1, l.z1 - .3, .35, 2.75, glass);
    if (winLitK > .05 || l.dest) {
      ctx.globalAlpha = l.dest ? Math.max(.35, winLitK) : winLitK * (hash(l.seed, 3) < .8 ? 1 : 0);
      const lf = emit([255, 208, 140], dm, .8);
      wrect(rx, l.z0 + .3, dz0 - .1, .35, 2.75, lf); wrect(rx, dz1 + .1, l.z1 - .3, .35, 2.75, lf); ctx.globalAlpha = 1;
    }
    wrect(rx, dz0, dz1, 0, 2.4, shade([28, 30, 34], dm));
    if (l.dest || winLitK > .05) wrect(rx, dz0 + .1, dz1 - .1, .2, 2.2, emit([255, 214, 160], dm, l.dest ? .55 : .3 * winLitK));
    if (near) wallText(l.name, rx, l.z0 + .4, l.z1 - .4, 3.08, 3.68, l.dest ? '#fff' : 'rgba(255,255,255,.88)', dm);
  } else if (l.kind === 'house') {
    const dc = DOORS[(hash(l.seed, 9) * DOORS.length) | 0], ground = shade([30, 34, 40], dm);
    const lift = l.setback > 1 ? .55 : .2;
    wrect(rx, l.z0 + .5, doorC - 1.1, .9, 2.5, ground); wrect(rx, doorC + 1.1, l.z1 - .5, .9, 2.5, ground);
    if (winLitK > .05) { ctx.globalAlpha = winLitK * .8; const lf = emit([255, 200, 130], dm, .7); wrect(rx, l.z0 + .5, doorC - 1.1, .9, 2.5, lf); wrect(rx, doorC + 1.1, l.z1 - .5, .9, 2.5, lf); ctx.globalAlpha = 1; }
    wrect(rx, dz0 - .12, dz1 + .12, lift - .1, 2.6, shade(l.trim, dm));
    wrect(rx, dz0, dz1, lift, 2.45, shade(dc, dm));
    wrect(rx, dz0 + .1, dz1 - .1, 2.0, 2.4, emit([255, 220, 170], dm, .25 + .5 * env.lamp * (hash(l.seed, 4) < .7 ? 1 : 0)));
    if (l.setback > 1 || lift > .3) { wrect(rx, dz0 - .3, dz1 + .3, 0, lift, shade(l.trim, dm, .9)); }
    if (l.dest && env.lamp > .1) wrect(rx, dz1 + .15, dz1 + .35, 1.8, 2.1, emit([255, 226, 170], dm, env.lamp));
  } else if (l.kind === 'block') {
    wrect(rx, l.z0, l.z1, 0, l.gh, shade(mulc(l.col, .8), dm));
    wrect(rx, dz0, dz1, 0, 2.6, shade([40, 46, 54], dm));
    wrect(rx, dz0 + .1, dz1 - .1, .1, 2.5, emit([230, 235, 220], dm, .25 + .45 * env.winLit + (l.dest ? .2 : 0)));
    wrect(rx, l.z0 + .8, dz0 - .8, 1.2, 2.4, shade([34, 40, 48], dm)); wrect(rx, dz1 + .8, l.z1 - .8, 1.2, 2.4, shade([34, 40, 48], dm));
  } else { // glass
    wrect(rx, l.z0, l.z1, 0, l.gh, shade([70, 100, 128], dm));
    wrect(rx, l.z0 + .5, l.z1 - .5, .2, l.gh - .4, emit([235, 240, 225], dm, .28 + .55 * env.winLit));
  }
  drawWindows(l, rx, dm, near);
  if (l.kind === 'block' && near) for (let f = 1; f < l.floors; f++) wrect(rx, l.z0, l.z1, l.gh + (f - 1) * l.fh - .12, l.gh + (f - 1) * l.fh + .12, shade(mulc(l.col, .7), dm));
  if (l.cornice && l.kind !== 'glass') wrect(rx, l.z0, l.z1, h - .32, h, shade(l.trim, dm, .95));
  if (l.front && l.setback > 1) {
    const gh = l.front === 'hedge' ? 1.15 : l.front === 'brick' ? .85 : .95, fc = l.front === 'hedge' ? [46, 88, 42] : l.front === 'brick' ? [130, 80, 66] : [24, 24, 28];
    const gate0 = doorC - .55, gate1 = doorC + .55, fill = shade(fc, dm);
    wrect(px, l.z0, gate0, 0, gh, fill); wrect(px, gate1, l.z1, 0, gh, fill);
    if (l.front !== 'rail') { let a = (l.z0 - cam.z) * d, b = (gate0 - cam.z) * d; if (a > b) { const t = a; a = b; b = t; } if (b > NEAR && a < FARZ) poly(shade(fc, dm, 1.15), [px, gh, Math.max(a, NEAR), px + sg * .5, gh, Math.max(a, NEAR), px + sg * .5, gh, b, px, gh, b]); }
    // path to the door
    poly(shade([150, 145, 138], dm), [(doorC - .5 - cam.z) * d < (doorC + .5 - cam.z) * d ? px : px, .02, Math.max(Math.min((doorC - .5 - cam.z) * d, (doorC + .5 - cam.z) * d), NEAR), rx, .02, Math.max(Math.min((doorC - .5 - cam.z) * d, (doorC + .5 - cam.z) * d), NEAR), rx, .02, Math.max((doorC + .5 - cam.z) * d, (doorC - .5 - cam.z) * d, NEAR), px, .02, Math.max((doorC + .5 - cam.z) * d, (doorC - .5 - cam.z) * d, NEAR)]);
  }
}
function drawWindows(l, rx, dm, near) {
  const len = l.z1 - l.z0, n = Math.max(1, Math.floor(len / l.wp)), pitch = len / n, ww = pitch * l.ww;
  const dark = new Path2D(), warm = new Path2D(), cool = new Path2D();
  const lk = l.lit * (env.winLit * .92 + .06);
  let any = false;
  for (let f = 1; f < l.floors; f++) {
    const yb = l.gh + (f - 1) * l.fh; let y0, y1;
    if (l.kind === 'glass') { y0 = yb + .2; y1 = yb + l.fh - .25; } else { y0 = yb + .7; y1 = yb + 2.3; }
    if (l.kind === 'house' && f === 1 && l.setback < .1) { y0 = yb + .5; }
    for (let k = 0; k < n; k++) {
      const zc = l.z0 + (k + .5) * pitch;
      let a = (zc - ww / 2 - cam.z) * cam.dir, b = (zc + ww / 2 - cam.z) * cam.dir; if (a > b) { const t = a; a = b; b = t; }
      if (b < NEAR || a > FARZ) continue; if (a < NEAR) a = NEAR;
      const hh = hash(l.seed, k, f);
      pathPoly(hh < lk ? (hh < lk * .3 ? cool : warm) : dark, [rx, y0, a, rx, y0, b, rx, y1, b, rx, y1, a]); any = true;
    }
  }
  if (!any) return;
  const dk = mixc(l.kind === 'glass' ? [44, 68, 96] : [36, 42, 54], env.skyBot, .32 * env.day);
  ctx.fillStyle = shade(dk, dm, l.kind === 'glass' ? 1.1 : 1); ctx.fill(dark);
  ctx.fillStyle = emit([255, 204, 130], dm, .5 + .4 * env.night); ctx.fill(warm);
  ctx.fillStyle = emit([190, 214, 255], dm, .5); ctx.fill(cool);
  if (near && l.kind !== 'glass') { ctx.strokeStyle = shade([236, 236, 230], dm, .9); ctx.lineWidth = Math.max(1, 0.05 * F / dm); ctx.stroke(dark); }
}

function drawVeh(v) {
  if (v.type === 'bike') return drawCyclist(v);
  const d = cam.dir; let x0, x1, z0, z1;
  if (v.axis === 'z') { x0 = v.x - v.w / 2; x1 = v.x + v.w / 2; z0 = v.z - v.len / 2; z1 = v.z + v.len / 2; }
  else { x0 = v.x - v.len / 2; x1 = v.x + v.len / 2; z0 = v.z - v.w / 2; z1 = v.z + v.w / 2; }
  const T = v.type, lowTop = T === 'car' ? .88 : T === 'cab' ? 1.0 : v.h, y0 = T === 'bus' ? .45 : .28;
  // shadow
  { const a = (x0 - .1 - cam.x) * d, b = (x1 + .1 - cam.x) * d, c = (z0 - .1 - cam.z) * d, e = (z1 + .1 - cam.z) * d;
    if (Math.max(c, e) > NEAR && Math.min(c, e) < FARZ) poly('rgba(0,0,0,.28)', [Math.min(a, b), .01, Math.min(c, e), Math.max(a, b), .01, Math.min(c, e), Math.max(a, b), .01, Math.max(c, e), Math.min(a, b), .01, Math.max(c, e)]); }
  const body = box(x0, x1, y0, lowTop, z0, z1, v.col);
  if (!body) return;
  let cabi = null;
  if (T === 'car' || T === 'cab') {
    const glass = mixc(v.col, [22, 30, 42], .78);
    if (v.axis === 'z') cabi = box(x0 + .1, x1 - .1, lowTop, v.h, z0 + .85, z1 - .75, glass);
    else cabi = box(x0 + .85, x1 - .75, lowTop, v.h, z0 + .1, z1 - .1, glass);
  }
  const dm = body.dm, rh = v.dir * d;
  const az = v.axis === 'z';
  const end = az ? (body.fz ? { axis: 'z', plane: body.c, h0: body.a, h1: body.b, front: rh === -1 } : null)
    : (body.fx !== 0 ? { axis: 'x', plane: body.fx, h0: body.c, h1: body.e, front: body.fx === body.b ? rh === 1 : rh === -1 } : null);
  const side = az ? (body.fx !== 0 ? { axis: 'x', plane: body.fx, h0: body.c, h1: body.e } : null)
    : (body.fz ? { axis: 'z', plane: body.c, h0: body.a, h1: body.b } : null);
  const dark = shade([12, 12, 14], dm);
  if (side) {
    const L = side.h1 - side.h0;
    if (T === 'bus') {
      const win = env.winLit > .3 ? emit([255, 222, 160], dm, .55) : shade([40, 54, 70], dm);
      for (let y = 0; y < 2; y++) { const a0 = y ? 2.55 : 0.95, a1 = y ? 3.65 : 2.0; const n = Math.max(1, Math.floor(L / 1.5)); for (let k = 0; k < n; k++) fr(side.axis, side.plane, side.h0 + .5 + k * (L - 1) / n, side.h0 + .5 + (k + .8) * (L - 1) / n, a0, a1, win); }
    } else if (T === 'van') fr(side.axis, side.plane, side.h1 - L * .28, side.h1 - L * .02, 1.25, 2.0, shade([40, 54, 70], dm));
    for (const f of [.17, .83]) fr(side.axis, side.plane, side.h0 + L * f - .34, side.h0 + L * f + .34, 0, .64, dark);
  }
  if (end) {
    const W = end.h1 - end.h0, cx = (end.h0 + end.h1) / 2;
    if (end.front) {
      const hl = emit([255, 250, 225], dm, .9);
      fr(end.axis, end.plane, end.h0 + W * .07, end.h0 + W * .27, .6, .76, hl); fr(end.axis, end.plane, end.h1 - W * .27, end.h1 - W * .07, .6, .76, hl);
      fr(end.axis, end.plane, cx - W * .18, cx + W * .18, .45, .6, dark);
      if (T === 'van' || T === 'bus') fr(end.axis, end.plane, end.h0 + W * .06, end.h1 - W * .06, T === 'bus' ? 1.9 : 1.3, T === 'bus' ? 3.6 : 2.1, shade([40, 54, 70], dm));
      if (env.lamp > .2 || env.rain > .3) {
        for (const xx of [end.h0 + W * .17, end.h1 - W * .17]) { const p = end.axis === 'z' ? P(xx, .68, end.plane) : P(end.plane, .68, xx); glow(p[0], p[1], Math.max(4, F / dm * .55), [255, 244, 210], .55 * Math.max(env.lamp, .4)); }
      }
    } else {
      const br = v.brake ? 1 : .55, tl = emit([255, 40, 34], dm, br);
      fr(end.axis, end.plane, end.h0 + W * .05, end.h0 + W * .26, .6, .8, tl); fr(end.axis, end.plane, end.h1 - W * .26, end.h1 - W * .05, .6, .8, tl);
      fr(end.axis, end.plane, cx - W * .15, cx + W * .15, .4, .52, emit([225, 215, 120], dm, .6));
      if (T === 'bus') fr(end.axis, end.plane, end.h0 + W * .08, end.h1 - W * .08, 2.4, 3.6, env.winLit > .3 ? emit([255, 222, 160], dm, .5) : shade([40, 54, 70], dm));
      if (T === 'van') fr(end.axis, end.plane, end.h0 + W * .1, end.h1 - W * .1, 1.5, 2.1, shade([44, 56, 70], dm));
      const pp = end.axis === 'z' ? P(end.h0 + W * .15, .7, end.plane) : P(end.plane, .7, end.h0 + W * .15), pq = end.axis === 'z' ? P(end.h1 - W * .15, .7, end.plane) : P(end.plane, .7, end.h1 - W * .15);
      const ga = (v.brake ? .55 : .2) * (0.4 + env.night + env.rain), rr = Math.max(4, F / dm * .55);
      glow(pp[0], pp[1], rr, [255, 30, 24], ga); glow(pq[0], pq[1], rr, [255, 30, 24], ga);
      if (env.wet > .4) for (const q of [pp, pq]) { if (rr > 14) continue; const g = ctx.createLinearGradient(0, q[1], 0, q[1] + rr * 5); g.addColorStop(0, 'rgba(255,40,30,' + (.28 * env.wet).toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,40,30,0)'); ctx.fillStyle = g; ctx.fillRect(q[0] - rr * .25, q[1], rr * .5, rr * 5); }
    }
  }
  if (T === 'cab') { const p = P(v.x - cam.x, v.h + .12, Math.max(body.c + (body.e - body.c) * .5, NEAR)); const r = F / dm * .3; ctx.fillStyle = emit([255, 210, 90], dm, .9); ctx.fillRect(p[0] - r, p[1] - r * .3, r * 2, r * .5); }
}
function drawCyclist(v) {
  const d = cam.dir, rz = (v.z - cam.z) * d; if (rz < NEAR || rz > FARZ) return;
  const q = P((v.x - cam.x) * d, 0, rz), s = F / rz;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(q[0], q[1], .3 * s, .05 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shade([14, 14, 16], rz); ctx.fillRect(q[0] - .035 * s, q[1] - .68 * s, .07 * s, .68 * s);
  person({ x: q[0], y: q[1] + .02 * s, h: 1.75 * s * .94, dm: rz, skin: SKIN[1], top: [210, 200, 70], bot: [30, 30, 40], helmet: [40, 60, 130], front: false, walk: false, noShadow: true, arms: (x, y, h) => { ctx.beginPath(); ctx.moveTo(x, y - h * .8); ctx.lineTo(x, y - h * .57); ctx.stroke(); } });
  if (d === v.dir) glow(q[0], q[1] - .75 * s, .3 * s, [255, 30, 24], .6 * Math.max(.4, env.lamp));
}

function drawFurn(S, f) {
  const d = cam.dir, rz = (f.z - cam.z) * d; if (rz < NEAR || rz > FARZ) return;
  switch (f.k) {
    case 'lamp': {
      box(f.x - .06, f.x + .06, 0, 5.4, f.z - .06, f.z + .06, [46, 50, 54]);
      const x2 = f.x - f.side * 1.2; box(Math.min(f.x, x2), Math.max(f.x, x2), 5.32, 5.44, f.z - .05, f.z + .05, [46, 50, 54]);
      const p = P((x2 - cam.x) * d, 5.3, rz);
      const on = env.lamp; ctx.fillStyle = on > .1 ? emit([255, 226, 170], rz, 1) : shade([90, 94, 98], rz);
      ctx.fillRect(p[0] - .16 * F / rz, p[1] - .03 * F / rz, .32 * F / rz, .07 * F / rz);
      glow(p[0], p[1], Math.max(6, F / rz * 1.7), [255, 210, 140], on * .75);
      if (env.wet > .4 && on > .2) { const g = ctx.createLinearGradient(0, p[1], 0, SH); const gy = P(0, 0, rz); g.addColorStop(0, 'rgba(255,214,150,0)'); break; }
      break;
    }
    case 'tree': {
      box(f.x - .12, f.x + .12, 0, 2.6, f.z - .12, f.z + .12, [70, 54, 40]);
      const p = P((f.x - cam.x) * d, 4.4 * f.sz, rz), r = F / rz * 2.2 * f.sz;
      const leaf = f.hue < .5 ? [72, 112, 50] : f.hue < .8 ? [138, 142, 48] : [190, 122, 42];
      for (let i = 0; i < 4; i++) { ctx.fillStyle = shade(leaf, rz, .78 + i * .08); ctx.beginPath(); ctx.ellipse(p[0] + (i - 1.5) * r * .3, p[1] + (i % 2 ? 1 : -1) * r * .18, r * .62, r * .5, 0, 0, TAU); ctx.fill(); }
      break;
    }
    case 'bin': box(f.x - .28, f.x + .28, 0, 1.0, f.z - .28, f.z + .28, [46, 64, 50]); break;
    case 'post': box(f.x - .28, f.x + .28, 0, 1.3, f.z - .28, f.z + .28, [190, 30, 34]); break;
    case 'bollard': box(f.x - .07, f.x + .07, 0, .9, f.z - .07, f.z + .07, [60, 60, 66]); break;
    case 'phone': {
      const b = box(f.x - .5, f.x + .5, 0, 2.4, f.z - .5, f.z + .5, [196, 30, 34]);
      if (b && b.fz) fr('z', b.c, b.a + .12, b.b - .12, .5, 2.05, emit([255, 226, 170], b.dm, .25 + .5 * env.night));
      break;
    }
    case 'bus': {
      box(f.x - .03, f.x + .03, 0, 2.6, f.z - .03, f.z + .03, [70, 70, 76]);
      box(f.x + f.side * .1 - .8 * f.side, f.x + f.side * .1 + 0, 2.3, 2.42, f.z - 1.8, f.z + 1.8, [60, 64, 70]);
      const b = box(f.x + f.side * .75 - .03, f.x + f.side * .75 + .03, .2, 2.3, f.z - 1.7, f.z + 1.7, mixc([120, 150, 170], [40, 50, 60], .5));
      if (b && b.fx) fr('x', b.fx, b.c + .3, b.e - .3, .5, 2.0, emit([200, 230, 255], b.dm, .3 + .5 * env.night));
      box(f.x - f.side * .35 - .02, f.x - f.side * .35 + .02, 2.2, 3.2, f.z - .5, f.z + .5, [200, 30, 34]);
      break;
    }
  }
}

function drawSignal(S) {
  const rz = (S.stopZ + .5 - cam.z) * cam.dir; if (rz < NEAR || rz > FARZ) return;
  const x = -S.halfW - .4, st = sigState(S);
  box(x - .05, x + .05, 0, 3.0, S.stopZ + .5 - .05, S.stopZ + .5 + .05, [50, 52, 56]);
  const b = box(x - .17, x + .17, 2.3, 3.2, S.stopZ + .5 - .12, S.stopZ + .5 + .12, [18, 18, 20]);
  if (!b) return;
  const cols = [[255, 40, 30], [255, 180, 30], [40, 255, 120]], act = st === 'red' ? 0 : st === 'amber' ? 1 : 2;
  for (let i = 0; i < 3; i++) {
    const p = P((x - cam.x) * cam.dir, 3.0 - i * .3, rz - .13), r = Math.max(1.5, F / rz * .1);
    ctx.fillStyle = i === act ? rgb(cols[i]) : 'rgb(30,30,32)'; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
    if (i === act) glow(p[0], p[1], Math.max(5, F / rz * .8), cols[i], .8);
  }
}

function drawScooter(x, z, dir) {
  const c = [34, 40, 46];
  box(x - .22, x + .22, .34, .72, z - .85, z + .55, c);
  box(x - .2, x + .2, .72, .78, z - .55, z + .1, [20, 20, 22]);
  box(x - .23, x + .23, .78, 1.05, z + .3, z + .5, [30, 34, 38]);
  const rear = z - (dir > 0 ? .7 : -.7);
  box(x - .27, x + .27, .82, 1.4, z - .95, z - .4, [30, 170, 150]);
  box(x - .06, x + .06, 0, .55, z - .95, z - .6, [12, 12, 14]); box(x - .06, x + .06, 0, .55, z + .4, z + .75, [12, 12, 14]);
  const p = P((x - cam.x) * cam.dir, .68, (z - .95 - cam.z) * cam.dir); glow(p[0], p[1], 8, [255, 40, 30], .4);
}

let stats = { lastRain: 0 };
function renderStreet(dt) {
  const S = world.street; if (!S) return;
  drawSky(); drawSkyline(S);
  ctx.fillStyle = shade([70, 70, 74], FARZ); ctx.fillRect(0, HZ, SW, SH - HZ);
  const d = cam.dir, hw = S.halfW, pav = S.pav;
  // ground: pavements + road
  const pc = groundGrad([148, 146, 140]), rc = groundGrad([62, 63, 68]);
  strip(-hw - pav, -hw, .12, pc); strip(hw, hw + pav, .12, pc);
  strip(-hw - .18, -hw, .125, groundGrad([180, 178, 172])); strip(hw, hw + .18, .125, groundGrad([180, 178, 172]));
  strip(-hw, hw, 0, rc);
  for (const p of S.patches) {
    const a = (p.z - cam.z) * d, b = (p.z + p.l - cam.z) * d; if (Math.max(a, b) < NEAR || Math.min(a, b) > 90) continue;
    const x0 = (p.x - cam.x) * d, x1 = (p.x + p.w - cam.x) * d;
    poly(shade([54 * p.s, 55 * p.s, 60 * p.s], Math.max(Math.min(a, b), NEAR)), [x0, .004, Math.min(a, b), x1, .004, Math.min(a, b), x1, .004, Math.max(a, b), x0, .004, Math.max(a, b)]);
  }
  // road markings
  const zmin = Math.min(cam.z, cam.z + d * FARZ), zmax = Math.max(cam.z, cam.z + d * FARZ);
  const white = c => shade([224, 224, 218], c, .95);
  if (S.centre) for (let z = Math.floor(zmin / 9) * 9; z < zmax; z += 9) {
    let a = (z - cam.z) * d, b = (z + 3.5 - cam.z) * d; if (a > b) { const t = a; a = b; b = t; }
    if (b < NEAR || a > 100) continue; a = Math.max(a, NEAR); const x0 = -cam.x * d - .07, x1 = -cam.x * d + .07;
    poly(white(a), [Math.min(x0, x1), .006, a, Math.max(x0, x1), .006, a, Math.max(x0, x1), .006, b, Math.min(x0, x1), .006, b]);
  }
  if (S.yellow) { const yc = groundGrad([206, 176, 40]); for (const sd of [-1, 1]) { strip(sd * (hw - .4), sd * (hw - .32), .006, yc); strip(sd * (hw - .24), sd * (hw - .16), .006, yc); } }
  for (const zz of S.zebras) for (let x = -hw + .3; x < hw - .3; x += 1.0) {
    let a = (zz - cam.z) * d, b = (zz + 3.2 - cam.z) * d; if (a > b) { const t = a; a = b; b = t; } if (b < NEAR || a > 90) continue; a = Math.max(a, NEAR);
    const x0 = (x - cam.x) * d, x1 = (x + .5 - cam.x) * d; poly(white(a), [Math.min(x0, x1), .007, a, Math.max(x0, x1), .007, a, Math.max(x0, x1), .007, b, Math.min(x0, x1), .007, b]);
  }
  if (S.signal) { const a = (S.stopZ - cam.z) * d, b = (S.stopZ + .3 - cam.z) * d; if (Math.max(a, b) > NEAR && Math.min(a, b) < 100) { const x0 = (-hw - cam.x) * d, x1 = (0 - cam.x) * d; poly(white(Math.max(Math.min(a, b), NEAR)), [Math.min(x0, x1), .007, Math.max(Math.min(a, b), NEAR), Math.max(x0, x1), .007, Math.max(Math.min(a, b), NEAR), Math.max(x0, x1), .007, Math.max(a, b), Math.min(x0, x1), .007, Math.max(a, b)]); } }
  // pavement slab lines
  ctx.strokeStyle = shade([120, 118, 112], 12); ctx.lineWidth = 1; ctx.beginPath();
  for (let z = Math.ceil(zmin / 1.4) * 1.4; z < zmax; z += 1.4) {
    const r = (z - cam.z) * d; if (r < NEAR || r > 34) continue;
    for (const sd of [-1, 1]) { const a = P((sd * hw - cam.x) * d, .12, r), b = P((sd * (hw + pav) - cam.x) * d, .12, r); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  }
  ctx.stroke();
  // side streets
  for (const sd of [-1, 1]) for (const g of S.gaps[sd < 0 ? 'L' : 'R']) {
    let a = (g.z0 - cam.z) * d, b = (g.z1 - cam.z) * d; if (a > b) { const t = a; a = b; b = t; } if (b < NEAR || a > FARZ) continue;
    const an = Math.max(a, NEAR), x0 = (sd * hw - cam.x) * d, x1 = (sd * (hw + pav + 14) - cam.x) * d;
    poly(rc, [x0, .13, an, x1, .13, an, x1, .13, b, x0, .13, b]);
    poly(rc, [x0, .0, an, x1, .0, an, x1, .0, b, x0, .0, b]);
    const wx = (sd * (hw + pav + 15) - cam.x) * d, wc = shade(PAL.brick[1], Math.max(an, 8), .85);
    poly(wc, [wx, 0, an, wx, 0, b, wx, 9, b, wx, 9, an]);
  }
  // wet road sheen
  if (env.wet > .05) {
    const g = ctx.createLinearGradient(0, HZ, 0, HZ + (SH - HZ) * .55); const sc = mixc(env.skyBot, [255, 255, 255], .1);
    g.addColorStop(0, rgba(sc, .38 * env.wet)); g.addColorStop(1, rgba(sc, 0));
    ctx.fillStyle = g; ctx.beginPath(); for (let i = 0; i < ZS.length; i++) { const p = P((-hw - cam.x) * d, 0, ZS[i]); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    for (let i = ZS.length - 1; i >= 0; i--) { const p = P((hw - cam.x) * d, 0, ZS[i]); ctx.lineTo(p[0], p[1]); } ctx.fill();
  }
  // buildings far -> near
  for (const arr of [S.L, S.Rt]) {
    if (d > 0) for (let i = arr.length - 1; i >= 0; i--) drawLot(S, arr[i]); else for (let i = 0; i < arr.length; i++) drawLot(S, arr[i]);
  }
  // dynamic things sorted
  const items = [], depth = z => (z - cam.z) * d;
  for (const f of S.furn) { const r = depth(f.z); if (r > NEAR && r < FARZ) items.push({ d: r, f: () => drawFurn(S, f) }); }
  for (const c of S.parked) { const r = depth(c.z); if (r > NEAR - 3 && r < FARZ) items.push({ d: r, f: () => drawVeh({ axis: 'z', x: c.x, z: c.z, len: c.len, w: c.w, h: c.h, type: c.type, col: c.col, dir: c.side < 0 ? 1 : -1, brake: false }) }); }
  for (const v of S.veh) { const r = depth(v.z); if (r > NEAR - 6 && r < FARZ) items.push({ d: r, f: () => drawVeh(v) }); }
  for (const v of S.cross) { const r = depth(v.z); if (r > NEAR && r < FARZ) items.push({ d: r, f: () => drawVeh(v) }); }
  for (const p of S.peds) { const r = depth(p.z); if (r > 1.2 && r < 110) items.push({ d: r, f: () => drawPed(p, S, r) }); }
  if (S.signal) items.push({ d: depth(S.stopZ + .5), f: () => drawSignal(S) });
  if (!scene.rideActive) items.push({ d: depth(R.z), f: () => drawScooter(R.x, R.z, 1) });
  items.sort((p, q) => q.d - p.d);
  for (const it of items) it.f();
  // atmosphere
  if (env.night > .45) {
    const a = ((env.night - .45) * .3).toFixed(2); ctx.fillStyle = 'rgba(6,8,20,' + a + ')'; ctx.fillRect(0, 0, SW, SH);
  }
}
