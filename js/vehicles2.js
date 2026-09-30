'use strict';
// Emergency liveries + flashing lights, the delivery moped, and cyclists.

function paintLiverySide(g, T, d, X, Y, livery) {
  const L = d[1], top = d[2], blue = [24, 64, 176], yel = [248, 222, 50], red = [200, 30, 40], grn = [30, 150, 70];
  const band = (y0, y1, c1, c2, sq) => { for (let x = .18, i = 0; x < L - .18; x += sq, i++) { g.fillStyle = rgb(i % 2 ? c1 : c2); g.fillRect(X(x), Y(y1), X(Math.min(sq, L - .18 - x) + .006), X(y1 - y0)); } };
  if (livery === 'police') { band(.44, .64, blue, yel, .34); band(.64, .84, yel, blue, .34); }
  else { band(.6, .86, grn, yel, .34); band(.86, 1.12, yel, grn, .34); g.fillStyle = rgb(red); g.fillRect(X(.1), Y(1.62), X(L - .2), X(.13)); g.fillRect(X(.1), Y(.5), X(L - .2), X(.07)); }
  g.fillStyle = '#1b2540'; g.fillRect(X(L * .38), Y(top + .1), X(.85), X(.11));
  g.fillStyle = '#2f6bff'; g.fillRect(X(L * .38 + .04), Y(top + .09), X(.36), X(.08)); g.fillStyle = '#1e46c8'; g.fillRect(X(L * .38 + .47), Y(top + .09), X(.34), X(.08));
  g.fillStyle = livery === 'police' ? '#123a8a' : '#0d4a26'; g.font = 'bold ' + Math.round(X(livery === 'police' ? .2 : .24)) + 'px Arial,sans-serif'; g.textBaseline = 'alphabetic';
  g.fillText(livery === 'police' ? 'POLICE' : 'AMBULANCE', X(livery === 'police' ? 1.6 : 1.1), Y(livery === 'police' ? .98 : 1.85));
}
function paintLiveryEnd(g, T, front, d, X, Y, livery) {
  const w = d[0], top = d[2], blue = [24, 64, 176], yel = [248, 222, 50], red = [200, 30, 40];
  g.fillStyle = '#1b2540'; g.fillRect(X(w * .2), Y(top + .13), X(w * .6), X(.14));
  g.fillStyle = '#2f6bff'; g.fillRect(X(w * .22), Y(top + .12), X(w * .27), X(.11)); g.fillStyle = '#1e46c8'; g.fillRect(X(w * .51), Y(top + .12), X(w * .27), X(.11));
  if (front) { const n = 8; for (let i = 0; i < n; i++) { g.fillStyle = rgb(i % 2 ? blue : yel); g.fillRect(X(.06 + i * (w - .12) / n), Y(.66), X((w - .12) / n + .005), X(.13)); } }
  else { const n = 10; for (let i = 0; i < n; i++) { g.fillStyle = rgb(i % 2 ? red : yel); g.beginPath(); g.moveTo(X(.05 + i * (w - .1) / n), Y(.9)); g.lineTo(X(.05 + (i + 1) * (w - .1) / n), Y(.9)); g.lineTo(X(.05 + (i + 1) * (w - .1) / n), Y(.46)); g.lineTo(X(.05 + i * (w - .1) / n), Y(.46)); g.fill(); } }
}
function emergLights(v) {
  const ph = Math.floor(world.time * 7) % 2, p0 = Pw(v.x, v.h * .5, v.z); if (!p0) return; const dm = p0[2];
  for (const s of [-1, 1]) {
    const on = (ph === 0) === (s < 0), p = Pw(v.x + s * .3, v.h - .06, v.z); if (!p) continue;
    glow(p[0], p[1], Math.max(7, F / p[2] * 1.7), on ? [70, 130, 255] : [30, 50, 150], on ? 1 : .25);
    if (on) glow(p[0], p[1], Math.max(3, F / p[2] * .5), [230, 240, 255], .9);
  }
  world.flashA = Math.max(world.flashA || 0, clamp(1 - dm / 55, 0, 1) * (ph ? 1 : .35));
  world.flashPh = ph;
}

// ---------- the delivery moped ----------
// Extrude a convex side profile [[z, y], ...] (counter-clockwise seen from +x) between x0 and x1, culling back faces.
function extrudeZY(ox, oz, prof, x0, x1, col, dm, gloss) {
  const n = prof.length, cz = camL.z - oz, cy = cam.h;
  for (let i = 0; i < n; i++) {
    const a = prof[i], b = prof[(i + 1) % n], ez = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ez, ey) || 1, nz = ey / L, ny = -ez / L;
    if (nz * (cz - a[0]) + ny * (cy - a[1]) <= 0) continue;
    const k = .72 + .38 * ny + .08 * nz;
    poly(shade(col, dm, k), [ox + x0, a[1], oz + a[0], ox + x1, a[1], oz + a[0], ox + x1, b[1], oz + b[0], ox + x0, b[1], oz + b[0]]);
  }
  const sx = camL.x > ox + x1 ? x1 : camL.x < ox + x0 ? x0 : null;
  if (sx === null) return;
  const pts = []; for (const p of prof) pts.push(ox + sx, p[1], oz + p[0]);
  poly(shade(col, dm, .84), pts);
  if (gloss && dm < 14) { // a soft highlight along the upper half of the panel
    const top = []; let ymax = -1, ymin = 9; for (const p of prof) { ymax = Math.max(ymax, p[1]); ymin = Math.min(ymin, p[1]); }
    const cut = ymin + (ymax - ymin) * .62; for (const p of prof) if (p[1] >= cut) top.push(ox + sx + (sx > 0 ? .002 : -.002), p[1] - .015, oz + p[0]);
    if (top.length >= 3) poly('rgba(255,255,255,' + (.12 * env.amb).toFixed(3) + ')', top);
  }
}
const WHEEL_PROF = (() => { const a = []; for (let i = 0; i < 18; i++) { const t = i / 18 * TAU; a.push([Math.cos(t) * .27, .27 + Math.sin(t) * .27]); } return a; })();
const HUB_PROF = WHEEL_PROF.map(p => [p[0] * .62, .27 + (p[1] - .27) * .62]);
// y: base height (kerb height when it is parked up on the pavement) - done by lowering the eye for the draw
function drawMoped(x, z, y) {
  const h0 = cam.h; cam.h -= y || 0;
  try { mopedModel(x, z); } finally { cam.h = h0; }
}
function mopedModel(x, z) {
  const teal = [30, 170, 150], dk = [38, 43, 50], blk = [16, 17, 19], chrome = [150, 156, 162];
  toCam(x, z); const dm = Math.max(_rz, NEAR);
  const hub = (wz, hx) => {
    if (Math.abs(camL.x - x) < hx) return; const sx = x + (camL.x > x ? hx : -hx), a = [], b = [];
    for (const p of HUB_PROF) { a.push(sx, p[1], wz + p[0]); b.push(sx, .27 + (p[1] - .27) * .3, wz + p[0] * .3); }
    poly(shade(chrome, dm, 1), a); poly(shade([60, 64, 70], dm, 1), b);
  };
  // contact shadow
  const sh = []; for (let i = 0; i < 12; i++) { const t = i / 12 * TAU; sh.push(x + Math.cos(t) * .34, .005, z + .02 + Math.sin(t) * 1.02); }
  poly('rgba(0,0,0,' + (.22 + .18 * env.amb).toFixed(3) + ')', sh);
  const parts = [
    [-.64, .27, () => { extrudeZY(x, z - .64, WHEEL_PROF, -.06, .06, blk, dm); hub(z - .64, .062); }],
    [.66, .27, () => { extrudeZY(x, z + .66, WHEEL_PROF, -.055, .055, blk, dm); hub(z + .66, .057); }],
    [.25, .32, () => extrudeZY(x, z, [[.08, .28], [.52, .28], [.52, .35], [.08, .35]], -.16, .16, [28, 30, 34], dm)],                         // floorboard
    [-.35, .6, () => extrudeZY(x, z, [[-.42, .3], [.12, .38], [.2, .62], [.12, .8], [-.7, .8], [-.86, .62], [-.84, .44]], -.17, .17, dk, dm, true)], // rear body
    [-.3, .86, () => extrudeZY(x, z, [[-.74, .8], [.14, .8], [.1, .88], [-.58, .92], [-.74, .87]], -.15, .15, blk, dm)],                         // seat
    [.68, .65, () => extrudeZY(x, z, [[.64, .26], [.72, .26], [.8, 1.0], [.72, 1.0]], -.035, .035, [42, 46, 52], dm)],                          // fork
    [.62, .68, () => extrudeZY(x, z, [[.46, .3], [.62, .32], [.74, .62], [.8, 1.04], [.64, 1.08], [.52, .72]], -.2, .2, teal, dm, true)],         // leg shield
    [.7, 1.1, () => {                                                                                                                            // bars, mirrors, headlight
      box(x - .35, x + .35, 1.07, 1.11, z + .63, z + .68, blk); box(x - .36, x - .26, 1.06, 1.12, z + .62, z + .69, [24, 24, 26]); box(x + .26, x + .36, 1.06, 1.12, z + .62, z + .69, [24, 24, 26]);
      for (const s of [-1, 1]) { box(x + s * .25 - .01, x + s * .25 + .01, 1.1, 1.34, z + .64, z + .66, blk); box(x + s * .27 - .06, x + s * .27 + .06, 1.3, 1.39, z + .63, z + .67, [30, 32, 36]); }
      box(x - .1, x + .1, .9, 1.08, z + .7, z + .84, teal);
      const hp = Pw(x, .99, z + .845); if (hp && camL.z > z + .84) { const r = Math.max(1.5, F / hp[2] * .055); ctx.fillStyle = env.lamp > .2 || scene.headlight > .3 ? emit([255, 250, 225], hp[2], 1) : shade([220, 222, 214], hp[2], 1.1); ctx.beginPath(); ctx.ellipse(hp[0], hp[1], r * 1.3, r, 0, 0, TAU); ctx.fill(); }
    }],
    [-.66, 1.18, () => {                                                                                                                         // delivery box
      box(x - .2, x + .2, .86, .92, z - .86, z - .44, [26, 28, 30]);
      const b = box(x - .26, x + .26, .92, 1.46, z - .94, z - .38, teal); if (!b) return;
      if (b.fzs < 0) { const zz = z - .941; fr('z', zz, x - .26, x + .26, 1.3, 1.315, shade([10, 60, 52], b.dm)); const c = Pw(x, 1.16, zz); if (c) { const r = F / c[2] * .08; ctx.fillStyle = shade([244, 244, 238], c[2]); ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, TAU); ctx.fill(); } }
      if (b.fxs) { const xx = b.fxs < 0 ? x - .261 : x + .261; fr('x', xx, z - .94, z - .38, 1.3, 1.315, shade([10, 60, 52], b.dm)); fr('x', xx, z - .86, z - .46, 1.0, 1.06, shade([244, 244, 238], b.dm, .95)); }
    }],
    [-.88, .7, () => { box(x - .1, x + .1, .66, .74, z - .9, z - .86, [120, 20, 22]); box(x - .09, x + .09, .5, .6, z - .9, z - .87, [230, 214, 90]); }],
  ];
  // painter's order inside the model
  const order = parts.map(p => { toCam(x, z + p[0]); return { d: _rz + Math.abs(camL.x - x) * .02 - p[1] * .001, f: p[2] }; }).sort((a, b) => b.d - a.d);
  for (const o of order) o.f();
  const p = Pw(x, .7, z - .91); if (p && camL.z < z - .9) glow(p[0], p[1], Math.max(5, F / p[2] * .3), [255, 40, 30], .35 + .3 * env.night);
}
function drawScooter(x, z) { drawMoped(x, z, R.onPave ? .125 : 0); }

// ---------- cyclists ----------
function drawCyclist(v) {
  const q = Pw(v.x, 0, v.z); if (!q) return; const rz = q[2], s = F / rz;
  const dirSign = v.v >= 0 ? 1 : -1, away = (FR.d * dirSign * cam.cs + FR.b * dirSign * cam.sn) > 0;
  const bx = q[0], by = q[1];
  if (s < 9) { ctx.fillStyle = shade([40, 50, 90], rz); ctx.fillRect(bx - .22 * s, by - 1.75 * s, .44 * s, 1.75 * s); return; }
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(bx, by, .32 * s, .06 * s, 0, 0, TAU); ctx.fill();
  const dk = shade([18, 18, 22], rz), sil = shade([60, 62, 68], rz);
  // wheel (edge-on), frame and rack
  ctx.fillStyle = dk; ctx.beginPath(); ctx.ellipse(bx, by - .34 * s, .035 * s, .34 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(bx - .012 * s, by - .66 * s, .012 * s, .6 * s);
  ctx.strokeStyle = sil; ctx.lineWidth = Math.max(1, .035 * s); ctx.beginPath(); ctx.moveTo(bx, by - .34 * s); ctx.lineTo(bx, by - 1.0 * s); ctx.stroke();
  if (away) { ctx.fillStyle = shade([60, 40, 30], rz); ctx.fillRect(bx - .25 * s, by - .86 * s, .5 * s, .3 * s); ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(bx - .25 * s, by - .86 * s, .5 * s, .03 * s); }
  ctx.fillStyle = dk; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx - .1 * s, by - 1.03 * s, .2 * s, .07 * s, .03 * s) : ctx.rect(bx - .1 * s, by - 1.03 * s, .2 * s, .07 * s); ctx.fill();
  person({ x: bx, y: by - .22 * s, h: 1.72 * s, dm: rz, skin: SKIN[1], hair: HAIR[0], top: [230, 236, 60], bot: [34, 36, 46], helmet: [40, 60, 130], view: away ? 'back' : 'front', armPose: 'bars', outfit: 'hiviz', pack: away ? [30, 34, 40] : null, pedal: world.time * (2 + Math.abs(v.v) * .9) + (v.ph || 0), noShadow: true });
  // handlebar in front of the torso
  ctx.strokeStyle = dk; ctx.lineWidth = Math.max(1.5, .03 * s); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx - .27 * s, by - 1.1 * s); ctx.lineTo(bx + .27 * s, by - 1.1 * s); ctx.stroke();
  if (away) { const gl = Math.max(.4, env.lamp); glow(bx, by - .62 * s, .35 * s, [255, 30, 24], .7 * gl); ctx.fillStyle = emit([255, 40, 30], rz, .9); ctx.fillRect(bx - .03 * s, by - .66 * s, .06 * s, .08 * s); }
  else { glow(bx, by - 1.0 * s, .35 * s, [255, 250, 220], .6 * Math.max(.3, env.lamp)); }
}

// ---------- the moped's own headlight: on after dark, and in fog or heavy rain ----------
let hlOn = 0, hlWas = false;
function drawHeadlight(dt) {
  const want = clamp((env.night - .25) * 1.7, 0, 1) || 0, dull = (env.fog > .012 || env.rain > .5) && env.amb < .75 ? .7 : 0, target = Math.max(want, dull);
  hlOn += (target - hlOn) * (1 - Math.exp(-dt * 3));
  const on = hlOn > .5; if (on !== hlWas) { hlWas = on; if (Snd.on) Snd.click(); }
  scene.headlight = hlOn;
  if (hlOn < .03) return;
  // The beam is rendered as a light map (how much light reaches each pixel), then the frame is multiplied by it:
  // the scene is copied through the map and added back, so dark asphalt stays dark, white lines and paint pop,
  // and cars, people and rain in the beam are lit rather than washed over.
  const gain = hlOn * clamp(1.2 - env.amb, 0, 1) * 5.5; if (gain < .03) return;
  const W = cv.width, H = cv.height;
  if (!HLC || HLC.width !== W || HLC.height !== H) { HLC = document.createElement('canvas'); HLC.width = W; HLC.height = H; HLG = HLC.getContext('2d'); }
  const g = HLG, cx = CXs + cam.yawPx, lampH = .82, wet = clamp(env.wet, 0, 1);
  // everything the beam can reach lies below its cut-off line, just under the horizon: only work on that band
  const y0 = clamp(Math.floor((HZ + .012 * F - 6) * DPR), 0, H - 1), bh = H - y0;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, y0, W, bh); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  // dipped beam: ground rows from 2 m to ~48 m. Intensity ~ aim profile x inverse-square; lateral soft falloff;
  // UK pattern kicks up on the nearside (left) so the kerb and pavement get more reach.
  const yTop = HZ + cam.h * F / 48, yBot = SH;
  const I = z => sstep(1.6, 6.5, z) * 1 / (1 + Math.pow(z / 17, 2)) * (1 - .35 * wet);
  for (let y = Math.floor(yTop); y < yBot; y += 3) {
    const z = cam.h * F / (y + 1.5 - HZ); if (z < 1.2) continue;
    const a = I(z); if (a < .004) continue;
    const hwR = (.45 + z * .2) * F / z, hwL = (.6 + z * .3) * F / z;
    const lg = g.createLinearGradient(cx - hwL * 1.6, 0, cx + hwR * 1.6, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.2, 'rgba(255,255,255,' + (a * .55).toFixed(3) + ')');
    lg.addColorStop(hwL * 1.6 / (hwL * 1.6 + hwR * 1.6), 'rgba(255,255,255,' + a.toFixed(3) + ')');
    lg.addColorStop(.86, 'rgba(255,255,255,' + (a * .4).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(cx - hwL * 1.6, y, (hwL + hwR) * 1.6, 3.2);
  }
  // upright things in the beam (car backs, legs, bollards) sit above the ground rows: light a band up to the
  // cut-off line, which falls ~1% from the lamp, so it only reaches low on anything far away
  // (drawn with 'lighten' = max, so overlapping soft half-ellipses never build up rings)
  const cut = z => HZ + (cam.h - (lampH - .012 * z)) * F / z;
  g.globalCompositeOperation = 'lighten';
  for (let z = 3; z < 40; z *= 1.12) {
    const a = I(z) * .8, yA = cut(z), yB = HZ + cam.h * F / z; if (yB - yA < 2) continue;
    const hw = (.6 + z * .24) * F / z, ex = cx - hw * .15, ry = yB - yA, rx = hw * 1.35;
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    rg.addColorStop(0, 'rgba(255,255,255,' + a.toFixed(3) + ')'); rg.addColorStop(.55, 'rgba(255,255,255,' + (a * .75).toFixed(3) + ')'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.save(); g.translate(ex, yB); g.scale(rx, ry); g.fillStyle = rg; g.fillRect(-1, -1, 2, 1); g.restore();
  }
  g.globalCompositeOperation = 'source-over';
  // modulate: light map x frame, added back 'gain' times. 'screen' adds in proportion to (1 - pixel), so dark
  // surfaces brighten while things that are already bright (lamps, tail lights, glare) are left alone.
  // (the lit copy is doubled onto itself rather than composited many times: fewer full-band blits)
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-in'; g.drawImage(cv, 0, y0, W, bh, 0, y0, W, bh);
  let k = gain; g.globalCompositeOperation = 'lighter';
  while (k > 2.2) { g.drawImage(HLC, 0, y0, W, bh, 0, y0, W, bh); k /= 2; }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen';
  for (; k > .01; k -= 1) { ctx.globalAlpha = Math.min(1, k); ctx.drawImage(HLC, 0, y0, W, bh, 0, y0, W, bh); }
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // a little warm fill so pitch-black surfaces still read, and the hot spot just ahead
  const near = P(0, 0, 8), sp = ctx.createRadialGradient(near[0], near[1], 0, near[0], near[1], SW * .32);
  sp.addColorStop(0, 'rgba(255,236,200,' + (.05 * hlOn * gain / 5.5).toFixed(3) + ')'); sp.addColorStop(1, 'rgba(255,236,200,0)');
  ctx.translate(near[0], near[1]); ctx.scale(1, .3); ctx.translate(-near[0], -near[1]); ctx.fillStyle = sp; ctx.fillRect(near[0] - SW * .32, near[1] - SW * .32, SW * .64, SW * .64);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // wet tarmac: a long glossy streak of the lamp mirrored in the road, and the beam visible in rain or fog
  if (wet > .2) { const top = P(0, 0, 30)[1], bot = P(0, 0, 3)[1]; ctx.save(); ctx.translate(cx, (top + bot) * .55); ctx.scale(1, (bot - top) / (SW * .09)); glow(0, 0, SW * .045, [255, 244, 214], .1 * wet * hlOn); ctx.restore(); }
  const haze = Math.min(1, env.rain * .9 + Math.max(0, env.fog - .005) * 40) * hlOn;
  if (haze > .05) { // the beam itself, scattered by rain or fog: a soft wedge of glow ahead, no hard edges
    const m = P(0, .6, 9); ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.translate(cx, m[1]); ctx.scale(1.25, .5); glow(0, 0, SH * .55, [255, 240, 214], .09 * haze); ctx.restore();
  }
  ctx.restore();
}
let HLC = null, HLG = null;
