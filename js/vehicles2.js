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
const MP = {};
function paintMoped(view) {
  const teal = [30, 170, 150], dk = [40, 46, 54];
  if (view === 'side') {
    const c = C2(190, 152), g = c.getContext('2d'), X = m => m * 100, Y = m => 148 - m * 100;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(X(.15), Y(.04), X(1.5), X(.06));
    // body
    smoothClosed(g, [[.12, .46], [.1, .78], [.55, .88], [1.0, .82], [1.06, .56], [.86, .34], [.35, .34]], X, Y); g.fillStyle = bodyGradient(g, Y(.9), Y(.34), dk); g.fill();
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(X(.15), Y(.86), X(.8), 2);
    // battery panel + logo
    g.fillStyle = 'rgba(20,24,28,.7)'; g.fillRect(X(.42), Y(.6), X(.5), X(.16)); g.fillStyle = '#7ce9ff'; g.fillRect(X(.46), Y(.55), X(.12), 2);
    // floorboard + leg shield
    g.fillStyle = '#1c2024'; g.fillRect(X(1.0), Y(.3), X(.36), X(.07));
    smoothClosed(g, [[1.28, .32], [1.32, .68], [1.42, 1.06], [1.54, 1.07], [1.5, .6], [1.44, .3]], X, Y); g.fillStyle = bodyGradient(g, Y(1.06), Y(.3), teal); g.fill();
    // fork + wheels
    g.strokeStyle = '#2b2f36'; g.lineWidth = 5; g.beginPath(); g.moveTo(X(1.55), Y(1.02)); g.lineTo(X(1.57), Y(.27)); g.stroke();
    paintWheel(g, X(.38), Y(.27), X(.27)); paintWheel(g, X(1.57), Y(.27), X(.27));
    g.fillStyle = rgb(teal); g.beginPath(); g.arc(X(1.57), Y(.27), X(.33), Math.PI * 1.02, Math.PI * 1.92); g.lineTo(X(1.57), Y(.27)); g.fill();
    g.fillStyle = rgb(dk); g.beginPath(); g.arc(X(.38), Y(.27), X(.31), Math.PI * 1.02, Math.PI * 1.75); g.lineTo(X(.38), Y(.27)); g.fill();
    // handlebar, mirror, screen, headlight
    g.fillStyle = '#16181c'; g.fillRect(X(1.38), Y(1.12), X(.26), X(.05));
    g.strokeStyle = '#16181c'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(X(1.5), Y(1.14)); g.lineTo(X(1.45), Y(1.32)); g.stroke(); g.fillStyle = '#5a6672'; g.beginPath(); g.ellipse(X(1.44), Y(1.34), X(.06), X(.04), 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(150,190,220,.5)'; g.beginPath(); g.moveTo(X(1.5), Y(1.14)); g.lineTo(X(1.62), Y(1.02)); g.lineTo(X(1.55), Y(1.02)); g.fill();
    g.fillStyle = '#f3f0dc'; g.beginPath(); g.ellipse(X(1.68), Y(.94), X(.05), X(.07), 0, 0, TAU); g.fill();
    // seat + delivery box
    g.fillStyle = '#0d0e10'; smoothClosed(g, [[.3, .8], [.35, .9], [.95, .9], [1.0, .82]], X, Y); g.fill();
    g.fillStyle = bodyGradient(g, Y(1.44), Y(.92), teal); g.fillRect(X(-.0), Y(1.44), X(.68), X(.52));
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, Y(1.34), X(.68), 2); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(X(.05), Y(1.02), X(.58), X(.05)); g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(X(.34), Y(1.2), X(.09), 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, Y(1.44), X(.68), 3);
    g.fillStyle = '#c22'; g.fillRect(X(0), Y(.7), X(.06), X(.1));
    g.strokeStyle = '#25282c'; g.lineWidth = 3; g.beginPath(); g.moveTo(X(.75), Y(.34)); g.lineTo(X(.85), Y(.06)); g.stroke();
    return c;
  }
  const c = C2(62, 152), g = c.getContext('2d'), X = m => m * 100, Y = m => 148 - m * 100, front = view === 'front';
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(X(.08), Y(.03), X(.46), X(.05));
  g.fillStyle = '#0c0c0e'; g.fillRect(X(.24), Y(.5), X(.14), X(.5)); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(X(.26), Y(.5), 2, X(.5));
  smoothClosed(g, [[.14, .5], [.16, .86], [.31, .92], [.46, .86], [.48, .5]], X, Y); g.fillStyle = bodyGradient(g, Y(.9), Y(.5), front ? teal : dk); g.fill();
  if (front) {
    g.fillStyle = '#f3f0dc'; g.beginPath(); g.ellipse(X(.31), Y(.85), X(.07), X(.05), 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(150,190,220,.45)'; g.fillRect(X(.16), Y(1.1), X(.3), X(.2));
    g.fillStyle = '#16181c'; g.fillRect(X(.02), Y(1.14), X(.58), X(.04)); g.fillStyle = '#5a6672'; for (const x of [.02, .56]) { g.beginPath(); g.ellipse(X(x), Y(1.3), X(.05), X(.04), 0, 0, TAU); g.fill(); g.fillStyle = '#16181c'; g.fillRect(X(x) - 1, Y(1.28), 2, X(.14)); g.fillStyle = '#5a6672'; }
    g.fillStyle = 'rgba(230,230,220,.9)'; g.fillRect(X(.22), Y(.6), X(.18), X(.09));
  } else {
    g.fillStyle = bodyGradient(g, Y(1.44), Y(.92), teal); g.fillRect(X(.03), Y(1.44), X(.56), X(.52));
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(X(.03), Y(1.34), X(.56), 2); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(X(.06), Y(1.1), X(.5), X(.05)); g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(X(.31), Y(1.26), X(.07), 0, TAU); g.fill();
    g.fillStyle = '#7d1418'; g.fillRect(X(.08), Y(.98), X(.14), X(.06)); g.fillRect(X(.4), Y(.98), X(.14), X(.06));
    g.fillStyle = '#e9dd7a'; g.fillRect(X(.21), Y(.66), X(.2), X(.1));
    g.fillStyle = '#16181c'; g.fillRect(X(.0), Y(.86), X(.62), X(.03));
  }
  return c;
}
function drawMoped(x, z) {
  box(x - .16, x + .16, .32, .78, z - .7, z + .55, [40, 46, 54]);
  box(x - .26, x + .26, .95, 1.42, z - .94, z - .34, [30, 170, 150]);
  box(x - .1, x + .1, .78, 1.1, z + .25, z + .75, [30, 170, 150]);
  const x0 = x - .28, x1 = x + .28, z0 = z - .95, z1 = z + .95;
  if (camL.x > x1) drawSlicedQuad(MP.side || (MP.side = paintMoped('side')), x1, z0, x1, z1, 0, 1.5, .8);
  else if (camL.x < x0) drawSlicedQuad(MP.side || (MP.side = paintMoped('side')), x0, z0, x0, z1, 0, 1.5, .8);
  if (camL.z < z0) drawSlicedQuad(MP.rear || (MP.rear = paintMoped('rear')), x0, z0, x1, z0, 0, 1.5, .95);
  else if (camL.z > z1) drawSlicedQuad(MP.front || (MP.front = paintMoped('front')), x0, z1, x1, z1, 0, 1.5, .95);
  const p = Pw(x, .84, z - .96); if (p) glow(p[0], p[1], Math.max(5, F / p[2] * .3), [255, 40, 30], .5);
}
function drawScooter(x, z) { drawMoped(x, z); }

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
  const rzN = 2.2, rzF = 36, fogK = 1 - Math.min(.5, env.fog * 28);
  const cx = CXs + cam.yawPx, cy = HZ + cam.h * F / 9, rad = SH * .62;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // several nested cones give a soft, feathered edge instead of one hard trapezoid
  for (const k of [1.25, 1.0, .78, .56, .36]) {
    const hw = z => (.5 + z * .11) * k;
    const pts = [P(-hw(rzN), 0, rzN), P(-hw(rzF), 0, rzF), P(-hw(rzF) * .9, 2.1, rzF), P(hw(rzF) * .9, 2.1, rzF), P(hw(rzF), 0, rzF), P(hw(rzN), 0, rzN)];
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad), a = hlOn * fogK * .17;
    g.addColorStop(0, 'rgba(255,246,222,' + (a * 1.5).toFixed(3) + ')'); g.addColorStop(.55, 'rgba(255,240,210,' + (a * .6).toFixed(3) + ')'); g.addColorStop(1, 'rgba(255,236,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let q = 1; q < pts.length; q++) ctx.lineTo(pts[q][0], pts[q][1]); ctx.closePath(); ctx.fill();
  }
  // hot spot on the road just ahead, and a long wet-road reflection down the middle
  const near = P(0, 0, 7); const sp = ctx.createRadialGradient(near[0], near[1], 0, near[0], near[1], SW * .3);
  sp.addColorStop(0, 'rgba(255,250,232,' + (.4 * hlOn).toFixed(3) + ')'); sp.addColorStop(1, 'rgba(255,250,232,0)');
  ctx.save(); ctx.translate(near[0], near[1]); ctx.scale(1, .32); ctx.translate(-near[0], -near[1]); ctx.fillStyle = sp; ctx.fillRect(near[0] - SW * .3, near[1] - SW * .3, SW * .6, SW * .6); ctx.restore();
  if (env.wet > .2) { const top = P(0, 0, 45)[1], bot = P(0, 0, 3)[1], rg = ctx.createLinearGradient(0, top, 0, bot); rg.addColorStop(0, 'rgba(255,244,214,0)'); rg.addColorStop(1, 'rgba(255,244,214,' + (.16 * env.wet * hlOn).toFixed(3) + ')'); ctx.fillStyle = rg; ctx.fillRect(cx - SW * .05, top, SW * .1, bot - top); }
  ctx.restore();
}
