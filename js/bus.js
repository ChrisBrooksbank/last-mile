'use strict';
// London double-decker (Enviro400-style): painted side / front / rear textures, each with two emissive layers —
// c.E (LED destination blinds, lamps: always lit) and c.W (saloon lighting, faded in when it's dull or dark).
const BUS_L = 10.8, BUS_H = 4.3;
const BUS_WIN = { lo: [1.18, 2.24], up: [2.74, 3.8] };   // glazing bands, metres above the road

function busRR(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
function busLed(g, txt, x, y, h, maxW, bold) {   // amber dot-matrix style text
  g.save(); let fs = h; g.font = (bold ? '800 ' : '700 ') + fs + 'px "Arial Narrow",Arial,sans-serif';
  const tw = g.measureText(txt).width; if (tw > maxW) { fs *= maxW / tw; g.font = (bold ? '800 ' : '700 ') + fs + 'px "Arial Narrow",Arial,sans-serif'; }
  g.textBaseline = 'middle'; g.fillStyle = '#ffb21e'; g.shadowColor = 'rgba(255,170,30,.8)'; g.shadowBlur = h * .25; g.fillText(txt, x, y); g.restore();
}
function busBody(g, W, H, X, Y, top, col, rTop) {
  const gr = g.createLinearGradient(0, Y(top), 0, Y(0));
  gr.addColorStop(0, rgb(mulc(col, 1.12))); gr.addColorStop(.08, rgb(mulc(col, 1.02))); gr.addColorStop(.6, rgb(col)); gr.addColorStop(1, rgb(mulc(col, .62)));
  g.fillStyle = gr; busRR(g, 0, Y(top), W, Y(.34) - Y(top), rTop); g.fill();
}
// a band of saloon windows: glass (day) with passengers and seat backs, and the lit version into W
function busGlass(g, w, X, Y, x0, x1, yb, yt, r, lower) {
  const e = w.getContext('2d');
  for (const c of [g, e]) { c.save(); c.beginPath(); c.rect(X(x0), Y(yt), X(x1 - x0), X(yt - yb)); c.clip(); }
  // day glass: sky reflection over a dark interior
  const gg = g.createLinearGradient(0, Y(yt), 0, Y(yb)); gg.addColorStop(0, '#8ea6ba'); gg.addColorStop(.35, '#3c4c5c'); gg.addColorStop(1, '#141a22');
  g.fillStyle = gg; g.fillRect(X(x0), Y(yt), X(x1 - x0), X(yt - yb));
  const eg = e.createLinearGradient(0, Y(yt), 0, Y(yb)); eg.addColorStop(0, '#fff3dc'); eg.addColorStop(1, '#f2dcb0');
  e.fillStyle = eg; e.fillRect(X(x0), Y(yt), X(x1 - x0), X(yt - yb));
  // ceiling strip lights, yellow grab poles, seat backs (moquette) and passengers
  e.fillStyle = 'rgba(255,255,250,1)'; e.fillRect(X(x0), Y(yt - .06), X(x1 - x0), X(.05));
  for (let x = x0 + .5; x < x1 - .2; x += 1.6) { e.fillStyle = 'rgba(230,180,20,.9)'; e.fillRect(X(x), Y(yt), Math.max(2, X(.035)), X(yt - yb)); g.fillStyle = 'rgba(200,160,30,.35)'; g.fillRect(X(x), Y(yt), Math.max(2, X(.035)), X(yt - yb)); }
  for (let x = x0 + .15; x < x1 - .3; x += .78) {
    const sb = [[70, 40, 90], [30, 60, 110], [110, 40, 50]][(r.n() * 3) | 0];
    for (const c of [g, e]) { c.fillStyle = c === e ? rgb(mulc(sb, 1.1)) : rgb(mulc(sb, .45)); busRR(c, X(x), Y(yb + .42), X(.5), X(.42), X(.06)); c.fill(); }
    if (r.c(lower ? .42 : .34)) { // a passenger: head and shoulders above the seat back
      const px = x + .25 + r.r(-.08, .08), sk = r.p(SKIN), hr = r.p(HAIR), top = r.p(CLOTHES), hy = yb + .78 + r.r(-.04, .06);
      for (const c of [g, e]) {
        const k = c === e ? .85 : .42;
        c.fillStyle = rgb(mulc(top, k)); busRR(c, X(px - .2), Y(hy - .1), X(.4), X(.5), X(.12)); c.fill();
        c.fillStyle = rgb(mulc(sk, k)); c.beginPath(); c.ellipse(X(px), Y(hy + .08), X(.1), X(.125), 0, 0, TAU); c.fill();
        c.fillStyle = rgb(mulc(hr, k)); c.beginPath(); c.ellipse(X(px), Y(hy + .15), X(.105), X(.08), 0, Math.PI, 0); c.fill();
      }
    }
  }
  // reflections: two soft diagonal sheens across the glass (day only)
  for (const off of [.18, .55]) { const sx = X(x0 + (x1 - x0) * off); g.fillStyle = 'rgba(255,255,255,.10)'; g.beginPath(); g.moveTo(sx, Y(yt)); g.lineTo(sx + X(1.1), Y(yt)); g.lineTo(sx + X(.3), Y(yb)); g.lineTo(sx - X(.8), Y(yb)); g.fill(); }
  g.restore(); e.restore();
}
function busWheel(g, X, Y, cx, rear) {
  const r = .5;
  g.fillStyle = '#060607'; g.beginPath(); g.arc(X(cx), Y(.52), X(.62), Math.PI, 0); g.lineTo(X(cx + .62), Y(.34)); g.lineTo(X(cx - .62), Y(.34)); g.fill();
  g.fillStyle = '#111214'; g.beginPath(); g.arc(X(cx), Y(r), X(r), 0, TAU); g.fill();
  g.strokeStyle = '#1d1e21'; g.lineWidth = X(.05); g.beginPath(); g.arc(X(cx), Y(r), X(r * .9), 0, TAU); g.stroke();
  const hg = g.createRadialGradient(X(cx - .08), Y(r + .08), X(.02), X(cx), Y(r), X(.3)); hg.addColorStop(0, rear ? '#6a6e74' : '#e2e5e8'); hg.addColorStop(1, rear ? '#2a2c30' : '#80858c');
  g.fillStyle = hg; g.beginPath(); g.arc(X(cx), Y(r), X(.3), 0, TAU); g.fill();
  g.fillStyle = rear ? '#1a1b1e' : '#50545a'; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.beginPath(); g.arc(X(cx + Math.cos(a) * .19), Y(r + Math.sin(a) * .19), X(.022), 0, TAU); g.fill(); }
  g.fillStyle = '#2e3034'; g.beginPath(); g.arc(X(cx), Y(r), X(.08), 0, TAU); g.fill();
}

function paintBusSide(c, g, col, lit, ppm, W, H, X, Y, route) {
  const L = BUS_L, rt = BUS_ROUTES[route || 0] || BUS_ROUTES[0], r = new RNG(71 + (route || 0) * 13);
  const E = C2(W, H), Wn = C2(W, H), e = E.getContext('2d');
  c.E = E; c.W = Wn;
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(X(.2), Y(.1), X(L - .4), X(.12));
  busBody(g, W, H, X, Y, BUS_H, col, X(.45));
  g.save(); busRR(g, 0, Y(BUS_H), W, Y(.34) - Y(BUS_H), X(.45)); g.clip();
  // skirt shadow + rubbing strip
  g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(0, Y(.62), W, X(.28)); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, Y(.9), W, 2);
  // black window surrounds
  g.fillStyle = '#0c0d10';
  busRR(g, X(.18), Y(BUS_WIN.up[1] + .1), X(L - .26), X(BUS_WIN.up[1] - BUS_WIN.up[0] + .2), X(.22)); g.fill();
  busRR(g, X(.18), Y(BUS_WIN.lo[1] + .08), X(L - .36), X(BUS_WIN.lo[1] - BUS_WIN.lo[0] + .16), X(.1)); g.fill();
  // saloon windows: upper deck runs the full length; lower deck is broken by the doors
  busGlass(g, Wn, X, Y, .32, L - .2, BUS_WIN.up[0], BUS_WIN.up[1], r, false);
  busGlass(g, Wn, X, Y, .32, 4.6, BUS_WIN.lo[0], BUS_WIN.lo[1], r, true);
  busGlass(g, Wn, X, Y, 5.95, L - 2.0, BUS_WIN.lo[0], BUS_WIN.lo[1], r, true);
  // window pillars
  g.fillStyle = '#0c0d10';
  for (let x = 1.55; x < L - .8; x += 1.3) g.fillRect(X(x), Y(BUS_WIN.up[1]), X(.07), X(BUS_WIN.up[1] - BUS_WIN.up[0]));
  for (const x of [1.5, 2.8, 3.95, 7.1, 8.2]) g.fillRect(X(x), Y(BUS_WIN.lo[1]), X(.07), X(BUS_WIN.lo[1] - BUS_WIN.lo[0]));
  // driver's cab side window behind the front door
  { const cx0 = L - .74, cx1 = L - .24, gg = g.createLinearGradient(0, Y(BUS_WIN.lo[1]), 0, Y(BUS_WIN.lo[0])); gg.addColorStop(0, '#8ea6ba'); gg.addColorStop(1, '#161c24');
    g.fillStyle = gg; g.fillRect(X(cx0), Y(BUS_WIN.lo[1]), X(cx1 - cx0), X(BUS_WIN.lo[1] - BUS_WIN.lo[0]));
    const wc = Wn.getContext('2d'); wc.fillStyle = 'rgba(236,222,190,.45)'; wc.fillRect(X(cx0), Y(BUS_WIN.lo[1]), X(cx1 - cx0), X(BUS_WIN.lo[1] - BUS_WIN.lo[0]));
    for (const cc of [g, wc]) { const k = cc === wc ? .6 : .38; cc.fillStyle = rgb(mulc([40, 50, 80], k)); cc.fillRect(X(cx0 + .08), Y(1.72), X(.34), X(.5)); cc.fillStyle = rgb(mulc(SKIN[1], k)); cc.beginPath(); cc.ellipse(X(cx0 + .27), Y(1.82), X(.1), X(.12), 0, 0, TAU); cc.fill(); } }
  // front upper corner: the deck window wraps round
  g.fillStyle = 'rgba(160,190,215,.25)'; g.fillRect(X(L - .7), Y(BUS_WIN.up[1]), X(.5), X(BUS_WIN.up[1] - BUS_WIN.up[0]));
  // doors (centre + front): glazed leaves with a black frame, rubber seals, lit step
  for (const [d0, d1] of [[4.62, 5.92], [L - 1.98, L - .8]]) {
    g.fillStyle = '#0a0b0d'; g.fillRect(X(d0), Y(2.38), X(d1 - d0), X(2.0));
    const dm = (d0 + d1) / 2;
    for (const [a, b] of [[d0 + .05, dm - .02], [dm + .02, d1 - .05]]) {
      const dg = g.createLinearGradient(0, Y(2.3), 0, Y(.5)); dg.addColorStop(0, '#7f96ab'); dg.addColorStop(.5, '#2e3b49'); dg.addColorStop(1, '#10151b');
      g.fillStyle = dg; g.fillRect(X(a), Y(2.3), X(b - a), X(1.82));
      Wn.getContext('2d').fillStyle = 'rgba(246,232,200,.95)'; Wn.getContext('2d').fillRect(X(a), Y(2.3), X(b - a), X(1.82));
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(X(a + .05), Y(2.25), X(.06), X(1.7));
    }
    g.fillStyle = '#1b1c1f'; g.fillRect(X(dm - .02), Y(2.3), X(.04), X(1.85));
    g.fillStyle = 'rgba(210,190,40,.9)'; g.fillRect(X(d0 + .05), Y(.52), X(d1 - d0 - .1), X(.04));   // step edge
  }
  // between-deck advert panel
  { const a0 = .8, a1 = 4.4, y0 = BUS_WIN.lo[1] + .16, y1 = BUS_WIN.up[0] - .1;
    g.fillStyle = '#f4f1ea'; g.fillRect(X(a0), Y(y1), X(a1 - a0), X(y1 - y0));
    const ag = g.createLinearGradient(X(a0), 0, X(a1), 0); ag.addColorStop(0, '#ff7a3c'); ag.addColorStop(.5, '#ffc93c'); ag.addColorStop(1, '#58d1a8');
    g.fillStyle = ag; g.fillRect(X(a0), Y(y1), X(1.1), X(y1 - y0));
    g.fillStyle = '#20222a'; g.font = '800 ' + X(.22) + 'px Arial,sans-serif'; g.textBaseline = 'middle'; g.fillText('HOLY WATER', X(a0 + 1.22), Y((y0 + y1) / 2 + .03));
    const tw = g.measureText('HOLY WATER').width;
    g.fillStyle = '#6a6c72'; g.font = '600 ' + X(.1) + 'px Arial,sans-serif'; g.fillText('flavour drops', X(a0 + 1.22) + tw + X(.12), Y((y0 + y1) / 2 + .02));
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(X(a0 + .55), Y((y0 + y1) / 2), X(.14), 0, TAU); g.fill(); }
  // side route blind over the front door (always lit)
  { const bx = L - 1.95, by = BUS_WIN.lo[1] + .12; g.fillStyle = '#050505'; g.fillRect(X(bx), Y(by + .26), X(1.1), X(.24)); e.fillStyle = '#060504'; e.fillRect(X(bx), Y(by + .26), X(1.1), X(.24)); busLed(e, rt[0] + ' ' + rt[1], X(bx + .06), Y(by + .14), X(.16), X(1.0)); }
  // panel seams, fleet number, fuel flap, amber side markers
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1.2; for (const x of [.9, 3.3, 7.6]) { g.beginPath(); g.moveTo(X(x), Y(1.1)); g.lineTo(X(x), Y(.62)); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '700 ' + X(.1) + 'px Arial,sans-serif'; g.fillText('LT ' + (400 + (route || 0) * 37), X(L - 1.9), Y(.8));
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X(3.5), Y(1.02), X(.3), X(.22));
  for (const x of [1.2, 4.2, 6.4, 8.9]) { g.fillStyle = '#b86a10'; g.fillRect(X(x), Y(.72), X(.1), X(.05)); e.fillStyle = 'rgba(255,160,30,.9)'; e.fillRect(X(x), Y(.72), X(.1), X(.05)); }
  // highlight along the roof curve and the waist
  g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, Y(BUS_H - .06), W, 2); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, Y(BUS_WIN.lo[1] + .12), W, 2);
  g.restore();
  busWheel(g, X, Y, 2.3, true); busWheel(g, X, Y, L - 2.55, false);
  return c;
}

function paintBusEnd(c, g, col, front, lit, ppm, W, H, X, Y, w, route) {
  const rt = BUS_ROUTES[route || 0] || BUS_ROUTES[0], E = C2(W, H), Wn = C2(W, H), e = E.getContext('2d'), wn = Wn.getContext('2d'), r = new RNG(19 + (route || 0) * 7 + (front ? 1 : 0));
  c.E = E; c.W = Wn;
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(X(.1), Y(.1), X(w - .2), X(.1));
  for (const x0 of [.12, w - .52]) { g.fillStyle = '#0b0b0d'; g.fillRect(X(x0), Y(.5), X(.4), X(.5)); }
  busBody(g, W, H, X, Y, BUS_H, col, X(.4));
  g.save(); busRR(g, 0, Y(BUS_H), W, Y(.34) - Y(BUS_H), X(.4)); g.clip();
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, X(.08), H); g.fillRect(W - X(.08), 0, X(.08), H);   // wrap-round shading at the corners
  if (front) {
    // upper deck front window
    g.fillStyle = '#0c0d10'; busRR(g, X(.1), Y(3.92), X(w - .2), X(1.18), X(.25)); g.fill();
    busGlass(g, Wn, X, Y, .18, w - .18, 2.8, 3.84, r, false);
    // destination blind between the decks: route number + destination
    g.fillStyle = '#050505'; g.fillRect(X(.2), Y(2.68), X(w - .4), X(.36)); e.fillStyle = '#060504'; e.fillRect(X(.2), Y(2.68), X(w - .4), X(.36));
    busLed(e, rt[0], X(.28), Y(2.5), X(.26), X(.55), true); busLed(e, rt[1], X(.9), Y(2.5), X(.19), X(w - 1.2));
    // windscreen with the driver (right-hand drive: on the left as we look at it), wipers and a centre pillar
    g.fillStyle = '#0c0d10'; busRR(g, X(.08), Y(2.3), X(w - .16), X(1.42), X(.12)); g.fill();
    const wg = g.createLinearGradient(0, Y(2.24), 0, Y(.94)); wg.addColorStop(0, '#91a8bc'); wg.addColorStop(.4, '#3b4a59'); wg.addColorStop(1, '#131920');
    g.fillStyle = wg; g.fillRect(X(.14), Y(2.24), X(w - .28), X(1.3));
    wn.fillStyle = 'rgba(236,222,190,.4)'; wn.fillRect(X(.14), Y(2.24), X(w - .28), X(1.3));
    for (const cc of [g, wn]) { const k = cc === wn ? .8 : .4; cc.fillStyle = rgb(mulc([40, 50, 80], k)); busRR(cc, X(.35), Y(1.72), X(.62), X(.62), X(.15)); cc.fill(); cc.fillStyle = rgb(mulc(SKIN[2], k)); cc.beginPath(); cc.ellipse(X(.66), Y(1.84), X(.11), X(.13), 0, 0, TAU); cc.fill(); cc.fillStyle = '#111'; cc.beginPath(); cc.ellipse(X(.66), Y(1.3), X(.3), X(.06), 0, 0, TAU); cc.fill(); }
    g.fillStyle = '#16171a'; g.fillRect(X(w / 2 - .03), Y(2.24), X(.06), X(1.3));
    g.strokeStyle = '#111'; g.lineWidth = X(.025); g.beginPath(); g.moveTo(X(.5), Y(.98)); g.lineTo(X(1.05), Y(1.55)); g.moveTo(X(w / 2 + .3), Y(.98)); g.lineTo(X(w / 2 + .85), Y(1.55)); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(X(.3), Y(2.24)); g.lineTo(X(.9), Y(2.24)); g.lineTo(X(.4), Y(.94)); g.lineTo(X(.14), Y(.94)); g.fill();
    // bumper, grille, headlamps, plate
    g.fillStyle = '#141518'; g.fillRect(X(.05), Y(.72), X(w - .1), X(.36));
    g.fillStyle = '#0d0e10'; g.fillRect(X(.7), Y(.88), X(w - 1.4), X(.12));
    for (const x0 of [.1, w - .1 - w * .18]) {
      g.fillStyle = '#26282d'; busRR(g, X(x0), Y(.84), X(w * .18), X(.24), X(.05)); g.fill();
      g.fillStyle = '#e8eef4'; g.beginPath(); g.arc(X(x0 + w * .06), Y(.72), X(.07), 0, TAU); g.arc(X(x0 + w * .12), Y(.72), X(.07), 0, TAU); g.fill();
      e.fillStyle = 'rgba(255,252,236,.95)'; e.beginPath(); e.arc(X(x0 + w * .06), Y(.72), X(.06), 0, TAU); e.fill();
      g.fillStyle = '#d88a18'; g.fillRect(X(x0 + w * .02), Y(.64), X(w * .14), X(.04));
    }
    g.fillStyle = '#f0efe6'; g.fillRect(X(w / 2 - .26), Y(.62), X(.52), X(.12)); g.fillStyle = '#222'; g.font = '700 ' + X(.08) + 'px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LX' + (60 + (route || 0)) + ' BUS', X(w / 2), Y(.56)); g.textAlign = 'left';
  } else {
    // rear: small upper window, rear route number box, engine grille, rear advert, vertical lamp clusters
    g.fillStyle = '#0c0d10'; busRR(g, X(.3), Y(3.78), X(w - .6), X(.9), X(.2)); g.fill();
    busGlass(g, Wn, X, Y, .38, w - .38, 2.96, 3.7, r, false);
    g.fillStyle = '#050505'; g.fillRect(X(w / 2 - .42), Y(2.78), X(.84), X(.34)); e.fillStyle = '#060504'; e.fillRect(X(w / 2 - .42), Y(2.78), X(.84), X(.34)); busLed(e, rt[0], X(w / 2 - .3), Y(2.61), X(.26), X(.6), true);
    g.fillStyle = '#f2efe8'; g.fillRect(X(.35), Y(2.3), X(w - .7), X(.8));
    g.fillStyle = '#1d1f26'; g.font = '800 ' + X(.17) + 'px Arial,sans-serif'; g.textBaseline = 'middle'; g.fillText('HOLY WATER', X(.5), Y(1.98));
    const ag = g.createLinearGradient(X(.35), 0, X(w - .35), 0); ag.addColorStop(0, '#ff7a3c'); ag.addColorStop(1, '#58d1a8'); g.fillStyle = ag; g.fillRect(X(.35), Y(1.65), X(w - .7), X(.14));
    g.fillStyle = '#16171a'; g.fillRect(X(.45), Y(1.35), X(w - .9), X(.72));
    g.fillStyle = '#2a2c30'; for (let i = 0; i < 9; i++) g.fillRect(X(.5), Y(1.3 - i * .075), X(w - 1.0), X(.035));
    for (const x0 of [.07 * w, w - .24 * w]) { g.fillStyle = '#2a0608'; g.fillRect(X(x0), Y(1.55), X(.17 * w), X(.95)); g.fillStyle = '#7d1418'; g.fillRect(X(x0 + .03), Y(1.5), X(.17 * w - .06), X(.55)); g.fillStyle = '#b36a12'; g.fillRect(X(x0 + .03), Y(.92), X(.17 * w - .06), X(.14)); g.fillStyle = '#ddd'; g.fillRect(X(x0 + .03), Y(.75), X(.17 * w - .06), X(.08)); }
    g.fillStyle = '#141518'; g.fillRect(X(.05), Y(.62), X(w - .1), X(.26));
    g.fillStyle = '#e9dd7a'; g.fillRect(X(w / 2 - .26), Y(.82), X(.52), X(.13));
  }
  g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, Y(BUS_H - .06), W, 2);
  g.restore();
  return c;
}
