'use strict';
// Textured doorstep / lobby / stairwell / corridor scenes. Walls, doors and floors are painted procedurally and
// drawn as perspective-correct textured planes (same machinery as the street facades).

// ---- extra tiling ground textures
function makeGroundTex2(kind) {
  if (kind === 'asphalt' || kind === 'slabs') return makeGroundTex(kind);
  const N = 256, c = C2(N, N), g = c.getContext('2d'), r = new RNG(kind.length * 131 + 7);
  if (kind === 'grass') {
    g.fillStyle = 'rgb(66,104,48)'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 6000; i++) { const v = r.i(-24, 30); g.strokeStyle = 'rgb(' + (66 + v * .6) + ',' + (108 + v) + ',' + (46 + v * .4) + ')'; g.lineWidth = 1; const x = r.n() * N, y = r.n() * N; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r.r(-1.5, 1.5), y - r.r(2, 5)); g.stroke(); }
    for (let i = 0; i < 10; i++) { const x = r.n() * N, y = r.n() * N, rad = r.r(20, 50); for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); gr.addColorStop(0, r.c(.5) ? 'rgba(30,60,20,.14)' : 'rgba(120,150,60,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2); } }
    return { c, ppm: 64 };
  }
  if (kind === 'tiles') {
    const S = 64;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const dk = (i + j) % 2; g.fillStyle = dk ? 'rgb(46,50,58)' : 'rgb(206,204,196)'; g.fillRect(i * S, j * S, S, S); for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(' + (dk ? '120,120,130' : '90,90,84') + ',.10)'; g.fillRect(i * S + r.n() * S, j * S + r.n() * S, 1 + r.n() * 3, 1); } g.fillStyle = 'rgba(255,255,255,' + (dk ? .07 : .25) + ')'; g.fillRect(i * S + 2, j * S + 2, S - 4, 2); }
    g.fillStyle = 'rgba(70,68,64,.8)'; for (let k = 0; k < 4; k++) { g.fillRect(k * S, 0, 1.6, N); g.fillRect(0, k * S, N, 1.6); }
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(60,50,40,.10)'; g.beginPath(); g.ellipse(r.n() * N, r.n() * N, r.r(8, 26), r.r(5, 14), r.n() * 3, 0, TAU); g.fill(); }
    return { c, ppm: N / 1.2 };
  }
  if (kind === 'carpet') {
    g.fillStyle = 'rgb(84,88,102)'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 5200; i++) { const v = r.i(-16, 16); g.fillStyle = 'rgba(' + (96 + v) + ',' + (100 + v) + ',' + (116 + v) + ',.5)'; g.fillRect(r.n() * N, r.n() * N, 1, 2); }
    g.strokeStyle = 'rgba(30,34,50,.16)'; g.lineWidth = 1.5; for (let k = -N; k < N * 2; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + N, N); g.stroke(); g.beginPath(); g.moveTo(k + N, 0); g.lineTo(k, N); g.stroke(); }
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(30,26,20,.09)'; g.beginPath(); g.ellipse(r.n() * N, r.n() * N, r.r(8, 28), r.r(6, 16), r.n() * 3, 0, TAU); g.fill(); }
    return { c, ppm: 64 };
  }
  if (kind === 'wood') {
    const pw = 16;
    for (let i = 0; i < N / pw; i++) { const v = r.i(-22, 22); g.fillStyle = 'rgb(' + (162 + v) + ',' + (116 + v * .8) + ',' + (70 + v * .5) + ')'; g.fillRect(i * pw, 0, pw, N); for (let k = 0; k < 14; k++) { g.strokeStyle = 'rgba(90,56,26,' + r.r(.06, .2).toFixed(2) + ')'; g.lineWidth = 1; const x = i * pw + r.r(1, pw - 1); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + r.r(-1, 1), N); g.stroke(); } g.fillStyle = 'rgba(40,24,10,.55)'; g.fillRect(i * pw, 0, 1.4, N); const j = r.r(20, N - 20); g.fillRect(i * pw, j, pw, 1.4); }
    return { c, ppm: N / 2 };
  }
  // 'stone' (steps / thresholds)
  g.fillStyle = 'rgb(176,172,162)'; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 3800; i++) { const v = r.i(-30, 30); g.fillStyle = 'rgba(' + (176 + v) + ',' + (172 + v) + ',' + (162 + v) + ',.5)'; g.fillRect(r.n() * N, r.n() * N, 1 + r.n() * 2, 1); }
  return { c, ppm: 64 };
}

// ---- painted pieces
function paintHedge(len) {
  const ppm = 60, W = Math.max(8, Math.round(len * ppm)), H = 84, c = C2(W, H), g = c.getContext('2d'), r = new RNG(Math.round(len * 100));
  g.fillStyle = 'rgb(30,62,30)'; g.fillRect(0, 34, W, H - 34);
  for (let i = 0; i < len * 170; i++) { const x = r.n() * W, y = 8 + r.n() * (H - 8), rad = r.r(4, 9), v = r.i(-22, 34); g.fillStyle = 'rgb(' + (46 + v * .5) + ',' + (96 + v) + ',' + (40 + v * .4) + ')'; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); }
  for (let i = 0; i < len * 90; i++) { const x = r.n() * W, y = 6 + r.n() * 20, rad = r.r(3, 7), v = r.i(0, 40); g.fillStyle = 'rgb(' + (60 + v * .5) + ',' + (120 + v) + ',' + (50 + v * .4) + ')'; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); }
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,220,.08)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = gr; g.globalCompositeOperation = 'source-atop'; g.fillRect(0, 0, W, H);
  return c;
}
function paintDoorLeaf(g, X, Y, xc, hb, col, o) {
  o = o || {};
  const dark = mulc(col, .62), light = mulc(col, 1.25);
  g.fillStyle = '#efeeea'; g.fillRect(X(xc - .53), Y(hb + 2.16), X(1.06), X(2.16));               // architrave
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X(xc - .48), Y(hb + 2.1), X(.96), X(2.1));
  const gr = g.createLinearGradient(X(xc - .46), 0, X(xc + .46), 0); gr.addColorStop(0, rgb(mulc(col, 1.08))); gr.addColorStop(.5, rgb(col)); gr.addColorStop(1, rgb(mulc(col, .86)));
  g.fillStyle = gr; g.fillRect(X(xc - .46), Y(hb + 2.06), X(.92), X(2.06));
  const panel = (px, py, pw, ph) => { g.fillStyle = rgb(dark); g.fillRect(X(px), Y(py + ph), X(pw), X(ph)); g.fillStyle = rgb(col); g.fillRect(X(px) + 2, Y(py + ph) + 2, X(pw) - 4, X(ph) - 4); g.fillStyle = rgba(light, .5); g.fillRect(X(px), Y(py + ph), X(pw), 1.6); g.fillRect(X(px), Y(py + ph), 1.6, X(ph)); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X(px), Y(py) - 1.6, X(pw), 1.6); };
  if (o.glassTop) { const gg = g.createLinearGradient(0, Y(hb + 2.0), 0, Y(hb + 1.3)); gg.addColorStop(0, '#f2dcae'); gg.addColorStop(1, '#a58350'); g.fillStyle = gg; g.fillRect(X(xc - .32), Y(hb + 1.98), X(.64), X(.6)); }
  else panel(xc - .32, hb + 1.34, .64, .62);
  panel(xc - .32, hb + .62, .64, .62); panel(xc - .32, hb + .12, .64, .42);
  g.fillStyle = '#c9a44a'; g.beginPath(); g.arc(X(xc + .36), Y(hb + 1.02), X(.045), 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(X(xc + .35), Y(hb + 1.03), X(.015), 0, TAU); g.fill();
  g.fillStyle = '#b8923c'; g.fillRect(X(xc - .16), Y(hb + 1.3), X(.32), X(.05));
  g.fillStyle = '#222'; g.beginPath(); g.arc(X(xc), Y(hb + 1.72), X(.018), 0, TAU); g.fill();
  if (o.num !== undefined && o.num !== null && String(o.num) !== 'undefined' && String(o.num) !== '') { g.fillStyle = '#d6b45c'; g.beginPath(); g.arc(X(xc), Y(hb + 1.5), X(.075), 0, TAU); g.fill(); g.fillStyle = '#3a2a10'; g.font = 'bold ' + Math.max(6, X(.09)) + 'px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(o.num), X(xc), Y(hb + 1.5)); }
  g.fillStyle = 'rgba(255,240,200,.28)'; g.fillRect(X(xc - .46), Y(hb + .03), X(.92), 2.5);   // light under the door
}
function paintTunWall(t, side) {
  const ppm = 48, L = t.L, top = t.H(L) + t.ch + .2, W = Math.round(L * ppm), Hh = Math.round(top * ppm), r = new RNG(L * 100 + side);
  const c = C2(W, Hh), g = c.getContext('2d'), X = m => m * ppm, Y = m => Hh - m * ppm;
  const zAt = px => side < 0 ? px / ppm : L - px / ppm, xz = z => side < 0 ? z : L - z;
  g.fillStyle = rgb(t.wallCol); g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < W * Hh / 70; i++) { g.fillStyle = r.c(.5) ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.05)'; g.fillRect(r.n() * W, r.n() * Hh, 1 + r.n() * 2, 1 + r.n() * 2); }
  for (let px = 0; px < W; px += 2) {
    const h = t.H(Math.min(L, Math.max(0, zAt(px))));
    g.fillStyle = 'rgba(50,38,26,.15)'; g.fillRect(px, Y(h + 1.04), 2, X(1.04));
    g.fillStyle = 'rgba(214,208,194,.92)'; g.fillRect(px, Y(h + .11), 2, X(.11)); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(px, Y(h + .11), 2, 1.4);
    g.fillStyle = 'rgba(250,250,246,.75)'; g.fillRect(px, Y(h + 1.08), 2, X(.05)); g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(px, Y(h + 1.03), 2, 1.4);
    g.fillStyle = 'rgba(252,252,248,.95)'; g.fillRect(px, Y(h + t.ch), 2, X(.13)); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(px, Y(h + t.ch - .13), 2, X(.05));
  }
  if (t.stairs.length && side < 0) {   // timber handrail with brackets following the stairs
    for (let px = 0; px < W; px += 2) { const z = zAt(px); if (!t.stairs.some(s => z >= s.z0 - .2 && z <= s.z0 + s.n * .28 + .2)) continue; const h = t.H(z); g.fillStyle = '#4a2f1c'; g.fillRect(px, Y(h + .98), 2, X(.06)); g.fillStyle = 'rgba(255,220,170,.25)'; g.fillRect(px, Y(h + .98), 2, 1.5); if (Math.floor(z * 1.6) !== Math.floor((z + 2 / ppm) * 1.6)) { g.fillStyle = '#2a2a2c'; g.fillRect(px, Y(h + .98), 3, X(.14)); } }
  }
  for (const d of t.doors) if (d.side === side) paintDoorLeaf(g, X, Y, xz(d.z), t.H(d.z), d.col || [96, 74, 62], { num: d.num });
  if (t.mail && side < 0) { for (let m = 0; m < 12; m++) { const zz = t.mail[0] + (m % 6) * .28, yy = t.H(zz) + 1.0 + Math.floor(m / 6) * .3; const bx = X(xz(zz) - .12), by = Y(yy + .26); const gr = g.createLinearGradient(bx, 0, bx + X(.24), 0); gr.addColorStop(0, '#9aa0a6'); gr.addColorStop(.5, '#c7ccd0'); gr.addColorStop(1, '#858b91'); g.fillStyle = gr; g.fillRect(bx, by, X(.24), X(.26)); g.fillStyle = '#25282c'; g.fillRect(bx + X(.04), by + X(.06), X(.16), X(.02)); g.fillStyle = '#eee'; g.fillRect(bx + X(.05), by + X(.15), X(.14), X(.05)); } }
  if (t.mail && side > 0) { const zz = 1.4, hb = t.H(zz) + 1.05; g.fillStyle = '#5a4230'; g.fillRect(X(xz(zz) - .5), Y(hb + .8), X(1.0), X(.8)); g.fillStyle = '#c9a874'; g.fillRect(X(xz(zz) - .46), Y(hb + .76), X(.92), X(.72)); for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? '#f4f1e6' : '#e9e2c8'; g.fillRect(X(xz(zz) - .4 + (k % 3) * .3), Y(hb + .68 - Math.floor(k / 3) * .34), X(.24), X(.28)); } }
  if (t.buzzer && side > 0) { const zz = t.L - .9, hb = 1.05; g.fillStyle = '#2a2d31'; g.fillRect(X(xz(zz) - .17), Y(hb + .6), X(.34), X(.6)); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(X(xz(zz) - .17), Y(hb + .6), X(.34), 2); for (let rr = 0; rr < 4; rr++) for (let cc = 0; cc < 2; cc++) { g.fillStyle = '#d5dbe0'; g.fillRect(X(xz(zz) - .13 + cc * .14), Y(hb + .52 - rr * .12), X(.11), X(.08)); } g.fillStyle = '#111'; g.beginPath(); g.arc(X(xz(zz)), Y(hb + .08), X(.03), 0, TAU); g.fill(); }
  if (!t.mail && !t.buzzer && side > 0 && t.L > 6) { const zz = 3.3, hb = t.H(zz) + .3; g.fillStyle = '#b3201f'; g.fillRect(X(xz(zz) - .07), Y(hb + .5), X(.14), X(.5)); g.fillStyle = '#111'; g.fillRect(X(xz(zz) - .07), Y(hb + .5), X(.14), X(.06)); }
  return { A: c, W, top };
}
function paintEndWall(t) {
  const ppm = 48, w = t.hw * 2, H = t.ch + .2, W = Math.round(w * ppm), Hh = Math.round(H * ppm), r = new RNG(t.L * 77);
  const c = C2(W, Hh), g = c.getContext('2d'), e = C2(W >> 1, Hh >> 1), ge = e.getContext('2d'); ge.scale(.5, .5);
  const X = m => m * ppm, Y = m => Hh - m * ppm, xc = t.hw;
  g.fillStyle = rgb(mulc(t.wallCol, .96)); g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < W * Hh / 70; i++) { g.fillStyle = r.c(.5) ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.05)'; g.fillRect(r.n() * W, r.n() * Hh, 1 + r.n() * 2, 1 + r.n() * 2); }
  g.fillStyle = 'rgba(250,250,246,.92)'; g.fillRect(0, Y(.15), W, X(.15)); g.fillStyle = 'rgba(252,252,248,.95)'; g.fillRect(0, Y(t.ch), W, X(.13));
  const e0 = t.end;
  if (e0.type === 'lift') {
    g.fillStyle = '#d9dcdf'; g.fillRect(X(xc - .62), Y(2.28), X(1.24), X(2.28));
    for (const s of [-1, 1]) { const gr = g.createLinearGradient(X(xc + (s < 0 ? -.56 : 0)), 0, X(xc + (s < 0 ? 0 : .56)), 0); gr.addColorStop(0, '#9da3a8'); gr.addColorStop(.5, '#d4d8db'); gr.addColorStop(1, '#8b9196'); g.fillStyle = gr; g.fillRect(X(xc + (s < 0 ? -.56 : .01)), Y(2.2), X(.55), X(2.2)); for (let k = 0; k < 30; k++) { g.fillStyle = 'rgba(255,255,255,' + r.r(.03, .12).toFixed(2) + ')'; g.fillRect(X(xc + (s < 0 ? -.56 : .01)) + r.n() * X(.55), Y(2.2), 1, X(2.2)); } }
    g.fillStyle = '#0a0a0a'; g.fillRect(X(xc - .01), Y(2.2), X(.02), X(2.2));
    g.fillStyle = '#26292d'; g.fillRect(X(xc + .8), Y(1.5), X(.16), X(.34)); ge.fillStyle = '#ffd77a'; ge.fillRect(X(xc + .845), Y(1.36), X(.07), X(.07)); ge.fillRect(X(xc + .845), Y(1.24), X(.07), X(.07));
    g.fillStyle = '#111'; g.fillRect(X(xc - .2), Y(2.5), X(.4), X(.16)); ge.fillStyle = '#ff5a3a'; ge.fillRect(X(xc - .16), Y(2.46), X(.32), X(.08));
  } else if (e0.type === 'glass') {
    g.fillStyle = '#2b3036'; g.fillRect(X(xc - .68), Y(2.34), X(1.36), X(2.34));
    const gg = g.createLinearGradient(0, Y(2.25), 0, Y(0)); gg.addColorStop(0, '#f6f4e2'); gg.addColorStop(1, '#cfd8cf'); g.fillStyle = gg; g.fillRect(X(xc - .62), Y(2.28), X(.6), X(2.28)); g.fillRect(X(xc + .02), Y(2.28), X(.6), X(2.28));
    ge.fillStyle = 'rgba(255,250,225,.95)'; ge.fillRect(X(xc - .62), Y(2.28), X(.6), X(2.28)); ge.fillRect(X(xc + .02), Y(2.28), X(.6), X(2.28));
    g.fillStyle = '#c8cdd2'; g.fillRect(X(xc - .1), Y(1.25), X(.03), X(.6)); g.fillRect(X(xc + .07), Y(1.25), X(.03), X(.6));
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(X(xc - .6), Y(.2)); g.lineTo(X(xc - .25), Y(.2)); g.lineTo(X(xc + .2), Y(2.2)); g.lineTo(X(xc - .15), Y(2.2)); g.fill();
  } else {
    paintDoorLeaf(g, X, Y, xc, 0, t.doorCol || [40, 60, 100], { num: t.num });
    g.fillStyle = '#2a2d31'; g.beginPath(); g.arc(X(xc + .86), Y(1.15), X(.05), 0, TAU); g.fill(); ge.fillStyle = 'rgba(255,240,180,.9)'; ge.beginPath(); ge.arc(X(xc + .86), Y(1.15), X(.028), 0, TAU); ge.fill();
    g.fillStyle = '#e2c25a'; g.fillRect(X(xc - .86), Y(1.42), X(.16), X(.1)); g.fillStyle = '#3a2a10'; g.font = 'bold ' + Math.max(6, X(.08)) + 'px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(t.num || ''), X(xc - .78), Y(1.37));
  }
  return { A: c, E: e, W };
}

// ---- builders (same API the story uses)
function buildGarden(o) {
  const t = { kind: 'garden', out: true, L: o.L, hw: 1.1, eye: 1.6, num: (o.num !== undefined && o.num !== null) ? o.num : 12, doorCol: o.doorCol || [30, 50, 90], hedge: o.hedge !== false && !o.short };
  const L = t.L, stepZ = L - 1.3; t.stepZ = stepZ;
  t.H = z => z < stepZ ? 0 : .17 * Math.min(4, Math.floor((z - stepZ) / .3) + 1);
  const dh = t.H(L); t.doorRect = { x0: -.5, x1: .5, y0: dh, y1: dh + 2.2, z: L };
  const S = { D: DISTRICTS.islington }, brick = o.wall || [150, 84, 62];
  const lot = (side, z0, z1, col, pal, doorU, extra) => Object.assign({ side, z0, z1, x: side * 5, kind: 'house', floors: 3, gh: 3.3, fh: 3, h: 9.3, col, trim: mixc(col, [255, 255, 255], .35), seed: (Math.random() * 1e6) | 0, wp: 2.4, ww: .48, lit: .4, doorU, shopCol: [0, 0, 0], name: '', dest: null, setback: 3.2, pal, num: 3 + ((Math.random() * 80) | 0), building: '', graffiti: false }, extra);
  t.front = buildLotTex(S, lot(-1, -5, 5, brick, o.pal || 'brick', .5, { lift: dh, noSteps: true, num: t.num, doorCol: t.doorCol }));
  const nb = () => G.p([PAL.brick[1], PAL.stock[0], PAL.stucco[1], PAL.brick[3]]);
  t.left = buildLotTex(S, lot(-1, -12, L, nb(), G.c(.4) ? 'stucco' : 'brick', .3));
  t.right = buildLotTex(S, lot(1, -12, L, nb(), G.c(.4) ? 'stucco' : 'brick', .7));
  t.hedgeTex = t.hedge ? paintHedge(stepZ) : null;
  return t;
}
function buildIndoor(o) {
  const t = { kind: 'indoor', out: false, L: o.L, hw: 1.1, ch: 2.7, eye: 1.62, bright: .82, num: (o.end && o.end.num !== undefined && o.end.num !== null) ? o.end.num : 12, mail: o.mail, buzzer: !!o.buzzer, doors: o.doors || [], stairs: o.stairs || [], end: o.end || { type: 'flat', num: 12 }, wallCol: o.wall || [204, 198, 180] };
  const run = .28, rise = .18, st = t.stairs;
  t.H = z => { let h = 0; for (const s of st) if (z >= s.z0) h += rise * Math.min(s.n, Math.floor((z - s.z0) / run) + 1); return h; };
  t.floorKind = o.floorKind || (o.mail || st.length ? 'tiles' : 'carpet');
  t.doorCol = t.end.col;
  const eh = t.H(t.L);
  t.doorRect = (t.end.type === 'flat') ? { x0: -.5, x1: .5, y0: eh, y1: eh + 2.1, z: t.L } : null;
  // floor pieces, far-to-near draw order is handled by sorting
  const segs = []; let cur = 0;
  for (const s of st.slice().sort((a, b) => a.z0 - b.z0)) {
    if (s.z0 > cur + .001) segs.push({ z0: cur, z1: s.z0, h: t.H(cur), riser: false });
    for (let k = 0; k < s.n; k++) segs.push({ z0: s.z0 + k * run, z1: s.z0 + (k + 1) * run, h: t.H(s.z0 + k * run + .001), riser: true, hp: t.H(s.z0 + k * run + .001) - rise });
    cur = s.z0 + s.n * run;
  }
  if (cur < t.L - .001) segs.push({ z0: cur, z1: t.L, h: t.H(cur + .001), riser: false });
  t.segs = segs; t.tex = null;
  return t;
}

// ---- drawing
function tshade(col, rz, k) {
  const b = (k || 1) * .82 * (1 - .35 * (1 - Math.exp(-rz * .06))), f = Math.min(.5, 1 - Math.exp(-rz * .045));
  return 'rgb(' + ((col[0] * b * (1 - f) + 22 * f) | 0) + ',' + ((col[1] * b * (1 - f) + 19 * f) | 0) + ',' + ((col[2] * b * (1 - f) + 17 * f) | 0) + ')';
}
function renderTunnel(dt) {
  const t = scene.tun; if (!t) return;
  const z = scene.wz, hw = t.hw, L = t.L;
  setHeading(0); cam.x = scene.wx; cam.z = z; setFrame(IDENT);
  cam.h = t.H(z) + (t.eye || 1.62) + Math.sin(scene.wph * 2) * .025;
  cam.yawPx = scene.look * SW * .3;
  HZ = HZ0 - Math.sin(scene.wph) * 2 - (t.pitch || 0) * SH;
  texBudgetReset();
  if (t.kind === 'garden') renderGarden(t, z); else renderIndoor(t, z);
  if (scene.extra) scene.extra(dt, z);
  if (t.out && env.night > .3) { ctx.fillStyle = 'rgba(6,8,20,' + ((env.night - .3) * .3).toFixed(2) + ')'; ctx.fillRect(0, 0, SW, SH); }
  HZ = HZ0; LIGHT = null;
}
function renderGarden(t, z) {
  const L = t.L, hw = t.hw, sz = t.stepZ;
  LIGHT = null; drawSky();
  ctx.fillStyle = shade([70, 100, 60], 60); ctx.fillRect(0, HZ, SW, SH - HZ);
  const ea = clamp(env.winLit * 1.05, 0, 1);
  drawSlicedQuad(t.front.A, -5, L, 5, L, 0, 9.3, .92, t.front.E, ea);                    // the house front, with its door
  drawSlicedQuad(t.left.A, -5, -12, -5, L, 0, 9.3, .9, t.left.E, ea);                    // neighbours
  drawSlicedQuad(t.right.A, 5, L, 5, -12, 0, 9.3, .95, t.right.E, ea);
  texGround([-5, 0, -2, -hw, 0, -2, -hw, 0, L, -5, 0, L], 'grass', 60);                  // lawns
  texGround([hw, 0, -2, 5, 0, -2, 5, 0, L, hw, 0, L], 'grass', 60);
  texGround([-hw, 0, -2, hw, 0, -2, hw, 0, sz, -hw, 0, sz], 'slabs', 60);                // the path
  if (t.hedgeTex) {
    drawSlicedQuad(t.hedgeTex, -hw - .02, 0, -hw - .02, sz, 0, 1.15, .82);
    drawSlicedQuad(t.hedgeTex, hw + .02, sz, hw + .02, 0, 0, 1.15, .95);
    for (const sd of [-1, 1]) poly(shade([64, 118, 52], 8, 1.1), [sd * hw, 1.15, 0, sd * (hw + .55), 1.15, 0, sd * (hw + .55), 1.15, sz, sd * hw, 1.15, sz]);
  }
  for (let k = 3; k >= 0; k--) {                                                          // steps to the front door
    const z0 = sz + .3 * k, h = .17 * (k + 1);
    texGround([-hw, h, z0, hw, h, z0, hw, h, z0 + .3, -hw, h, z0 + .3], 'stone', 40);
    poly(shade([150, 146, 138], Math.max(1, z0 - z), .95), [-hw, h - .17, z0, hw, h - .17, z0, hw, h, z0, -hw, h, z0]);
  }
  const lp = Pw(1.05, t.H(L) + 1.9, L - .05); if (lp && env.lamp > .1) glow(lp[0], lp[1], Math.max(8, F / lp[2] * .9), [255, 226, 170], env.lamp * .8);
}
function renderIndoor(t, z) {
  const L = t.L, hw = t.hw, ch = t.ch, eh = t.H(L);
  LIGHT = { amb: [t.bright, t.bright * .97, t.bright * .92], fog: r2 => Math.min(.5, 1 - Math.exp(-r2 * .045)), fogC: [22, 19, 17] };
  if (!t.tex) t.tex = { L: paintTunWall(t, -1), R: paintTunWall(t, 1), E: paintEndWall(t) };
  ctx.fillStyle = '#161412'; ctx.fillRect(0, 0, SW, SH);
  const T = t.tex;
  drawSlicedQuad(T.E.A, -hw, L, hw, L, eh, eh + ch + .2, .95, T.E.E, 1);
  drawSlicedQuad(T.L.A, -hw, 0, -hw, L, 0, T.L.top, .9);
  drawSlicedQuad(T.R.A, hw, L, hw, 0, 0, T.R.top, 1);
  const segs = t.segs.slice().sort((a, b) => b.z0 - a.z0);
  for (const s of segs) {
    if (s.z1 < z - .3) continue;
    texGround([-hw, s.h, s.z0, hw, s.h, s.z0, hw, s.h, s.z1, -hw, s.h, s.z1], t.floorKind === 'tiles' && s.riser ? 'wood' : t.floorKind, 30);
    if (s.riser) poly(tshade([170, 140, 108], Math.max(1, s.z0 - z), .9), [-hw, s.hp, s.z0, hw, s.hp, s.z0, hw, s.h, s.z0, -hw, s.h, s.z0]);
    const cy = s.h + ch, rz = Math.max(1, (s.z0 + s.z1) / 2 - z);
    poly(tshade([236, 234, 228], rz, 1.05), [-hw, cy, s.z0, hw, cy, s.z0, hw, cy, s.z1, -hw, cy, s.z1]);
  }
  for (let zz = 1.2; zz < L; zz += 3.1) {                                                  // ceiling lights
    const h = t.H(zz) + ch - .015, rz = Math.max(1, zz - z);
    poly(emit([255, 250, 230], rz, .95), [-.32, h, zz, .32, h, zz, .32, h, zz + .7, -.32, h, zz + .7]);
    const p = Pw(0, h, zz + .35); if (p) glow(p[0], p[1], Math.max(8, F / p[2] * 1.4), [255, 240, 200], .55);
  }
}
