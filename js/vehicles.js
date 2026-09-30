'use strict';
// Painted vehicle views (rear / front / side) drawn as perspective-sliced textures, plus realistic street lamps.
const VT = {};
const VPPM = { car: 100, cab: 100, van: 90, bus: 60 };
const VDIM = { car: [1.8, 4.3, 1.45], cab: [1.9, 4.6, 1.75], van: [2.0, 5.3, 2.4], bus: [2.55, 10.8, 4.3] };

function smoothClosed(g, pts, X, Y) {
  const n = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[0], pts[1]);
  g.beginPath(); g.moveTo(X(m0[0]), Y(m0[1]));
  for (let i = 1; i <= n; i++) { const p = pts[i % n], m = mid(p, pts[(i + 1) % n]); g.quadraticCurveTo(X(p[0]), Y(p[1]), X(m[0]), Y(m[1])); }
  g.closePath();
}
function bodyGradient(g, y0, y1, col) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, rgb(mulc(col, 1.22))); gr.addColorStop(.35, rgb(col)); gr.addColorStop(1, rgb(mulc(col, .55)));
  return gr;
}
function glassGradient(g, y0, y1) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, '#b3c9dc'); gr.addColorStop(.45, '#4c5f74'); gr.addColorStop(1, '#1b222c');
  return gr;
}
function paintWheel(g, cx, cy, r) {
  g.fillStyle = '#0d0d0f'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
  g.fillStyle = '#1f2023'; g.beginPath(); g.arc(cx, cy, r * .86, 0, TAU); g.fill();
  const rg = g.createRadialGradient(cx - r * .1, cy - r * .1, r * .05, cx, cy, r * .62); rg.addColorStop(0, '#e6e8ea'); rg.addColorStop(1, '#7c8086');
  g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, r * .6, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(30,30,34,.85)'; g.lineWidth = Math.max(1, r * .07);
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + .3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * .58, cy + Math.sin(a) * r * .58); g.stroke(); }
  g.fillStyle = '#4b4e54'; g.beginPath(); g.arc(cx, cy, r * .13, 0, TAU); g.fill();
}
function sheen(g, W, H, y0, y1) {
  const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, 'rgba(255,255,255,.28)'); gr.addColorStop(.25, 'rgba(255,255,255,.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, y0, W, y1 - y0);
}

// ---- silhouettes used for side views
const PROFILE = {
  car0: [[.10, .30], [.03, .42], [.02, .80], [.10, .93], [.55, .98], [.95, 1.30], [1.25, 1.42], [2.30, 1.44], [2.75, 1.30], [3.10, 1.0], [3.25, .95], [4.05, .86], [4.24, .74], [4.26, .50], [4.16, .30]],
  car1: [[.10, .30], [.03, .42], [.02, .88], [.30, .98], [.95, 1.02], [1.35, 1.36], [1.55, 1.44], [2.45, 1.44], [2.85, 1.30], [3.15, 1.0], [3.30, .95], [4.10, .86], [4.24, .74], [4.26, .50], [4.16, .30]],
  car2: [[.10, .32], [.02, .48], [.02, 1.0], [.10, 1.20], [.35, 1.45], [1.0, 1.47], [2.6, 1.47], [2.95, 1.36], [3.3, 1.02], [3.45, .98], [4.10, .92], [4.26, .78], [4.26, .52], [4.16, .32]],
  cab: [[.12, .30], [.02, .45], [.02, 1.1], [.10, 1.62], [.5, 1.74], [2.65, 1.74], [3.15, 1.58], [3.62, 1.05], [4.35, .95], [4.55, .80], [4.55, .50], [4.45, .30]],
  van: [[.10, .30], [0, .42], [0, 2.28], [.12, 2.40], [3.7, 2.40], [4.35, 1.62], [4.85, 1.25], [5.22, 1.0], [5.28, .52], [5.18, .30]],
};
const PGLASS = {
  car0: [[.80, 1.03], [1.10, 1.35], [2.28, 1.38], [2.70, 1.27], [3.02, 1.03]],
  car1: [[.98, 1.07], [1.40, 1.36], [2.42, 1.38], [2.80, 1.26], [3.10, 1.07]],
  car2: [[.35, 1.10], [.45, 1.42], [2.6, 1.42], [2.9, 1.32], [3.2, 1.06], [.4, 1.06]],
  cab: [[.16, 1.10], [.22, 1.62], [2.5, 1.64], [2.55, 1.10]],
  van: [[3.98, 1.40], [3.98, 2.08], [4.38, 1.78], [4.72, 1.40]],
};

function paintSide(T, col, style, lit) {
  const ppm = VPPM[T], d = VDIM[T], W = Math.round(d[1] * ppm), H = Math.round(d[2] * ppm) + 6;
  const c = C2(W, H), g = c.getContext('2d'), X = m => m * ppm, Y = m => H - 3 - m * ppm;
  if (T === 'bus') return paintBusSide(c, g, col, lit, ppm, W, H, X, Y);
  const key = T === 'car' ? 'car' + style : T, pr = PROFILE[key];
  // shadow under the vehicle
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(X(.15), Y(.12), X(d[1] - .3), X(.12));
  smoothClosed(g, pr, X, Y); g.fillStyle = bodyGradient(g, Y(d[2]), Y(.3), col); g.fill();
  g.save(); smoothClosed(g, pr, X, Y); g.clip();
  sheen(g, W, H, Y(d[2]), Y(.3));
  // lower sill / bumper shading
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, Y(.42), W, X(.14));
  g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, Y(.98), W, 2); // shoulder highlight
  // glass
  const gl = PGLASS[key]; smoothClosed(g, gl, X, Y); g.fillStyle = glassGradient(g, Y(d[2]), Y(.95)); g.fill();
  g.strokeStyle = rgb(mulc(col, .45)); g.lineWidth = 2; g.stroke();
  g.fillStyle = rgb(mulc(col, .5));
  if (T === 'car') g.fillRect(X(style === 2 ? 1.6 : 1.72), Y(1.4), X(.1), X(.46));
  if (T === 'cab') { g.fillRect(X(2.55), Y(1.65), X(.22), X(.62)); }
  if (T === 'van') { g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.strokeRect(X(1.4), Y(2.2), X(1.95), X(1.4)); g.beginPath(); g.moveTo(X(3.4), Y(2.3)); g.lineTo(X(3.4), Y(.5)); g.stroke(); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(X(3.28), Y(1.25), X(.1), X(.06)); }
  // door lines + handles
  if (T !== 'van') {
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5;
    const dl = T === 'cab' ? [.9, 2.5, 3.4] : [1.15, 1.78, 2.6];
    for (const x of dl) { g.beginPath(); g.moveTo(X(x), Y(.95)); g.lineTo(X(x), Y(.36)); g.stroke(); }
    g.fillStyle = 'rgba(210,214,220,.8)'; for (const x of (T === 'cab' ? [1.7, 2.9] : [1.55, 2.35])) g.fillRect(X(x), Y(.86), X(.14), X(.03));
  }
  // lights
  g.fillStyle = '#d33'; g.fillRect(X(.01), Y(.82), X(.06), X(.14));
  g.fillStyle = '#f2f4e8'; g.fillRect(X(d[1] - .1), Y(.84), X(.09), X(.12));
  g.fillStyle = 'rgba(240,240,240,.7)'; g.fillRect(X(d[1] - .16), Y(.42), X(.14), X(.05));
  g.restore();
  // wheel arches + wheels
  const wx = T === 'van' ? [.95, 4.15] : T === 'cab' ? [.95, 3.75] : [.85, 3.4], wr = T === 'van' ? .36 : .33;
  for (const x of wx) { g.fillStyle = '#0a0a0c'; g.beginPath(); g.arc(X(x), Y(wr - .02), X(wr + .06), Math.PI, 0); g.lineTo(X(x + wr + .06), Y(.2)); g.lineTo(X(x - wr - .06), Y(.2)); g.fill(); paintWheel(g, X(x), Y(wr - .02), X(wr)); }
  // mirror
  if (T !== 'van') { g.fillStyle = rgb(mulc(col, .7)); g.fillRect(X(T === 'cab' ? 2.95 : 2.98), Y(1.08), X(.16), X(.1)); }
  return c;
}
function paintBusSide(c, g, col, lit, ppm, W, H, X, Y) {
  const L = 10.8, Hh = 4.3;
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(X(.2), Y(.12), X(L - .4), X(.14));
  g.fillStyle = bodyGradient(g, Y(Hh), Y(.4), col); g.beginPath(); g.moveTo(X(.05), Y(.45)); g.lineTo(X(.05), Y(Hh - .2)); g.quadraticCurveTo(X(.05), Y(Hh), X(.3), Y(Hh)); g.lineTo(X(L - .5), Y(Hh)); g.quadraticCurveTo(X(L - .05), Y(Hh), X(L - .05), Y(Hh - .4)); g.lineTo(X(L - .05), Y(.45)); g.closePath(); g.fill();
  sheen(g, W, H, Y(Hh), Y(.4));
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(X(.05), Y(.62), X(L - .1), X(.2));
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(X(.05), Y(2.42), X(L - .1), 2); g.fillRect(X(.05), Y(.95), X(L - .1), 2);
  // window rows
  const win = lit ? '#ffe0a0' : null;
  for (const row of [[2.72, 3.72], [1.32, 2.28]]) {
    g.fillStyle = '#12151a'; g.fillRect(X(.25), Y(row[1] + .06), X(L - .5), X(row[1] - row[0] + .12));
    for (let x = .35; x < L - 1.3; x += 1.12) {
      if (row[0] < 2 && x > 8.9) continue;
      const gr = g.createLinearGradient(0, Y(row[1]), 0, Y(row[0])); if (win) { gr.addColorStop(0, '#ffe8b8'); gr.addColorStop(1, '#e0a850'); } else { gr.addColorStop(0, '#8fa5ba'); gr.addColorStop(.5, '#3b4b5d'); gr.addColorStop(1, '#161c25'); }
      g.fillStyle = gr; g.fillRect(X(x), Y(row[1]), X(1.0), X(row[1] - row[0]));
    }
  }
  // door + ad panel
  g.fillStyle = '#111'; g.fillRect(X(8.95), Y(2.3), X(1.0), X(1.75)); const dg = g.createLinearGradient(0, Y(2.2), 0, Y(.7)); dg.addColorStop(0, win ? '#ffe0a0' : '#7c92a8'); dg.addColorStop(1, win ? '#c88838' : '#1d2630'); g.fillStyle = dg; g.fillRect(X(9.0), Y(2.2), X(.9), X(1.5));
  g.fillStyle = 'rgba(240,240,240,.85)'; g.fillRect(X(2.0), Y(1.2), X(4.6), X(.75)); g.fillStyle = 'rgba(200,40,40,.9)'; g.fillRect(X(2.1), Y(1.14), X(2.1), X(.6)); g.fillStyle = 'rgba(40,80,160,.9)'; g.fillRect(X(4.3), Y(1.14), X(2.2), X(.6));
  g.fillStyle = '#f0f0f0'; g.fillRect(X(9.0), Y(3.98), X(.9), X(.16));
  for (const x of [1.9, 8.5]) { g.fillStyle = '#08080a'; g.beginPath(); g.arc(X(x), Y(.52), X(.6), Math.PI, 0); g.lineTo(X(x + .6), Y(.3)); g.lineTo(X(x - .6), Y(.3)); g.fill(); paintWheel(g, X(x), Y(.5), X(.5)); }
  return c;
}

function paintEnd(T, col, front, style, lit) {
  const ppm = VPPM[T], d = VDIM[T], W = Math.round(d[0] * ppm), H = Math.round(d[2] * ppm) + 6;
  const c = C2(W, H), g = c.getContext('2d'), X = m => m * ppm, Y = m => H - 3 - m * ppm, w = d[0];
  const glass = glassGradient(g, Y(d[2]), Y(.9));
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(X(.08), Y(.1), X(w - .16), X(.1));
  const tyre = (x0, x1) => { g.fillStyle = '#0c0c0e'; g.beginPath(); g.moveTo(X(x0), Y(0)); g.lineTo(X(x0), Y(.42)); g.lineTo(X(x1), Y(.42)); g.lineTo(X(x1), Y(0)); g.fill(); };
  if (T === 'bus') {
    tyre(.1, .48); tyre(w - .48, w - .1);
    g.fillStyle = bodyGradient(g, Y(d[2]), Y(.4), col); smoothClosed(g, [[.05, .5], [.02, 4.1], [.3, 4.3], [w - .3, 4.3], [w - .02, 4.1], [w - .05, .5]], X, Y); g.fill();
    g.save(); smoothClosed(g, [[.05, .5], [.02, 4.1], [.3, 4.3], [w - .3, 4.3], [w - .02, 4.1], [w - .05, .5]], X, Y); g.clip(); sheen(g, W, H, Y(4.3), Y(.4));
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, Y(.62), W, X(.2));
    if (front) {
      g.fillStyle = '#0d0f12'; g.fillRect(X(.25), Y(4.1), X(w - .5), X(.4)); g.fillStyle = lit ? '#ffb43a' : '#8a5a1c'; g.fillRect(X(.35), Y(4.04), X(w - .7), X(.28));
      for (const a of [.25, 1.34]) { g.fillStyle = glass; g.fillRect(X(a), Y(3.55), X(.95 + (a > 1 ? .0 : 0)), X(1.35)); g.fillStyle = glass; g.fillRect(X(a), Y(2.35), X(.95), X(.9)); }
      g.fillStyle = '#0d0f12'; g.fillRect(X(.25), Y(2.28), X(w - .5), X(1.8 * 0 + .06));
      g.fillStyle = glass; g.fillRect(X(.25), Y(2.15), X(w - .5), X(1.05)); g.fillStyle = '#111'; g.fillRect(X(w / 2 - .02), Y(2.15), X(.04), X(1.05));
      g.fillStyle = '#1a1c20'; g.fillRect(X(.6), Y(.98), X(w - 1.2), X(.34));
    } else {
      g.fillStyle = '#0d0f12'; g.fillRect(X(.25), Y(3.7), X(w - .5), X(1.2)); g.fillStyle = glass; g.fillRect(X(.3), Y(3.66), X(w - .6), X(1.12));
      g.fillStyle = '#0d0f12'; g.fillRect(X(.4), Y(2.3), X(w - .8), X(.75)); g.fillStyle = glass; g.fillRect(X(.45), Y(2.26), X(w - .9), X(.67));
      g.fillStyle = '#1a1c20'; for (let i = 0; i < 6; i++) g.fillRect(X(.35), Y(1.4 - i * .1), X(w - .7), X(.05));
    }
    g.restore();
    for (const s of [0, 1]) { const x0 = s ? w - .35 : .12; g.fillStyle = front ? '#d8dcd0' : '#7a1216'; g.fillRect(X(x0), Y(.95), X(.23), X(.3)); }
    g.fillStyle = '#e8d95a'; g.fillRect(X(w / 2 - .25), Y(.45), X(.5), X(.14));
    return c;
  }
  const isVan = T === 'van', isCab = T === 'cab', bt = isVan ? d[2] - .08 : .9, topW = isVan ? w - .08 : isCab ? w - .15 : w - .35;
  tyre(.12, .4); tyre(w - .4, w - .12);
  // lower body
  const lowTop = isVan ? d[2] - .1 : isCab ? 1.05 : .9;
  smoothClosed(g, [[.04, .32], [.0, .5], [.0, lowTop - .1], [.06, lowTop], [w - .06, lowTop], [w, lowTop - .1], [w, .5], [w - .04, .32]], X, Y);
  g.fillStyle = bodyGradient(g, Y(lowTop), Y(.3), col); g.fill();
  if (!isVan) { // cabin
    const roofY = d[2] - (style === 2 ? .0 : .03), inset = isCab ? .1 : .19;
    smoothClosed(g, [[inset - .02, lowTop - .02], [inset + .1, roofY - .12], [inset + .2, roofY], [w - inset - .2, roofY], [w - inset - .1, roofY - .12], [w - inset + .02, lowTop - .02]], X, Y);
    g.fillStyle = bodyGradient(g, Y(roofY), Y(lowTop), col); g.fill();
    const gi = inset + (isCab ? .07 : .13);
    smoothClosed(g, [[gi, lowTop + .04], [gi + .08, roofY - .14], [gi + .16, roofY - .1], [w - gi - .16, roofY - .1], [w - gi - .08, roofY - .14], [w - gi, lowTop + .04]], X, Y);
    g.fillStyle = glass; g.fill();
    g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(X(gi + .1), Y(lowTop + .05)); g.lineTo(X(gi + .55), Y(lowTop + .05)); g.lineTo(X(gi + .9), Y(roofY - .12)); g.lineTo(X(gi + .3), Y(roofY - .12)); g.fill();
    if (front) { g.fillStyle = rgb(mulc(col, .5)); g.fillRect(X(-.02), Y(lowTop + .18), X(.14), X(.1)); g.fillRect(X(w - .12), Y(lowTop + .18), X(.14), X(.1)); }
  } else {
    if (front) { smoothClosed(g, [[.14, 1.2], [.2, 1.95], [.5, 2.15], [w - .5, 2.15], [w - .2, 1.95], [w - .14, 1.2]], X, Y); g.fillStyle = glass; g.fill(); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(X(w / 2 - .02), Y(2.15), X(.04), X(.95)); }
    else { g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(w / 2), Y(2.3)); g.lineTo(X(w / 2), Y(.4)); g.stroke(); g.fillStyle = glass; g.fillRect(X(.25), Y(2.0), X(w / 2 - .32), X(.55)); g.fillRect(X(w / 2 + .07), Y(2.0), X(w / 2 - .32), X(.55)); g.fillStyle = '#25282c'; g.fillRect(X(w / 2 - .12), Y(1.0), X(.08), X(.16)); g.fillRect(X(w / 2 + .04), Y(1.0), X(.08), X(.16)); }
  }
  sheen(g, W, H, Y(d[2]), Y(.3));
  // bumper and valance
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(X(.03), Y(.5), X(w - .06), X(.16));
  g.fillStyle = '#17181b'; g.fillRect(X(.12), Y(.3), X(w - .24), X(.13));
  if (front) {
    const pw = isVan ? .3 : .34; g.fillStyle = '#1b1d22'; g.fillRect(X(w * .3), Y(.5), X(w * .4), X(.2)); g.fillStyle = '#93979e'; g.fillRect(X(w * .3), Y(.6), X(w * .4), X(.03));
    for (const x0 of [.07, w - .07 - w * .2]) { g.fillStyle = '#26282d'; g.fillRect(X(x0), Y(.84), X(w * .2), X(.24)); g.fillStyle = '#e6ecf2'; g.fillRect(X(x0 + .03), Y(.8), X(w * .2 - .06), X(.16)); }
    g.fillStyle = '#e8e6d8'; g.fillRect(X(w / 2 - .22), Y(.46), X(.44), X(.1));
  } else {
    for (const x0 of [.05, w - .05 - w * .21]) { g.fillStyle = '#33090c'; g.fillRect(X(x0), Y(.82), X(w * .21), X(.22)); g.fillStyle = '#7d1418'; g.fillRect(X(x0 + .03), Y(.79), X(w * .21 - .06), X(.16)); }
    g.fillStyle = '#e9dd7a'; g.fillRect(X(w / 2 - .22), Y(.58), X(.44), X(.12)); g.fillStyle = 'rgba(20,20,20,.7)'; for (let i = 0; i < 6; i++) g.fillRect(X(w / 2 - .19 + i * .07), Y(.56), 1.5, X(.08));
    g.fillStyle = '#1a1a1c'; g.fillRect(X(w / 2 - .15), Y(lowTop - .12), X(.3), X(.05));
  }
  return c;
}

function vehTex(T, col, view, style, lit) {
  const key = T + '|' + col.map(v => v | 0).join(',') + '|' + view + '|' + style + '|' + (lit ? 1 : 0);
  return VT[key] || (VT[key] = view === 'side' ? paintSide(T, col, style, lit) : paintEnd(T, col, view === 'front', style, lit));
}
function mipOf(img, lv) {
  img._m = img._m || {}; if (img._m[lv]) return img._m[lv];
  const k = 1 / (1 << lv), c = C2(img.width * k, img.height * k), g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
  return (img._m[lv] = c);
}

// ---- slicing a vertical textured quad, with ambient + fog applied only to opaque pixels
let SCR = null, SCRg = null;
function drawSlicedQuad(img, ax, az, bx, bz, y0, y1, faceK) {
  toCam(ax, az); const cax = _rx, caz = _rz; toCam(bx, bz); const cbx = _rx, cbz = _rz;
  const dz = cbz - caz, dx = cbx - cax;
  if (caz < NEAR && cbz < NEAR) return;
  let tlo = 0, thi = 1; if (caz < NEAR) tlo = (NEAR - caz) / dz; else if (cbz < NEAR) thi = (NEAR - caz) / dz;
  const sxOf = t => CXs + cam.yawPx + F * (cax + t * dx) / (caz + t * dz);
  const xl = sxOf(tlo), xh = sxOf(thi), xmin = Math.min(xl, xh), xmax = Math.max(xl, xh);
  if (xmax < 0 || xmin > SW || xmax - xmin < .4) return;
  const rl = caz + tlo * dz, rh = caz + thi * dz, rmin = Math.min(rl, rh), rmax = Math.max(rl, rh);
  const top = HZ + (cam.h - y1) * F / rmin, bot = HZ + (cam.h - y0) * F / rmin;
  const top2 = HZ + (cam.h - y1) * F / rmax, bot2 = HZ + (cam.h - y0) * F / rmax;
  const bt = Math.max(-4, Math.min(top, top2)) | 0, bb = Math.min(SH + 4, Math.max(bot, bot2)) + 1 | 0;
  const bx0 = Math.max(0, Math.floor(xmin) - 1), bx1 = Math.min(SW, Math.ceil(xmax) + 1);
  if (bb <= bt || bx1 <= bx0) return;
  const wpx = xmax - xmin, dens = img.width / wpx, lv = dens > 6 ? 3 : dens > 3 ? 2 : dens > 1.6 ? 1 : 0;
  const src = lv ? mipOf(img, lv) : img, iw = src.width, ih = src.height;
  if (!SCR || SCR.width < cv.width || SCR.height < cv.height) { SCR = document.createElement('canvas'); SCR.width = cv.width; SCR.height = cv.height; SCRg = SCR.getContext('2d'); }
  const g = SCRg; g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(bx0, bt, bx1 - bx0, bb - bt);
  const step = wpx > 360 ? 3 : wpx > 90 ? 2 : 1;
  const tOf = sx => { const s = (sx - CXs - cam.yawPx) / F; let d = s * dz - dx; if (Math.abs(d) < 1e-9) d = 1e-9; const t = (cax - s * caz) / d; return t < tlo ? tlo : t > thi ? thi : t; };
  const ex = Math.min(SW, Math.ceil(xmax));
  for (let sx = Math.max(0, Math.floor(xmin)); sx < ex; sx += step) {
    const t0 = tOf(sx), t1 = tOf(sx + step), tm = (t0 + t1) / 2, rz = caz + tm * dz; if (rz < NEAR) continue;
    const yT = HZ + (cam.h - y1) * F / rz, yB = HZ + (cam.h - y0) * F / rz;
    let u0 = t0, u1 = t1; if (u0 > u1) { const q = u0; u0 = u1; u1 = q; }
    const sw = Math.max(1, (u1 - u0) * iw);
    g.drawImage(src, Math.min(u0 * iw, iw - sw), 0, sw, ih, sx, yT, step + .5, yB - yT);
  }
  const a = clamp(env.amb * faceK, 0, 1);
  g.globalCompositeOperation = 'source-atop';
  if (a < .98) { g.fillStyle = 'rgba(' + (env.night * 6 | 0) + ',' + (env.night * 10 | 0) + ',' + (env.night * 26 | 0) + ',' + (1 - a).toFixed(3) + ')'; g.fillRect(bx0, bt, bx1 - bx0, bb - bt); }
  const fg = fogAmt(Math.max(1, (rmin + rmax) / 2)); if (fg > .01) { g.fillStyle = rgba(env.fogC, fg); g.fillRect(bx0, bt, bx1 - bx0, bb - bt); }
  ctx.drawImage(SCR, bx0 * DPR, bt * DPR, (bx1 - bx0) * DPR, (bb - bt) * DPR, bx0, bt, bx1 - bx0, bb - bt);
}

// ---- the vehicle itself
function drawVeh(v) {
  if (v.type === 'bike') return drawCyclist(v);
  let x0, x1, z0, z1;
  if (v.axis === 'z') { x0 = v.x - v.w / 2; x1 = v.x + v.w / 2; z0 = v.z - v.len / 2; z1 = v.z + v.len / 2; }
  else { x0 = v.x - v.len / 2; x1 = v.x + v.len / 2; z0 = v.z - v.w / 2; z1 = v.z + v.w / 2; }
  const T = v.type, lowTop = T === 'car' ? .88 : T === 'cab' ? 1.0 : v.h - .05;
  poly('rgba(0,0,0,.30)', [x0 - .12, .01, z0 - .12, x1 + .12, .01, z0 - .12, x1 + .12, .01, z1 + .12, x0 - .12, .01, z1 + .12]);
  // inset hull keeps the volume solid between the painted faces
  const y0 = T === 'bus' ? .45 : .28;
  const body = box(x0 + .04, x1 - .04, y0, lowTop, z0 + .04, z1 - .04, v.col);
  if (!body) return;
  if (T === 'car' || T === 'cab') {
    const glass = mixc(v.col, [22, 30, 42], .78);
    if (v.axis === 'z') box(x0 + .16, x1 - .16, lowTop, v.h - .06, z0 + .9, z1 - .8, glass); else box(x0 + .9, x1 - .8, lowTop, v.h - .06, z0 + .16, z1 - .16, glass);
  }
  const style = T === 'car' ? ((v.col[0] * 3 + v.col[1] + v.col[2]) | 0) % 3 : 0, az = v.axis === 'z', dm = body.dm, lit = T === 'bus' && env.winLit > .35;
  let end = null, side = null;
  if (az) {
    if (body.fzs) end = { axis: 'z', plane: body.fzs < 0 ? z0 : z1, h0: x0, h1: x1, front: body.fzs < 0 ? v.dir === -1 : v.dir === 1 };
    if (body.fxs) side = { axis: 'x', plane: body.fxs < 0 ? x0 : x1, h0: z0, h1: z1 };
  } else {
    if (body.fxs) end = { axis: 'x', plane: body.fxs < 0 ? x0 : x1, h0: z0, h1: z1, front: body.fxs < 0 ? v.dir === -1 : v.dir === 1 };
    if (body.fzs) side = { axis: 'z', plane: body.fzs < 0 ? z0 : z1, h0: x0, h1: x1 };
  }
  if (side) {
    const st = vehTex(T, v.col, 'side', style, lit), fwd = v.dir > 0;
    const ra = fwd ? side.h0 : side.h1, rb = fwd ? side.h1 : side.h0;
    if (side.axis === 'x') drawSlicedQuad(st, side.plane, ra, side.plane, rb, 0, v.h + .02, .78); else drawSlicedQuad(st, ra, side.plane, rb, side.plane, 0, v.h + .02, .78);
  }
  if (end) {
    const et = vehTex(T, v.col, end.front ? 'front' : 'rear', style, lit);
    if (end.axis === 'z') drawSlicedQuad(et, end.h0, end.plane, end.h1, end.plane, 0, v.h + .02, .95); else drawSlicedQuad(et, end.plane, end.h0, end.plane, end.h1, 0, v.h + .02, .95);
    // lit lamps over the painted housings
    const Wd = end.h1 - end.h0;
    if (end.front) {
      const hl = emit([255, 250, 225], dm, .9);
      fr(end.axis, end.plane, end.h0 + Wd * .09, end.h0 + Wd * .25, .64, .78, hl); fr(end.axis, end.plane, end.h1 - Wd * .25, end.h1 - Wd * .09, .64, .78, hl);
      if (env.lamp > .2 || env.rain > .3) for (const xx of [end.h0 + Wd * .17, end.h1 - Wd * .17]) { const p = end.axis === 'z' ? Pw(xx, .7, end.plane) : Pw(end.plane, .7, xx); if (p) glow(p[0], p[1], Math.max(4, F / dm * .6), [255, 244, 210], .6 * Math.max(env.lamp, .4)); }
    } else {
      const br = v.brake ? 1 : .5, tl = emit([255, 40, 34], dm, br);
      fr(end.axis, end.plane, end.h0 + Wd * .07, end.h0 + Wd * .24, .8 * (T === 'bus' ? 1.3 : 1) , .95 * (T === 'bus' ? 1.3 : 1) - (T === 'bus' ? 0 : .05), tl);
      fr(end.axis, end.plane, end.h1 - Wd * .24, end.h1 - Wd * .07, .8 * (T === 'bus' ? 1.3 : 1), .95 * (T === 'bus' ? 1.3 : 1) - (T === 'bus' ? 0 : .05), tl);
      const pa = end.axis === 'z' ? Pw(end.h0 + Wd * .15, .86, end.plane) : Pw(end.plane, .86, end.h0 + Wd * .15), pb = end.axis === 'z' ? Pw(end.h1 - Wd * .15, .86, end.plane) : Pw(end.plane, .86, end.h1 - Wd * .15);
      const ga = (v.brake ? .6 : .2) * (0.4 + env.night + env.rain), rr = Math.max(4, F / dm * .6);
      for (const q of [pa, pb]) if (q) {
        glow(q[0], q[1], rr, [255, 30, 24], ga);
        if (env.wet > .4 && rr <= 14) { const g = ctx.createLinearGradient(0, q[1], 0, q[1] + rr * 5); g.addColorStop(0, 'rgba(255,40,30,' + (.28 * env.wet).toFixed(2) + ')'); g.addColorStop(1, 'rgba(255,40,30,0)'); ctx.fillStyle = g; ctx.fillRect(q[0] - rr * .25, q[1], rr * .5, rr * 5); }
      }
    }
  }
  if (side && T === 'bus' && lit) { /* windows already painted lit */ }
  if (T === 'cab') { const p = Pw(v.x, v.h + .1, v.z); if (p) { const r = F / dm * .3; ctx.fillStyle = emit([255, 210, 90], dm, .95); ctx.fillRect(p[0] - r, p[1] - r * .35, r * 2, r * .5); glow(p[0], p[1], r * 2.2, [255, 210, 90], .35); } }
}

// ---- street lamp: fluted base, tapered pole, swan-neck arm, luminaire with a glowing lens
function drawLamp(f) {
  const x = f.x, z = f.z, s = f.side, dark = [34, 40, 38], mid = [52, 58, 54];
  box(x - .17, x + .17, 0, .16, z - .17, z + .17, dark);
  box(x - .12, x + .12, .16, .9, z - .12, z + .12, dark);
  box(x - .16, x + .16, .9, 1.02, z - .16, z + .16, mid);
  let y = 1.02; const n = 5, top = 5.25;
  for (let i = 0; i < n; i++) { const w0 = .085 - i * .006, y1 = y + (top - 1.02) / n; box(x - w0, x + w0, y, y1, z - w0, z + w0, dark); y = y1; }
  box(x - .11, x + .11, top - .1, top + .04, z - .11, z + .11, mid);
  // curved arm
  const armLen = 1.35; let px0 = x, py0 = top;
  for (let k = 1; k <= 6; k++) {
    const t = k / 6, px1 = x - s * armLen * t, py1 = top + .12 + .5 * (1 - (1 - t) * (1 - t)) * .95;
    box(Math.min(px0, px1) - .01, Math.max(px0, px1) + .01, Math.min(py0, py1) - .035, Math.max(py0, py1) + .035, z - .04, z + .04, dark);
    px0 = px1; py0 = py1;
  }
  const hx = x - s * armLen, hy = py0, lx0 = Math.min(hx, hx - s * .55), lx1 = Math.max(hx, hx - s * .55);
  box(lx0, lx1, hy - .14, hy + .04, z - .16, z + .16, [58, 62, 66]);
  box(lx0 + .03, lx1 - .03, hy + .04, hy + .1, z - .12, z + .12, [70, 74, 78]);
  const on = env.lamp, lens = hy - .145, cx = hx - s * .27;
  if (cam.h < lens) poly(on > .1 ? emit([255, 232, 175], 2, .55 + .45 * on) : shade([150, 158, 160], 10), [lx0 + .04, lens, z - .13, lx1 - .04, lens, z - .13, lx1 - .04, lens, z + .13, lx0 + .04, lens, z + .13]);
  if (on < .05) return;
  const head = Pw(cx, lens, z); if (!head) return; const rz = head[2];
  glow(head[0], head[1], Math.max(8, F / rz * 2.6), [255, 214, 150], on * .8);
  glow(head[0], head[1], Math.max(3, F / rz * .7), [255, 244, 220], on);
  // pool of light on the ground and a faint beam in damp air
  const gp = Pw(cx, 0, z);
  if (gp) {
    const rr = F / gp[2] * 4.2;
    ctx.save(); ctx.translate(gp[0], gp[1]); ctx.scale(1, .28); glow(0, 0, rr, [255, 206, 140], on * (.32 + .3 * env.wet)); ctx.restore();
    const haze = Math.min(1, env.rain * 1.3 + env.fog * 30) * on;
    if (haze > .08) { const g = ctx.createLinearGradient(0, head[1], 0, gp[1]); g.addColorStop(0, 'rgba(255,220,160,' + (.16 * haze).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,220,160,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(head[0] - 3, head[1]); ctx.lineTo(head[0] + 3, head[1]); ctx.lineTo(gp[0] + rr * .55, gp[1]); ctx.lineTo(gp[0] - rr * .55, gp[1]); ctx.fill(); }
  }
}
