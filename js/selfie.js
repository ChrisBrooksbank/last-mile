'use strict';
// The rider's spot to camera: parked at the kerb, helmet off, talking to the lens with the street behind him.
const RIDER_LOOK = Object.assign(randomLook(new RNG(4242)), { female: false, outfit: 'hiviz', top: [30, 34, 40], bot: [32, 34, 44], hairStyle: 'short', hair: [58, 40, 28], beard: true, glasses: false, helmet: null, skin: SKIN[1] });
const FLAVOURS = [{ n: 'PEACH', c: [246, 170, 90] }, { n: 'LIME', c: [150, 204, 60] }, { n: 'CHERRY', c: [204, 44, 62] }];

function drawBottleAt(cx, cy, s, rot, tint, label) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot || 0);
  const bw = s * .42, bh = s * .64, t = tint || [236, 166, 52];
  const g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0); g.addColorStop(0, rgb(mulc(t, .62))); g.addColorStop(.35, rgb(t)); g.addColorStop(1, rgb(mulc(t, .5)));
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-bw / 2, -bh / 2, bw, bh, s * .08) : ctx.rect(-bw / 2, -bh / 2, bw, bh); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-bw / 2 + s * .04, -bh / 2 + s * .05, s * .05, bh * .8);
  ctx.fillStyle = '#f7f5ee'; ctx.fillRect(-bw / 2 + s * .02, -bh * .16, bw - s * .04, bh * .5);
  ctx.strokeStyle = '#2a6fb8'; ctx.lineWidth = Math.max(1, s * .012); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-bw / 2 + s * .03, -bh * .02 + i * s * .035); ctx.bezierCurveTo(-bw * .2, -bh * .05 + i * s * .035, bw * .2, bh * .01 + i * s * .035, bw / 2 - s * .03, -bh * .02 + i * s * .035); ctx.stroke(); }
  ctx.fillStyle = '#12437d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '800 ' + Math.max(5, Math.round(s * .085)) + 'px system-ui,sans-serif'; ctx.fillText('HOLY', 0, -bh * .09); ctx.fillText('WATER', 0, -bh * .09 + s * .09);
  ctx.fillStyle = rgb(mulc(t, .8)); ctx.font = '700 ' + Math.max(4, Math.round(s * .038)) + 'px system-ui,sans-serif'; ctx.fillText(label || 'FLAVOUR DROPS', 0, bh * .22);
  ctx.fillStyle = '#17181b'; ctx.fillRect(-bw * .3, -bh / 2 - s * .07, bw * .6, s * .08); ctx.beginPath(); ctx.ellipse(0, -bh / 2 - s * .17, bw * .2, s * .12, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(-bw * .07, -bh / 2 - s * .2, bw * .05, s * .05, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

function renderSelfie(dt) {
  const s = scene.selfie, S = world.street; if (!s || !S) return;
  s.t += dt; s.hold += ((s.holdT || 0) - s.hold) * (1 - Math.exp(-dt * 4)); s.flav += ((s.flavT || 0) - s.flav) * (1 - Math.exp(-dt * 3)); s.code += ((s.codeT || 0) - s.code) * (1 - Math.exp(-dt * 3));
  const sd = s.side, cx = sd * (S.halfW - 1.85), cz = R.z + .05, tx = sd * (S.halfW + .8), tz = R.z + .8;
  cam.x = cx + Math.sin(s.t * 1.3) * .012; cam.z = cz; cam.h = 1.55 + Math.sin(s.t * 1.9) * .01; setHeading(sd * Math.PI / 2); cam.yawPx = Math.sin(s.t * .9) * 3; HZ = HZ0;
  ctx.save(); ctx.translate(SW / 2, SH / 2); ctx.rotate(Math.sin(s.t * .7) * .004); ctx.scale(1.03, 1.03); ctx.translate(-SW / 2, -SH / 2);
  renderStreet(dt);
  // the products on the moped's box
  const bp = Pw(R.x, 1.5, R.z - .62);
  if (bp && s.flav > .02) { const u = F / bp[2]; FLAVOURS.forEach((f, i) => { const k = i - 1; ctx.globalAlpha = Math.min(1, s.flav * 1.5); drawBottleAt(bp[0] + k * .3 * u * (sd < 0 ? 1 : -1), bp[1] - .12 * u, .5 * u, k * .05, f.c, f.n); }); ctx.globalAlpha = 1; }
  // the rider, talking to the lens
  const q = Pw(tx, 0, tz);
  if (q) {
    const h = 1.76 * F / q[2], u = h / 100, talking = s.talk;
    person(Object.assign({}, RIDER_LOOK, { x: q[0], y: q[1], h, dm: q[2], view: 'front', mood: 'happy', hold: s.hold > .3, actL: talking, actT: s.t, noShadow: false }));
    if (s.hold > .05) { const hx = q[0] + 17 * u, hy = q[1] - 72 * u; drawBottleAt(hx, hy - h * .045, h * .2, .04, [236, 166, 52], 'FLAVOUR DROPS'); ctx.fillStyle = 'rgb(38,34,32)'; ctx.beginPath(); ctx.ellipse(hx, hy + h * .008, h * .03, h * .036, 0, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
  // camera overlay: viewfinder, REC, lower-third and the discount code
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; const m = Math.min(SW, SH) * .05, cl = m * .8;
  for (const [x, y, dx, dy] of [[m, m, 1, 1], [SW - m, m, -1, 1], [m, SH - m, 1, -1], [SW - m, SH - m, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + dy * cl); ctx.lineTo(x, y); ctx.lineTo(x + dx * cl, y); ctx.stroke(); }
  if (Math.floor(s.t * 1.4) % 2 === 0) { ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(m + 8, m + cl + 18, 6, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '700 ' + Math.round(SH * .022) + 'px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('REC', m + 20, m + cl + 18);
  const ba = clamp(s.hold * 1.5, 0, 1);
  if (ba > .02) {
    const bx = m + 6, bw = Math.min(SW * .5, 420), bh = SH * .17, by = SH - m - bh - 6 - (1 - ba) * 40;
    ctx.globalAlpha = ba; ctx.fillStyle = 'rgba(14,40,86,.92)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 10) : ctx.rect(bx, by, bw, bh); ctx.fill();
    ctx.fillStyle = '#f2b13a'; ctx.fillRect(bx, by, 8, bh);
    ctx.fillStyle = '#fff'; ctx.font = '900 ' + Math.round(bh * .34) + 'px system-ui,sans-serif'; ctx.fillText('HOLY WATER', bx + 22, by + bh * .32);
    ctx.fillStyle = '#cfe0f6'; ctx.font = '600 ' + Math.round(bh * .17) + 'px system-ui,sans-serif'; ctx.fillText('Flavour drops for your water  ·  £4.99', bx + 22, by + bh * .6);
    FLAVOURS.forEach((f, i) => { const fx = bx + 22 + i * (bw * .26); ctx.fillStyle = rgb(f.c); ctx.beginPath(); ctx.arc(fx + 7, by + bh * .84, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = '700 ' + Math.round(bh * .13) + 'px system-ui,sans-serif'; ctx.fillText(f.n, fx + 20, by + bh * .84); });
    ctx.globalAlpha = 1;
  }
  if (s.code > .02) {
    const cw = Math.min(SW * .42, 360), ch = SH * .11, cx2 = SW - m - cw - 6, cy2 = SH * .13 - (1 - s.code) * 30 + Math.sin(s.t * 3) * 2;
    ctx.globalAlpha = clamp(s.code * 1.5, 0, 1); ctx.save(); ctx.translate(cx2 + cw / 2, cy2 + ch / 2); ctx.rotate(-.04);
    ctx.fillStyle = '#f7c948'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 12) : ctx.rect(-cw / 2, -ch / 2, cw, ch); ctx.fill(); ctx.strokeStyle = '#7a4c00'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#4a2c00'; ctx.textAlign = 'center'; ctx.font = '700 ' + Math.round(ch * .2) + 'px system-ui,sans-serif'; ctx.fillText('USE CODE', 0, -ch * .24); ctx.font = '900 ' + Math.round(ch * .36) + 'px system-ui,sans-serif'; ctx.fillText('KICKING OFF', 0, ch * .14); ctx.font = '800 ' + Math.round(ch * .17) + 'px system-ui,sans-serif'; ctx.fillText('10% OFF', 0, ch * .38);
    ctx.restore(); ctx.globalAlpha = 1;
  }
}
