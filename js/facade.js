'use strict';
// Procedural building facades: each lot gets a painted albedo texture + an emissive (lit windows) texture,
// which the renderer maps onto the wall in perspective-correct vertical slices.
const TX = { brick: {}, t0: 0 };
function C2(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
const rgbaS = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
const lum = c => (c[0] * .3 + c[1] * .59 + c[2] * .11);

function brickTile(col) {
  const key = col.map(v => v | 0).join(','); if (TX.brick[key]) return TX.brick[key];
  const t = C2(90, 30), g = t.getContext('2d'), r = new RNG(col[0] * 7 + col[1] * 13 + col[2] + 1);
  g.fillStyle = rgb(mixc(col, [206, 202, 190], .5)); g.fillRect(0, 0, 90, 30);
  for (let row = 0; row < 10; row++) {
    const off = (row % 2) * 4.5;
    for (let bx = -9 + off; bx < 90; bx += 9) {
      const v = .8 + r.n() * .38, hue = (r.n() - .5) * 16, dark = r.n() < .07 ? .72 : 1;
      g.fillStyle = 'rgb(' + clamp(col[0] * v * dark + hue, 0, 255) + ',' + clamp(col[1] * v * dark, 0, 255) + ',' + clamp(col[2] * v * dark - hue * .5, 0, 255) + ')';
      g.fillRect(bx, row * 3, 8, 2);
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(bx, row * 3, 8, 1);
    }
  }
  return TX.brick[key] = t;
}

function makeMip(tex, lv) {
  const k = 1 / (1 << lv), A = C2(tex.W * k, tex.H * k), E = C2(tex.E.width * k, tex.E.height * k);
  let g = A.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(tex.A, 0, 0, A.width, A.height);
  g = E.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(tex.E, 0, 0, E.width, E.height);
  return (tex.mips[lv] = { A, E });
}

function buildLotTex(S, l) {
  const r = new RNG(l.seed), len = l.z1 - l.z0, hM = l.h, D = S.D;
  const ppm = Math.min(30, 1000 / Math.max(len, hM));
  const W = Math.max(8, Math.round(len * ppm)), H = Math.max(8, Math.round(hM * ppm));
  const A = C2(W, H), a = A.getContext('2d'), E = C2(W >> 1, H >> 1), e = E.getContext('2d'); e.scale(.5, .5);
  const mm = (x, y, w, h) => [x * ppm, H - (y + h) * ppm, w * ppm, h * ppm];
  const rc = (c, col, x, y, w, h) => { c.fillStyle = col; c.fillRect.apply(c, mm(x, y, w, h)); };
  const sideL = l.side < 0, doorX = sideL ? l.doorU * len : (1 - l.doorU) * len;
  const pal = l.pal;
  const mat = l.kind === 'glass' ? 'glass' : l.kind === 'block' ? 'concrete' : pal === 'stucco' ? 'stucco' : pal === 'painted' ? 'paint' : pal === 'concrete' ? 'concrete' : 'brick';
  const stone = mixc([226, 220, 206], l.col, .12), frameC = r.c(.85) ? [238, 238, 232] : r.p([[40, 60, 50], [30, 34, 48], [110, 40, 40]]);

  // ---- base material
  if (mat === 'brick' || mat === 'paint') {
    const tile = brickTile(mat === 'paint' ? mixc(l.col, [150, 84, 62], .45) : (pal === 'warehouse' ? mulc(l.col, .9) : l.col));
    const s = ppm / 40; a.save(); a.scale(s, s); a.fillStyle = a.createPattern(tile, 'repeat'); a.fillRect(0, 0, W / s, H / s); a.restore();
    if (mat === 'paint') { a.fillStyle = rgbaS(l.col, .8); a.fillRect(0, 0, W, H); }
  } else if (mat === 'stucco') {
    a.fillStyle = rgb(l.col); a.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H / 90; i++) { a.fillStyle = r.c(.5) ? 'rgba(0,0,0,.035)' : 'rgba(255,255,255,.05)'; a.fillRect(r.n() * W, r.n() * H, 1 + r.n() * 2, 1 + r.n() * 2); }
  } else if (mat === 'concrete') {
    const g = a.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgb(mulc(l.col, 1.05))); g.addColorStop(1, rgb(mulc(l.col, .9))); a.fillStyle = g; a.fillRect(0, 0, W, H);
    for (let i = 0; i < W * H / 60; i++) { a.fillStyle = r.c(.5) ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.05)'; a.fillRect(r.n() * W, r.n() * H, 1 + r.n() * 3, 1 + r.n() * 2); }
    a.fillStyle = 'rgba(0,0,0,.16)'; for (let x = 0; x < len; x += 3) a.fillRect(x * ppm, 0, 1, H); for (let y = l.gh; y < hM; y += l.fh) a.fillRect(0, H - y * ppm, W, 1);
  } else { // curtain wall glass
    const g = a.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgb(mixc(l.col, [190, 214, 240], .55))); g.addColorStop(.5, rgb(l.col)); g.addColorStop(1, rgb(mulc(l.col, .55))); a.fillStyle = g; a.fillRect(0, 0, W, H);
    for (let x = 0; x < len; x += 1.5) for (let y = l.gh; y < hM; y += l.fh) { a.fillStyle = 'rgba(' + (r.c(.5) ? '255,255,255' : '0,0,0') + ',' + (r.n() * .1).toFixed(3) + ')'; a.fillRect(x * ppm, H - (y + l.fh) * ppm, 1.5 * ppm, l.fh * ppm); }
    a.fillStyle = 'rgba(20,28,40,.7)'; for (let x = 0; x <= len; x += 1.5) a.fillRect(x * ppm, 0, 1.5, H);
    for (let y = l.gh; y <= hM; y += l.fh) { a.fillStyle = 'rgba(30,36,44,.85)'; a.fillRect(0, H - y * ppm - 3, W, ppm * .5); }
    // lit offices
    for (let x = 0; x < len; x += 1.5) for (let y = l.gh; y < hM - 1; y += l.fh) if (r.c(l.lit * .8)) { e.fillStyle = rgbaS(r.c(.7) ? [255, 236, 190] : [200, 225, 255], .85); e.fillRect.apply(e, mm(x + .05, y + .2, 1.4, l.fh - .7)); }
  }

  // ---- window painter
  const glazed = (x0, yb, ww, hh, lit, style) => {
    const gx = x0, gy = yb, gw = ww, gh = hh;
    const g = a.createLinearGradient(0, H - (gy + gh) * ppm, 0, H - gy * ppm); g.addColorStop(0, '#9db8cf'); g.addColorStop(.55, '#465667'); g.addColorStop(1, '#232b36');
    a.fillStyle = g; a.fillRect.apply(a, mm(gx, gy, gw, gh));
    // interior dressing
    const q = r.n();
    if (q < .3) { rc(a, rgbaS(r.p([[160, 60, 60], [200, 190, 160], [90, 110, 150], [120, 140, 100]]), .85), gx, gy, gw * .3, gh); rc(a, rgbaS(r.p([[160, 60, 60], [200, 190, 160], [90, 110, 150]]), .85), gx + gw * .7, gy, gw * .3, gh); }
    else if (q < .48) rc(a, 'rgba(232,228,214,.9)', gx, gy + gh * (.35 + r.n() * .4), gw, gh); // blind
    else if (q < .58) { rc(a, 'rgba(60,110,60,.9)', gx + gw * .2, gy, gw * .25, gh * .3); }
    if (lit) {
      const warm = r.c(.78) ? [255, 214, 140] : [190, 214, 255];
      e.save(); e.globalAlpha = .28; const hg = e.createRadialGradient((gx + gw / 2) * ppm, H - (gy + gh / 2) * ppm, 0, (gx + gw / 2) * ppm, H - (gy + gh / 2) * ppm, ww * ppm * 1.6);
      hg.addColorStop(0, rgbaS(warm, 1)); hg.addColorStop(1, rgbaS(warm, 0)); e.fillStyle = hg; e.fillRect((gx - ww * 1.6) * ppm, H - (gy + gh + ww * 1.6) * ppm, ww * 3.2 * ppm + ww * ppm, (gh + ww * 3.2) * ppm); e.restore();
      e.fillStyle = rgbaS(warm, .9); e.fillRect.apply(e, mm(gx, gy, gw, gh));
      if (q < .3) { e.fillStyle = 'rgba(80,30,10,.35)'; e.fillRect.apply(e, mm(gx, gy, gw * .3, gh)); e.fillRect.apply(e, mm(gx + gw * .7, gy, gw * .3, gh)); }
      e.fillStyle = 'rgba(70,40,20,.25)'; e.fillRect.apply(e, mm(gx, gy + gh * .85, gw, gh * .15));
    }
    // reveal shadows
    rc(a, 'rgba(0,0,0,.5)', gx, gy + gh - .07, gw, .07); rc(a, 'rgba(0,0,0,.32)', gx, gy, .05, gh);
    // sunlit reflection
    a.fillStyle = 'rgba(255,255,255,.10)'; a.beginPath(); a.moveTo.apply(a, mm(gx, gy + gh * .5, 0, 0).slice(0, 2)); a.lineTo(gx * ppm + gw * ppm * .6, H - (gy + gh) * ppm); a.lineTo(gx * ppm + gw * ppm * .85, H - (gy + gh) * ppm); a.lineTo(gx * ppm, H - gy * ppm - gh * ppm * .1); a.fill();
  };
  const sash = (xc, yb, ww, hh, lit, arch) => {
    const x0 = xc - ww / 2;
    if (mat !== 'glass') {
      rc(a, rgb(stone), x0 - .1, yb + hh, ww + .2, .17); rc(a, rgb(stone), x0 - .13, yb - .11, ww + .26, .11); rc(a, 'rgba(0,0,0,.3)', x0 - .08, yb - .22, ww + .16, .11);
      rc(a, 'rgba(0,0,0,.16)', x0 - .03, yb - 1.1, ww + .06, .9);  // rain streak under the sill
    }
    rc(a, '#20242a', x0, yb, ww, hh); rc(a, rgb(frameC), x0 + .03, yb + .03, ww - .06, hh - .06);
    const gx = x0 + .09, gy = yb + .09, gw = ww - .18, gh = hh - .18;
    glazed(gx, gy, gw, gh, lit);
    // glazing bars
    a.fillStyle = rgb(frameC);
    a.fillRect.apply(a, mm(gx + gw / 2 - .02, gy, .04, gh)); a.fillRect.apply(a, mm(gx, gy + gh * .5 - .03, gw, .06));
    if (hh > 1.5) { a.fillRect.apply(a, mm(gx, gy + gh * .75 - .015, gw, .03)); a.fillRect.apply(a, mm(gx, gy + gh * .25 - .015, gw, .03)); }
    if (lit) { e.fillStyle = 'rgba(40,20,10,.55)'; e.fillRect.apply(e, mm(gx + gw / 2 - .02, gy, .04, gh)); e.fillRect.apply(e, mm(gx, gy + gh * .5 - .03, gw, .06)); }
  };
  const crittall = (xc, yb, ww, hh, lit) => {
    const x0 = xc - ww / 2;
    rc(a, '#1b1e22', x0 - .05, yb - .05, ww + .1, hh + .1);
    glazed(x0, yb, ww, hh, lit);
    a.fillStyle = '#1b1e22'; const nc = Math.max(2, Math.round(ww / .45)), nr = Math.max(2, Math.round(hh / .4));
    for (let i = 1; i < nc; i++) a.fillRect.apply(a, mm(x0 + ww * i / nc - .015, yb, .03, hh)); for (let j = 1; j < nr; j++) a.fillRect.apply(a, mm(x0, yb + hh * j / nr - .015, ww, .03));
    rc(a, rgb(mixc(stone, [90, 90, 90], .5)), x0 - .1, yb - .1, ww + .2, .08);
    if (lit) { e.fillStyle = 'rgba(30,20,10,.6)'; for (let i = 1; i < nc; i++) e.fillRect.apply(e, mm(x0 + ww * i / nc - .015, yb, .03, hh)); for (let j = 1; j < nr; j++) e.fillRect.apply(e, mm(x0, yb + hh * j / nr - .015, ww, .03)); }
  };
  const ribbon = (xc, yb, ww, hh, lit) => { // modern block window + balcony
    const x0 = xc - ww / 2; rc(a, '#2b2f35', x0 - .04, yb - .04, ww + .08, hh + .08); glazed(x0, yb, ww, hh, lit);
    rc(a, 'rgba(255,255,255,.55)', x0 - .3, yb - .32, ww + .6, .1); rc(a, 'rgba(0,0,0,.4)', x0 - .3, yb - .42, ww + .6, .1);
    rc(a, 'rgba(20,24,28,.5)', x0 - .3, yb - .22, ww + .6, .2);
    a.fillStyle = 'rgba(190,210,225,.35)'; a.fillRect.apply(a, mm(x0 - .3, yb - .22, ww + .6, .2));
  };

  // ---- floors
  const n = Math.max(1, Math.floor(len / l.wp)), pitch = len / n;
  const wstyle = l.kind === 'block' ? 'ribbon' : (pal === 'warehouse' || (D.id === 'shoreditch' && r.c(.5))) ? 'crit' : 'sash';
  // string courses
  if (mat !== 'glass' && mat !== 'concrete') for (let f = 1; f < l.floors; f++) { const yy = l.gh + (f - 1) * l.fh - .35; if (f === 1 || r.c(.35)) { rc(a, rgb(stone), 0, yy, len, .16); rc(a, 'rgba(0,0,0,.28)', 0, yy - .12, len, .12); } }
  for (let f = 1; f < l.floors; f++) {
    if (mat === 'glass') break;
    const yb0 = l.gh + (f - 1) * l.fh;
    for (let i = 0; i < n; i++) {
      const xc = (i + .5) * pitch, lit = r.c(l.lit);
      if (wstyle === 'ribbon') ribbon(xc, yb0 + .75, Math.min(1.7, pitch * .62), 1.3, lit);
      else if (wstyle === 'crit') crittall(xc, yb0 + .5, Math.min(1.8, pitch * .62), 1.9, lit);
      else { const tall = (mat === 'stucco' && f === 1) ? 2.35 : (f === l.floors - 1 ? 1.55 : 1.9); sash(xc, yb0 + (f === 1 && mat === 'stucco' ? .35 : .6), Math.min(1.05, pitch * .5), tall, lit); }
      if (f === 1 && mat === 'stucco') { rc(a, 'rgba(20,20,24,.85)', xc - Math.min(1.05, pitch * .5) / 2 - .25, yb0 - .05, Math.min(1.05, pitch * .5) + .5, .06); for (let bx = -.5; bx <= .5; bx += .12) rc(a, 'rgba(20,20,24,.8)', xc + bx * Math.min(1.05, pitch * .5) * 1.1, yb0 - .05, .025, .9); }
    }
  }
  // ---- ground floor
  const gh = l.gh;
  if (l.kind === 'shop') {
    const dw = 1.05, dx0 = doorX - dw / 2, dcol = l.shopCol, dark = lum(dcol) < 110;
    // stallriser + window bay + pilasters
    rc(a, rgb(mulc(dcol, .55)), 0, 0, len, .5);
    const win = (x0, w) => {
      if (w < .5) return;
      rc(a, '#15171a', x0 - .04, .5 - .04, w + .08, 2.4 + .08);
      const g = a.createLinearGradient(0, H - 2.9 * ppm, 0, H - .5 * ppm); g.addColorStop(0, '#f4dcaa'); g.addColorStop(1, '#a8804e'); a.fillStyle = g; a.fillRect.apply(a, mm(x0, .5, w, 2.4));
      // display: shelves & goods
      const nm = l.name; const cafe = /CAF|COFFEE|BAKERY|DELI/.test(nm), market = /MARKET|SUPERMARKET|OFF LIC/.test(nm);
      for (let sh = 0; sh < 3; sh++) { const yy = .75 + sh * .75; rc(a, 'rgba(70,46,30,.8)', x0, yy, w, .05); for (let gx2 = x0 + .1; gx2 < x0 + w - .2; gx2 += .22 + r.n() * .2) { const cc = market ? r.p([[200, 60, 50], [230, 180, 40], [70, 150, 70], [240, 240, 230]]) : cafe ? r.p([[230, 200, 150], [170, 110, 70], [240, 240, 235], [190, 80, 80]]) : r.p([[60, 80, 120], [200, 200, 190], [140, 70, 70], [50, 50, 56]]); rc(a, rgb(cc), gx2, yy + .05, .14 + r.n() * .1, .18 + r.n() * .25); } }
      if (/BARBER|NAILS|VINTAGE|TAILOR|OPTICIAN|BOOKS|GYM|DENTIST|PHONE/.test(nm)) { rc(a, 'rgba(30,30,40,.55)', x0 + w * .55, .5, w * .4, 2.4); }
      // ceiling lights
      for (let lx = x0 + .4; lx < x0 + w - .2; lx += .9) rc(a, 'rgba(255,255,240,.95)', lx, 2.75, .35, .05);
      // reflection
      a.fillStyle = 'rgba(255,255,255,.12)'; a.beginPath(); a.moveTo(x0 * ppm, H - .5 * ppm); a.lineTo((x0 + w * .4) * ppm, H - .5 * ppm); a.lineTo((x0 + w * .7) * ppm, H - 2.9 * ppm); a.lineTo(x0 * ppm, H - 2.9 * ppm); a.fill();
      e.fillStyle = 'rgba(255,214,150,.75)'; e.fillRect.apply(e, mm(x0, .5, w, 2.4));
      e.fillStyle = 'rgba(60,30,10,.5)'; for (let sh = 0; sh < 3; sh++) e.fillRect.apply(e, mm(x0, .75 + sh * .75, w, .05));
    };
    win(.55, dx0 - .75); win(dx0 + dw + .2, len - (dx0 + dw + .2) - .55);
    // pilasters
    rc(a, rgb(mulc(dcol, 1.25)), 0, .5, .4, 2.5); rc(a, rgb(mulc(dcol, 1.25)), len - .4, .5, .4, 2.5);
    // door
    rc(a, '#101214', dx0 - .05, 0, dw + .1, 2.35); const gd = a.createLinearGradient(0, H - 2.3 * ppm, 0, H); gd.addColorStop(0, '#f0d8a4'); gd.addColorStop(1, '#a07848'); a.fillStyle = gd; a.fillRect.apply(a, mm(dx0, .05, dw, 2.25));
    rc(a, 'rgba(30,30,34,.9)', dx0 + dw / 2 - .02, .05, .04, 2.25); rc(a, '#b0b4b8', dx0 + .12, 1.0, .05, .45);
    rc(a, 'rgba(255,255,255,.9)', dx0 + .2, 1.6, .5, .18); a.fillStyle = '#c33'; a.font = 'bold ' + Math.max(6, .1 * ppm) + 'px Arial'; a.fillText('OPEN', (dx0 + .24) * ppm, H - 1.46 * ppm);
    e.fillStyle = 'rgba(255,230,170,.85)'; e.fillRect.apply(e, mm(dx0, .05, dw, 2.25));
    // fascia + sign
    const fy = 3.0, fh = .65; rc(a, rgb(mulc(dcol, .9)), 0, fy, len, fh); rc(a, 'rgba(255,255,255,.35)', 0, fy + fh - .04, len, .04); rc(a, 'rgba(0,0,0,.5)', 0, fy - .05, len, .05);
    const txtCol = dark ? '#f6efe0' : '#1a1a1e';
    let fs = fh * .62 * ppm; a.font = 'bold ' + fs + 'px "Trebuchet MS",Arial,sans-serif'; const tw = a.measureText(l.name).width; const maxw = (len - 1.2) * ppm; if (tw > maxw) fs *= maxw / tw;
    a.font = 'bold ' + fs + 'px "Trebuchet MS",Arial,sans-serif'; a.textAlign = 'center'; a.textBaseline = 'middle'; a.fillStyle = txtCol; a.fillText(l.name, W / 2, H - (fy + fh / 2) * ppm);
    e.save(); e.scale(2, 2); e.restore();
    e.fillStyle = 'rgba(' + (dark ? '255,240,210' : '255,255,255') + ',.55)'; e.fillRect.apply(e, mm(0, fy, len, fh)); e.font = 'bold ' + fs + 'px "Trebuchet MS",Arial,sans-serif'; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillStyle = dark ? 'rgba(255,248,230,.95)' : 'rgba(30,20,10,.5)'; e.fillText(l.name, W / 2, H - (fy + fh / 2) * ppm);
    if (l.dest) { // awning + menu board
      const ac = l.shopCol; for (let i = 0; i < len * 4; i++) rc(a, i % 2 ? rgb(ac) : 'rgba(245,240,230,.95)', i * .25, fy - .55, .25, .5);
      rc(a, 'rgba(0,0,0,.35)', 0, fy - .62, len, .07); rc(a, '#1d1f22', .7, .55, .6, .95); rc(a, 'rgba(255,255,255,.85)', .78, 1.05, .44, .03); rc(a, 'rgba(255,255,255,.85)', .78, .95, .36, .03); rc(a, 'rgba(255,255,255,.85)', .78, .85, .4, .03);
      e.fillStyle = 'rgba(255,255,255,.6)'; e.fillRect.apply(e, mm(.78, .85, .44, .25));
    }
  } else if (l.kind === 'house') {
    const dw = 1.0, dh = 2.3, dx0 = doorX - dw / 2, lift = l.setback > 1 ? .6 : .35;
    const dcol = DOORS[(hash(l.seed, 9) * DOORS.length) | 0];
    // ground windows
    for (const wx of [Math.max(.9, doorX - 2.3), Math.min(len - .9, doorX + 2.3)]) if (Math.abs(wx - doorX) > 1.5 && wx > .6 && wx < len - .6) sash(wx, .95, .95, 1.7, r.c(l.lit));
    // basement area railing
    if (mat === 'stucco') { rc(a, 'rgba(15,15,18,.85)', 0, .12, len, .06); for (let bx = .1; bx < len; bx += .14) if (Math.abs(bx - doorX) > .8) rc(a, 'rgba(15,15,18,.85)', bx, .12, .025, .8); }
    // portico
    if (mat === 'stucco') { rc(a, rgb(stone), dx0 - .55, 0, .3, dh + .25); rc(a, rgb(stone), dx0 + dw + .25, 0, .3, dh + .25); rc(a, rgb(stone), dx0 - .7, dh + .25, dw + 1.4, .3); rc(a, 'rgba(0,0,0,.3)', dx0 - .55, dh - .05, dw + 1.1, .25); }
    rc(a, rgb(stone), dx0 - .12, lift, dw + .24, dh + .14);
    rc(a, rgb(dcol), dx0, lift, dw, dh);
    rc(a, 'rgba(0,0,0,.25)', dx0 + .12, lift + .15, dw - .24, .9); rc(a, 'rgba(0,0,0,.25)', dx0 + .12, lift + 1.2, dw - .24, .8);
    rc(a, 'rgba(255,255,255,.14)', dx0 + .12, lift + 1.2, dw - .24, .04);
    // fanlight
    const fl = a.createLinearGradient(0, H - (lift + dh) * ppm, 0, H - (lift + dh - .5) * ppm); fl.addColorStop(0, '#f2d9a4'); fl.addColorStop(1, '#a58350'); a.fillStyle = fl; a.fillRect.apply(a, mm(dx0 + .1, lift + dh - .5, dw - .2, .4));
    e.fillStyle = 'rgba(255,215,150,' + (r.c(.75) ? .85 : .0) + ')'; e.fillRect.apply(e, mm(dx0 + .1, lift + dh - .5, dw - .2, .4));
    rc(a, '#c9b070', dx0 + dw - .2, lift + 1.1, .08, .08); rc(a, '#e8e6e0', dx0 + dw + .05, lift + 1.7, .12, .09); a.fillStyle = '#222'; a.font = 'bold ' + Math.max(5, .12 * ppm) + 'px Arial'; a.fillText(String(l.num || ''), (dx0 + dw + .05) * ppm, H - (lift + 1.62) * ppm);
    // steps
    for (let s = 0; s < (l.setback > 1 ? 3 : 2); s++) rc(a, s % 2 ? rgb(mulc(stone, .9)) : rgb(stone), dx0 - .25 - s * .05, s * lift / 3, dw + .5 + s * .1, lift / 3);
    // lamp
    rc(a, '#222', dx0 - .35, lift + 1.9, .1, .18); e.fillStyle = 'rgba(255,230,170,.9)'; e.fillRect.apply(e, mm(dx0 - .34, lift + 1.92, .08, .14));
  } else if (l.kind === 'block') {
    const ew = 2.2, ex0 = doorX - ew / 2;
    rc(a, 'rgba(0,0,0,.28)', 0, 0, len, gh); rc(a, rgb(mulc(l.col, .8)), 0, 0, len, .9);
    for (let i = 0; i < n; i++) { const xc = (i + .5) * pitch; if (Math.abs(xc - doorX) > 2) ribbon(xc, 1.15, Math.min(1.5, pitch * .55), 1.2, r.c(l.lit)); }
    rc(a, '#171a1e', ex0 - .08, 0, ew + .16, 2.7); const gd = a.createLinearGradient(0, H - 2.6 * ppm, 0, H); gd.addColorStop(0, '#9fb6c8'); gd.addColorStop(1, '#3c4c5a'); a.fillStyle = gd; a.fillRect.apply(a, mm(ex0, .05, ew, 2.55));
    rc(a, '#15181c', ex0 + ew / 2 - .03, .05, .06, 2.55); rc(a, rgb(stone), ex0 - .4, 2.75, ew + .8, .18); rc(a, 'rgba(0,0,0,.3)', ex0 - .4, 2.6, ew + .8, .15);
    e.fillStyle = 'rgba(230,240,230,.85)'; e.fillRect.apply(e, mm(ex0, .05, ew, 2.55)); e.fillStyle = 'rgba(30,40,40,.5)'; e.fillRect.apply(e, mm(ex0 + ew / 2 - .03, .05, .06, 2.55));
    rc(a, '#ddd', ex0 + ew + .2, 1.2, .3, .45); a.fillStyle = '#222'; a.font = 'bold ' + Math.max(5, .14 * ppm) + 'px Arial'; a.fillText(l.building ? l.building.split(' ')[0] : '', (ex0 - 1.6) * ppm, H - 2.1 * ppm);
  } else if (l.kind === 'glass') {
    const ew = 3; const ex0 = doorX - ew / 2;
    rc(a, 'rgba(210,232,250,.9)', 0, 0, len, gh); a.fillStyle = 'rgba(40,52,64,.75)'; for (let x = 0; x <= len; x += 1.5) a.fillRect.apply(a, mm(x - .05, 0, .1, gh));
    rc(a, 'rgba(255,255,255,.14)', 0, gh * .5, len, gh * .5);
    e.fillStyle = 'rgba(245,244,225,.9)'; e.fillRect.apply(e, mm(0, .2, len, gh - .6)); e.fillStyle = 'rgba(40,52,64,.7)'; for (let x = 0; x <= len; x += 1.5) e.fillRect.apply(e, mm(x - .05, 0, .1, gh));
    rc(a, 'rgba(20,24,30,.9)', ex0, 0, ew, 3.2); e.fillStyle = 'rgba(255,255,240,.95)'; e.fillRect.apply(e, mm(ex0 + .1, .1, ew - .2, 3.0));
    rc(a, '#1a1c20', 0, gh - .5, len, .5);
  }

  // ---- roofline, pipes, weathering
  if (mat !== 'glass') {
    const ct = hM - .55; rc(a, rgb(stone), -.05, ct, len + .1, .55); rc(a, 'rgba(255,255,255,.25)', -.05, hM - .1, len + .1, .1); rc(a, 'rgba(0,0,0,.42)', 0, ct - .3, len, .3);
    if (mat === 'stucco') for (let x = .1; x < len; x += .32) rc(a, 'rgba(0,0,0,.2)', x, ct + .08, .16, .2);
    if (r.c(.4) && mat !== 'concrete') rc(a, 'rgba(24,26,28,.85)', r.c(.5) ? .18 : len - .28, 0, .1, hM - .5);  // down pipe
    if (r.c(.14) && l.kind !== 'block' && mat !== 'stucco') { // fire escape
      const fx = len * r.r(.3, .6), fw = Math.min(2.6, len * .4); a.strokeStyle = 'rgba(16,18,20,.9)'; a.lineWidth = Math.max(1, ppm * .04);
      for (let f = 1; f < Math.min(l.floors, 5); f++) { const yy = l.gh + (f - 1) * l.fh + .1; rc(a, 'rgba(16,18,20,.9)', fx, yy, fw, .07); for (let bx = 0; bx <= fw; bx += .12) rc(a, 'rgba(16,18,20,.7)', fx + bx, yy, .015, .8); a.beginPath(); a.moveTo((fx + (f % 2 ? fw : 0)) * ppm, H - yy * ppm); a.lineTo((fx + (f % 2 ? .4 : fw - .4)) * ppm, H - (yy - l.fh) * ppm); a.stroke(); }
    }
    if (r.c(.12) && D.id !== 'kensington') { rc(a, '#d8d8d4', len * .7, l.gh + l.fh * r.i(0, 1) + 1.6, .5, .3); }
  }
  // grime, ambient occlusion and soft top light
  let g = a.createLinearGradient(0, H - 1.4 * ppm, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.32)'); a.fillStyle = g; a.fillRect(0, H - 1.4 * ppm, W, 1.4 * ppm);
  for (let i = 0; i < 9; i++) { const bx = r.n() * len, bw = 1 + r.n() * 3; g = a.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,.0)'); g.addColorStop(1, 'rgba(0,0,0,' + (0.04 + r.n() * .06).toFixed(3) + ')'); a.fillStyle = g; a.fillRect(bx * ppm, 0, bw * ppm, H); }
  if (l.graffiti) for (let i = 0; i < 5; i++) { a.fillStyle = rgb(r.p([[230, 60, 120], [60, 200, 230], [240, 220, 40], [120, 220, 90]])); a.beginPath(); a.ellipse(r.r(.5, len - .5) * ppm, H - r.r(.5, 2.2) * ppm, ppm * r.r(.3, .9), ppm * r.r(.2, .5), r.n() * 3, 0, TAU); a.fill(); }
  return { A, E, W, H, ppm, len, mips: [null, null, null] };
}

let _texBudgetT0 = 0;
function texBudgetReset() { _texBudgetT0 = performance.now(); }
function getLotTex(S, l) {
  if (l.tex) return l.tex;
  if (performance.now() - _texBudgetT0 > 7) return null;
  l.tex = buildLotTex(S, l);
  return l.tex;
}
