'use strict';
// Pseudo-3D canvas renderer. World-space polygons are transformed through a street frame and a rotating
// camera (so turns really swing), clipped to the near plane and filled; facades are drawn as textured slices.
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let SW = 1, SH = 1, F = 1, HZ = 1, HZ0 = 1, CXs = 1, DPR = 1;
const NEAR = 0.6, FARZ = 150;
const cam = { x: 0, z: 0, h: 1.25, th: 0, cs: 1, sn: 0, dir: 1, bend: 0, yawPx: 0, roll: 0 };
const scene = {
  mode: 'street', rideActive: true, walking: false, fade: 0, carry: null, t: 0, tun: null, shop: null,
  pitch: 0, wz: 0, wx: 0, wdir: 1, wph: 0, look: 0, lookT: 0, indoor: false, door: null, extra: null,
};
function setHeading(th) { cam.th = th; cam.cs = Math.cos(th); cam.sn = Math.sin(th); if (Math.abs(cam.sn) < 1e-9) cam.sn = 0; if (Math.abs(cam.cs) < 1e-9) cam.cs = 0; }

function resize() {
  DPR = QP.has('dpr') ? +QP.get('dpr') : Math.min(window.devicePixelRatio || 1, 1.5);
  SW = window.innerWidth; SH = window.innerHeight;
  cv.width = Math.round(SW * DPR); cv.height = Math.round(SH * DPR);
  F = Math.max(SW * 0.68, SH * 0.95); HZ0 = HZ = SH * 0.44; CXs = SW / 2;
}
window.addEventListener('resize', resize);

// ---------- street frame + projection ----------
const IDENT = { a: 1, b: 0, c: 0, d: 1, tx: 0, tz: 0 };
let FR = IDENT; const camL = { x: 0, z: 0 };
function setFrame(f) {
  FR = f; const X = cam.x - f.tx, Z = cam.z - f.tz;
  camL.x = f.a * X + f.c * Z; camL.z = f.b * X + f.d * Z;
}
let _rx = 0, _rz = 0;
function toCam(x, z) {
  const X = FR.a * x + FR.b * z + FR.tx, Z = FR.c * x + FR.d * z + FR.tz, dx = X - cam.x, dz = Z - cam.z;
  _rx = dx * cam.cs - dz * cam.sn; _rz = dx * cam.sn + dz * cam.cs;
}
const bx_ = new Float64Array(40), by_ = new Float64Array(40), bz_ = new Float64Array(40), ox_ = new Float64Array(40), oy_ = new Float64Array(40), oz_ = new Float64Array(40);
function clipProject(a) {
  let n = Math.min(12, (a.length / 3) | 0);
  const fa = FR.a, fb = FR.b, fc = FR.c, fd = FR.d, tx = FR.tx, tz = FR.tz, cs = cam.cs, sn = cam.sn, cx = cam.x, cz = cam.z;
  let minz = 1e9;
  for (let i = 0; i < n; i++) {
    const x = a[3 * i], z = a[3 * i + 2], X = fa * x + fb * z + tx, Z = fc * x + fd * z + tz, dx = X - cx, dz = Z - cz;
    bx_[i] = dx * cs - dz * sn; bz_[i] = dx * sn + dz * cs; by_[i] = a[3 * i + 1]; if (bz_[i] < minz) minz = bz_[i];
  }
  let m = n;
  if (minz < NEAR) { // Sutherland-Hodgman against z = NEAR
    m = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, zi = bz_[i], zj = bz_[j], ii = zi >= NEAR, ij = zj >= NEAR;
      if (ii) { ox_[m] = bx_[i]; oy_[m] = by_[i]; oz_[m] = zi; m++; }
      if (ii !== ij) { const t = (NEAR - zi) / (zj - zi); ox_[m] = bx_[i] + (bx_[j] - bx_[i]) * t; oy_[m] = by_[i] + (by_[j] - by_[i]) * t; oz_[m] = NEAR; m++; }
    }
    if (m < 3) return 0;
    for (let i = 0; i < m; i++) { bx_[i] = ox_[i]; by_[i] = oy_[i]; bz_[i] = oz_[i]; }
  }
  for (let i = 0; i < m; i++) {
    const s = F / bz_[i];
    ox_[i] = Math.max(-40000, Math.min(40000, CXs + cam.yawPx + bx_[i] * s));
    oy_[i] = Math.max(-40000, Math.min(40000, HZ + (cam.h - by_[i]) * s));
  }
  return m;
}
function poly(fill, a) {
  const m = clipProject(a); if (m < 3) return false;
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(ox_[0], oy_[0]);
  for (let i = 1; i < m; i++) ctx.lineTo(ox_[i], oy_[i]);
  ctx.closePath(); ctx.fill(); return true;
}
// camera-space point -> screen (used by tunnels, doorways, glows)
function P(rx, y, rz) {
  if (rz < NEAR) rz = NEAR; const s = F / rz;
  return [CXs + cam.yawPx + rx * s, HZ + (cam.h - y) * s];
}
// street-local point -> [sx, sy, depth] or null when behind the camera
function Pw(x, y, z) {
  toCam(x, z); if (_rz < NEAR) return null; const s = F / _rz;
  return [CXs + cam.yawPx + _rx * s, HZ + (cam.h - y) * s, _rz];
}
function emit(c, z, k) {
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
function strip(x0, x1, y, fill, z0, z1) { poly(fill, [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]); }

function box(x0, x1, y0, y1, z0, z1, col, k) {
  k = k || 1; toCam((x0 + x1) / 2, (z0 + z1) / 2);
  const ext = Math.max(x1 - x0, z1 - z0);
  if (_rz + ext < NEAR || _rz > FARZ + 10) return null;
  const dm = Math.max(_rz, NEAR), info = { x0, x1, y0, y1, z0, z1, dm, fxs: 0, fzs: 0 };
  if (cam.h > y1) poly(shade(col, dm, 1.12 * k), [x0, y1, z0, x1, y1, z0, x1, y1, z1, x0, y1, z1]);
  if (camL.x > x1) { poly(shade(col, dm, .72 * k), [x1, y0, z0, x1, y0, z1, x1, y1, z1, x1, y1, z0]); info.fxs = 1; }
  else if (camL.x < x0) { poly(shade(col, dm, .72 * k), [x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0]); info.fxs = -1; }
  if (camL.z > z1) { poly(shade(col, dm, .92 * k), [x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1]); info.fzs = 1; }
  else if (camL.z < z0) { poly(shade(col, dm, .92 * k), [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0]); info.fzs = -1; }
  return info;
}
function fr(axis, plane, h0, h1, y0, y1, fill) {
  if (axis === 'z') poly(fill, [h0, y0, plane, h1, y0, plane, h1, y1, plane, h0, y1, plane]);
  else poly(fill, [plane, y0, h0, plane, y0, h1, plane, y1, h1, plane, y1, h0]);
}

// ---------- people ----------
// person() lives in people.js
function drawPed(p) {
  const q = Pw(p.x, 0, p.z); if (!q || q[0] < -60 || q[0] > SW + 60) return;
  const dm = q[2], h = p.h * F / dm; if (h < 4) return;
  const away = (FR.b * p.dz * cam.sn + FR.d * p.dz * cam.cs) > 0;
  person(Object.assign({}, p, { x: q[0], y: q[1], h, dm, view: away ? 'back' : 'front', walk: true, umb: env.rain > .2 ? p.umb : null, noShadow: h < 14, mood: 'ok', phone: p.phone && !away }));
  if (env.lamp > .3 && h > 8) glow(q[0], q[1] - h * .5, h * .5, [255, 200, 140], .05 * env.lamp);
}

// ---------- sky ----------
let clouds = null, skyDist = null, skyDistId = '';
function angNorm(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
function drawSky() {
  if (!clouds) { const r = new RNG(7); clouds = []; for (let i = 0; i < 12; i++) clouds.push({ phi: r.r(-Math.PI, Math.PI), y: r.r(.05, .36), w: r.r(.16, .36), s: r.r(.4, 1) }); }
  const g = ctx.createLinearGradient(0, 0, 0, HZ + 2);
  g.addColorStop(0, rgb(env.skyTop)); g.addColorStop(1, rgb(env.skyBot));
  ctx.fillStyle = g; ctx.fillRect(0, 0, SW, HZ + 2);
  if (env.night > .55 && env.cloud < .7) {
    ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * (env.night - .55) * (1 - env.cloud)).toFixed(2) + ')';
    for (let i = 0; i < 60; i++) { const ph = hash(i, 1) * TAU - Math.PI, dph = angNorm(ph - cam.th); if (Math.abs(dph) < 1.3) ctx.fillRect(CXs + cam.yawPx + F * Math.tan(dph), hash(i, 2) * HZ * .8, 1.3, 1.3); }
  }
  const elev = Math.sin(Math.PI * (env.hour - 6.7) / 11.6);
  if (elev > -0.05 && env.cloud < .9) {
    const alt = Math.asin(clamp(elev, 0, 1)) * .85, dph = angNorm(0.55 - cam.th), sx = CXs + cam.yawPx + F * Math.tan(dph), sy = HZ - F * Math.tan(alt);
    if (Math.abs(dph) < 1.4 && sy > -F * .4) {
      const a = (1 - env.cloud) * (env.day * .8 + .2), warm = env.twi > .05 ? [255, 190, 120] : [255, 244, 214];
      const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, F * .5); rg.addColorStop(0, rgba(warm, .55 * a)); rg.addColorStop(1, rgba(warm, 0)); ctx.fillStyle = rg; ctx.fillRect(0, 0, SW, HZ + 2);
      ctx.fillStyle = rgba([255, 252, 240], a); ctx.beginPath(); ctx.arc(sx, sy, F * .022, 0, TAU); ctx.fill();
    }
  } else if (env.night > .7 && env.cloud < .6) {
    const dph = angNorm(-.45 - cam.th), mx = CXs + cam.yawPx + F * Math.tan(dph), my = HZ - F * .55;
    if (Math.abs(dph) < 1.3) { ctx.fillStyle = 'rgba(240,244,255,' + (0.85 * (1 - env.cloud)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(mx, my, F * .016, 0, TAU); ctx.fill(); }
  }
  if (env.twi > .05) { const gx = CXs + F * Math.tan(clamp(angNorm(.55 - cam.th), -1.4, 1.4)); const gr = ctx.createRadialGradient(gx, HZ, 0, gx, HZ, SW * .7); gr.addColorStop(0, 'rgba(255,170,90,' + (env.twi * .55).toFixed(2) + ')'); gr.addColorStop(1, 'rgba(255,170,90,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, SW, HZ + 2); }
  const cl = mixc(mixc(env.skyBot, [255, 255, 255], .5 * env.day), [90, 96, 110], env.cloud * .45 * env.day);
  const sh = mulc(cl, .6 + .4 * env.day);
  for (const c of clouds) {
    const dphi = angNorm(c.phi + world.time * .004 * c.s - cam.th); if (Math.abs(dphi) > 1.5) continue;
    const x = CXs + cam.yawPx + F * Math.tan(dphi), w = c.w * F;
    ctx.fillStyle = rgba(sh, clamp(env.cloud * .5 * c.s + .04, 0, .6));
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x + (k - 1.5) * w * .22, c.y * HZ + (k % 2) * 8, w * .3, w * .05, 0, 0, TAU); ctx.fill(); }
  }
}
function drawSkyline(S) {
  if (skyDistId !== S.D.id) {
    skyDistId = S.D.id; const r = new RNG(S.seed ^ 55), tall = S.D.kind === 'towers' ? 2.4 : 1; skyDist = [[], []];
    for (let L = 0; L < 2; L++) for (let i = 0; i < 90; i++) skyDist[L].push({ phi: -Math.PI + (i + r.n()) * TAU / 90, w: r.r(.02, .05), h: r.r(.01, .05) * tall * (L ? .8 : 1.15) * (r.c(.07) ? 2.4 : 1) });
  }
  for (let L = 0; L < 2; L++) {
    const col = shade(L ? [128, 132, 142] : [110, 114, 124], L ? 300 : 200, .8);
    for (const b of skyDist[L]) {
      const dphi = angNorm(b.phi - cam.th); if (Math.abs(dphi) > 1.45) continue;
      const x = CXs + cam.yawPx + F * Math.tan(dphi), w = Math.max(3, F * b.w), hh = b.h * SH * 2.2;
      ctx.fillStyle = col; ctx.fillRect(x, HZ - hh, w, hh + 2);
      if (env.night > .4 && !L) { ctx.fillStyle = 'rgba(255,214,150,' + (env.night * .35).toFixed(2) + ')'; for (let k = 0; k < hh / 9; k++) ctx.fillRect(x + hash(k, b.phi * 99) * w, HZ - hh + k * 8, 1.5, 1.5); }
    }
  }
  const hz = ctx.createLinearGradient(0, HZ - F * .12, 0, HZ + 4); hz.addColorStop(0, rgba(env.fogC, 0)); hz.addColorStop(1, rgba(env.fogC, .55)); ctx.fillStyle = hz; ctx.fillRect(0, HZ - F * .12, SW, F * .12 + 4);
}

// ---------- textured facade walls ----------
const DOORS = [[30, 50, 90], [120, 30, 30], [30, 30, 34], [40, 90, 60], [220, 220, 216], [130, 96, 50]];
function drawTexWall(S, l, tex, dmin) {
  const x = l.x; toCam(x, l.z0); const ax = _rx, az = _rz; toCam(x, l.z1); const bx = _rx, bz = _rz;
  const dz = bz - az, dx = bx - ax;
  if (az < NEAR && bz < NEAR) return;
  let tlo = 0, thi = 1;
  if (az < NEAR) tlo = (NEAR - az) / dz; else if (bz < NEAR) thi = (NEAR - az) / dz;
  const sxOf = t => CXs + cam.yawPx + F * (ax + t * dx) / (az + t * dz);
  const xl = sxOf(tlo), xh = sxOf(thi), xmin = Math.min(xl, xh), xmax = Math.max(xl, xh);
  if (xmax < 0 || xmin > SW || xmax - xmin < .5) return;
  const x0 = Math.max(0, Math.floor(xmin)), x1 = Math.min(SW, Math.ceil(xmax));
  const h = l.h, wpx = xmax - xmin, dens = tex.len * tex.ppm / wpx;
  const lv = dens > 5 ? 2 : dens > 2.4 ? 1 : 0, mip = lv ? (tex.mips[lv] || makeMip(tex, lv)) : null;
  const img = mip ? mip.A : tex.A, emi = mip ? mip.E : tex.E, iw = img.width, ih = img.height, ew = emi.width, eh = emi.height;
  const flip = x > 0, step = wpx > 400 ? 3 : 2;
  const tOf = sx => { const s = (sx - CXs - cam.yawPx) / F; let d = s * dz - dx; if (Math.abs(d) < 1e-9) d = 1e-9; const t = (ax - s * az) / d; return t < tlo ? tlo : t > thi ? thi : t; };
  ctx.imageSmoothingEnabled = true;
  const cols = [];
  for (let sx = x0; sx < x1; sx += step) {
    const t0 = tOf(sx), t1 = tOf(sx + step), tm = (t0 + t1) / 2, rz = az + tm * dz; if (rz < NEAR) continue;
    const yT = HZ + (cam.h - h) * F / rz, yB = HZ + cam.h * F / rz;
    let u0 = flip ? 1 - t0 : t0, u1 = flip ? 1 - t1 : t1; if (u0 > u1) { const q = u0; u0 = u1; u1 = q; }
    const sw = Math.max(1, (u1 - u0) * iw);
    ctx.drawImage(img, Math.min(u0 * iw, iw - sw), 0, sw, ih, sx, yT, step + .6, yB - yT);
    cols.push(sx, yT, yB, u0, u1);
  }
  if (!cols.length) return;
  const nx = l.x < 0 ? 1 : -1, wall = [l.x, 0, l.z0, l.x, 0, l.z1, l.x, h, l.z1, l.x, h, l.z0];
  const k = nx > 0 ? .9 : 1, ac = [clamp(env.amb * env.tint[0] * k, 0, 1), clamp(env.amb * env.tint[1] * k, 0, 1), clamp(env.amb * env.tint[2] * k, 0, 1)];
  const lb = env.lamp * .24 * Math.max(0, 1 - dmin / 75); ac[0] = Math.min(1, ac[0] + lb); ac[1] = Math.min(1, ac[1] + lb * .78); ac[2] = Math.min(1, ac[2] + lb * .5);
  if (ac[0] < .985 || ac[1] < .985 || ac[2] < .985) { ctx.globalCompositeOperation = 'multiply'; poly('rgb(' + (ac[0] * 255 | 0) + ',' + (ac[1] * 255 | 0) + ',' + (ac[2] * 255 | 0) + ')', wall); ctx.globalCompositeOperation = 'source-over'; }
  if (env.winLit > .04 && dmin < 110) {
    ctx.globalAlpha = Math.min(1, env.winLit * 1.05);
    for (let i = 0; i < cols.length; i += 5) {
      const sw = Math.max(1, (cols[i + 4] - cols[i + 3]) * ew);
      ctx.drawImage(emi, Math.min(cols[i + 3] * ew, ew - sw), 0, sw, eh, cols[i], cols[i + 1], step + .6, cols[i + 2] - cols[i + 1]);
    }
    ctx.globalAlpha = 1;
  }
  if (Math.abs(xh - xl) > 1) {
    const g = ctx.createLinearGradient(xl, 0, xh, 0);
    for (let i = 0; i <= 3; i++) { const t = tlo + (thi - tlo) * i / 3, rz = az + t * dz; g.addColorStop(i / 3, rgba(env.fogC, fogAmt(Math.max(rz, 1)))); }
    poly(g, wall);
  }
}

function drawLot(S, l, dmin) {
  const d = l.depth, sg = l.x < 0 ? -1 : 1, h = l.h;
  const px = l.side * (S.halfW + S.pav), doorC = l.z0 + l.doorU * (l.z1 - l.z0);
  if (l.setback > .05) poly(shade(l.gcol, d), [px, .01, l.z0, l.x, .01, l.z0, l.x, .01, l.z1, px, .01, l.z1]);
  const endZ = camL.z < l.z0 ? l.z0 : camL.z > l.z1 ? l.z1 : null;
  if (endZ !== null) poly(shade(l.col, d, .66), [l.x, 0, endZ, l.x + sg * 9, 0, endZ, l.x + sg * 9, h, endZ, l.x, h, endZ]);
  if ((camL.x - l.x) * (l.x < 0 ? 1 : -1) > 0) {
    const tex = getLotTex(S, l);
    if (tex) drawTexWall(S, l, tex, dmin);
    else poly(shade(l.col, d), [l.x, 0, l.z0, l.x, 0, l.z1, l.x, h, l.z1, l.x, h, l.z0]);
  }
  if (l.chim && l.kind !== 'glass' && d < 90) {
    const cz = l.z0 + (l.z1 - l.z0) * .3, cx = l.x + sg * 2.2;
    box(cx - .4, cx + .4, h - .2, h + 1.5, cz - .4, cz + .4, mulc(l.col, .85));
    box(cx - .3, cx + .3, h + 1.5, h + 1.9, cz - .3, cz + .3, [150, 90, 70]);
  }
  if (l.front && l.setback > 1) {
    const gh = l.front === 'hedge' ? 1.15 : l.front === 'brick' ? .85 : .95, fc = l.front === 'hedge' ? [46, 88, 42] : l.front === 'brick' ? [130, 80, 66] : [24, 24, 28];
    const g0 = doorC - .55, g1 = doorC + .55, fill = shade(fc, d, l.front === 'rail' ? 1 : .95);
    poly(fill, [px, 0, l.z0, px, 0, g0, px, gh, g0, px, gh, l.z0]); poly(fill, [px, 0, g1, px, 0, l.z1, px, gh, l.z1, px, gh, g1]);
    if (l.front !== 'rail') { poly(shade(fc, d, 1.2), [px, gh, l.z0, px + sg * .5, gh, l.z0, px + sg * .5, gh, g0, px, gh, g0]); poly(shade(fc, d, 1.2), [px, gh, g1, px + sg * .5, gh, g1, px + sg * .5, gh, l.z1, px, gh, l.z1]); }
    poly(shade([150, 145, 138], d), [px, .02, doorC - .5, l.x, .02, doorC - .5, l.x, .02, doorC + .5, px, .02, doorC + .5]);
  }
}

// ---------- vehicles (see vehicles.js) ----------
function drawCyclist(v) {
  const q = Pw(v.x, 0, v.z); if (!q) return; const rz = q[2], s = F / rz;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(q[0], q[1], .3 * s, .05 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = shade([14, 14, 16], rz); ctx.fillRect(q[0] - .035 * s, q[1] - .68 * s, .07 * s, .68 * s);
  person({ x: q[0], y: q[1] + .02 * s, h: 1.75 * s * .94, dm: rz, skin: SKIN[1], top: [210, 200, 70], bot: [30, 30, 40], helmet: [40, 60, 130], view: 'back', armPose: 'bars', outfit: 'jacket', walk: false, noShadow: true });
  glow(q[0], q[1] - .75 * s, .3 * s, [255, 30, 24], .6 * Math.max(.4, env.lamp));
}

function drawFurn(S, f) {
  switch (f.k) {
    case 'lamp': drawLamp(f); break;
    case 'tree': {
      box(f.x - .12, f.x + .12, 0, 2.6, f.z - .12, f.z + .12, [70, 54, 40]);
      const p = Pw(f.x, 4.4 * f.sz, f.z); if (!p) break; const rz = p[2], r = F / rz * 2.2 * f.sz;
      const leaf = f.hue < .5 ? [72, 112, 50] : f.hue < .8 ? [138, 142, 48] : [190, 122, 42];
      for (let i = 0; i < 6; i++) { ctx.fillStyle = shade(leaf, rz, .7 + (i % 3) * .12); ctx.beginPath(); ctx.ellipse(p[0] + (i - 2.5) * r * .22, p[1] + (i % 2 ? 1 : -1) * r * .2 + (i % 3) * r * .05, r * .5, r * .42, 0, 0, TAU); ctx.fill(); }
      break;
    }
    case 'bin': box(f.x - .28, f.x + .28, 0, 1.0, f.z - .28, f.z + .28, [46, 64, 50]); break;
    case 'post': box(f.x - .28, f.x + .28, 0, 1.3, f.z - .28, f.z + .28, [190, 30, 34]); break;
    case 'bollard': box(f.x - .07, f.x + .07, 0, .9, f.z - .07, f.z + .07, [60, 60, 66]); break;
    case 'phone': {
      const b = box(f.x - .5, f.x + .5, 0, 2.4, f.z - .5, f.z + .5, [196, 30, 34]);
      if (b && b.fzs) fr('z', b.fzs < 0 ? f.z - .5 : f.z + .5, f.x - .38, f.x + .38, .5, 2.05, emit([255, 226, 170], b.dm, .25 + .5 * env.night));
      break;
    }
    case 'bus': {
      box(f.x - .03, f.x + .03, 0, 2.6, f.z - .03, f.z + .03, [70, 70, 76]);
      box(Math.min(f.x, f.x + f.side * .9) - .01, Math.max(f.x, f.x + f.side * .9) + .01, 2.3, 2.42, f.z - 1.8, f.z + 1.8, [60, 64, 70]);
      const bx = f.x + f.side * .85, b = box(bx - .03, bx + .03, .2, 2.3, f.z - 1.7, f.z + 1.7, mixc([120, 150, 170], [40, 50, 60], .5));
      if (b && b.fxs) fr('x', bx + b.fxs * .03, f.z - 1.4, f.z + 1.4, .5, 2.0, emit([200, 230, 255], b.dm, .3 + .5 * env.night));
      box(f.x - f.side * .35 - .02, f.x - f.side * .35 + .02, 2.2, 3.2, f.z - .5, f.z + .5, [200, 30, 34]);
      break;
    }
  }
}
function drawSignal(S) {
  const x = -S.halfW - .4, zz = S.stopZ + .5, st = sigState(S);
  box(x - .05, x + .05, 0, 3.0, zz - .05, zz + .05, [50, 52, 56]);
  const b = box(x - .17, x + .17, 2.3, 3.2, zz - .12, zz + .12, [18, 18, 20]); if (!b) return;
  const cols = [[255, 40, 30], [255, 180, 30], [40, 255, 120]], act = st === 'red' ? 0 : st === 'amber' ? 1 : 2;
  for (let i = 0; i < 3; i++) {
    const p = Pw(x, 3.0 - i * .3, zz - .13); if (!p) continue; const r = Math.max(1.5, F / p[2] * .1);
    ctx.fillStyle = i === act ? rgb(cols[i]) : 'rgb(30,30,32)'; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
    if (i === act) glow(p[0], p[1], Math.max(5, F / p[2] * .8), cols[i], .8);
  }
}
function drawScooter(x, z) {
  box(x - .22, x + .22, .34, .72, z - .85, z + .55, [34, 40, 46]);
  box(x - .2, x + .2, .72, .78, z - .55, z + .1, [20, 20, 22]);
  box(x - .23, x + .23, .78, 1.05, z + .3, z + .5, [30, 34, 38]);
  box(x - .27, x + .27, .82, 1.4, z - .95, z - .4, [30, 170, 150]);
  box(x - .06, x + .06, 0, .55, z - .95, z - .6, [12, 12, 14]); box(x - .06, x + .06, 0, .55, z + .4, z + .75, [12, 12, 14]);
  const p = Pw(x, .68, z - .95); if (p) glow(p[0], p[1], 8, [255, 40, 30], .4);
}

// ---------- ground ----------
function drawGround(S, cull) {
  const hw = S.halfW, pav = S.pav, zc = camL.z, zlo = Math.max(-14, zc - 60), zhi = Math.min(cull, zc + FARZ + 20);
  const pc = groundGrad([148, 146, 140]), rc = groundGrad([62, 63, 68]), kc = groundGrad([180, 178, 172]);
  const zp0 = Math.max(10, zlo);
  for (const sd of [-1, 1]) { strip(sd * hw, sd * (hw + pav), .12, pc, zp0, zhi); strip(sd < 0 ? -hw - .18 : hw, sd < 0 ? -hw : hw + .18, .125, kc, zp0, zhi); }
  strip(-hw, hw, 0, rc, zlo, zhi);
  for (const p of S.patches) {
    if (p.z > zhi || p.z + p.l < zlo || Math.abs(p.z - zc) > 100) continue;
    poly(shade([54 * p.s, 55 * p.s, 60 * p.s], Math.abs(p.z - zc) + 4), [p.x, .004, p.z, p.x + p.w, .004, p.z, p.x + p.w, .004, p.z + p.l, p.x, .004, p.z + p.l]);
  }
  const white = c => shade([224, 224, 218], c, .95);
  const zs = Math.max(zp0, Math.floor((zc - 30) / 9) * 9);
  if (S.centre) for (let z = zs; z < Math.min(zhi, zc + 110); z += 9) {
    if (z > S.len - 6 && z < S.len + 14) continue;
    toCam(0, z); const dm = Math.max(_rz, 1); poly(white(dm), [-.07, .006, z, .07, .006, z, .07, .006, z + 3.5, -.07, .006, z + 3.5]);
  }
  if (S.yellow) { const yc = groundGrad([206, 176, 40]); for (const sd of [-1, 1]) { strip(sd * (hw - .4), sd * (hw - .32), .006, yc, zp0, Math.min(zhi, S.len - 6)); strip(sd * (hw - .24), sd * (hw - .16), .006, yc, zp0, Math.min(zhi, S.len - 6)); } }
  for (const zz of S.zebras) for (let x = -hw + .3; x < hw - .3; x += 1.0) { toCam(x, zz); if (_rz < -5 || _rz > 100) continue; poly(white(Math.max(_rz, 1)), [x, .007, zz, x + .5, .007, zz, x + .5, .007, zz + 3.2, x, .007, zz + 3.2]); }
  if (S.signal) poly(white(Math.max(1, S.stopZ - zc)), [-hw, .007, S.stopZ, 0, .007, S.stopZ, 0, .007, S.stopZ + .3, -hw, .007, S.stopZ + .3]);
  ctx.strokeStyle = shade([120, 118, 112], 12); ctx.lineWidth = 1; ctx.beginPath();
  for (let z = Math.ceil(Math.max(zp0, zc - 6) / 1.4) * 1.4; z < zc + 30; z += 1.4) for (const sd of [-1, 1]) {
    const a = Pw(sd * hw, .12, z), b = Pw(sd * (hw + pav), .12, z); if (a && b) { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
  }
  ctx.stroke();
  for (const sd of [-1, 1]) for (const g of S.gaps[sd < 0 ? 'L' : 'R']) {
    if (g.z1 < zlo || g.z0 > zhi) continue;
    if (g === S.jg && S.turnSide === sd) continue;
    poly(rc, [sd * hw, .13, g.z0, sd * (hw + pav + 14), .13, g.z0, sd * (hw + pav + 14), .13, g.z1, sd * hw, .13, g.z1]);
    toCam(sd * (hw + pav + 15), (g.z0 + g.z1) / 2);
    poly(shade(PAL.brick[1], Math.max(_rz, 8), .85), [sd * (hw + pav + 15), 0, g.z0, sd * (hw + pav + 15), 0, g.z1, sd * (hw + pav + 15), 9, g.z1, sd * (hw + pav + 15), 9, g.z0]);
  }
  if (env.wet > .05) {
    const g = ctx.createLinearGradient(0, HZ, 0, HZ + (SH - HZ) * .55); const sc = mixc(env.skyBot, [255, 255, 255], .1);
    g.addColorStop(0, rgba(sc, .38 * env.wet)); g.addColorStop(1, rgba(sc, 0));
    poly(g, [-hw, .002, zlo, hw, .002, zlo, hw, .002, zhi, -hw, .002, zhi]);
  }
}

// ---------- main street render ----------
function streetList() {
  const list = [{ S: world.street, fr: IDENT, cull: world.street.cullFar || 1e9 }];
  if (world.turn) list.push({ S: world.turn.S1, fr: world.turn.fr, cull: 1e9 });
  if (world.prev) list.push({ S: world.prev.S, fr: world.prev.fr, cull: world.prev.S.cullFar || 1e9 });
  return list;
}
function renderStreet(dt) {
  const S0 = world.street; if (!S0) return;
  texBudgetReset(); setFrame(IDENT);
  drawSky(); drawSkyline(S0);
  ctx.fillStyle = shade([70, 70, 74], FARZ); ctx.fillRect(0, HZ, SW, SH - HZ);
  const list = streetList();
  for (const it of list) { setFrame(it.fr); drawGround(it.S, it.cull); }
  const lots = [];
  for (const it of list) {
    setFrame(it.fr);
    for (const arr of [it.S.L, it.S.Rt]) for (const l of arr) {
      if (l.z0 > it.cull) continue;
      toCam(l.x, (l.z0 + l.z1) / 2); const half = (l.z1 - l.z0) / 2 + 2;
      if (_rz + half < NEAR || _rz - half > FARZ + 20) continue;
      l.depth = Math.max(_rz, 1); lots.push({ d: _rz, S: it.S, fr: it.fr, l });
    }
  }
  lots.sort((p, q) => q.d - p.d);
  for (const o of lots) { setFrame(o.fr); drawLot(o.S, o.l, Math.max(o.d - (o.l.z1 - o.l.z0) / 2, 1)); }
  const items = [];
  const add = (it, x, z, f, pad) => { setFrame(it.fr); toCam(x, z); if (_rz > NEAR - (pad || 4) && _rz < FARZ + 5) items.push({ d: _rz, fr: it.fr, f }); };
  for (const it of list) {
    const S = it.S;
    for (const f of S.furn) if (f.z < it.cull) add(it, f.x, f.z, () => drawFurn(S, f), 2);
    for (const c of S.parked) if (c.z < it.cull) add(it, c.x, c.z, () => drawVeh({ axis: 'z', x: c.x, z: c.z, len: c.len, w: c.w, h: c.h, type: c.type, col: c.col, dir: c.side < 0 ? 1 : -1, brake: false }), 6);
    for (const v of S.veh) if (v.z < it.cull) add(it, v.x, v.z, () => drawVeh(v), 6);
    for (const v of S.cross) add(it, v.x, v.z, () => drawVeh(v), 6);
    for (const p of S.peds) if (p.z < it.cull) add(it, p.x, p.z, () => drawPed(p), 1);
    if (S.signal) add(it, -S.halfW, S.stopZ + .5, () => drawSignal(S), 3);
  }
  if (!scene.rideActive && !world.turn) add(list[0], R.x, R.z, () => drawScooter(R.x, R.z), 3);
  items.sort((p, q) => q.d - p.d);
  for (const it of items) { setFrame(it.fr); it.f(); }
  setFrame(IDENT);
  if (env.night > .45) { ctx.fillStyle = 'rgba(6,8,20,' + ((env.night - .45) * .3).toFixed(2) + ')'; ctx.fillRect(0, 0, SW, SH); }
}
