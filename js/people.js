'use strict';
// Detailed vector people: proportioned bodies, layered clothing, hands, shoes, and faces with eyes, brows, nose, lips, ears and hair.
const HAIRSTYLES_M = ['short', 'short', 'short', 'curly', 'bald', 'cap', 'buzz', 'quiff'];
const HAIRSTYLES_F = ['long', 'long', 'bun', 'bob', 'curly', 'ponytail', 'short'];
function randomLook(r, kind) {
  const female = r.c(.5);
  const l = {
    female, skin: r.p(SKIN), hair: r.p(HAIR), top: r.p(CLOTHES), bot: r.p([[40, 44, 60], [30, 30, 34], [70, 80, 110], [90, 76, 60], [60, 60, 66], [110, 96, 80]]),
    hairStyle: r.p(female ? HAIRSTYLES_F : HAIRSTYLES_M), outfit: r.p(['tee', 'tee', 'shirt', 'jacket', 'jacket', 'hoodie', 'coat', 'tee', 'puffer', 'puffer']),
    eye: r.p([[70, 45, 25], [70, 45, 25], [60, 100, 150], [70, 120, 80], [90, 70, 40]]), glasses: r.c(.16), beard: !female && r.c(.22),
    build: r.r(.92, 1.1), shoe: r.p([[30, 30, 34], [236, 236, 236], [90, 60, 40], [170, 50, 50], [40, 60, 110]]), inner: r.p([[230, 230, 226], [60, 60, 70], [180, 60, 60], [90, 120, 160]]),
    skirt: female && r.c(.3),
    hat: r.c(.13) ? r.p([[40, 40, 46], [150, 40, 50], [200, 190, 170], [40, 70, 110], [230, 180, 40]]) : null,
    scarf: r.c(.12) ? r.p([[150, 40, 50], [200, 170, 60], [60, 90, 70], [220, 220, 214], [40, 50, 90]]) : null,
    pack: r.c(.16) ? r.p([[30, 30, 34], [60, 70, 90], [120, 50, 40], [70, 90, 60]]) : null,
  };
  if (l.hair[0] > 170 && l.hair[1] > 160) l.grey = true;
  if (kind === 'gown') { l.outfit = 'gown'; l.top = r.p([[210, 200, 220], [120, 140, 170], [180, 120, 130]]); }
  if (kind === 'work') { l.outfit = 'shirt'; l.top = [232, 234, 238]; l.bot = [40, 44, 60]; }
  if (kind === 'staff') { l.outfit = 'apron'; l.top = r.p([[236, 236, 232], [60, 60, 66], [200, 200, 196]]); l.hairStyle = female ? 'bun' : 'cap'; }
  if (kind) { l.hat = null; l.pack = null; }
  if (kind === 'rider') { l.outfit = 'hiviz'; l.top = [30, 34, 40]; l.helmet = r.p([[30, 30, 34], [190, 190, 194], [120, 40, 40], [30, 60, 110]]); }
  return l;
}

function person(o) {
  if (o.view === 'side') return personSide(o);
  const dm = o.dm || 10, hpx = o.h, view = o.view || (o.front ? 'front' : 'back');
  const S = c => o.raw ? rgb(c) : shade(c, dm, .95);
  const bl = o.build || 1, fem = !!o.female;
  const x = o.x, y = o.y;
  ctx.save();
  if (!o.noShadow) { ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.beginPath(); ctx.ellipse(x, y, hpx * .15, hpx * .03, 0, 0, TAU); ctx.fill(); }
  ctx.translate(x, y); const u = hpx / 100; ctx.scale(u, u); const lean = ((o.skin ? o.skin[0] * 7 + (o.top ? o.top[1] : 0) : 3) % 7 - 3) * .006;
  // gait: the body is highest as the legs pass (mid-stance), lowest at double support, and shifts over the stance leg
  if (o.walk) { const p0 = o.ph || 0; ctx.rotate(lean + Math.sin(p0) * .012); ctx.translate(Math.sin(p0) * .9, -(Math.cos(2 * p0) + 1) * .8); } else ctx.rotate(lean);
  const g = ctx;
  const skin = o.skin || SKIN[1], hair = o.hair || HAIR[0], top = o.top || CLOTHES[0], bot = o.bot || [40, 44, 60], shoe = o.shoe || [30, 30, 34], inner = o.inner || [230, 230, 226];
  const detail = hpx > 70, front = view === 'front', ph = o.ph || 0;
  const ped = o.pedal !== undefined;
  // per leg: fwd = how far the foot is ahead (-1..1); during the swing phase (foot travelling forward) it lifts and the knee bends
  const gait = sd => { if (!o.walk) return { fwd: 0, lift: 0, knee: 0 }; const p = ph + (sd < 0 ? 0 : Math.PI), c = Math.cos(p), sw = Math.max(0, c); return { fwd: Math.sin(p), lift: Math.pow(sw, 1.6) * 5.2 + Math.max(0, -Math.sin(p)) * Math.max(0, -c) * 1.6, knee: sw * 4.2 }; };
  const lift0 = ped ? (Math.sin(o.pedal) * .5 + .5) * 9 : gait(-1).lift, lift1 = ped ? (Math.sin(o.pedal + Math.PI) * .5 + .5) * 9 : gait(1).lift;
  const swing = 0, depthDir = front ? 1 : -1;
  const sw = (fem ? 11.6 : 13.4) * bl, ww = (fem ? 8.4 : 10) * bl, hw = (fem ? 11.2 : 10.6) * bl;
  const grad = (x0, x1, c0, c1) => { const gr = g.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, S(c0)); gr.addColorStop(1, S(c1)); return gr; };
  const limb = (x0, y0, x1, y1, w0, w1, col, edge) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const gr = g.createLinearGradient(x0 + nx * w0 / 2, y0 + ny * w0 / 2, x0 - nx * w0 / 2, y0 - ny * w0 / 2); gr.addColorStop(0, S(mulc(col, 1.14))); gr.addColorStop(.6, S(col)); gr.addColorStop(1, S(mulc(col, .68)));
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); g.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
    g.arc(x1, y1, w1 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true); g.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2); g.arc(x0, y0, w0 / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true); g.fill();
    
  };
  const skinG = (cx, cy, r) => { const gr = g.createRadialGradient(cx - r * .3, cy - r * .35, r * .1, cx, cy, r * 1.15); gr.addColorStop(0, S(mulc(skin, 1.1))); gr.addColorStop(.65, S(skin)); gr.addColorStop(1, S(mulc(skin, .72))); return gr; };
  const outfit = o.outfit || 'tee';
  const legTopY = -49, hipX = 4.6 * bl;

  // ---- long hair behind the shoulders
  const hs = o.hairStyle || (o.hair ? 'short' : 'bald');
  if (detail && (hs === 'long' || hs === 'ponytail' || hs === 'bob') && !o.helmet) {
    g.fillStyle = S(hair); g.beginPath();
    const dropY = hs === 'bob' ? -84 : -68;
    g.moveTo(-6.4, -94); g.quadraticCurveTo(-8.2, -80, -7.4 * bl, dropY); g.lineTo(7.4 * bl, dropY); g.quadraticCurveTo(8.2, -80, 6.4, -94); g.fill();
  }
  if (outfit === 'hoodie' && detail) { g.fillStyle = S(mulc(top, .8)); g.beginPath(); g.ellipse(0, -84.5, 8, 4.6, 0, 0, TAU); g.fill(); }

  // ---- legs
  const skirt = o.skirt && outfit !== 'gown';
  const legCol = bot, kneeY = -27, ankleY = -4;
  // the leg nearer the camera is painted last (front view: the forward leg; back view: the trailing one)
  const legOrder = o.walk ? [-1, 1].sort((a, b) => (gait(a).fwd - gait(b).fwd) * depthDir) : [-1, 1];
  if (outfit !== 'gown') for (const s of legOrder) {
    const gt = gait(s), lift = s < 0 ? lift0 : lift1, near = gt.fwd * depthDir;   // near > 0: this foot is closer to the camera
    const fx = s * hipX, kx = s * (hipX + .6 + (ped ? 2.4 : 0)) - s * gt.knee * .08, ax = s * (hipX + 1.1) - s * Math.max(0, gt.fwd) * .5;
    const ky = kneeY - lift * .4 - gt.knee * .45 + near * 1.3, ay = ankleY - lift + near * 3.0;
    if (skirt) { limb(fx, legTopY + 12, kx, ky, 6.2, 5.2, skin, false); limb(kx, ky, ax, ay, 5, 3.6, skin, false); }
    else { limb(fx, legTopY, kx, ky, 9 * bl, 7.4 * bl, legCol, true); limb(kx, ky, ax, ay, 7.2 * bl, 5.2, mulc(legCol, 1 - Math.max(0, -near) * .12), true); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = .35; g.beginPath(); g.moveTo(kx, ky - 2); g.lineTo(kx, ky + 8); g.stroke(); }
    // shoe
    const sy = ay - ankleY, shc = shoe; g.fillStyle = S(mulc(shc, .95));
    if (front) { g.beginPath(); g.ellipse(ax + s * .4, -1.9 + sy, 3.4, 2.5, s * .15, 0, TAU); g.fill(); g.fillStyle = S(shc[0] > 200 ? [200, 200, 200] : [235, 235, 235]); g.fillRect(ax - 3, -.6 + sy, 6.4, 1); g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(ax + s * .2, -3 + sy, 1.6, .8, 0, 0, TAU); g.fill(); }
    else { g.beginPath(); g.roundRect ? g.roundRect(ax - 2.7, -3.6 + sy, 5.4, 3.6, 1.4) : g.rect(ax - 2.7, -3.6 + sy, 5.4, 3.6); g.fill(); g.fillStyle = 'rgba(240,240,240,.85)'; g.fillRect(ax - 2.8, -.8 + sy, 5.6, .9); }
  }

  // ---- torso
  const torso = (bottomY, flare) => {
    g.beginPath(); g.moveTo(-3.6, -85.4);
    g.bezierCurveTo(-sw * .7, -85.8, -sw, -84.2, -sw, -80.2); g.lineTo(-sw + 1, -68);
    g.bezierCurveTo(-ww - 1, -62, -ww, -60, -ww, -57);
    g.bezierCurveTo(-ww, -53, -hw - flare, bottomY + 4, -hw - flare, bottomY);
    g.lineTo(hw + flare, bottomY); g.bezierCurveTo(hw + flare, bottomY + 4, ww, -53, ww, -57);
    g.bezierCurveTo(ww, -60, ww + 1, -62, sw - 1, -68); g.lineTo(sw, -80.2); g.bezierCurveTo(sw, -84.2, sw * .7, -85.8, 3.6, -85.4); g.closePath();
  };
  const bottomY = outfit === 'gown' ? -12 : outfit === 'coat' ? -27 : outfit === 'hoodie' || outfit === 'jacket' || outfit === 'puffer' ? -44 : -46;
  // gown / coat skirts hide the legs, so paint the lower legs after for gowns
  if (outfit === 'gown') for (const s of [-1, 1]) { limb(s * hipX, -30, s * (hipX + .6), -14, 5, 4, skin, false); limb(s * (hipX + .6), -14, s * (hipX + 1), -4, 3.6, 3.2, skin, false); g.fillStyle = S([220, 200, 200]); g.beginPath(); g.ellipse(s * (hipX + 1.4), -1.6, 3.6, 2, 0, 0, TAU); g.fill(); }
  const tc = outfit === 'hiviz' ? top : top;
  torso(bottomY, outfit === 'gown' || outfit === 'coat' ? 2.5 : 0);
  g.fillStyle = grad(-sw, sw, mulc(tc, 1.12), mulc(tc, .72)); g.fill();
  g.save(); torso(bottomY, outfit === 'gown' || outfit === 'coat' ? 2.5 : 0); g.clip();
  const shg = g.createLinearGradient(0, -85, 0, bottomY); shg.addColorStop(0, 'rgba(255,255,255,.10)'); shg.addColorStop(.5, 'rgba(0,0,0,0)'); shg.addColorStop(1, 'rgba(0,0,0,.22)'); g.fillStyle = shg; g.fillRect(-20, -90, 40, 90);
  if (detail) {
    g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = .4;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-ww + 1 + i * 1.2, -58 - i * 2); g.quadraticCurveTo(-1, -55 - i * 2.4, ww - 1 - i * 1.2, -58 - i * 2); g.stroke(); } // fabric folds
    if (front) {
      if (outfit === 'shirt') { g.fillStyle = S(inner); g.fillRect(-.5, -84, 1, 40); g.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 5; i++) g.fillRect(-.35, -80 + i * 7, .7, .7); }
      if (outfit === 'jacket' || outfit === 'coat') {
        g.fillStyle = S(inner); g.beginPath(); g.moveTo(-3.4, -85); g.lineTo(3.4, -85); g.lineTo(2.4, bottomY + 2); g.lineTo(-2.4, bottomY + 2); g.fill();
        g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = .5; g.beginPath(); g.moveTo(-2.4, -84); g.lineTo(-2.2, bottomY + 2); g.moveTo(2.4, -84); g.lineTo(2.2, bottomY + 2); g.stroke();
        g.strokeStyle = 'rgba(200,200,200,.6)'; g.beginPath(); g.moveTo(-2.4, -70); g.lineTo(-2.4, bottomY + 2); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.moveTo(-8, -54); g.lineTo(-4.5, -53); g.moveTo(8, -54); g.lineTo(4.5, -53); g.stroke();
      }
      if (outfit === 'hoodie') { g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(-7, -56); g.lineTo(7, -56); g.lineTo(8, -46); g.lineTo(-8, -46); g.fill(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .5; g.beginPath(); g.moveTo(-2, -84); g.lineTo(-2.2, -68); g.moveTo(2, -84); g.lineTo(2.2, -68); g.stroke(); }
      if (outfit === 'apron') { g.fillStyle = S(o.apron || [150, 60, 50]); g.fillRect(-7.8, -80, 15.6, 40); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(-4.5, -58, 9, 6); g.strokeStyle = S(o.apron || [150, 60, 50]); g.lineWidth = .8; g.beginPath(); g.moveTo(-7.5, -80); g.lineTo(-3, -85); g.moveTo(7.5, -80); g.lineTo(3, -85); g.stroke(); }
      if (outfit === 'gown') { g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = .6; g.beginPath(); g.moveTo(0, -84); g.lineTo(-2, -12); g.stroke(); g.fillStyle = S(mulc(top, .7)); g.fillRect(-ww - 1, -58, 2 * ww + 2, 2.2); }
    } else {
      if (outfit === 'hoodie') { g.fillStyle = 'rgba(0,0,0,.16)'; g.beginPath(); g.ellipse(0, -80, 8, 5, 0, 0, TAU); g.fill(); }
      if (outfit === 'jacket' || outfit === 'coat') { g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = .5; g.beginPath(); g.moveTo(0, -84); g.lineTo(0, bottomY); g.stroke(); }
    }
    if (outfit === 'puffer') { // quilted baffles
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = .55; for (let yq = -80; yq < -45; yq += 5.2) { g.beginPath(); g.moveTo(-sw, yq); g.quadraticCurveTo(0, yq + 1.2, sw, yq); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.07)'; for (let yq = -79; yq < -45; yq += 5.2) g.fillRect(-sw, yq, 2 * sw, 1.4);
      if (front) { g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = .4; g.beginPath(); g.moveTo(0, -84); g.lineTo(0, bottomY); g.stroke(); }
    }
    if (outfit === 'hiviz') {
      g.fillStyle = S([214, 232, 46]); g.beginPath(); g.moveTo(-sw + 1.5, -84); g.lineTo(-4.4, -85); g.lineTo(-4, -46); g.lineTo(-hw, -46); g.lineTo(-ww, -60); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(sw - 1.5, -84); g.lineTo(4.4, -85); g.lineTo(4, -46); g.lineTo(hw, -46); g.lineTo(ww, -60); g.closePath(); g.fill();
      g.fillStyle = 'rgba(210,210,215,.85)'; g.fillRect(-hw, -66, 2 * hw, 2); g.fillRect(-hw, -55, 2 * hw, 2);
    }
  }
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = .4; torso(bottomY, outfit === 'gown' || outfit === 'coat' ? 2.5 : 0); g.stroke();
  if (skirt && outfit !== 'gown') { g.fillStyle = grad(-hw, hw, mulc(bot, 1.1), mulc(bot, .7)); g.beginPath(); g.moveTo(-hw, -48); g.lineTo(hw, -48); g.lineTo(hw + 3, -30); g.lineTo(-hw - 3, -30); g.fill(); }

  // ---- arms
  const sleeveCol = outfit === 'tee' ? top : (outfit === 'shirt' && o.longSleeves === false ? skin : top), bare = outfit === 'tee' && (o.sleeve === 'short');
  const handCol = skin;
  const armPair = (s) => {
    const shx = s * (sw - 1.4), shy = -80;
    let ex = s * (sw + 1.2) + swing * s * -.5, ey = -63, wx = s * (sw + 1.6) + swing * s * -.8, wy = -47 + Math.abs(swing) * .4;
    if ((o.armPose === 'pocket' || (!o.armPose && o.reach === undefined && ((o.top ? o.top[0] : 0) % 5 === 0)) ) && s === 1 && !o.phone) { ex = s * (sw + 4.2); ey = -64; wx = s * (hw - 1.5); wy = -50; }
    else if (o.armPose === 'bars') { ex = s * (sw + 4); ey = -70; wx = s * (sw + 2); wy = -60; }
    else if (o.reach !== undefined && s === (o.reachSide || 1)) { const e = o.reach; ex = s * (sw + 3 + e * 4); ey = -63 - e * 3; wx = s * (sw + 3 + e * 10); wy = -47 - e * 22; }
    if (o.walk && !o.armPose && o.reach === undefined) {
      // arms counter-swing the legs: this arm comes forward as the opposite leg does, the elbow bending on the way
      const af = -gait(s).fwd, fw = Math.max(0, af), near = af * depthDir;
      wy += near * 2.2 - fw * 3.2; ey += near * .8 - fw * .6; wx -= s * fw * 2.2; ex -= s * fw * .6; wx += s * Math.max(0, -af) * .8;
    }
    if (o.act === 'wave' && s === 1) { ex = s * (sw + 4); ey = -73; wx = s * (sw + 3) + Math.sin((o.actT || 0) * 11) * 3; wy = -93; }
    else if (o.act === 'talk' && s === 1) { ex = s * (sw + 3); ey = -65; wx = s * 6; wy = -63 + Math.sin((o.actT || 0) * 6) * 3; }
    else if (o.actL && s === -1) { ex = s * (sw + 3.5); ey = -66; wx = s * 8 + Math.sin((o.actT || 0) * 5) * 3; wy = -66 + Math.sin((o.actT || 0) * 4.3) * 3; }
    else if (o.hold && s === 1 && o.reach === undefined) { ex = s * (sw + 4.5); ey = -69; wx = s * 17; wy = -72; }
    else if (o.phone && s === 1 && o.reach === undefined) { ex = s * (sw + 2); ey = -67; wx = s * 6; wy = -73; }
    limb(shx, shy, ex, ey, 5.6, 4.8, sleeveCol, true); limb(ex, ey, wx, wy, 4.8, 3.9, sleeveCol, true);
    if (outfit === 'jacket' || outfit === 'coat' || outfit === 'hoodie') { g.fillStyle = S(mulc(sleeveCol, .78)); g.beginPath(); g.ellipse(wx, wy, 2.3, 1.2, 0, 0, TAU); g.fill(); }
    // hand
    const hx = wx, hy = wy + (o.reach !== undefined && s === (o.reachSide || 1) ? -1.2 : 3);
    g.fillStyle = skinG(hx, hy, 3); g.beginPath(); g.ellipse(hx, hy, 2.1, 3.1, s * .08, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = .3; g.beginPath(); g.ellipse(hx, hy, 2.1, 3.1, s * .08, 0, TAU); g.stroke();
    if (detail) { g.fillStyle = S(mulc(skin, .9)); g.beginPath(); g.ellipse(hx - s * 1.9, hy - 1, .8, 1.7, s * .4, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = .25; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(hx + k * .7, hy + 1); g.lineTo(hx + k * .7, hy + 3); g.stroke(); } }
    return [hx, hy];
  };
  const hL = armPair(-1), hR = armPair(1);
  if (o.phone && detail) { g.fillStyle = '#0b0c0e'; g.fillRect(hR[0] - 1.6, hR[1] - 4, 3.2, 5.6); g.fillStyle = 'rgba(160,210,255,.85)'; g.fillRect(hR[0] - 1.2, hR[1] - 3.6, 2.4, 4.6); }
  if (o.bag) { g.strokeStyle = S(o.bag); g.lineWidth = 1; g.beginPath(); g.moveTo(-sw + 1, -83); g.lineTo(hw, -46); g.stroke(); g.fillStyle = S(o.bag); g.beginPath(); g.roundRect ? g.roundRect(hw - 4, -52, 9, 8, 1.5) : g.rect(hw - 4, -52, 9, 8); g.fill(); }
  if (o.pack) { // backpack: the bag itself from behind, just the straps from the front
    if (front) { g.strokeStyle = S(mulc(o.pack, .8)); g.lineWidth = 1.6; g.beginPath(); g.moveTo(-6.5, -84); g.lineTo(-7.5, -62); g.moveTo(6.5, -84); g.lineTo(7.5, -62); g.stroke(); }
    else { g.fillStyle = S(o.pack); g.beginPath(); g.roundRect ? g.roundRect(-9, -86, 18, 26, 3) : g.rect(-9, -86, 18, 26); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(-8, -85, 16, 3); g.fillStyle = S(mulc(o.pack, .7)); g.beginPath(); g.roundRect ? g.roundRect(-6.5, -72, 13, 10, 2) : g.rect(-6.5, -72, 13, 10); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = .4; g.beginPath(); g.moveTo(-6, -79); g.lineTo(6, -79); g.stroke(); }
  }

  // ---- neck + head
  const HY = -92.4, hrx = (fem ? 5.2 : 5.6) * (1 + (bl - 1) * .4), hry = 6.9;
  g.fillStyle = skinG(0, -84, 4); g.fillRect(-2.9, -87, 5.8, 5); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(-2.9, -85.6, 5.8, 2.2);
  if (outfit === 'tee' && front) { g.fillStyle = skinG(0, -83, 4); g.beginPath(); g.ellipse(0, -84.4, 3.9, 2.4, 0, 0, Math.PI); g.fill(); g.strokeStyle = S(mulc(top, .75)); g.lineWidth = .7; g.beginPath(); g.ellipse(0, -84.4, 3.9, 2.4, 0, 0, Math.PI); g.stroke(); }
  if (outfit === 'shirt' && front) { g.fillStyle = S(inner); g.beginPath(); g.moveTo(-3.4, -86.4); g.lineTo(0, -82.6); g.lineTo(-.4, -85.2); g.fill(); g.beginPath(); g.moveTo(3.4, -86.4); g.lineTo(0, -82.6); g.lineTo(.4, -85.2); g.fill(); }
  if (outfit === 'hoodie' && front) { g.strokeStyle = S(mulc(top, .7)); g.lineWidth = 1.6; g.beginPath(); g.ellipse(0, -84.6, 4.4, 2.2, 0, 0, Math.PI); g.stroke(); }
  // ears
  if (!(o.helmet && view !== 'front')) for (const s of [-1, 1]) { g.fillStyle = skinG(s * (hrx), HY + .5, 1.8); g.beginPath(); g.ellipse(s * (hrx - .1), HY + .6, 1.1, 2, s * -.15, 0, TAU); g.fill(); }
  // head shape
  const headPath = () => { g.beginPath(); g.moveTo(0, HY - hry); g.bezierCurveTo(hrx * 1.05, HY - hry, hrx * 1.05, HY - .8, hrx * .82, HY + 2.6); g.bezierCurveTo(hrx * .55, HY + 5.2, hrx * .25, HY + 6.5, 0, HY + 6.6); g.bezierCurveTo(-hrx * .25, HY + 6.5, -hrx * .55, HY + 5.2, -hrx * .82, HY + 2.6); g.bezierCurveTo(-hrx * 1.05, HY - .8, -hrx * 1.05, HY - hry, 0, HY - hry); g.closePath(); };
  headPath(); g.fillStyle = skinG(0, HY, hry); g.fill(); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = .35; g.stroke();
  if (o.grey) { /* grey hair handled through colour */ }
  // face
  if (front && detail) {
    const eyeY = HY + .5, ex = hrx * .42, tone = mulc(skin, .55);
    // cheeks / blush
    for (const s of [-1, 1]) { const bg = g.createRadialGradient(s * ex * 1.25, eyeY + 3.2, .2, s * ex * 1.25, eyeY + 3.2, 2.6); bg.addColorStop(0, 'rgba(200,90,90,' + (fem ? .22 : .14) + ')'); bg.addColorStop(1, 'rgba(200,90,90,0)'); g.fillStyle = bg; g.fillRect(s * ex * 1.25 - 3, eyeY + .5, 6, 6); }
    // eye sockets, eyes
    for (const s of [-1, 1]) {
      const cx = s * ex; g.fillStyle = 'rgba(' + (tone[0] | 0) + ',' + (tone[1] | 0) + ',' + (tone[2] | 0) + ',.16)'; g.beginPath(); g.ellipse(cx, eyeY - .2, 1.9, 1.3, 0, 0, TAU); g.fill();
      g.fillStyle = '#f4f2ee'; g.beginPath(); g.ellipse(cx, eyeY, 1.35, .78, 0, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.ellipse(cx, eyeY, 1.35, .78, 0, 0, TAU); g.clip(); g.fillStyle = S(o.eye || [70, 45, 25]); g.beginPath(); g.arc(cx + s * -.05, eyeY + .02, .68, 0, TAU); g.fill(); g.fillStyle = '#0c0c0e'; g.beginPath(); g.arc(cx + s * -.05, eyeY + .02, .34, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(cx + .25, eyeY - .25, .2, 0, TAU); g.fill(); g.restore();
      g.strokeStyle = 'rgba(30,20,20,.8)'; g.lineWidth = fem ? .5 : .38; g.beginPath(); g.ellipse(cx, eyeY, 1.4, .8, 0, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
      if (fem) { g.beginPath(); g.moveTo(cx + s * 1.3, eyeY - .3); g.lineTo(cx + s * 1.9, eyeY - .75); g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = .3; g.beginPath(); g.ellipse(cx, eyeY + .2, 1.3, .7, 0, .1, Math.PI - .1); g.stroke();
      // eyebrow
      g.strokeStyle = S(mulc(hair, .8)); g.lineWidth = fem ? .5 : .75; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - s * 1.6, eyeY - 1.9); g.quadraticCurveTo(cx + s * .1, eyeY - 2.9, cx + s * 1.9, eyeY - 2.1); g.stroke();
    }
    // nose
    g.strokeStyle = 'rgba(' + (tone[0] | 0) + ',' + (tone[1] | 0) + ',' + (tone[2] | 0) + ',.4)'; g.lineWidth = .45; g.beginPath(); g.moveTo(-.85, eyeY + .5); g.quadraticCurveTo(-1.15, eyeY + 2.6, -1.3, eyeY + 3.4); g.moveTo(.85, eyeY + .5); g.quadraticCurveTo(1.15, eyeY + 2.6, 1.3, eyeY + 3.4); g.stroke();
    g.fillStyle = 'rgba(' + (tone[0] | 0) + ',' + (tone[1] | 0) + ',' + (tone[2] | 0) + ',.35)'; g.beginPath(); g.ellipse(0, eyeY + 3.5, 1.4, .6, 0, 0, Math.PI); g.fill();
    g.fillStyle = 'rgba(30,15,15,.55)'; g.beginPath(); g.ellipse(-.7, eyeY + 3.35, .32, .22, 0, 0, TAU); g.ellipse(.7, eyeY + 3.35, .32, .22, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.ellipse(-.05, eyeY + 1.6, .3, 1, 0, 0, TAU); g.fill();
    // mouth
    const my = HY + 4.5, lipC = mixc(skin, fem ? [176, 60, 72] : [170, 84, 84], fem ? .55 : .4), mood = o.mood || 'ok', sm = mood === 'sour' ? -.5 : mood === 'happy' ? 1.1 : .5;
    g.fillStyle = S(lipC); g.beginPath(); g.moveTo(-1.9, my - sm * .25); g.quadraticCurveTo(-.9, my - .95, 0, my - .55); g.quadraticCurveTo(.9, my - .95, 1.9, my - sm * .25); g.quadraticCurveTo(0, my + .35 + sm * .1, -1.9, my - sm * .25); g.fill();
    g.beginPath(); g.moveTo(-1.8, my - sm * .25); g.quadraticCurveTo(0, my + 1.5 + Math.max(0, sm) * .4, 1.8, my - sm * .25); g.quadraticCurveTo(0, my + .3, -1.8, my - sm * .25); g.fill();
    if (mood === 'happy') { g.fillStyle = '#f6f2ea'; g.beginPath(); g.moveTo(-1.5, my - .1); g.quadraticCurveTo(0, my + .8, 1.5, my - .1); g.quadraticCurveTo(0, my + .2, -1.5, my - .1); g.fill(); }
    g.strokeStyle = 'rgba(60,20,20,.75)'; g.lineWidth = .3; g.beginPath(); g.moveTo(-1.9, my - sm * .25); g.quadraticCurveTo(0, my + .3 + (mood === 'sour' ? -.3 : 0), 1.9, my - sm * .25); g.stroke();
    g.fillStyle = 'rgba(' + (tone[0] | 0) + ',' + (tone[1] | 0) + ',' + (tone[2] | 0) + ',.18)'; g.beginPath(); g.ellipse(0, my + 2.3, 1.3, .55, 0, 0, TAU); g.fill();
    if (o.beard) { g.fillStyle = S(mulc(hair, .85)); g.globalAlpha = .9; g.beginPath(); g.moveTo(-hrx * .95, HY + 1.2); g.quadraticCurveTo(-hrx * .9, HY + 6.5, 0, HY + 7); g.quadraticCurveTo(hrx * .9, HY + 6.5, hrx * .95, HY + 1.2); g.quadraticCurveTo(hrx * .6, HY + 3.4, 2.4, HY + 3.6); g.quadraticCurveTo(0, HY + 3, -2.4, HY + 3.6); g.quadraticCurveTo(-hrx * .6, HY + 3.4, -hrx * .95, HY + 1.2); g.fill(); g.globalAlpha = 1; g.fillStyle = S(lipC); g.beginPath(); g.ellipse(0, my + .2, 1.6, .55, 0, 0, TAU); g.fill(); }
    else if (!fem && o.stubble !== false && hpx > 110 && !o.noStubble) { g.fillStyle = 'rgba(30,25,20,.13)'; g.beginPath(); g.moveTo(-hrx * .9, HY + 1.6); g.quadraticCurveTo(-hrx * .8, HY + 6.4, 0, HY + 6.8); g.quadraticCurveTo(hrx * .8, HY + 6.4, hrx * .9, HY + 1.6); g.lineTo(hrx * .6, HY + 3); g.lineTo(-hrx * .6, HY + 3); g.fill(); }
    if (o.glasses) { g.strokeStyle = 'rgba(30,30,34,.85)'; g.lineWidth = .5; for (const s of [-1, 1]) { g.beginPath(); g.roundRect ? g.roundRect(s * ex - 2.1, eyeY - 1.5, 4.2, 3, 1.2) : g.rect(s * ex - 2.1, eyeY - 1.5, 4.2, 3); g.stroke(); g.fillStyle = 'rgba(180,210,240,.12)'; g.fill(); } g.beginPath(); g.moveTo(-ex + 2.1, eyeY - .3); g.lineTo(ex - 2.1, eyeY - .3); g.moveTo(-ex - 2.1, eyeY - .4); g.lineTo(-hrx, eyeY - .6); g.moveTo(ex + 2.1, eyeY - .4); g.lineTo(hrx, eyeY - .6); g.stroke(); }
  } else if (front) {
    g.fillStyle = 'rgba(30,20,20,.8)'; g.fillRect(-2.6, HY + .1, 1.5, 1.2); g.fillRect(1.1, HY + .1, 1.5, 1.2);
    g.strokeStyle = 'rgba(120,50,50,.7)'; g.lineWidth = .8; g.beginPath(); g.arc(0, HY + 3.4, 1.7, .2, Math.PI - .2); g.stroke();
  }
  // hair (over the face edges)
  const hcol = S(hair), hdark = S(mulc(hair, .6)), hlite = S(mixc(hair, [255, 255, 255], .35));
  if (o.helmet) {
    const hc = o.helmet, r0 = hrx * 1.22;
    const hg = g.createRadialGradient(-2, HY - 3, 1, 0, HY, r0 * 1.3); hg.addColorStop(0, S(mulc(hc, 1.5))); hg.addColorStop(.5, S(hc)); hg.addColorStop(1, S(mulc(hc, .45)));
    g.fillStyle = hg; g.beginPath(); g.moveTo(-r0, HY + (front ? 0 : 3.8)); g.bezierCurveTo(-r0 * 1.02, HY - hry * 1.4, r0 * 1.02, HY - hry * 1.4, r0, HY + (front ? 0 : 3.8)); g.lineTo(r0 * .9, HY + (front ? 1.2 : 5)); g.lineTo(-r0 * .9, HY + (front ? 1.2 : 5)); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-2.2, HY - 4.6, 1.6, .8, -.5, 0, TAU); g.fill();
    if (front) { g.fillStyle = 'rgba(20,24,30,.55)'; g.fillRect(-r0 * .85, HY - .4, r0 * 1.7, 1.6); }
  } else if (hs !== 'bald') {
    g.fillStyle = hcol; g.beginPath();
    const top0 = HY - hry - (hs === 'curly' ? 2 : hs === 'quiff' ? 1.6 : hs === 'buzz' ? -.3 : .4);
    if (front) {
      g.moveTo(-hrx * 1.06, HY + 1.6); g.bezierCurveTo(-hrx * 1.2, top0 - 1, hrx * 1.2, top0 - 1, hrx * 1.06, HY + 1.6);
      g.lineTo(hrx * .9, HY - 2.4); g.quadraticCurveTo(hrx * .4, HY - 4.4 - (fem ? 0 : .3), -hrx * .3, HY - 3.6); g.quadraticCurveTo(-hrx * .8, HY - 3, -hrx * .9, HY - .6); g.closePath(); g.fill();
      if (hs === 'curly') { for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; g.beginPath(); g.arc(Math.cos(a) * hrx * 1.05, HY - 1 + Math.sin(a) * hry * 1.02, 1.9, 0, TAU); g.fill(); } }
      if (hs === 'bun') { g.beginPath(); g.arc(0, HY - hry - 2.4, 2.8, 0, TAU); g.fill(); }
      if (hs === 'ponytail') { g.beginPath(); g.ellipse(hrx * 1.1, HY - 2, 1.8, 3.6, .5, 0, TAU); g.fill(); }
      if (hs === 'cap') { g.fillStyle = S(o.cap || top); g.beginPath(); g.moveTo(-hrx * 1.1, HY - .6); g.bezierCurveTo(-hrx * 1.2, HY - hry * 1.5, hrx * 1.2, HY - hry * 1.5, hrx * 1.1, HY - .6); g.closePath(); g.fill(); g.fillStyle = S(mulc(o.cap || top, .7)); g.beginPath(); g.ellipse(0, HY - .2, hrx * 1.2, 1.5, 0, 0, Math.PI); g.fill(); }
      if (hs === 'long' || hs === 'bob') { g.fillStyle = hcol; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * hrx * .55, HY - 3.6); g.quadraticCurveTo(s * hrx * 1.3, HY - 2, s * hrx * 1.2, HY + 3); g.quadraticCurveTo(s * hrx * 1.35, HY + (hs === 'bob' ? 6 : 13), s * hrx * 1.1, HY + (hs === 'bob' ? 7.4 : 16)); g.lineTo(s * hrx * .95, HY + (hs === 'bob' ? 6 : 12)); g.quadraticCurveTo(s * hrx * .98, HY + 2, s * hrx * .55, HY - 3.6); g.fill(); } }
      g.strokeStyle = hdark; g.globalAlpha = .35; g.lineWidth = .3; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 1.2, HY - hry + 1); g.quadraticCurveTo(i * 1.4, HY - 5.4, i * 1.8, HY - 4); g.stroke(); } g.globalAlpha = 1;
      g.strokeStyle = hlite; g.lineWidth = .5; g.beginPath(); g.arc(-1.4, HY - hry * .6, hrx * .6, Math.PI * 1.15, Math.PI * 1.55); g.stroke();
    } else {
      g.moveTo(-hrx * 1.08, HY + 3.4); g.bezierCurveTo(-hrx * 1.3, top0 - 1.2, hrx * 1.3, top0 - 1.2, hrx * 1.08, HY + 3.4); g.quadraticCurveTo(hrx * .6, HY + 5.2, 0, HY + 4.6); g.quadraticCurveTo(-hrx * .6, HY + 5.2, -hrx * 1.08, HY + 3.4); g.fill();
      if (hs === 'long' || hs === 'bob') { const dropY = hs === 'bob' ? HY + 9 : -68; g.beginPath(); g.moveTo(-hrx * 1.05, HY + 2); g.quadraticCurveTo(-hrx * 1.5, HY + 12, -sw * .72, dropY - 2); g.quadraticCurveTo(-sw * .4, dropY + 3, 0, dropY + 1); g.quadraticCurveTo(sw * .4, dropY + 3, sw * .72, dropY - 2); g.quadraticCurveTo(hrx * 1.5, HY + 12, hrx * 1.05, HY + 2); g.quadraticCurveTo(0, HY + 6.5, -hrx * 1.05, HY + 2); g.fill(); g.strokeStyle = hdark; g.globalAlpha = .4; g.lineWidth = .3; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 1.4, HY + 4); g.quadraticCurveTo(i * 2, HY + 12, i * 2.4, dropY); g.stroke(); } g.globalAlpha = 1; }
      if (hs === 'ponytail') { g.beginPath(); g.moveTo(-1.3, HY + 1); g.quadraticCurveTo(-3, HY + 12, -1.5, HY + 22); g.quadraticCurveTo(0, HY + 25, 1.5, HY + 22); g.quadraticCurveTo(3, HY + 12, 1.3, HY + 1); g.fill(); }
      if (hs === 'bun') { g.beginPath(); g.arc(0, HY - hry - 1.6, 2.8, 0, TAU); g.fill(); }
      if (hs === 'cap') { g.fillStyle = S(o.cap || top); g.beginPath(); g.moveTo(-hrx * 1.1, HY + 1); g.bezierCurveTo(-hrx * 1.2, HY - hry * 1.5, hrx * 1.2, HY - hry * 1.5, hrx * 1.1, HY + 1); g.closePath(); g.fill(); }
      g.strokeStyle = hdark; g.lineWidth = .3; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 1.3, HY - hry + 1); g.lineTo(i * 1.5, HY + 3.5); g.stroke(); }
    }
  }
  if (o.scarf && !o.helmet) { g.fillStyle = S(o.scarf); g.beginPath(); g.ellipse(0, -85.2, 5.4, 2.4, 0, 0, TAU); g.fill(); if (front) { g.fillRect(1.2, -85, 3.2, 14); g.fillStyle = 'rgba(0,0,0,.2)'; for (let k = 0; k < 3; k++) g.fillRect(1.2, -80 + k * 4, 3.2, .5); } }
  if (o.hood && !o.helmet) { // hood up against the rain
    g.fillStyle = S(mulc(top, .9)); g.beginPath(); g.moveTo(-hrx * 1.35, HY + 5); g.bezierCurveTo(-hrx * 1.5, HY - hry * 1.75, hrx * 1.5, HY - hry * 1.75, hrx * 1.35, HY + 5);
    if (front) { g.lineTo(hrx * .95, HY + 4); g.bezierCurveTo(hrx * 1.05, HY - hry * 1.05, -hrx * 1.05, HY - hry * 1.05, -hrx * .95, HY + 4); }
    g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = .4; g.stroke();
  } else if (o.hat && !o.helmet && hs !== 'cap') { // knitted beanie with a turned-up brim
    g.fillStyle = S(o.hat); g.beginPath(); g.moveTo(-hrx * 1.08, HY - 2.2); g.bezierCurveTo(-hrx * 1.15, HY - hry * 1.75, hrx * 1.15, HY - hry * 1.75, hrx * 1.08, HY - 2.2); g.closePath(); g.fill();
    g.fillStyle = S(mulc(o.hat, .78)); g.fillRect(-hrx * 1.1, HY - 3.6, hrx * 2.2, 2.2); g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = .3; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 1.4, HY - 3.6); g.lineTo(k * 1.2, HY - hry * 1.4); g.stroke(); }
  }
  // umbrella
  if (o.umb && hpx > 24) { g.strokeStyle = 'rgba(20,20,20,.85)'; g.lineWidth = .7; g.beginPath(); g.moveTo(sw + 1.6, -48); g.lineTo(sw + 1.6, -116); g.stroke(); g.fillStyle = S(o.umb); g.beginPath(); g.ellipse(sw + 1.6, -116, 28, 11, 0, Math.PI, 0); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = .4; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(sw + 1.6, -127); g.lineTo(sw + 1.6 + i * 9, -116); g.stroke(); } }
  ctx.restore();
}

function limbG(g, S, x0, y0, x1, y1, w0, w1, col) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const gr = g.createLinearGradient(x0 + nx * w0 / 2, y0 + ny * w0 / 2, x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  gr.addColorStop(0, S(mulc(col, 1.14))); gr.addColorStop(.6, S(col)); gr.addColorStop(1, S(mulc(col, .68)));
  g.fillStyle = gr; g.beginPath(); g.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); g.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  g.arc(x1, y1, w1 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true); g.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  g.arc(x0, y0, w0 / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true); g.fill();
}
// profile view with a proper walk cycle (used for people crossing the road)
function personSide(o) {
  const dm = o.dm || 10, hpx = o.h, S = c => o.raw ? rgb(c) : shade(c, dm, .95), face = o.face || 1, ph = o.ph || 0, mv = !!o.walk;
  const skin = o.skin || SKIN[1], hair = o.hair || HAIR[0], top = o.top || CLOTHES[0], bot = o.bot || [40, 44, 60], shoe = o.shoe || [30, 30, 34];
  const g = ctx, outfit = o.outfit || 'tee', hs = o.hairStyle || 'short';
  g.save();
  if (!o.noShadow) { g.fillStyle = 'rgba(0,0,0,.24)'; g.beginPath(); g.ellipse(o.x, o.y, hpx * .15, hpx * .03, 0, 0, TAU); g.fill(); }
  g.translate(o.x, o.y); const u = hpx / 100; g.scale(u * face, u);
  if (mv) g.translate(0, -Math.abs(Math.sin(ph)) * 1.1);
  const lean = mv ? 2.2 : .6;
  const thA = mv ? Math.sin(ph) * .55 : .05, thB = mv ? Math.sin(ph + Math.PI) * .55 : -.05;
  // leg phase pl, thigh angle th (forward +). While cos(pl) > 0 the leg is swinging through and the knee bends up
  // to ~65 degrees; in stance it stays nearly straight. The foot dorsiflexes for heel strike and rolls onto the toe.
  const drawLeg = (th, pl) => {
    const c = Math.cos(pl), flex = mv ? Math.pow(Math.max(0, c), 1.3) * 1.15 + Math.max(0, Math.sin(pl)) * .12 : .04;
    const hx = .5, hy = -48, kx = hx + Math.sin(th) * 22, ky = hy + Math.cos(th) * 22, phi = th - flex, ax = kx + Math.sin(phi) * 22, ay = ky + Math.cos(phi) * 22;
    limbG(g, S, hx, hy, kx, ky, 9.5, 7.5, bot); limbG(g, S, kx, ky, ax, ay, 7.5, 5.2, bot);
    const fr = mv ? (c > 0 ? -.12 * c : Math.min(0, Math.sin(pl)) * .5) + (th > .35 ? -.2 : 0) : 0;
    g.save(); g.translate(ax, ay + 1.6); g.rotate(-fr);
    g.fillStyle = S(mulc(shoe, .95)); g.beginPath(); g.ellipse(2.6, 0, 5.4, 2.5, 0, 0, TAU); g.fill();
    g.fillStyle = S([232, 232, 232]); g.fillRect(-2.4, 1.7, 10, .9); g.restore();
  };
  const arm = (a, dark) => {
    const sx = .5 + lean * .9, sy = -80, ex = sx + Math.sin(a) * 16, ey = sy + Math.cos(a) * 16, b = a + (a > 0 ? .55 : .15), wx = ex + Math.sin(b) * 15, wy = ey + Math.cos(b) * 15, col = dark ? mulc(top, .75) : top;
    limbG(g, S, sx, sy, ex, ey, 5.6, 4.8, col); limbG(g, S, ex, ey, wx, wy, 4.8, 3.8, col);
    g.fillStyle = S(dark ? mulc(skin, .8) : skin); g.beginPath(); g.ellipse(wx + Math.sin(b) * 2, wy + Math.cos(b) * 2.4, 2, 2.8, -b, 0, TAU); g.fill();
  };
  const al = mv ? -Math.sin(ph) * .5 : .05;
  if (o.pack) { g.fillStyle = S(mulc(o.pack, .85)); g.beginPath(); g.roundRect ? g.roundRect(-10.5 + lean * .6, -85, 7, 24, 2.5) : g.rect(-10.5, -85, 7, 24); g.fill(); }
  drawLeg(thB, ph + Math.PI); arm(-al, true);
  g.beginPath(); g.moveTo(-4.6, -49); g.lineTo(-3.8 + lean, -83); g.quadraticCurveTo(lean, -86, 3.6 + lean, -82); g.quadraticCurveTo(5.6 + lean * .6, -66, 4.8, -49); g.closePath();
  const gr = g.createLinearGradient(-5, 0, 6, 0); gr.addColorStop(0, S(mulc(top, .7))); gr.addColorStop(.5, S(top)); gr.addColorStop(1, S(mulc(top, 1.15))); g.fillStyle = gr; g.fill();
  if (outfit === 'jacket' || outfit === 'coat') { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = .5; g.beginPath(); g.moveTo(4.6 + lean * .5, -80); g.lineTo(4.6, -50); g.stroke(); }
  if (outfit === 'hoodie') { g.fillStyle = S(mulc(top, .8)); g.beginPath(); g.ellipse(-2.6 + lean, -84, 4.2, 3, 0, 0, TAU); g.fill(); }
  drawLeg(thA, ph); arm(al, false);
  const hx0 = lean + 2.1, hy0 = -91.6;
  g.fillStyle = S(mulc(skin, .9)); g.fillRect(hx0 - 3.2, -87.5, 4.8, 5);
  const sk = g.createRadialGradient(hx0 - 1, hy0 - 2, 1, hx0, hy0, 8); sk.addColorStop(0, S(mulc(skin, 1.1))); sk.addColorStop(.7, S(skin)); sk.addColorStop(1, S(mulc(skin, .75)));
  g.fillStyle = sk; g.beginPath(); g.ellipse(hx0, hy0, 5.5, 6.8, 0, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(hx0 + 5.1, hy0 - .6); g.lineTo(hx0 + 7.3, hy0 + 1.6); g.lineTo(hx0 + 5.1, hy0 + 2.3); g.fill();
  g.fillStyle = S(mulc(skin, .85)); g.beginPath(); g.ellipse(hx0 - 1.2, hy0 + .3, 1.1, 2, 0, 0, TAU); g.fill();
  g.fillStyle = '#f3f0ea'; g.beginPath(); g.ellipse(hx0 + 3.2, hy0 - 1.4, 1.1, .75, 0, 0, TAU); g.fill();
  g.fillStyle = S(o.eye || [70, 45, 25]); g.beginPath(); g.arc(hx0 + 3.6, hy0 - 1.4, .55, 0, TAU); g.fill(); g.fillStyle = '#0c0c0e'; g.beginPath(); g.arc(hx0 + 3.7, hy0 - 1.4, .28, 0, TAU); g.fill();
  g.strokeStyle = S(mulc(hair, .8)); g.lineWidth = .7; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx0 + 2, hy0 - 3.2); g.lineTo(hx0 + 4.4, hy0 - 3); g.stroke();
  g.strokeStyle = 'rgba(90,30,30,.8)'; g.lineWidth = .45; g.beginPath(); g.moveTo(hx0 + 3.6, hy0 + 3.6); g.lineTo(hx0 + 5.2, hy0 + 3.5); g.stroke();
  if (o.helmet) { g.fillStyle = S(o.helmet); g.beginPath(); g.ellipse(hx0 - .4, hy0 - 2.2, 6.4, 5.6, 0, Math.PI, 0); g.fill(); }
  else if (o.hood) { g.fillStyle = S(mulc(top, .9)); g.beginPath(); g.moveTo(hx0 + 3.2, hy0 + 5); g.bezierCurveTo(hx0 + 5.5, hy0 - 9, hx0 - 9, hy0 - 10, hx0 - 7, hy0 + 6); g.closePath(); g.fill(); }
  else if (o.hat && hs !== 'cap') { g.fillStyle = S(o.hat); g.beginPath(); g.ellipse(hx0 - .6, hy0 - 3.4, 6.1, 5.2, 0, Math.PI, 0); g.fill(); g.fillStyle = S(mulc(o.hat, .78)); g.fillRect(hx0 - 6.7, hy0 - 4.4, 12.2, 2); }
  else if (hs !== 'bald') {
    g.fillStyle = S(hair); g.beginPath(); g.moveTo(hx0 + 4.6, hy0 - 4.4); g.bezierCurveTo(hx0 + 2, hy0 - 8.6, hx0 - 6.4, hy0 - 8, hx0 - 5.8, hy0 + 1); g.lineTo(hx0 - 3, hy0 + (hs === 'long' || hs === 'bob' ? 7 : 2.6)); g.quadraticCurveTo(hx0 - 2, hy0 - 3, hx0 + 4.6, hy0 - 4.4); g.fill();
    if (hs === 'long' || hs === 'ponytail') { g.beginPath(); g.moveTo(hx0 - 4, hy0 - 2); g.quadraticCurveTo(hx0 - 8, hy0 + 10, hx0 - 5 + lean, -68); g.lineTo(hx0 - 2, -70); g.quadraticCurveTo(hx0 - 3, hy0 + 8, hx0 - 1, hy0); g.fill(); }
    if (hs === 'bun') { g.beginPath(); g.arc(hx0 - 5, hy0 - 6, 2.8, 0, TAU); g.fill(); }
    if (hs === 'cap') { g.fillStyle = S(o.cap || top); g.beginPath(); g.moveTo(hx0 - 5.8, hy0 - 2); g.bezierCurveTo(hx0 - 6, hy0 - 9.5, hx0 + 4, hy0 - 9.5, hx0 + 4.8, hy0 - 3); g.closePath(); g.fill(); g.fillRect(hx0 + 3.4, hy0 - 3.4, 5.4, 1.4); }
  }
  if (o.beard) { g.fillStyle = S(mulc(hair, .85)); g.beginPath(); g.moveTo(hx0 + 4, hy0 + 2); g.quadraticCurveTo(hx0 + 5, hy0 + 8, hx0, hy0 + 7); g.quadraticCurveTo(hx0 - 3, hy0 + 5, hx0 - 3, hy0 + 1); g.fill(); }
  if (o.glasses) { g.strokeStyle = 'rgba(30,30,34,.85)'; g.lineWidth = .5; g.strokeRect(hx0 + 2.2, hy0 - 2.4, 3, 2.2); g.beginPath(); g.moveTo(hx0 + 2.2, hy0 - 1.4); g.lineTo(hx0 - 1.2, hy0 - 1); g.stroke(); }
  if (o.bag) { g.fillStyle = S(o.bag); g.beginPath(); g.roundRect ? g.roundRect(-8, -56, 9, 8, 1.5) : g.rect(-8, -56, 9, 8); g.fill(); }
  if (o.umb && hpx > 24) { g.strokeStyle = 'rgba(20,20,20,.85)'; g.lineWidth = .7; g.beginPath(); g.moveTo(lean + 9, -52); g.lineTo(lean + 9, -116); g.stroke(); g.fillStyle = S(o.umb); g.beginPath(); g.ellipse(lean + 9, -116, 28, 11, 0, Math.PI, 0); g.fill(); }
  g.restore();
}
