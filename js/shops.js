'use strict';
// Restaurant interiors: fast-food restaurant, ghost (dark) kitchen, and a proper sit-down restaurant.
const FAST_CUISINES = ['Burgers', 'Chicken', 'Fish & Chips', 'Kebab'];
function makeShop(cu, busy) {
  const q = G.n(); let venue;
  if (FAST_CUISINES.includes(cu.k)) venue = q < .6 ? 'fast' : q < .9 ? 'ghost' : 'sit';
  else if (cu.k === 'Pizza') venue = q < .35 ? 'fast' : q < .65 ? 'sit' : 'ghost';
  else venue = q < .15 ? 'fast' : q < .45 ? 'ghost' : 'sit';
  if (['fast', 'ghost', 'sit'].includes(QP.get('venue'))) venue = QP.get('venue');
  const look = () => {
    const l = randomLook(G, 'staff');
    if (venue === 'fast') { l.outfit = 'tee'; l.top = mixc(cu.col, [255, 255, 255], .05); l.hairStyle = 'cap'; l.cap = cu.col; l.glasses = false; }
    else if (venue === 'ghost') { l.outfit = 'shirt'; l.top = [242, 242, 238]; l.inner = [242, 242, 238]; l.hairStyle = 'cap'; l.cap = [246, 246, 244]; l.bot = [60, 64, 72]; }
    else { l.outfit = 'apron'; l.top = [248, 248, 246]; l.apron = [28, 30, 36]; }
    return l;
  };
  const staff = [{ x: .34, hh: .86, sp: .5, ph: 0, amp: .01, look: look(), mood: 'ok' }, { x: .64, hh: .78, sp: .8, ph: 2, amp: .035, look: look() }];
  return { cu, venue, staff, others: Array.from({ length: busy }, (_, i) => ({ x: i ? .93 : .06, col: G.p([[30, 170, 150], [220, 60, 60], [60, 90, 200]]), look: randomLook(G, 'rider') })), bag: 0, bagGrab: 0 };
}

function foodIcon(k, x, y, s) {
  const c = ctx; c.save(); c.translate(x, y);
  if (k === 'Pizza') { c.fillStyle = '#e8b04a'; c.beginPath(); c.arc(0, 0, s * .46, 0, TAU); c.fill(); c.fillStyle = '#c8402a'; c.beginPath(); c.arc(0, 0, s * .38, 0, TAU); c.fill(); c.fillStyle = '#f0d060'; c.beginPath(); c.arc(0, 0, s * .34, 0, TAU); c.fill(); c.fillStyle = '#b33222'; for (const [a, b] of [[-.14, -.1], [.12, -.16], [.02, .14], [-.2, .12], [.2, .08]]) { c.beginPath(); c.arc(a * s, b * s, s * .07, 0, TAU); c.fill(); } }
  else if (k === 'Chicken') { c.fillStyle = '#b8742a'; c.beginPath(); c.ellipse(-s * .06, -s * .06, s * .3, s * .22, -.7, 0, TAU); c.fill(); c.fillStyle = '#e8e2d2'; c.fillRect(s * .12, s * .1, s * .08, s * .3); c.beginPath(); c.arc(s * .12, s * .42, s * .06, 0, TAU); c.arc(s * .2, s * .42, s * .06, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,220,140,.4)'; c.beginPath(); c.ellipse(-s * .12, -s * .14, s * .1, s * .06, -.7, 0, TAU); c.fill(); }
  else if (k === 'Fish & Chips') { c.fillStyle = '#d99a3c'; c.beginPath(); c.ellipse(-s * .05, -s * .05, s * .42, s * .2, -.2, 0, TAU); c.fill(); c.beginPath(); c.moveTo(s * .3, -s * .1); c.lineTo(s * .5, -s * .28); c.lineTo(s * .5, s * .1); c.fill(); c.fillStyle = '#f0c23a'; for (let i = 0; i < 6; i++) c.fillRect(-s * .4 + i * s * .09, s * .1, s * .06, s * .32); }
  else { c.fillStyle = '#d9a25a'; c.beginPath(); c.ellipse(0, -s * .2, s * .42, s * .22, 0, Math.PI, 0); c.fill(); c.fillStyle = '#3f9a3a'; c.fillRect(-s * .44, -s * .2, s * .88, s * .07); c.fillStyle = '#f0c23a'; c.fillRect(-s * .4, -s * .14, s * .8, s * .06); c.fillStyle = '#6b3a22'; c.fillRect(-s * .42, -s * .08, s * .84, s * .13); c.fillStyle = '#d9a25a'; c.beginPath(); c.ellipse(0, s * .12, s * .4, s * .09, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.7)'; for (const a of [-.2, 0, .2]) c.fillRect(a * s, -s * .32, s * .04, s * .03); }
  c.restore();
}
const grad2 = (y0, y1, a, b) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };

// ---------- backdrops ----------
function shopFast(S, t, w, h, cu) {
  ctx.fillStyle = grad2(0, h * .72, '#f6f1e8', rgb(cu.wall)); ctx.fillRect(-10, -10, w + 20, h * .74);
  ctx.fillStyle = '#f9f9f7'; ctx.fillRect(-10, -10, w + 20, h * .06); ctx.fillStyle = 'rgba(0,0,0,.06)'; for (let x = 0; x < w; x += w / 8) ctx.fillRect(x, 0, 2, h * .06);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(w * (.06 + i * .19), h * .02, w * .13, h * .012); glow(w * (.125 + i * .19), h * .025, h * .16, [255, 250, 235], .25); }
  // backlit menu boards with food pictures and prices
  for (let i = 0; i < 4; i++) {
    const bx = w * (.05 + i * .235), by = h * .1, bw = w * .215, bh = h * .23;
    ctx.fillStyle = '#101216'; ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = rgb(cu.col); ctx.fillRect(bx, by, bw, bh * .17);
    ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(bh * .11) + 'px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(['MEALS', 'SIDES', 'DRINKS', 'DESSERTS'][i], bx + bw * .05, by + bh * .085);
    for (let k = 0; k < 6; k++) {
      const tx = bx + bw * (.05 + (k % 3) * .31), ty = by + bh * (.24 + Math.floor(k / 3) * .38), tw = bw * .28, th = bh * .34;
      ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(tx, ty, tw, th); foodIcon(cu.k, tx + tw / 2, ty + th * .42, Math.min(tw, th) * .9);
      ctx.fillStyle = '#ffe28a'; ctx.font = '700 ' + Math.round(th * .2) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('£' + (3 + ((i * 7 + k * 3) % 8)) + '.' + ['49', '99', '29', '79'][(i + k) % 4], tx + tw / 2, ty + th * .9);
    }
    glow(bx + bw / 2, by + bh / 2, bw * .75, [255, 240, 210], .12);
  }
  // kitchen line: stainless kit, fryers and a heat-lamp shelf
  const ky = h * .38;
  ctx.fillStyle = grad2(ky, h * .72, '#c9ced2', '#8f969c'); ctx.fillRect(w * .1, ky, w * .8, h * .34);
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1; for (let x = w * .1; x < w * .9; x += w * .04) { ctx.beginPath(); ctx.moveTo(x, ky); ctx.lineTo(x, h * .72); ctx.stroke(); }
  ctx.fillStyle = '#2a2d31'; ctx.fillRect(w * .12, ky + h * .07, w * .14, h * .05); for (let i = 0; i < 3; i++) { ctx.fillStyle = '#6a6e74'; ctx.fillRect(w * (.135 + i * .04), ky + h * .12, w * .03, h * .09); ctx.fillStyle = '#1a1c20'; ctx.fillRect(w * (.14 + i * .04), ky + h * .1, w * .02, h * .03); }
  ctx.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(w * (.14 + i * .04) + Math.sin(t + i) * 4, ky + h * .04 - ((t * 24 + i * 15) % 40), 8, 16, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#2b2e33'; ctx.fillRect(w * .62, ky + h * .04, w * .26, h * .03); glow(w * .75, ky + h * .07, w * .16, [255, 150, 60], .55);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#e8c470', '#d8a850', '#e0b860'][i % 3]; ctx.fillRect(w * (.64 + i * .045), ky + h * .09, w * .035, h * .03); ctx.fillStyle = '#eee'; ctx.fillRect(w * (.64 + i * .045), ky + h * .085, w * .035, h * .008); }
  // digital order screen
  const sx = w * .4, sy = h * .34, sw = w * .2, sh = h * .095; ctx.fillStyle = '#0b0d10'; ctx.fillRect(sx, sy - h * .05, sw, sh + h * .05);
  ctx.fillStyle = '#ffdd55'; ctx.font = '800 ' + Math.round(h * .022) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('PREPARING', sx + sw * .25, sy - h * .033); ctx.fillStyle = '#5be07a'; ctx.fillText('READY', sx + sw * .75, sy - h * .033);
  ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(h * .03) + 'px system-ui,sans-serif';
  const ready = S.bag > 0; ['214', '215', '217'].forEach((n, i) => ctx.fillText(n, sx + sw * .25, sy + i * h * .03)); ['211', '212', ready ? String(S.order || 216) : '213'].forEach((n, i) => { ctx.fillStyle = (ready && i === 2 && Math.floor(t * 3) % 2) ? '#9dffb0' : '#fff'; ctx.fillText(n, sx + sw * .75, sy + i * h * .03); });
  ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(sx + sw / 2, sy - h * .04, 1, sh + h * .04);
  // self-order kiosks
  for (let i = 0; i < 2; i++) { const kx = w * (.02 + i * .085), kw = w * .07; ctx.fillStyle = '#23262b'; ctx.fillRect(kx, h * .38, kw, h * .36); ctx.fillStyle = '#0c2a44'; ctx.fillRect(kx + kw * .07, h * .4, kw * .86, h * .22); ctx.fillStyle = rgb(cu.col); ctx.fillRect(kx + kw * .07, h * .4, kw * .86, h * .035); for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 2; c2++) { ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(kx + kw * (.12 + c2 * .42), h * (.45 + r * .05), kw * .36, h * .04); } glow(kx + kw / 2, h * .5, kw * 1.2, [120, 190, 255], .25); ctx.fillStyle = '#0a0a0c'; ctx.fillRect(kx + kw * .3, h * .65, kw * .4, h * .03); }
  // floor tiles hint
  ctx.fillStyle = grad2(h * .7, h, '#8a8d92', '#55585c'); ctx.fillRect(-10, h * .7, w + 20, h * .3 + 10);
}
function shopGhost(S, t, w, h, cu) {
  ctx.fillStyle = grad2(0, h * .72, '#aeb4b8', '#7d868c'); ctx.fillRect(-10, -10, w + 20, h * .74);
  ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1.5; for (let x = 0; x < w; x += w / 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h * .72); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let x = 0; x < w; x += w / 14) ctx.fillRect(x + 2, 0, 3, h * .72);
  ctx.fillStyle = '#585e63'; ctx.fillRect(-10, -10, w + 20, h * .05); for (let i = 0; i < 4; i++) { const lx = w * (.08 + i * .24); ctx.fillStyle = '#e8f2ee'; ctx.fillRect(lx, h * .024, w * .18, h * .011); glow(lx + w * .09, h * .03, h * .22, [210, 240, 230], .3); }
  ctx.fillStyle = '#4a4f54'; ctx.fillRect(w * .34, h * .055, w * .3, h * .04); ctx.fillStyle = '#31353a'; for (let i = 0; i < 6; i++) ctx.fillRect(w * (.35 + i * .045), h * .095, w * .03, h * .015);
  // the hatch: cook line behind it
  const hx = w * .22, hy = h * .2, hw2 = w * .56, hh = h * .5;
  ctx.fillStyle = '#1b1c1e'; ctx.fillRect(hx - 10, hy - 10, hw2 + 20, hh + 10);
  ctx.fillStyle = grad2(hy, hy + hh, '#d5d7d2', '#8b8f8a'); ctx.fillRect(hx, hy, hw2, hh);
  ctx.fillStyle = '#7d8286'; for (let i = 0; i < 3; i++) ctx.fillRect(hx, hy + hh * (.26 + i * .2), hw2, h * .012);
  for (let i = 0; i < 9; i++) { ctx.fillStyle = ['#c9302c', '#e0e0d8', '#2c7fb8', '#f0c23a'][i % 4]; ctx.fillRect(hx + hw2 * (.04 + i * .1), hy + hh * .17, hw2 * .06, hh * .09); }
  ctx.strokeStyle = '#9ba0a4'; ctx.lineWidth = 3; for (let i = 0; i < 6; i++) { const ux = hx + hw2 * (.08 + i * .16); ctx.beginPath(); ctx.moveTo(ux, hy + hh * .02); ctx.lineTo(ux, hy + hh * .09); ctx.stroke(); ctx.fillStyle = '#a8adb1'; ctx.fillRect(ux - 6, hy + hh * .09, 12, hh * .07); }
  glow(hx + hw2 * .7, hy + hh * .62, hw2 * .18, [255, 150, 60], .5 + .15 * Math.sin(t * 9)); ctx.fillStyle = '#26282b'; ctx.fillRect(hx + hw2 * .62, hy + hh * .6, hw2 * .2, hh * .05);
  ctx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(hx + hw2 * (.2 + i * .16) + Math.sin(t + i) * 5, hy + hh * .5 - ((t * 20 + i * 17) % 50), 9, 18, 0, 0, TAU); ctx.fill(); }
  // background cooks
  for (const [cx2, ph2] of [[.34, 0], [.62, 2]]) { const c2 = randomLook(new RNG(Math.round(cx2 * 100)), 'staff'); person(Object.assign({}, c2, { x: w * cx2 + Math.sin(t * .7 + ph2) * 6, y: hy + hh * 1.05, h: hh * .95, view: 'front', raw: true, noShadow: true, outfit: 'shirt', top: [242, 242, 238], hairStyle: 'cap', cap: [246, 246, 244], act: Math.sin(t + ph2) > .3 ? 'talk' : null, actT: t })); }
  ctx.fillStyle = 'rgba(180,190,185,.16)'; ctx.fillRect(hx, hy, hw2, hh);
  // roller shutter frame + signage
  ctx.fillStyle = '#5a6066'; ctx.fillRect(hx - 14, hy - 22, hw2 + 28, 14); ctx.fillStyle = '#ffd400'; ctx.font = '800 ' + Math.round(h * .026) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('COURIER PICK-UP  ·  HAVE YOUR ORDER NUMBER READY', w / 2, hy - 15);
  // pickup racks with multi-brand bags, order tablets, lockers
  const rx = w * .02, ry = h * .26; ctx.fillStyle = '#393d42'; ctx.fillRect(rx, ry, w * .17, h * .46); for (let sh = 0; sh < 4; sh++) { ctx.fillStyle = '#6f757a'; ctx.fillRect(rx, ry + h * .115 * (sh + 1) - 4, w * .17, 4); for (let b = 0; b < 3; b++) { ctx.fillStyle = 'rgb(212,186,146)'; ctx.fillRect(rx + w * (.01 + b * .055), ry + h * (.115 * sh + .02), w * .045, h * .08); ctx.fillStyle = ['#c9302c', '#2c7fb8', '#3a9a4a', '#f0a020', '#8a3aa0'][(sh * 3 + b) % 5]; ctx.fillRect(rx + w * (.01 + b * .055), ry + h * (.115 * sh + .05), w * .045, h * .02); ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(h * .014) + 'px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(30 + sh * 7 + b * 3), rx + w * (.0325 + b * .055), ry + h * (.115 * sh + .09)); } }
  for (let i = 0; i < 3; i++) { const tx = w * .81, ty = h * (.24 + i * .16); ctx.fillStyle = '#0a0b0d'; ctx.fillRect(tx, ty, w * .13, h * .13); ctx.fillStyle = (Math.floor(t * 2 + i) % 3 === 0) ? '#ff5a3a' : '#1a3a52'; ctx.fillRect(tx + 4, ty + 4, w * .13 - 8, h * .02); for (let r = 0; r < 4; r++) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(tx + 8, ty + h * (.035 + r * .022), w * (.05 + ((r * 5 + i) % 4) * .012), 3); } glow(tx + w * .065, ty + h * .065, w * .09, [120, 190, 255], .18); }
  ctx.fillStyle = '#26292d'; ctx.fillRect(w * .955, h * .3, w * .04, h * .42); for (let i = 0; i < 6; i++) { ctx.fillStyle = '#4a5056'; ctx.fillRect(w * .958, h * (.31 + i * .065), w * .034, h * .055); ctx.fillStyle = i % 2 ? '#3ad068' : '#e0403a'; ctx.fillRect(w * .982, h * (.32 + i * .065), w * .006, h * .012); }
  // concrete floor with hazard tape
  ctx.fillStyle = grad2(h * .7, h, '#5c6064', '#35383b'); ctx.fillRect(-10, h * .7, w + 20, h * .3 + 10);
  ctx.fillStyle = '#f0c200'; for (let x = -20; x < w + 40; x += 34) { ctx.beginPath(); ctx.moveTo(x, h * .705); ctx.lineTo(x + 17, h * .705); ctx.lineTo(x + 7, h * .72); ctx.lineTo(x - 10, h * .72); ctx.fill(); }
}
function shopSit(S, t, w, h, cu) {
  const warm = mixc(cu.wall, [120, 70, 40], .55);
  ctx.fillStyle = grad2(0, h * .74, rgb(mulc(warm, .55)), rgb(mulc(warm, .8))); ctx.fillRect(-10, -10, w + 20, h * .76);
  // wood panelling and dado rail
  ctx.fillStyle = grad2(h * .42, h * .74, '#4b2f1c', '#2f1c10'); ctx.fillRect(-10, h * .42, w + 20, h * .32);
  for (let x = 0; x < w; x += w / 9) { ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.strokeRect(x + 6, h * .45, w / 9 - 12, h * .25); ctx.strokeStyle = 'rgba(255,220,170,.10)'; ctx.strokeRect(x + 9, h * .46, w / 9 - 18, h * .23); }
  ctx.fillStyle = '#6a4326'; ctx.fillRect(-10, h * .415, w + 20, h * .014);
  // picture frames, mirror, wall lights
  for (const [fx, fy, fw, fh] of [[.06, .12, .1, .16], [.19, .16, .07, .1], [.7, .1, .12, .18], [.84, .15, .08, .1]]) { ctx.fillStyle = '#c9a25a'; ctx.fillRect(w * fx - 5, h * fy - 5, w * fw + 10, h * fh + 10); ctx.fillStyle = grad2(h * fy, h * (fy + fh), rgb(mulc(cu.col, .8)), rgb(mulc(cu.col, .4))); ctx.fillRect(w * fx, h * fy, w * fw, h * fh); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(w * fx + 6, h * fy + 6, w * fw * .4, 3); }
  ctx.fillStyle = 'rgba(190,210,220,.5)'; ctx.fillRect(w * .36, h * .1, w * .22, h * .22); ctx.strokeStyle = '#c9a25a'; ctx.lineWidth = 6; ctx.strokeRect(w * .36, h * .1, w * .22, h * .22); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(w * .37, h * .31); ctx.lineTo(w * .43, h * .11); ctx.lineTo(w * .48, h * .11); ctx.lineTo(w * .42, h * .31); ctx.fill();
  // pendant lamps
  for (let i = 0; i < 4; i++) { const lx = w * (.14 + i * .24), ly = h * (.14 + (i % 2) * .03); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly); ctx.stroke(); ctx.fillStyle = '#2b2118'; ctx.beginPath(); ctx.moveTo(lx - h * .04, ly + h * .05); ctx.lineTo(lx - h * .015, ly); ctx.lineTo(lx + h * .015, ly); ctx.lineTo(lx + h * .04, ly + h * .05); ctx.fill(); glow(lx, ly + h * .05, h * .28, [255, 200, 120], .55); ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.ellipse(lx, ly + h * .05, h * .028, h * .008, 0, 0, TAU); ctx.fill(); }
  // bar shelves at the right, lit bottles
  const bx = w * .8, by = h * .2; ctx.fillStyle = '#20140c'; ctx.fillRect(bx, by, w * .18, h * .5); for (let sh = 0; sh < 3; sh++) { ctx.fillStyle = '#6a4326'; ctx.fillRect(bx, by + h * .15 * (sh + 1) - 3, w * .18, 5); glow(bx + w * .09, by + h * (.15 * sh + .08), w * .11, [255, 190, 110], .35); for (let b = 0; b < 6; b++) { const c2 = ['#2f7a44', '#7a2f2f', '#c98a2a', '#2f4f7a', '#d8d0b8'][(b + sh) % 5]; ctx.fillStyle = c2; ctx.fillRect(bx + w * (.01 + b * .028), by + h * (.15 * sh + .04), w * .014, h * .1); ctx.fillRect(bx + w * (.0125 + b * .028), by + h * (.15 * sh + .025), w * .009, h * .02); } }
  // dining room floor in perspective + tables, chairs and diners
  const fy = h * .58; ctx.fillStyle = grad2(fy, h, '#3a2416', '#5a3a22'); ctx.fillRect(-10, fy, w + 20, h - fy + 10);
  ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1.5; for (let i = -6; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(w * .5 + (i - 4) * w * .03, fy); ctx.lineTo(w * .5 + (i - 4) * w * .14, h); ctx.stroke(); } for (let k = 1; k < 7; k++) { const yy = fy + (h - fy) * Math.pow(k / 7, 1.6); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
  const tables = [[.13, .66, .8], [.31, .62, .6], [.7, .63, .62], [.9, .67, .85]];
  tables.forEach(([tx, ty, sc], i) => {
    const px = w * tx, py = h * ty, s = h * .2 * sc;
    // seated diners behind the tables
    if (i !== 1) for (const sdx of [-1, 1]) { const dl = randomLook(new RNG(i * 31 + (sdx > 0 ? 7 : 3)), 'plain'); person(Object.assign({}, dl, { x: px + sdx * s * .62, y: py + s * .5, h: s * 2.15, view: 'front', raw: true, noShadow: true, outfit: 'jacket', mood: 'happy', act: Math.sin(t * .6 + i * 2 + sdx) > .6 ? 'talk' : null, actT: t })); }
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(px, py + s * .95, s * 1.15, s * .22, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3a2416'; ctx.fillRect(px - s * .05, py + s * .32, s * .1, s * .62);
    ctx.fillStyle = '#f5f1e8'; ctx.beginPath(); ctx.ellipse(px, py + s * .26, s * 1.1, s * .3, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(px, py + s * .34, s * 1.1, s * .3, 0, 0, Math.PI); ctx.fill();
    for (const sdx of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(px + sdx * s * .5, py + s * .25, s * .2, s * .07, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.stroke(); ctx.fillStyle = 'rgba(190,210,230,.7)'; ctx.fillRect(px + sdx * s * .82, py - s * .04, s * .06, s * .2); }
    ctx.fillStyle = '#fff5d0'; ctx.fillRect(px - s * .02, py - s * .02, s * .04, s * .16); glow(px, py - s * .04, s * .45, [255, 190, 100], .5 + .08 * Math.sin(t * 7 + i));
    ctx.fillStyle = 'rgba(255,190,90,.9)'; ctx.beginPath(); ctx.ellipse(px, py - s * .04, s * .025, s * .05, 0, 0, TAU); ctx.fill();
  });
  // a plant and a menu stand near the entrance
  ctx.fillStyle = '#5a3a22'; ctx.fillRect(w * .02, h * .5, w * .07, h * .2); ctx.fillStyle = '#2f6a34'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(w * (.02 + Math.sin(i * 2.1) * .03 + .035), h * (.38 + (i % 4) * .03), w * .03, h * .04, i, 0, TAU); ctx.fill(); }
}

function renderShop(dt) {
  const S = scene.shop; if (!S) return;
  const w = SW, h = SH, t = scene.t, cu = S.cu, venue = S.venue;
  const bob = Math.sin(scene.wph * 2) * 2;
  ctx.save(); ctx.translate(0, bob);
  (venue === 'fast' ? shopFast : venue === 'ghost' ? shopGhost : shopSit)(S, t, w, h, cu);
  // staff
  for (const p of S.staff) {
    const px = w * p.x + Math.sin(t * p.sp + p.ph) * w * p.amp, py = h * .74 + h * p.hh * .4;
    person(Object.assign({}, p.look, { x: px, y: py + (p.bow || 0), h: h * p.hh, view: 'front', raw: true, noShadow: true, mood: p.mood, reach: p.reach || 0, reachSide: 1 }));
  }
  // counter
  const cy = h * .74;
  if (venue === 'sit') {
    ctx.fillStyle = grad2(cy, h, '#4b2f1c', '#2a190e'); ctx.fillRect(w * .22, cy, w * .56, h - cy + 10);
    ctx.fillStyle = '#6a4326'; ctx.fillRect(w * .21, cy - h * .02, w * .58, h * .03); ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(w * .21, cy - h * .02, w * .58, 2);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) ctx.strokeRect(w * (.24 + i * .13), cy + h * .04, w * .11, h * .18);
    ctx.fillStyle = '#c9a25a'; ctx.fillRect(w * .32, cy - h * .09, 4, h * .07); ctx.beginPath(); ctx.arc(w * .322, cy - h * .09, h * .022, Math.PI, 0); ctx.fill(); glow(w * .322, cy - h * .09, h * .1, [255, 210, 130], .5);
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(w * .58, cy - h * .05, w * .08, h * .03); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(w * .585, cy - h * .045, w * .04, 3);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, cy + h * .1, w * .22, h);
  } else if (venue === 'ghost') {
    ctx.fillStyle = grad2(cy, h, '#b9bfc3', '#6d7479'); ctx.fillRect(-10, cy, w + 20, h - cy + 10);
    ctx.fillStyle = '#d5dade'; ctx.fillRect(-10, cy - h * .018, w + 20, h * .028); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(-10, cy - h * .018, w + 20, 2);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let x = 0; x < w; x += w / 10) ctx.fillRect(x, cy + h * .02, 2, h * .3);
    ctx.fillStyle = '#26292d'; ctx.fillRect(w * .68, cy - h * .09, w * .08, h * .075); ctx.fillStyle = '#7fe0c0'; ctx.fillRect(w * .69, cy - h * .082, w * .06, h * .022);
    ctx.fillStyle = '#f2f2ee'; ctx.fillRect(w * .84, cy - h * .05, w * .05, h * .035); ctx.fillStyle = '#d33'; ctx.fillRect(w * .845, cy - h * .045, w * .02, h * .012);
    ctx.fillStyle = '#222'; ctx.fillRect(w * .55, cy - h * .07, w * .06, h * .05); ctx.fillStyle = '#fff'; ctx.fillRect(w * .56, cy - h * .02, w * .025, h * (.02 + .02 * Math.sin(t * 2) ** 2));
  } else {
    ctx.fillStyle = grad2(cy, h, rgb(mulc(cu.col, .8)), rgb(mulc(cu.col, .45))); ctx.fillRect(-10, cy, w + 20, h - cy + 10);
    ctx.fillStyle = '#e8e4dc'; ctx.fillRect(-10, cy - h * .018, w + 20, h * .028); ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(-10, cy - h * .018, w + 20, 2);
    for (const px of [.66, .82]) { ctx.fillStyle = '#1e2126'; ctx.fillRect(w * px, cy - h * .1, w * .07, h * .085); ctx.fillStyle = '#7ce0ff'; ctx.fillRect(w * (px + .006), cy - h * .092, w * .058, h * .03); }
    ctx.fillStyle = '#f5f2ea'; for (let i = 0; i < 4; i++) ctx.fillRect(w * (.5 + i * .012), cy - h * (.035 + i * .004), w * .03, h * (.035 + i * .004));
    ctx.fillStyle = 'rgba(200,220,230,.7)'; ctx.fillRect(w * .58, cy - h * .06, w * .03, h * .045);
  }
  // the order on the counter
  if (S.bag > 0) {
    const b = S.bag, s = h * .2, bx = w * lerp(.42, .55, S.bagGrab || 0), by = cy - (S.bagGrab || 0) * h * .12 + (1 - Math.min(1, b)) * h * .06;
    ctx.save(); ctx.globalAlpha = Math.min(1, b * 2); ctx.translate(bx, by + s * .4);
    ctx.fillStyle = 'rgb(214,188,148)'; ctx.fillRect(-s * .3, -s * .8, s * .6, s * .8); ctx.fillStyle = 'rgb(190,162,122)'; ctx.beginPath(); ctx.moveTo(s * .3, -s * .8); ctx.lineTo(s * .36, 0); ctx.lineTo(s * .3, 0); ctx.fill();
    ctx.fillStyle = rgb(cu.col); ctx.fillRect(-s * .3, -s * .5, s * .6, s * .14);
    // order sticker with a QR-style code
    ctx.fillStyle = '#fff'; ctx.fillRect(-s * .22, -s * .3, s * .3, s * .2); ctx.fillStyle = '#111'; for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) if (hash(i, j, 3) < .5) ctx.fillRect(-s * .2 + i * s * .045, -s * .28 + j * s * .045, s * .04, s * .04);
    ctx.strokeStyle = 'rgb(160,130,90)'; ctx.lineWidth = s * .03; ctx.beginPath(); ctx.arc(-s * .12, -s * .82, s * .12, Math.PI, 0); ctx.arc(s * .12, -s * .82, s * .12, Math.PI, 0); ctx.stroke(); ctx.restore();
  }
  // another courier waiting
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
  ctx.fillStyle = venue === 'ghost' ? 'rgba(180,220,210,.05)' : venue === 'sit' ? 'rgba(255,170,90,.08)' : 'rgba(255,240,220,.04)'; ctx.fillRect(0, 0, w, h);
}
