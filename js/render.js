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
  k = k === undefined ? 1 : k; const f = fogF(z), fc = env.fogC;
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
  const st = p.state || 'walk', dirn = st === 'cross' ? p.cdir : (Math.sign(p.dz) || 1);
  let view, face = 1;
  if (st === 'cross') { view = 'side'; face = Math.sign(dirn * (FR.a * cam.cs - FR.c * cam.sn)) || 1; }
  else view = (FR.b * dirn * cam.sn + FR.d * dirn * cam.cs) > 0 ? 'back' : 'front';
  const moving = st === 'walk' || st === 'cross';
  person(Object.assign({}, p, { x: q[0], y: q[1], h, dm, view, face, walk: moving, umb: env.rain > .2 ? p.umb : null, hood: env.rain > .2 && !p.umb && (p.outfit === 'hoodie' || p.outfit === 'coat' || p.outfit === 'puffer' || p.outfit === 'jacket'), noShadow: h < 9, mood: st === 'chat' ? 'happy' : 'ok', act: st === 'chat' ? (p.t < 1.8 ? 'wave' : 'talk') : null, actT: p.t, phone: view !== 'back' && (st === 'stand' || (moving && p.basePhone)) }));
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
  const k = sunK(nx, 0), ac = [clamp(env.amb * env.tint[0] * k, 0, 1), clamp(env.amb * env.tint[1] * k, 0, 1), clamp(env.amb * env.tint[2] * k, 0, 1)];
  const lb = env.lamp * .24 * Math.max(0, 1 - dmin / 75); ac[0] = Math.min(1, ac[0] + lb); ac[1] = Math.min(1, ac[1] + lb * .78); ac[2] = Math.min(1, ac[2] + lb * .5);
  if (ac[0] < .985 || ac[1] < .985 || ac[2] < .985) { ctx.globalCompositeOperation = 'multiply'; poly('rgb(' + (ac[0] * 255 | 0) + ',' + (ac[1] * 255 | 0) + ',' + (ac[2] * 255 | 0) + ')', wall); ctx.globalCompositeOperation = 'source-over'; }
  if (env.winLit > .04 && dmin < 145) {
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

// Direct sun on a wall whose street-local outward normal is (nx, nz): ~0.82 in shade, up to ~1.25 face-on in clear sun.
// The sun sits 0.55 rad right of world +z (as drawn in the sky), low and warm in the evening.
function sunK(nx, nz) {
  const wx = FR.a * nx + FR.b * nz, wz = FR.c * nx + FR.d * nz, lam = Math.max(0, wx * Math.sin(.55) + wz * Math.cos(.55));
  const sun = env.day * (1 - env.cloud * .85) * (1 - env.rain * .6);
  return .86 - .08 * sun + lam * sun * .42;
}
function drawRoof(l, sg, h, d, pitched) {
  const z0 = l.z0 + .02, z1 = l.z1 - .02, back = l.x + sg * 8.6;
  if (pitched) {
    const rx = l.x + sg * .35, rh = h + 2.4, ridge = l.x + sg * 3.4, mans = l.floors >= 4;
    const slate = mans ? [62, 66, 76] : [84, 80, 84];
    poly(shade(slate, d, .95 * sunK(-sg, 0) + .1), [rx, h - .05, z0, rx, h - .05, z1, ridge, rh, z1, ridge, rh, z0]);
    poly(shade(slate, d, 1.15), [ridge, rh, z0, ridge, rh, z1, back, rh, z1, back, rh, z0]);
    if (camL.z < z0 || camL.z > z1) { const ez = camL.z < z0 ? z0 : z1; poly(shade(l.col, d, .62), [rx, h - .05, ez, ridge, rh, ez, back, rh, ez, back, h - .05, ez]); }
    if (d < 60) { // dormers, one over each bay
      const n = Math.max(1, Math.floor((z1 - z0) / (l.wp || 3))), pitch = (z1 - z0) / n;
      for (let i = 0; i < n; i++) {
        const zc = z0 + (i + .5) * pitch, dx0 = l.x + sg * 1.0, dx1 = l.x + sg * 2.4, dw = Math.min(.55, pitch * .28);
        box(Math.min(dx0, dx1), Math.max(dx0, dx1), h + .5, h + 1.75, zc - dw, zc + dw, mans ? [60, 64, 72] : [210, 206, 198]);
        box(Math.min(dx0, dx1) - .05, Math.max(dx0, dx1) + .05, h + 1.75, h + 1.85, zc - dw - .08, zc + dw + .08, [56, 58, 64]);
        if ((camL.x - dx0) * -sg > 0) fr('x', dx0 - sg * .005, zc - dw + .1, zc + dw - .1, h + .65, h + 1.6, env.winLit > .3 && hash(l.seed, i) < l.lit ? emit([255, 214, 150], d, .9) : shade([60, 76, 92], d, 1));
      }
    }
  } else if (l.kind !== 'house' && d < 120 && hash(l.seed, 3) < .6) { // flat roof: lift housing / plant / water tank set back behind the parapet
    const zc = z0 + (z1 - z0) * (.3 + hash(l.seed, 4) * .4), bx0 = l.x + sg * 2.5, bx1 = l.x + sg * 5;
    box(Math.min(bx0, bx1), Math.max(bx0, bx1), h - .1, h + 1.6 + hash(l.seed, 5), zc - 1.2, zc + 1.2, mixc(l.col, [150, 150, 150], .5));
    if (hash(l.seed, 6) < .5) { const ax0 = l.x + sg * 1.2, ax1 = l.x + sg * 2.2; box(Math.min(ax0, ax1), Math.max(ax0, ax1), h - .1, h + .9, zc + 1.6, zc + 2.6, [170, 172, 176]); }
  }
}
function drawLot(S, l, dmin) {
  const d = l.depth, sg = l.x < 0 ? -1 : 1, h = l.h;
  const px = l.side * (S.halfW + S.pav), doorC = l.z0 + l.doorU * (l.z1 - l.z0);
  if (l.setback > .05) poly(shade(l.gcol, d), [px, .01, l.z0, l.x, .01, l.z0, l.x, .01, l.z1, px, .01, l.z1]);
  const endZ = camL.z < l.z0 ? l.z0 : camL.z > l.z1 ? l.z1 : null;
  const pitched = l.roof === 1 && l.kind !== 'glass' && l.kind !== 'block' && l.pal !== 'modern';
  // roof behind the parapet: slate mansard / pitched slope with dormers, or a flat roof with plant on it
  if (d < 170 && l.kind !== 'glass') drawRoof(l, sg, h, d, pitched);
  if (endZ !== null) { // flank wall: textured brick / render with a chimney breast, weathering, the odd window
    toCam(l.x, endZ); const fa = _rx / Math.max(_rz, NEAR); toCam(l.x + sg * 9, endZ); const fwid = Math.abs(_rx / Math.max(_rz, NEAR) - fa) * F;
    if (d < 70 && fwid > 14) drawSlicedQuad(flankTex(l), l.x + sg * 9, endZ, l.x, endZ, 0, h, .72 * sunK(0, endZ === l.z0 ? -1 : 1));
    else poly(shade(l.col, d, .66), [l.x, 0, endZ, l.x + sg * 9, 0, endZ, l.x + sg * 9, h, endZ, l.x, h, endZ]);
  }
  if ((camL.x - l.x) * (l.x < 0 ? 1 : -1) > 0) {
    drawTexWall(S, l, getLotTex(S, l) || genericLotTex(l), dmin);
    // contact shadow where the wall meets the pavement
    if (d < 60) { const px2 = l.x - sg * .7; poly('rgba(0,0,0,' + (.16 * env.amb + .04).toFixed(3) + ')', [l.x, .125, l.z0, px2, .125, l.z0, px2, .125, l.z1, l.x, .125, l.z1]); }
  }
  if (l.kind !== 'glass' && l.kind !== 'block' && d < 140 && (l.chim || pitched)) { // chimney stack on the party wall, with pots
    const cz = l.z0 + .05, cx = l.x + sg * (pitched ? 2.6 : 2.2), top = h + (pitched ? 2.9 : 1.6), stk = mulc(l.col, .85);
    box(cx - .35, cx + .35, h - .2, top, cz - .6, cz + .6, stk);
    box(cx - .42, cx + .42, top, top + .12, cz - .67, cz + .67, mixc(stk, [210, 205, 195], .4));
    for (let k = 0; k < 3; k++) { const pz = cz - .4 + k * .4; box(cx - .1, cx + .1, top + .12, top + .5 + (k % 2) * .08, pz - .1, pz + .1, [170, 96, 64]); }
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
// cyclists live in vehicles2.js
function drawFurn(S, f) {
  switch (f.k) {
    case 'lamp': drawLamp(f); break;
    case 'tree': drawTree(f); break;
    case 'rack': {
      for (const k of [-1, 0, 1]) { const zz = f.z + k * .9; box(f.x - .025, f.x + .025, 0, .85, zz - .38, zz - .34, [176, 178, 182]); box(f.x - .025, f.x + .025, 0, .85, zz + .34, zz + .38, [176, 178, 182]); box(f.x - .025, f.x + .025, .82, .88, zz - .38, zz + .38, [176, 178, 182]); }
      if (f.bike) { box(f.x - .03, f.x + .03, .0, .68, f.z - .85, f.z - .79, [20, 20, 24]); box(f.x - .03, f.x + .03, .0, .68, f.z - .1, f.z - .04, [20, 20, 24]); box(f.x - .025, f.x + .025, .62, .7, f.z - .85, f.z - .04, [150, 30, 30]); box(f.x - .025, f.x + .025, .7, .95, f.z - .55, f.z - .5, [150, 30, 30]); box(f.x - .05, f.x + .05, .95, .99, f.z - .6, f.z - .42, [16, 16, 18]); box(f.x - .16, f.x + .16, .98, 1.02, f.z - .1, f.z - .05, [16, 16, 18]); }
      break;
    }
    case 'aboard': { const b = box(f.x - .3, f.x + .3, 0, .9, f.z - .03, f.z + .03, [28, 30, 34]); if (b && (b.fxs || b.fzs)) { const dm = b.dm; for (let k = 0; k < 4; k++) if (b.fxs) fr('x', b.fxs < 0 ? f.x - .3 : f.x + .3, f.z - .22, f.z + .22 - k * .05, .62 - k * .12, .66 - k * .12, shade([220, 220, 216], dm, .9)); if (b.fzs) for (let k = 0; k < 4; k++) fr('z', b.fzs < 0 ? f.z - .03 : f.z + .03, f.x - .22, f.x + .22 - k * .05, .62 - k * .12, .66 - k * .12, shade([220, 220, 216], dm, .9)); } break; }
    case 'cafe': {
      const par = f.par || [200, 60, 50];
      box(f.x - .02, f.x + .02, 0, 2.3, f.z - .02, f.z + .02, [60, 60, 64]);
      box(f.x - .3, f.x + .3, .7, .74, f.z - .3, f.z + .3, [40, 44, 48]); box(f.x - .02, f.x + .02, 0, .7, f.z - .02, f.z + .02, [50, 52, 56]);
      for (const sd of [-1, 1]) { box(f.x + sd * .55 - .2, f.x + sd * .55 + .2, .42, .46, f.z - .2, f.z + .2, [70, 50, 34]); box(f.x + sd * (sd > 0 ? .72 : .38) - .2 * 0 - .02, f.x + sd * (sd > 0 ? .72 : .38) + .02, .46, .85, f.z - .18, f.z + .18, [70, 50, 34]); }
      const pts = []; for (let k = 0; k < 8; k++) { const an = k / 8 * TAU; pts.push(f.x + Math.cos(an) * 1.25, 2.28, f.z + Math.sin(an) * 1.25); } toCam(f.x, f.z); poly(shade(par, Math.max(_rz, 1), 1), pts);
      const pt2 = []; for (let k = 0; k < 8; k++) { const an = k / 8 * TAU; pt2.push(f.x + Math.cos(an) * .5, 2.42, f.z + Math.sin(an) * .5); } poly(shade(mulc(par, 1.15), Math.max(_rz, 1), 1), pt2);
      break;
    }
    case 'cabinet': { const b = box(f.x - .6, f.x + .6, 0, 1.3, f.z - .22, f.z + .22, [44, 92, 62]); if (b && b.fzs) { const pl = b.fzs < 0 ? f.z - .22 : f.z + .22; fr('z', pl, f.x - .02, f.x + .02, .05, 1.25, shade([20, 44, 30], b.dm)); fr('z', pl, f.x - .5, f.x - .35, .95, 1.05, shade([220, 220, 216], b.dm, .8)); } break; }
    case 'meter': { box(f.x - .03, f.x + .03, 0, 1.2, f.z - .03, f.z + .03, [50, 54, 58]); const b = box(f.x - .16, f.x + .16, 1.1, 1.62, f.z - .1, f.z + .1, [26, 36, 60]); if (b && b.fzs) fr('z', b.fzs < 0 ? f.z - .1 : f.z + .1, f.x - .1, f.x + .1, 1.36, 1.5, emit([140, 240, 220], b.dm, .3 + .6 * env.night)); break; }
    case 'speed': { box(f.x - .03, f.x + .03, 0, 2.5, f.z - .03, f.z + .03, [110, 112, 116]); const p = Pw(f.x, 2.55, f.z); if (p) { const rr = Math.max(2, F / p[2] * .32); ctx.fillStyle = shade([232, 232, 232], p[2]); ctx.beginPath(); ctx.arc(p[0], p[1], rr, 0, TAU); ctx.fill(); ctx.strokeStyle = shade([200, 30, 30], p[2]); ctx.lineWidth = Math.max(1, rr * .22); ctx.stroke(); if (rr > 6) { ctx.fillStyle = shade([20, 20, 20], p[2]); ctx.font = '700 ' + Math.round(rr * 1.05) + 'px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('20', p[0], p[1] + 1); } } break; }
    case 'cones': {
      for (let k = 0; k < 4; k++) { const zz = f.z - 3 + k * 2; box(f.x - .16, f.x + .16, 0, .05, zz - .16, zz + .16, [30, 30, 30]); const b = box(f.x - .11, f.x + .11, .05, .72, zz - .11, zz + .11, [255, 112, 22]); if (b && b.fzs) fr('z', b.fzs < 0 ? zz - .11 : zz + .11, f.x - .09, f.x + .09, .4, .5, shade([240, 240, 240], b.dm)); }
      box(f.x - .03, f.x + .03, .0, 1.0, f.z + 3.4, f.z + 3.46, [90, 90, 92]); box(f.x - .03, f.x + .03, .0, 1.0, f.z + 5.4, f.z + 5.46, [90, 90, 92]);
      for (let k = 0; k < 6; k++) box(f.x - .025, f.x + .025, .75, .95, f.z + 3.4 + k * .34, f.z + 3.74 + k * .34 - .02, k % 2 ? [230, 30, 30] : [240, 240, 240]);
      const lp = Pw(f.x, 1.05, f.z + 3.43); if (lp) { const on = Math.floor(world.time * 2) % 2 === 0; ctx.fillStyle = on ? emit([255, 180, 40], lp[2], 1) : shade([90, 70, 20], lp[2]); ctx.fillRect(lp[0] - 2, lp[1] - 2, 4 * Math.max(1, F / lp[2] * .05), 4 * Math.max(1, F / lp[2] * .05)); if (on) glow(lp[0], lp[1], Math.max(6, F / lp[2] * 1.1), [255, 170, 40], .9 * (.4 + env.night)); }
      break;
    }
    case 'belisha': {
      for (let k = 0; k < 6; k++) box(f.x - .045, f.x + .045, k * .4, (k + 1) * .4, f.z - .045, f.z + .045, k % 2 ? [20, 20, 22] : [236, 236, 232]);
      const p = Pw(f.x, 2.62, f.z); if (p) { const rr = Math.max(2, F / p[2] * .22), on = env.night > .3 ? (Math.floor(world.time * 1.6) % 2 === 0) : true; ctx.fillStyle = on ? emit([255, 150, 20], p[2], 1) : shade([120, 70, 10], p[2]); ctx.beginPath(); ctx.arc(p[0], p[1], rr, 0, TAU); ctx.fill(); if (on) glow(p[0], p[1], rr * 3, [255, 160, 40], .5 * (.3 + env.night)); }
      break;
    }
    case 'rail': {
      const n = Math.floor(f.len / 1.6);
      for (let k = 0; k <= n; k++) box(f.x - .025, f.x + .025, 0, 1.05, f.z + k * 1.6 - .025, f.z + k * 1.6 + .025, [30, 34, 38]);
      box(f.x - .02, f.x + .02, .95, .99, f.z, f.z + n * 1.6, [30, 34, 38]); box(f.x - .02, f.x + .02, .45, .49, f.z, f.z + n * 1.6, [30, 34, 38]);
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
// ---------- ground ----------
let LIGHT = null;   // indoor lighting override used by the tunnel scenes
const ambRGB = () => LIGHT ? LIGHT.amb : [env.amb * env.tint[0], env.amb * env.tint[1], env.amb * env.tint[2]];
const fogNow = z => LIGHT ? LIGHT.fog(z) : fogAmt(z);
const fogColNow = () => LIGHT ? LIGHT.fogC : env.fogC;
// Fill a ground polygon (local coords, constant height) with a tiling texture mapped in perspective, band by band.
function texGround(a, kind, maxRz) {
  const m = clipProject(a); if (m < 3) return;
  const yg = a[1], hh = cam.h - yg; if (hh <= 0) return;
  let ymin = 1e9, ymax = -1e9;
  const xs = [], ys = [];
  for (let i = 0; i < m; i++) { xs.push(ox_[i]); ys.push(oy_[i]); if (oy_[i] < ymin) ymin = oy_[i]; if (oy_[i] > ymax) ymax = oy_[i]; }
  const yFar = HZ + hh * F / (maxRz || 60);
  ymin = Math.max(ymin, yFar, HZ + 1); ymax = Math.min(ymax, SH); if (ymax <= ymin) return;
  ctx.save(); ctx.beginPath(); ctx.moveTo(xs[0], ys[0]); for (let i = 1; i < m; i++) ctx.lineTo(xs[i], ys[i]); ctx.closePath(); ctx.clip();
  const fa = FR.a, fb = FR.b, fc = FR.c, fd = FR.d, ftx = FR.tx, ftz = FR.tz, cs = cam.cs, sn = cam.sn;
  const toLocal = (sx, rz) => { const rx = (sx - CXs - cam.yawPx) * rz / F, dx = rx * cs + rz * sn, dz = -rx * sn + rz * cs, X = cam.x + dx - ftx, Z = cam.z + dz - ftz; return [fa * X + fc * Z, fb * X + fd * Z]; };
  const step = 2;
  for (let y = ymin; y < ymax; y += step) {
    const yc = y + step / 2, rz = hh * F / (yc - HZ);
    const L0 = toLocal(0, rz), L1 = toLocal(SW, rz), ex = L1[0] - L0[0], ez = L1[1] - L0[1], L = Math.hypot(ex, ez) || 1e-6, dx = ex / L, dz = ez / L, nx = -dz, nz = dx;
    const cxm = (L0[0] + L1[0]) / 2, czm = (L0[1] + L1[1]) / 2;
    toCam(cxm + nx * .5, czm + nz * .5); if (_rz < NEAR) continue; const dY = (HZ + hh * F / _rz - yc) / .5;
    const tpp = (L / SW) * ((GPAT[kind] && GPAT[kind].ppm) || 64), lv = clamp(Math.floor(Math.log2(Math.max(tpp, 1)) + .3), 0, 3);
    const gp = groundPattern(kind, lv), k = SW / L, ppm = gp.ppm;
    gp.pat.setTransform(new DOMMatrix([k * dx / ppm, dY * nx / ppm, k * dz / ppm, dY * nz / ppm, -k * (dx * L0[0] + dz * L0[1]), yc - dY * (nx * L0[0] + nz * L0[1])]));
    ctx.fillStyle = gp.pat; ctx.fillRect(0, y, SW, step + .6);
  }
  // ambient light, then distance fog, only over the textured part
  const A3 = ambRGB(), ac = 'rgb(' + (clamp(A3[0], 0, 1) * 255 | 0) + ',' + (clamp(A3[1], 0, 1) * 255 | 0) + ',' + (clamp(A3[2], 0, 1) * 255 | 0) + ')';
  if (A3[0] < .985) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = ac; ctx.fillRect(0, ymin, SW, ymax - ymin); ctx.globalCompositeOperation = 'source-over'; }
  const gf = ctx.createLinearGradient(0, ymin, 0, ymax), span = Math.max(1, ymax - ymin);
  for (const z of [(maxRz || 60), 40, 25, 15, 8, 4, 2]) { const yy = HZ + hh * F / z; const t = (yy - ymin) / span; if (t >= 0 && t <= 1) gf.addColorStop(t, rgba(fogColNow(), fogNow(z))); }
  gf.addColorStop(0, rgba(fogColNow(), fogNow(maxRz || 60))); gf.addColorStop(1, rgba(fogColNow(), fogNow(2)));
  ctx.fillStyle = gf; ctx.fillRect(0, ymin, SW, ymax - ymin);
  ctx.restore();
}

function drawGround(S, cull) {
  const hw = S.halfW, pav = S.pav, zc = camL.z, zlo = Math.max(-14, zc - 60), zhi = Math.min(cull, zc + FARZ + 20);
  const pc = groundGrad([148, 146, 140]), rc = groundGrad([62, 63, 68]), kc = groundGrad([180, 178, 172]);
  const zp0 = Math.max(10, zlo);
  for (const sd of [-1, 1]) { strip(sd * hw, sd * (hw + pav), .12, pc, zp0, zhi); strip(sd < 0 ? -hw - .18 : hw, sd < 0 ? -hw : hw + .18, .125, kc, zp0, zhi); }
  strip(-hw, hw, 0, rc, zlo, zhi);
  texGround([-hw, 0, zlo, hw, 0, zlo, hw, 0, zhi, -hw, 0, zhi], 'asphalt', 58);
  for (const sd of [-1, 1]) texGround([sd * hw, .12, zp0, sd * (hw + pav), .12, zp0, sd * (hw + pav), .12, zhi, sd * hw, .12, zhi], 'slabs', 52);
  // kerb face, gutter and tyre wear
  for (const sd of [-1, 1]) {
    poly(shade([176, 174, 168], 12, .92), [sd * hw, 0, zp0, sd * hw, .12, zp0, sd * hw, .12, zhi, sd * hw, 0, zhi]);
    strip(sd * (hw - .55), sd * hw, .004, 'rgba(10,10,12,.22)', zp0, zhi);
  }
  for (const lx of [laneX(S), -laneX(S)]) for (const o of [-.72, .72]) strip(lx + o - .17, lx + o + .17, .003, 'rgba(12,12,14,.11)', zlo, Math.min(zhi, S.len - 6));
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
  // drains, manholes, box-junction hatching, autumn leaves and puddles
  for (const dr of S.drains) { if (dr.z < zc - 5 || dr.z > zc + 60) continue; toCam(dr.x, dr.z); const dm = Math.max(_rz, 1); poly(shade([26, 26, 30], dm), [dr.x - .25, .006, dr.z - .4, dr.x + .25, .006, dr.z - .4, dr.x + .25, .006, dr.z + .4, dr.x - .25, .006, dr.z + .4]); for (let k = -1; k <= 1; k++) poly(shade([80, 82, 86], dm), [dr.x - .22, .008, dr.z + k * .2 - .02, dr.x + .22, .008, dr.z + k * .2 - .02, dr.x + .22, .008, dr.z + k * .2 + .02, dr.x - .22, .008, dr.z + k * .2 + .02]); }
  for (const mh of S.manholes) {
    if (mh.z < zc - 5 || mh.z > zc + 70) continue; toCam(mh.x, mh.z); const dm = Math.max(_rz, 1), pts = [], pts2 = [];
    for (let k = 0; k < 10; k++) { const an = k / 10 * TAU; pts.push(mh.x + Math.cos(an) * .36, .006, mh.z + Math.sin(an) * .36); pts2.push(mh.x + Math.cos(an) * .3, .007, mh.z + Math.sin(an) * .3); }
    poly(shade([44, 46, 50], dm), pts); poly(shade([70, 72, 76], dm), pts2);
    for (let k = -2; k <= 2; k++) poly(shade([40, 42, 46], dm), [mh.x - .28, .008, mh.z + k * .1 - .012, mh.x + .28, .008, mh.z + k * .1 - .012, mh.x + .28, .008, mh.z + k * .1 + .012, mh.x - .28, .008, mh.z + k * .1 + .012]);
  }
  if (S.signal) { // yellow box junction
    const b0 = S.len - 3, b1 = S.len + 11, yel = shade([214, 182, 40], Math.max(1, Math.abs(b0 - zc)), .95);
    for (let t = -2 * hw * .6; t < b1 - b0; t += 1.3) {
      const xs = -hw + Math.max(0, -t / .6), xe = -hw + Math.min(2 * hw, (b1 - b0 - t) / .6); if (xe <= xs) continue;
      const za = b0 + t + .6 * (xs + hw), zb = b0 + t + .6 * (xe + hw);
      if (Math.max(za, zb) < zc - 3 || Math.min(za, zb) > zc + 70) continue;
      poly(yel, [xs, .007, za - .06, xe, .007, zb - .06, xe, .007, zb + .06, xs, .007, za + .06]);
    }
    strip(-hw, hw, .007, yel, b0, b0 + .12); strip(-hw, hw, .007, yel, b1 - .12, b1);
  }
  if (S.leaves) for (const lf of S.leaves) { if (lf.z < zc - 4 || lf.z > zc + 34) continue; const cl = lf.c, sz = lf.s, ca = Math.cos(lf.a) * sz, sa = Math.sin(lf.a) * sz; toCam(lf.x, lf.z); poly(shade(cl, Math.max(_rz, 1), .9), [lf.x - ca, lf.y, lf.z - sa, lf.x - sa * .5, lf.y, lf.z + ca * .5, lf.x + ca, lf.y, lf.z + sa, lf.x + sa * .5, lf.y, lf.z - ca * .5]); }
  if (env.wet > .3 && S.puddles) for (const pd of S.puddles) {
    if (pd.z < zc - 4 || pd.z > zc + 55) continue; const pts = []; toCam(pd.x, pd.z); const dm = Math.max(_rz, 1);
    for (let k = 0; k < 12; k++) { const an = k / 12 * TAU; pts.push(pd.x + Math.cos(an) * pd.rx, pd.y + .003, pd.z + Math.sin(an) * pd.rz); }
    poly(rgba(mixc(env.skyBot, [70, 76, 90], .35), .5 * Math.min(1, env.wet) * (1 - fogAmt(dm))), pts);
    if (env.rain > .2) { const rp = ((world.time * .8 + pd.x * 3) % 1); const pp = []; for (let k = 0; k < 12; k++) { const an = k / 12 * TAU; pp.push(pd.x + Math.cos(an) * pd.rx * rp, pd.y + .004, pd.z + Math.sin(an) * pd.rz * rp); } poly('rgba(255,255,255,' + (0.10 * (1 - rp)).toFixed(3) + ')', pp); }
  }
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
// build facade textures nearest-first so buildings never show up flat (and warm the next street before a turn)
function texWarm(list) {
  const t0 = performance.now(), cand = [];
  for (const it of list) {
    setFrame(it.fr);
    for (const arr of [it.S.L, it.S.Rt]) for (const l of arr) {
      if (l.tex) continue; toCam(l.x, (l.z0 + l.z1) / 2);
      if (_rz < -40 || _rz > 260) continue; cand.push({ d: Math.abs(_rz), S: it.S, l });
    }
  }
  if (!cand.length) return;
  cand.sort((a, b) => a.d - b.d);
  const budget = cand[0].d < 60 ? 9 : 3;
  for (const c of cand) { if (performance.now() - t0 > budget) break; c.l.tex = buildLotTex(c.S, c.l); }
}
// does segment (ax,az)-(bx,bz) cross or end inside the convex quad q = [x0,z0,..,x3,z3]?
function segHitsQuad(ax, az, bx, bz, q) {
  if (Math.max(ax, bx) < Math.min(q[0], q[2], q[4], q[6]) || Math.min(ax, bx) > Math.max(q[0], q[2], q[4], q[6])) return false;
  if (Math.max(az, bz) < Math.min(q[1], q[3], q[5], q[7]) || Math.min(az, bz) > Math.max(q[1], q[3], q[5], q[7])) return false;
  const cr = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  let inside = true, s0 = 0;
  for (let k = 0; k < 4; k++) {
    const cx = q[2 * k], cz = q[2 * k + 1], dx = q[(2 * k + 2) % 8], dz = q[(2 * k + 3) % 8];
    const d1 = cr(ax, az, bx, bz, cx, cz), d2 = cr(ax, az, bx, bz, dx, dz), d3 = cr(cx, cz, dx, dz, ax, az), d4 = cr(cx, cz, dx, dz, bx, bz);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    const s = Math.sign(d4); if (s) { if (!s0) s0 = s; else if (s !== s0) inside = false; }
  }
  return inside;
}
function renderStreet(dt) {
  const S0 = world.street; if (!S0) return;
  texBudgetReset(); setFrame(IDENT);
  drawSky(); drawSkyline(S0);
  ctx.fillStyle = shade([70, 70, 74], FARZ); ctx.fillRect(0, HZ, SW, SH - HZ);
  const list = streetList();
  texWarm(world.next ? list.concat([{ S: world.next.S1, fr: world.next.fr }]) : list);
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
  // world-space footprint of each block (facade line back 9 m, as the end walls are drawn) for occlusion tests
  for (const o of lots) {
    const l = o.l, sg = l.x < 0 ? -1 : 1, f = o.fr, q = o.q = new Float64Array(8);
    const lx = [l.x, l.x + sg * 9, l.x + sg * 9, l.x], lz = [l.z0, l.z0, l.z1, l.z1];
    let mn = 1e9;
    for (let k = 0; k < 4; k++) { const X = f.a * lx[k] + f.b * lz[k] + f.tx, Z = f.c * lx[k] + f.d * lz[k] + f.tz; q[2 * k] = X; q[2 * k + 1] = Z; const rz = (X - cam.x) * cam.sn + (Z - cam.z) * cam.cs; if (rz < mn) mn = rz; }
    o.near = mn; o.bucket = null;
  }
  const items = [];
  // pts: extra sample points (street-local) spanning the object, so partly hidden vehicles get tested at both ends
  const add = (it, x, z, f, pad, pts) => {
    setFrame(it.fr); toCam(x, z); if (!(_rz > NEAR - (pad || 4) && _rz < FARZ + 5)) return;
    const fr = it.fr, w = [];
    const pw = (px, pz) => w.push(fr.a * px + fr.b * pz + fr.tx, fr.c * px + fr.d * pz + fr.tz);
    pw(x, z); if (pts) for (let k = 0; k < pts.length; k += 2) pw(pts[k], pts[k + 1]);
    items.push({ d: _rz, fr, f, w });
  };
  const vpts = v => v.axis === 'x' ? [v.x - v.len / 2, v.z, v.x + v.len / 2, v.z] : [v.x, v.z - v.len / 2, v.x, v.z + v.len / 2];
  for (const it of list) {
    const S = it.S;
    for (const f of S.furn) if (f.z < it.cull) add(it, f.x, f.z, () => drawFurn(S, f), 2);
    for (const c of S.parked) if (c.z < it.cull) add(it, c.x, c.z, () => drawVeh({ axis: 'z', x: c.x, z: c.z, len: c.len, w: c.w, h: c.h, type: c.type, col: c.col, dir: c.side < 0 ? 1 : -1, brake: false }), 6, [c.x, c.z - c.len / 2, c.x, c.z + c.len / 2]);
    for (const v of S.veh) if (v.z < it.cull) add(it, v.x, v.z, () => drawVeh(v), 6, vpts(v));
    for (const v of S.cross) add(it, v.x, v.z, () => drawVeh(v), 6, vpts(v));
    for (const p of S.peds) if (p.z < it.cull) add(it, p.x, p.z, () => drawPed(p), 1);
    if (S.signal) add(it, -S.halfW, S.stopZ + .5, () => drawSignal(S), 3);
  }
  if (!scene.rideActive && !world.turn) add(list[0], R.x, R.z, () => drawScooter(R.x, R.z), 3);
  items.sort((p, q) => q.d - p.d);
  // Anything whose line of sight crosses a block's footprint is painted just before the farthest such block,
  // so the building covers it (cross traffic at junctions, the other street during a corner swing).
  const late = [];
  for (const it of items) {
    let hit = -1;
    for (let i = 0; i < lots.length && hit < 0; i++) {
      const o = lots[i]; if (o.near >= it.d) continue;
      for (let k = 0; k < it.w.length; k += 2) if (segHitsQuad(cam.x, cam.z, it.w[k], it.w[k + 1], o.q)) { hit = i; break; }
    }
    if (hit < 0) late.push(it); else (lots[hit].bucket || (lots[hit].bucket = [])).push(it);
  }
  for (const o of lots) {
    if (o.bucket) for (const it of o.bucket) { setFrame(it.fr); it.f(); }
    setFrame(o.fr); drawLot(o.S, o.l, Math.max(o.d - (o.l.z1 - o.l.z0) / 2, 1));
  }
  for (const it of late) { setFrame(it.fr); it.f(); }
  setFrame(IDENT);
  if (env.night > .45) { ctx.fillStyle = 'rgba(6,8,20,' + ((env.night - .45) * .3).toFixed(2) + ')'; ctx.fillRect(0, 0, SW, SH); }
}
