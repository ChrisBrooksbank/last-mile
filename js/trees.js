'use strict';
// Street trees: painted canopies (leaf clusters with gaps, visible limbs), mottled bark, tree pits with grates.
const TREESPR = {};
function paintTree(variant, hue) {
  const W = 360, H = 460, c = C2(W, H), g = c.getContext('2d'), r = new RNG(variant * 977 + hue * 131 + 5);
  const cx = W / 2, baseY = H - 6, trunkTop = H - 150;
  // canopy palette by season
  const P = hue === 0 ? [[38, 84, 34], [58, 112, 44], [84, 140, 52], [110, 160, 60]] : hue === 1 ? [[64, 92, 30], [104, 124, 38], [150, 150, 44], [188, 168, 52]] : [[110, 60, 24], [168, 96, 30], [206, 134, 40], [226, 176, 52]];
  // trunk with a slight lean and a flared base
  const lean = r.r(-10, 10);
  const trunkPath = () => { g.beginPath(); g.moveTo(cx - 17, baseY); g.quadraticCurveTo(cx - 9, baseY - 30, cx - 9 + lean * .3, baseY - 80); g.lineTo(cx - 7 + lean, trunkTop); g.lineTo(cx + 7 + lean, trunkTop); g.lineTo(cx + 9 + lean * .3, baseY - 80); g.quadraticCurveTo(cx + 9, baseY - 30, cx + 17, baseY); g.closePath(); };
  trunkPath(); const bg = g.createLinearGradient(cx - 17, 0, cx + 17, 0); bg.addColorStop(0, '#4b4034'); bg.addColorStop(.45, '#7a6e60'); bg.addColorStop(1, '#3a3128'); g.fillStyle = bg; g.fill();
  g.save(); trunkPath(); g.clip();
  for (let i = 0; i < 60; i++) { g.fillStyle = r.c(.5) ? 'rgba(200,190,170,' + r.r(.10, .3).toFixed(2) + ')' : 'rgba(30,24,18,' + r.r(.15, .4).toFixed(2) + ')'; g.beginPath(); g.ellipse(cx + r.r(-14, 14), r.r(trunkTop, baseY), r.r(3, 9), r.r(6, 18), r.r(-.3, .3), 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(20,14,10,.35)'; g.lineWidth = 1; for (let i = 0; i < 26; i++) { const x = cx + r.r(-14, 14); g.beginPath(); g.moveTo(x, baseY); g.lineTo(x + r.r(-3, 3) + lean * (1 - (baseY - trunkTop) / 150) * .6, trunkTop + r.r(0, 30)); g.stroke(); }
  g.restore();
  // limbs
  const limb = (x, y, ang, len, w, depth) => {
    if (depth > 3 || len < 14) return;
    const x2 = x + Math.cos(ang) * len, y2 = y - Math.sin(ang) * len;
    g.strokeStyle = depth < 2 ? '#43382d' : '#3a3026'; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + r.r(-6, 6), (y + y2) / 2, x2, y2); g.stroke();
    const n = depth === 0 ? 3 : 2;
    for (let k = 0; k < n; k++) limb(x2, y2, ang + r.r(-.7, .7), len * r.r(.6, .78), w * .62, depth + 1);
  };
  for (let k = 0; k < 6; k++) limb(cx + lean, trunkTop + 6, Math.PI / 2 + (k - 2.5) * .34 + r.r(-.1, .1), r.r(60, 90), 8.5, 0);
  // canopy: many small clusters, denser and lighter toward the sunlit top-left, with gaps so sky shows through
  const ccx = cx + lean * 1.2, ccy = trunkTop - 105, rx = 160, ry = 128, clusters = 340;
  const order = []; for (let i = 0; i < clusters; i++) { const a = r.n() * TAU, d = Math.sqrt(r.n()); order.push({ x: ccx + Math.cos(a) * rx * d, y: ccy + Math.sin(a) * ry * d * (a > Math.PI ? 1 : .95), d }); }
  order.sort((a, b) => b.d - a.d);
  for (const o of order) {
    const light = clamp(.5 + (-(o.x - ccx) * .0022) + (-(o.y - ccy) * .0036) + r.r(-.18, .18), 0, 1), col = P[Math.min(3, Math.floor(light * 4))];
    const gap = r.c(.10 + o.d * .16); if (gap) continue;
    for (let k = 0; k < 9; k++) {
      const lx = o.x + r.r(-14, 14), ly = o.y + r.r(-11, 11), s = r.r(4.5, 8.5), v = r.i(-14, 14);
      g.fillStyle = 'rgb(' + clamp(col[0] + v, 0, 255) + ',' + clamp(col[1] + v, 0, 255) + ',' + clamp(col[2] + v * .5, 0, 255) + ')';
      g.beginPath(); g.ellipse(lx, ly, s, s * .72, r.n() * 3, 0, TAU); g.fill();
    }
    if (r.c(.18)) { g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(o.x + 4, o.y + 7, 12, 6, 0, 0, TAU); g.fill(); }
  }
  // dappled highlights
  for (let i = 0; i < 90; i++) { const a = r.n() * TAU, d = Math.sqrt(r.n()); const x = ccx - 30 + Math.cos(a) * rx * d * .8, y = ccy - 30 + Math.sin(a) * ry * d * .8; g.fillStyle = 'rgba(255,255,200,' + r.r(.06, .16).toFixed(2) + ')'; g.beginPath(); g.ellipse(x, y, r.r(5, 11), r.r(3, 7), r.n() * 3, 0, TAU); g.fill(); }
  return c;
}
function treeSprite(variant, hue) { const k = variant + '|' + hue; return TREESPR[k] || (TREESPR[k] = paintTree(variant, hue)); }

// draw a 2D sprite standing on the ground, lit + fogged like everything else (only opaque pixels are tinted)
function drawBillboard(img, bx, by, w, h, k, sway) {
  const x0 = bx - w / 2, y0 = by - h;
  if (x0 > SW || x0 + w < 0 || by < -20 || y0 > SH) return;
  const sx = Math.max(0, Math.floor(x0)), ex = Math.min(SW, Math.ceil(x0 + w)), sy = Math.max(-4, Math.floor(y0)), ey = Math.min(SH + 4, Math.ceil(by) + 1);
  if (ex <= sx || ey <= sy) return;
  if (!SCR || SCR.width < cv.width || SCR.height < cv.height) { SCR = document.createElement('canvas'); SCR.width = cv.width; SCR.height = cv.height; SCRg = SCR.getContext('2d'); }
  const g = SCRg; g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(sx, sy, ex - sx, ey - sy);
  g.imageSmoothingQuality = 'high'; g.drawImage(img, x0, y0, w, h);
  const amb = LIGHT ? LIGHT.amb[0] : env.amb, a = clamp(amb * (k || 1), 0, 1), nt = LIGHT ? 0 : env.night;
  g.globalCompositeOperation = 'source-atop';
  if (a < .98) { g.fillStyle = 'rgba(' + (nt * 6 | 0) + ',' + (nt * 10 | 0) + ',' + (nt * 26 | 0) + ',' + (1 - a).toFixed(3) + ')'; g.fillRect(sx, sy, ex - sx, ey - sy); }
  const rz = F * 1.7 / Math.max(h, 1) * (k ? 1 : 1), fg = fogNow(rz); if (fg > .01) { g.fillStyle = rgba(fogColNow(), fg); g.fillRect(sx, sy, ex - sx, ey - sy); }
  ctx.save(); ctx.translate(bx, by); ctx.rotate(sway || 0); ctx.translate(-bx, -by);
  ctx.drawImage(SCR, sx * DPR, sy * DPR, (ex - sx) * DPR, (ey - sy) * DPR, sx, sy, ex - sx, ey - sy);
  ctx.restore();
}
function drawTree(f) {
  const p = Pw(f.x, 0, f.z); if (!p) return; const rz = p[2];
  toCam(f.x, f.z);
  // tree pit with an iron grate, and a soft shadow on the pavement
  const gy = .126;
  poly(shade([44, 38, 32], rz), [f.x - .55, gy, f.z - .55, f.x + .55, gy, f.z - .55, f.x + .55, gy, f.z + .55, f.x - .55, gy, f.z + .55]);
  for (let k = -2; k <= 2; k++) { poly(shade([70, 72, 76], rz), [f.x - .5, gy + .003, f.z + k * .2 - .015, f.x + .5, gy + .003, f.z + k * .2 - .015, f.x + .5, gy + .003, f.z + k * .2 + .015, f.x - .5, gy + .003, f.z + k * .2 + .015]); poly(shade([70, 72, 76], rz), [f.x + k * .2 - .015, gy + .003, f.z - .5, f.x + k * .2 + .015, gy + .003, f.z - .5, f.x + k * .2 + .015, gy + .003, f.z + .5, f.x + k * .2 - .015, gy + .003, f.z + .5]); }
  const sh = []; for (let k = 0; k < 12; k++) { const an = k / 12 * TAU; sh.push(f.x + Math.cos(an) * 2.6 * f.sz, gy + .002, f.z + Math.sin(an) * 2.2 * f.sz); }
  poly('rgba(0,0,0,' + (0.15 * (0.4 + env.day * .6)).toFixed(2) + ')', sh);
  if (f.guard) for (const sd of [-1, 1]) { box(f.x - .6, f.x + .6, 0, .9, f.z + sd * .6 - .015, f.z + sd * .6 + .015, [30, 34, 38]); box(f.x + sd * .6 - .015, f.x + sd * .6 + .015, 0, .9, f.z - .6, f.z + .6, [30, 34, 38]); }
  if (rz > 150) return;
  const variant = (f.z * 7 | 0) % 4, hue = f.hue < .55 ? 0 : f.hue < .85 ? 1 : 2, spr = treeSprite(variant < 0 ? -variant : variant, hue);
  const hm = 9 * f.sz, wm = 7.2 * f.sz, s = F / rz;
  drawBillboard(spr, p[0], p[1], wm * s, hm * s * (460 / 400), 1, Math.sin(world.time * .7 + f.z) * .006 * (1 + env.rain));
}
