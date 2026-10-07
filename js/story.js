'use strict';
// The rider's shift: offers, decisions, pickups, deliveries — written as one long coroutine.
let DT = 0.016;
let shiftStarted = false; // set when the viewer presses Start
const capEl = document.getElementById('cap'), capWho = document.getElementById('capWho'), capTxt = document.getElementById('capTxt');
let capTimer = 0;
function caption(who, text, dur, mute) {
  capEl.classList.toggle('high', scene.mode === 'tunnel' && !!scene.door); // keep the subtitle off the face in the doorway
  capWho.textContent = (who || '').replace(/^Rider[MF]$/, 'Rider'); capTxt.textContent = text; capEl.classList.add('on'); capEl.classList.toggle('inner', !who);
  capTimer = dur;
}
function* speak(who, text, pitch, female) {
  const est = Math.max(1.5, text.length * .052 + .7), isF = female !== undefined ? female : pitch >= 180;
  const tts = Snd.talk(text, who, { female: isF, pitch: who === 'You' ? .8 : undefined, rate: who === 'You' ? 1.02 : undefined });
  if (!tts) Snd.voice(text, pitch, .07);
  caption(who, text, (tts ? est * 1.7 : est) + .5);
  if (tts) { let tw = 0; yield (dt) => { tw += dt; return tts.done || tw > est * 2.4 + 2; }; yield .3; }
  else yield est;
}
function says(text, dur) { caption('', text, dur || 3.2); if (!Snd.talk(text, 'You', { female: false, pitch: .8, rate: 1.02 })) Snd.voice(text, 105, .06); }
function mutter(text, dur) { if (capTimer <= 0) { caption('', text, dur || 3.2); Snd.talk(text, 'You', { female: false, pitch: .8, rate: 1.02, vol: .8 }); } }

// ---------- coroutine runner ----------
let mainGen = null, waitT = 0, waitFn = null;
function stepStory(dt) {
  if (!mainGen) return;
  if (waitFn) { if (!waitFn(dt)) return; waitFn = null; }
  else if (waitT > 0) { waitT -= dt; if (waitT > 0) return; }
  for (let guard = 0; guard < 50; guard++) {
    const r = mainGen.next();
    if (r.done) { mainGen = null; return; }
    const y = r.value;
    if (typeof y === 'number') { waitT = Math.max(y, .0001); return; }
    if (typeof y === 'function') { waitFn = y; if (!y(dt)) return; waitFn = null; }
  }
}
function* fade(to, sec) {
  const from = scene.fade; let t = 0;
  while (t < sec) { t += DT; scene.fade = lerp(from, to, clamp(t / sec, 0, 1)); yield 0; }
  scene.fade = to;
}
function* until(fn, timeout) { let t = 0; while (!fn()) { t += DT; if (timeout && t > timeout) return; yield 0; } }

// ---------- people ----------
function mkLook(kind) { return randomLook(G, kind === 'plain' ? undefined : kind); }
function mkCustomer(dest, plan) {
  const D = DISTRICTS[plan.district], first = G.p(FIRST), type = dest.type;
  const c = { first, name: first + ' ' + String.fromCharCode(65 + G.i(0, 25)) + '.', type, look: mkLook(G.p(['plain', 'plain', 'plain', 'gown', 'work'])), dog: G.c(.13),
    floors: G.i(1, 3), lift: type === 'tower' || (type === 'flat' && D.floors[1] >= 5 && G.c(.35)), overshoot: G.c(.16), wrongBlock: type === 'estate' && G.c(.5),
    noAnswer: (type === 'flat' || type === 'estate' || type === 'tower') && G.c(.12), building: G.p(BLDG), unit: G.i(2, 24), num: G.i(3, 88), street: plan.name, gate: G.c(.15) };
  c.addr = (type === 'house' || type === 'direct') ? c.num + ' ' + plan.name : 'Flat ' + c.unit + ', ' + c.building;
  c.doorNum = (type === 'house' || type === 'direct') ? String(c.num) : String(c.unit);
  if (!c.doorNum || c.doorNum === 'undefined') c.doorNum = '12';
  c.light = G.c(.6);
  return c;
}

// ---------- offers ----------
function busyness() {
  const h = env.hour;
  return (h > 11.7 && h < 14.3) ? .8 : (h > 17.7 && h < 21.7) ? 1 : (h > 14.3 && h < 17.7) ? .35 : (h > 21.7 || h < 6) ? .3 : .5;
}
const DEST_TYPES = ['house', 'direct', 'flat', 'estate', 'tower'], OUTCOMES = ['ready', 'short', 'long', 'gone', 'stolen'];
function makeOffer() {
  const cu = G.p(CUISINES), from = nav.district;
  const name = G.p(cu.names) + ' ' + G.p(cu.suffix);
  const n1 = G.i(2, 4), plans1 = planRoute(from, n1);
  const rest = setDest(plans1[plans1.length - 1], 'restaurant', { name, cuisine: cu.k });
  const dropD = G.c(.3) ? G.p(NEIGH[from]) : from;
  nav.lastName = plans1[plans1.length - 1].name;
  const n2 = G.c(.1) ? G.i(6, 7) : G.i(3, 5), plans2 = planRoute(plans1[plans1.length - 1].district, n2, dropD);
  const last2 = plans2[plans2.length - 1], dt = DEST_TYPES.includes(QP.get('dest')) ? QP.get('dest') : G.p(DISTRICTS[last2.district].dest);
  const dest2 = setDest(last2, dt, {}); dest2.cust = mkCustomer(dest2, last2);
  const mi = (routeLength(plans1) + routeLength(plans2)) / 1609;
  const b = busyness(), wet = env.rain > .2 ? .6 : 0, surge = b > .9 ? .5 : 0;
  const pay = Math.round((2.5 + 1.05 * mi + wet + surge + G.r(-.35, .6)) * 20) / 20;
  const r = G.n(), bb = b;
  const outcome = r < .5 ? 'ready' : r < .5 + .25 ? 'short' : r < .75 + .08 + bb * .05 ? 'long' : r < .93 ? 'gone' : 'stolen';
  const oc = OUTCOMES.includes(QP.get('outcome')) ? QP.get('outcome') : outcome; const items = []; const pool = cu.items.slice(); for (let i = 0; i < G.i(2, 3); i++) { const it = pool.splice(G.i(0, pool.length - 1), 1)[0]; if (it) items.push((G.c(.3) ? '2× ' : '1× ') + it); }
  return { cu, rest, name, plans1, plans2, dropD, cust: dest2.cust, mi, pay, outcome: oc, items, order: String(G.i(1000, 9999)), code: String(G.i(1000, 9999)), min: mi * 4.2 + 8, district: DISTRICTS[dropD].name, street: plans1[plans1.length - 1].name };
}
function* waitRiding(sec) { let t = 0; while (t < sec) { t += DT; yield 0; } }

function* waitForOrder() {
  nav.wander = true; nav.arrived = false; phone.mode = 'idle'; phone.gt = 0; phone.tap = null;
  let declines = 0, first = trips === 0;
  // he rides about behind the title card, but the first order waits until the shift is actually started (and audible)
  while (!shiftStarted) yield 0;
  for (;;) {
    const b = busyness();
    yield* waitRiding(first ? 7 : G.r(9, 24) * (1.3 - b * .6)); first = false;
    while (merchActive) yield 0;
    const tr = makeOffer();
    phone.offer = { pay: tr.pay, mi: tr.mi, rest: tr.name, cuisine: tr.cu.k, street: tr.street, district: tr.district, min: tr.min };
    phone.mode = 'offer'; phone.timer = 1; phone.gt = 1; phone.tap = null;
    Snd.ping(); Snd.buzz();
    const D = G.r(4.5, 7), decideAt = D * G.r(.6, .85);
    let t = 0;
    while (t < decideAt) { t += DT; phone.timer = 1 - t / 20 * 1.6; yield 0; }
    // decision
    const ppm = tr.pay / tr.mi;
    const thr = 2.7 + b * .55 + (env.rain > .3 ? -.25 : 0) - declines * .45 - (trips === 0 ? .5 : 0) + G.r(-.3, .3);
    const accept = ppm >= thr && tr.mi < 2.9 && tr.pay >= 3.2;
    phone.tap = accept ? 'accept' : 'decline'; phone.tapT = 0; Snd.tap();
    yield .5;
    if (accept) {
      Snd.click(); phone.gt = 0;
      const lines = ['Go on then.', 'That\'s decent.', env.rain > .3 ? 'Rain bonus. Go on.' : 'Alright, that\'ll do.', 'Nice, close by.'];
      mutter(G.p(lines), 2.6);
      yield .6; phone.tap = null;
      return tr;
    }
    const why = tr.mi > 2.5 ? 'Too far for that.' : tr.pay < 3.6 ? money(tr.pay) + ' for that? No thanks.' : G.p(['Nah, not worth it.', 'Skip.', 'Not for that money.']);
    mutter(why, 2.6);
    phone.gt = 0; phone.mode = 'idle'; phone.tap = null; declines++;
    yield 1.2;
  }
}

// ---------- walking helpers ----------
function beginWalk() {
  scene.mode = 'street'; scene.rideActive = false; scene.walking = true;
  scene.wz = R.z; scene.wx = R.x; scene.wdir = 1; scene.look = 0;
}
function* turnFace(dir) {
  yield* fade(1, .2); scene.wdir = dir; scene.look = 0; yield* fade(0, .25);
}
function* walkTo(z, speed, lx) {
  const S = world.street; let dir = Math.sign(z - scene.wz);
  if (Math.abs(z - scene.wz) < .3) return;
  if (dir !== scene.wdir) yield* turnFace(dir);
  const side = S.dest ? S.dest.side : -1;
  const px = lx !== undefined ? lx : side * (S.halfW + S.pav * .38);
  while ((z - scene.wz) * dir > .05) {
    scene.wz += dir * Math.min(speed * DT, (z - scene.wz) * dir);
    const prev = scene.wph; scene.wph += DT * speed * 3.4;
    if (Math.floor(scene.wph / Math.PI) !== Math.floor(prev / Math.PI)) Snd.step('street');
    scene.wx += (px - scene.wx) * (1 - Math.exp(-DT * 1.8));
    yield 0;
  }
}
function* dismount() {
  R.v = 0; Snd.stand(); yield .5;
  beginWalk(); phone.gt = 0;
  // wheel it up onto the pavement edge, clear of the traffic, then step off a pace
  const S = world.street, side = S.dest ? S.dest.side : -1, px = side * (S.halfW + S.pav * .38);
  R.x = side * (S.halfW + .42); R.onPave = true;
  for (let t = 0; t < .9; t += DT) { const k = 1 - Math.exp(-DT * 4); scene.wx += (px - scene.wx) * k; scene.wz += DT * .9; scene.wph += DT * 5; yield 0; }
}
// walk back along the pavement, then step off the kerb to the moped with it in full view
function* walkBackToMoped(parkZ, speed) {
  const dir = Math.sign(parkZ - scene.wz) || -1;
  yield* walkTo(parkZ - dir * 3.2, speed);
  if (dir !== scene.wdir) yield* turnFace(dir);
  const S = world.street, side = S.dest ? S.dest.side : -1, z1 = parkZ - dir * 1.9, x1 = R.x + side * .6;
  while ((z1 - scene.wz) * dir > .03) {
    scene.wz += dir * Math.min(speed * .7 * DT, (z1 - scene.wz) * dir);
    scene.wx += (x1 - scene.wx) * (1 - Math.exp(-DT * 2.2));
    const prev = scene.wph; scene.wph += DT * speed * 2.6;
    if (Math.floor(scene.wph / Math.PI) !== Math.floor(prev / Math.PI)) Snd.step('street');
    yield 0;
  }
  for (let t = 0; t < .7; t += DT) { scene.wx += (x1 - scene.wx) * (1 - Math.exp(-DT * 3)); yield 0; }
}
function* mount(plans, target) {
  Snd.stand(); yield .3;
  yield* fade(1, .25);
  scene.walking = false; scene.rideActive = true; scene.look = 0; scene.wdir = 1; scene.carry = null;
  if (R.onPave) { R.onPave = false; R.x = Math.sign(R.x) * (world.street.halfW - .6); }
  R.parked = false; R.parkZ = null; R.tx = laneX(world.street); R.v = 0; nav.arrived = false;
  nav.wander = false; nav.queue = plans ? plans.slice() : [];
  if (!plans) nav.wander = true;
  yield* fade(0, .3);
  yield .3;
}
function* stepTunnel(zTarget, speed, kind) {
  const t = scene.tun;
  while (scene.wz < zTarget - .02) {
    scene.wz += Math.min(speed * DT, zTarget - scene.wz);
    const prev = scene.wph; scene.wph += DT * speed * (kind === 'stairs' ? 5 : 3.6);
    if (Math.floor(scene.wph / Math.PI) !== Math.floor(prev / Math.PI)) Snd.step(t.out ? 'street' : (t.H(scene.wz) > t.H(scene.wz - .3) ? 'stairs' : 'indoor'));
    t.pitch = t.kind === 'indoor' ? clamp((t.H(scene.wz + 1) - t.H(scene.wz - .3)) * .02, 0, .03) : 0;
    yield 0;
  }
}
function* enterTunnel(tun, look) {
  scene.tun = tun; scene.mode = 'tunnel'; scene.wz = 0.01; scene.wx = 0; scene.look = look || 0; scene.door = null; scene.extra = null; scene.wph = 0;
}

// ---------- a chat with another courier while waiting for an order ----------
const RIDER_CHATS = [
  [['R', 'Busy tonight, is it?'], ['Y', 'Steady. You?'], ['R', 'Non-stop since six. My legs are gone.'], ['Y', 'Not long to go now.']],
  [['R', 'Is that the new model? How is the range?'], ['Y', 'Fifty miles, easy. The battery is a dream.'], ['R', 'Might switch. Mine is on its last legs.'], ['Y', 'Do it. You will not look back.']],
  [['R', 'Been waiting long?'], ['Y', 'Ages. The kitchen is slammed.'], ['R', 'Same at the last place. Thirty minutes.'], ['Y', 'Unreal.']],
  [['R', 'Are you getting good offers?'], ['Y', 'Three pounds for two miles earlier.'], ['R', 'Robbery. I declined that one.'], ['Y', 'Every time.']],
  [['R', 'Did you hear that siren earlier?'], ['Y', 'Yeah. Is it kicking off?'], ['R', 'It is always kicking off round here.'], ['Y', 'Ha! It really is.']],
  [['R', 'Had a bloke tip me ten quid last night.'], ['Y', 'Never happens to me.'], ['R', 'First one this month.']],
  [['R', 'Did you watch the match?'], ['Y', 'Do not get me started.'], ['R', 'Three nil.'], ['Y', 'Please stop.']],
  [['R', 'Lovely weather for it.'], ['Y', 'Ha. Soaked through.'], ['R', 'Should have been a barista.'], ['Y', 'I think that every single day.']],
];
function mkOther() { return { x: .93, col: G.p([[30, 170, 150], [220, 60, 60], [60, 90, 200]]), look: randomLook(G, 'rider') }; }
function* riderChat(S) {
  const o = S.others[0]; if (!o) return;
  const f = !!o.look.female, who = 'Rider' + (f ? 'F' : 'M');
  const pool = RIDER_CHATS.filter((c, i) => i !== 7 || env.rain > .25);
  const script = G.p(pool);
  o.chat = true; yield .5;
  for (const [sp, text] of script) {
    if (sp === 'R') yield* speak(who, text, f ? 205 : 130, f); else yield* speak('You', text, 118);
    yield .2;
  }
  yield .4; o.chat = false;
}

// ---------- pickup ----------
function* doPickup(tr) {
  const S = () => world.street;
  phone.mode = 'nav'; phone.target = 'PICK UP'; phone.sub = tr.name; phone.sub2 = tr.cu.k + ' · ' + tr.street; phone.order = tr.order; phone.amount = tr.pay;
  nav.wander = false; nav.queue = tr.plans1.slice(); nav.arrived = false;
  // the route was planned when the offer came in; if he has turned since, don't "turn onto" the street he's on
  const q0 = nav.queue[0], cur = world.turn ? world.turn.plan.name : world.street.name;
  if (q0 && nav.queue.length > 1 && q0.name === cur) for (let k = 0; k < 12 && (q0.name === cur || q0.name === nav.queue[1].name); k++) q0.name = streetName(q0.district, cur);
  phone.gt = 0;
  yield () => nav.arrived;
  // arrived at the restaurant street
  yield* dismount();
  const dest = S().dest, doorZ = dest.z;
  phone.mode = 'arrived'; phone.sub = tr.name; phone.sub2 = 'Collect order for ' + tr.cust.name; phone.status = 'Preparing'; phone.btn = 'Confirm pickup'; phone.items = null;
  if (dest.parkZ - doorZ > 12) mutter('Nowhere to stop nearer…', 3);
  yield* walkTo(doorZ, 1.85, undefined);
  // look at the door
  const sg = dest.side * scene.wdir;
  for (let t = 0; t < .8; t += DT) { scene.look = lerp(scene.look, -sg * 1.2, .08); yield 0; }
  Snd.door(); yield .4; Snd.doorBell();
  yield* fade(1, .3);
  yield* inShop(tr);
  // back out
  scene.mode = 'street'; scene.look = -sg * 1.2; scene.extra = null;
  yield* fade(0, .4);
  if (!tr.cancelled) scene.carry = tr.cu.col;
  scene.look = 0;
  yield* walkBackToMoped(dest.parkZ, 1.9);
  yield* mount(tr.cancelled ? null : tr.plans2);
  if (!tr.cancelled) {
    phone.mode = 'nav'; phone.target = 'DELIVER'; phone.sub = tr.cust.name; phone.sub2 = tr.cust.addr; phone.order = tr.order; phone.amount = tr.pay;
  } else { phone.mode = 'idle'; }
}

function* inShop(tr) {
  const busy = G.i(0, busyness() > .7 ? 2 : 1);
  scene.shop = makeShop(tr.cu, busy); scene.shop.order = tr.order.slice(-3); scene.mode = 'shop'; scene.wph = 0; scene.rideActive = false;
  const S = scene.shop, st = S.staff[0], name = tr.cust.first, sp = st.look.female ? 200 : 135;
  const chatty = (tr.outcome === 'short' || tr.outcome === 'long') && G.c(.55);
  if (chatty && !S.others.length) S.others.push(mkOther());
  yield* fade(0, .5);
  Snd.clatter();
  yield .8;
  yield* speak('Staff', G.p(S.venue === 'ghost' ? ['Courier? Which order?', 'Number on your app?', 'Name on the order?'] : S.venue === 'sit' ? ['Good evening, can I help?', 'Hi there, collecting an order?'] : ['Hi, collecting?', 'Evening — pick up?', 'Yeah?', 'Hello, delivery?']), sp);
  yield* speak('You', G.p(['Order for ' + name + '.', 'Collecting for ' + name + ', please.', 'Pickup for ' + name + '.']), 120);
  const handOver = function* (line) {
    Snd.bag(); for (let t = 0; t < .8; t += DT) { S.bag = t / .8; st.reach = Math.min(1, t / .5); yield 0; }
    S.bag = 1; phone.status = 'Ready — confirm pickup'; phone.items = tr.items;
    yield* speak('Staff', line, sp);
    yield* speak('Staff', G.p(['Scan the code on the bag, please.', 'Just scan the sticker there.', 'You need to scan that code.']), sp);
    phone.mode = 'scan'; phone.scanOk = false; phone.gt = 1; yield .6;
    for (let t = 0; t < 1.8; t += DT) yield 0;
    Snd.beep(); phone.scanOk = true; yield 1;
    phone.mode = 'arrived'; phone.gt = 0;
    Snd.bag(); for (let t = 0; t < .7; t += DT) { S.bagGrab = t / .7; yield 0; }
    S.bag = 0; st.reach = 0; phone.gt = .8; phone.mode = 'arrived'; Snd.tap(); yield .8; phone.gt = 0;
    yield* speak('You', G.p(['Cheers!', 'Thanks, have a good one.', 'Thanks!']), 120);
  };
  const cancel = function* (comp) {
    phone.gt = 1; yield .5; phone.mode = 'cancel'; phone.amount = comp; phone.sub = comp > 0 ? 'Compensation added' : 'No fault of yours';
    Snd.sad(); tr.cancelled = true; tr.comp = comp; yield 2.2; phone.gt = 0; if (comp) phone.earn += comp;
  };
  switch (tr.outcome) {
    case 'ready':
      yield .4; yield* handOver(G.p(['Here you go.', 'There you go, cheers.', 'All here — enjoy.'])); break;
    case 'short': {
      yield* speak('Staff', G.p(['Nearly done — two minutes.', 'Just bagging it up now.', 'Give me a couple of minutes.']), sp);
      yield* speak('You', 'No problem.', 120);
      phone.gt = .8; yield 1; phone.gt = 0;
      for (let t = 0, T = G.r(14, 26), cd = false; t < T; t += DT) { if (chatty && !cd && t > 2) { cd = true; const w0 = world.time; yield* riderChat(S); t += world.time - w0; } if (Math.random() < DT * .3) Snd.clatter(); yield 0; }
      yield* handOver(G.p(['Sorry for the wait.', 'Here you go.', 'Thanks for waiting.']));
      break;
    }
    case 'long': {
      st.mood = 'sour';
      yield* speak('Staff', G.p(['Sorry mate, we\'re backed up. Another ten?', 'Kitchen\'s slammed — could be a while.', 'Chef\'s only just started yours, sorry.']), sp);
      yield* speak('You', G.p(['Ten minutes… okay.', 'Right. Fine.']), 115);
      const total = G.r(40, 70), giveUp = G.c(.4) ? total * G.r(.5, .8) : 1e9;
      let t = 0, told = false, chatDone = false;
      while (t < total) {
        t += DT; if (Math.random() < DT * .35) Snd.clatter();
        if (chatty && !chatDone && t > total * .18) { chatDone = true; const w0 = world.time; yield* riderChat(S); t += world.time - w0; }
        if (!told && t > total * .35) { told = true; phone.gt = .9; mutter('Still nothing…', 3); }
        if (told && t > total * .55) phone.gt = 0;
        if (t > giveUp) break;
        yield 0;
      }
      phone.gt = 0;
      if (t >= total) { st.mood = 'ok'; yield* handOver(G.p(['Really sorry about that.', 'Here you go, sorry mate.'])); }
      else { yield* speak('You', 'I\'m going to cancel this one, sorry.', 120); yield* speak('Staff', 'Yeah, fair enough.', sp); yield* cancel(Math.round(tr.pay * .55 * 20) / 20); }
      break;
    }
    case 'gone': case 'stolen': {
      yield .6;
      const l = tr.outcome === 'gone' ? G.p(['That\'s already been collected.', 'Someone took that about five minutes ago.', 'We handed that to another rider.']) : 'It was on the shelf… someone walked off with the wrong bag.';
      st.mood = 'sour'; yield* speak('Staff', l, sp);
      yield* speak('You', G.p(['Already? Brilliant.', 'Right… great.', 'Ah. Okay.']), 115);
      if (G.c(.3)) { says("It's all kicking off.", 2.6); yield 2.4; }
      yield .5; yield* cancel(Math.round(tr.pay * .5 * 20) / 20);
      break;
    }
  }
  yield* fade(1, .45);
  phone.gt = 0;
}

// ---------- delivery ----------
function* doDelivery(tr) {
  nav.arrived = false;
  yield () => nav.arrived;
  const S = () => world.street, c = tr.cust, dest = S().dest;
  yield* dismount();
  phone.mode = 'arrived'; phone.sub = c.name; phone.sub2 = c.addr; phone.status = 'Ready — hand over'; phone.btn = 'Complete delivery'; phone.items = null;
  scene.carry = tr.cu.col;
  if (dest.parkZ - dest.z > 12) mutter('Had to park up the road…', 3);
  else if (dest.parkZ - dest.z < -1) mutter('Right outside, nice.', 2.5);
  const doorZ = dest.z; const sgFn = () => dest.side * scene.wdir;
  if (c.overshoot) {
    const dir = Math.sign(doorZ - scene.wz) || 1, beyond = doorZ + dir * G.r(9, 14);
    yield* walkTo(beyond, 1.85);
    phone.gt = 1; yield .6; mutter('Hang on… wrong end of the street.', 3.4); yield 2.4; phone.gt = 0; yield .5;
  }
  yield* walkTo(doorZ, 1.85);
  for (let t = 0; t < .8; t += DT) { scene.look = lerp(scene.look, -sgFn() * 1.2, .08); yield 0; }
  yield* fade(1, .3);
  scene.mode = 'tunnel';
  // ---- entrance sequences
  if (c.type === 'house' || c.type === 'direct') {
    yield* enterTunnel(buildGarden({ L: c.type === 'house' ? 8.5 : 4.6, short: c.type === 'direct', doorCol: G.p(DOORS), num: c.doorNum, wall: G.p(PAL.brick) }));
    yield* fade(0, .4);
    yield* stepTunnel(scene.tun.L - 2.4, 1.5); scene.tun.pitch = 0;
  } else {
    // buzzer at the block entrance
    const t1 = buildIndoor({ L: 6, end: { type: 'glass' }, buzzer: true, wall: [188, 186, 176] });
    yield* enterTunnel(t1); scene.tun.bright = .85;
    yield* fade(0, .4);
    yield* stepTunnel(3.5, 1.3);
    for (let t = 0; t < .7; t += DT) { scene.look = lerp(scene.look, .9, .1); yield 0; }
    yield .3; Snd.tap(); phone.gt = 0;
    Snd.buzzer(); yield .8;
    if (c.noAnswer) {
      yield 3; mutter('No answer…', 2.4); yield 1.5; Snd.buzzer(); yield 2.5;
      phone.mode = 'call'; phone.sub = c.first; phone.status = 'Calling…'; phone.gt = 1; yield 2.5;
      yield* speak(c.first, 'Sorry! Coming down, one sec.', 200); phone.gt = 0; phone.mode = 'arrived';
      Snd.lift(); yield 2.2;
    } else {
      yield* speak(c.first, G.p(['Hello?', 'Yeah?', 'Hi?']), 190);
      yield* speak('You', 'Delivery!', 120);
      yield .3;
    }
    Snd.buzzer(); Snd.click(); yield .8;
    scene.look = 0; yield* fade(1, .3);
    if (c.wrongBlock) {
      // wrong block: come back out and try the next one
      yield* enterTunnel(buildIndoor({ L: 5, end: { type: 'flat', num: 'B' + c.unit, col: [70, 66, 60] }, doors: [{ z: 2, side: -1, num: 3, col: [70, 66, 60] }, { z: 3.6, side: 1, num: 4, col: [70, 66, 60] }], wall: [176, 174, 164] }));
      yield* fade(0, .4); yield* stepTunnel(3.8, 1.5);
      phone.gt = 1; yield .5; mutter('This is Block B… I need C.', 3.4); yield 3; phone.gt = 0;
      yield* fade(1, .3); yield 0.5; yield* fade(0, .3); mutter('Round to the other entrance.', 2.5); yield 1.5; yield* fade(1, .4);
    }
    if (c.lift) {
      yield* enterTunnel(buildIndoor({ L: 5.5, end: { type: 'lift' }, mail: [1.4], wall: [214, 210, 196] }));
      yield* fade(0, .4); yield* stepTunnel(4.6, 1.4);
      Snd.click(); yield .5; Snd.lift(); yield* fade(1, .5); yield 1.2; Snd.lift();
    } else {
      const nfl = c.floors, st = [], per = 12; let z = 4;
      for (let f = 0; f < nfl; f++) { st.push({ z0: z, n: per }); z += per * .28 + 1.1; }
      yield* enterTunnel(buildIndoor({ L: z + 1, stairs: st, mail: [1.4], wall: [204, 198, 180] }));
      yield* fade(0, .4);
      yield* stepTunnel(3.8, 1.4);
      if (c.floors > 1) mutter('No lift. Of course.', 2.6);
      for (const s of st) { yield* stepTunnel(s.z0 + s.n * .28 + .3, 1.05, 'stairs'); }
      yield* stepTunnel(z + .6, 1.3);
      yield* fade(1, .3);
    }
    // landing / corridor
    const doors = [], L = 9; let nums = c.unit;
    doors.push({ z: 1.6, side: -1, num: nums - 2 > 0 ? nums - 2 : nums + 3, col: G.p(DOORS) }); doors.push({ z: 3.2, side: 1, num: nums - 1 > 0 ? nums - 1 : nums + 4, col: G.p(DOORS) });
    doors.push({ z: 4.8, side: -1, num: nums + 1, col: G.p(DOORS) }); doors.push({ z: 6.4, side: 1, num: nums + 2, col: G.p(DOORS) });
    yield* enterTunnel(buildIndoor({ L, doors, end: { type: 'flat', num: c.unit, col: G.p(DOORS) }, wall: G.p([[210, 204, 188], [198, 208, 200], [214, 200, 190]]) }));
    yield* fade(0, .4);
    yield* stepTunnel(2.8, 1.5);
    if (G.c(.35)) { scene.look = .5; phone.gt = .7; yield 1.2; mutter('Flat ' + c.unit + '… further along.', 2.6); yield 1.2; phone.gt = 0; scene.look = 0; }
    yield* stepTunnel(L - 2.3, 1.4);
  }
  // ---- doorstep
  yield* doorstep(tr);
  // ---- back out
  yield* fade(1, .5);
  scene.mode = 'street'; scene.tun = null; scene.extra = null; scene.door = null; scene.look = 0; scene.wz = doorZ; scene.wx = dest.side * (S().halfW + S().pav * .8);
  yield* fade(0, .4);
  yield* walkBackToMoped(dest.parkZ, 1.95);
  scene.carry = null;
  yield* mount(null);
}

function* doorstep(tr) {
  const c = tr.cust, t = scene.tun;
  scene.door = { open: 0, cust: { look: c.look, dog: c.dog }, arm: 0, bagT: -1 };
  scene.extra = (dt, z) => {
    const dr = scene.door;
    if (dr.open > .02) drawDoorway(t, z, dr.open, dr.cust, dr.arm);
    if (dr.bagT >= 0) {
      // the customer stands 0.7 m inside the door; their reaching hand ends ~0.45 m right, 1.17 m up
      const r = t.doorRect, rz = Math.max(r.z - z, .6), cz = rz + .7, hand = P(.45 - cam.x, r.y0 + 1.17, cz), k = clamp(dr.bagT, 0, 1), e = k * k * (3 - 2 * k);
      const s = lerp(SH * .3, F / cz * .34, e), x = lerp(SW * .8, hand[0], e), y = lerp(SH * .95, hand[1] + s * .64, e);
      drawBag(x, y, s, tr.cu.col, e > .6 ? c.look.skin : null);
    }
  };
  for (let a = 0; a < 1; a += DT * 2) { yield 0; }
  yield .4; scene.look = 0;
  Snd.doorBell(); yield 1.4;
  if (c.dog) { Snd.dog(); yield 1.6; }
  yield 1.2 + G.r(0, 2.5);
  if (c.type === 'house' && G.c(.3)) { Snd.doorBell(); yield 2; }
  Snd.door();
  for (let o = 0; o < 1; o += DT * 1.6) { scene.door.open = o; yield 0; }
  scene.door.open = 1;
  Snd.creak(); yield .4;
  yield* speak(c.first, G.p(['Hi!', 'Alright?', 'Oh, hello.', 'Hey — that was quick.']), c.look.female ? 210 : 140);
  yield* speak('You', 'Delivery for ' + c.first + '?', 120);
  yield* speak(c.first, G.p(['Yep, that\'s me.', 'That\'s me, thanks.', 'Yeah, thanks.']), c.look.female ? 210 : 140);
  yield* speak('You', G.p(['Could I get your four-digit code, please?', 'Can I have the delivery code, please?']), 120);
  const pitch = c.look.female ? 210 : 140;
  if (G.c(.3)) { yield* speak(c.first, 'Erm… hang on, where is it…', pitch); phone.gt = 0; yield 2.4; yield* speak(c.first, 'Found it!', pitch); }
  yield* speak(c.first, "It's " + tr.code.split('').join(', ') + '.', pitch);
  phone.mode = 'code'; phone.digits = ''; phone.codeOk = false; phone.key = ''; phone.gt = 1; yield .5;
  for (const ch of tr.code) { phone.digits += ch; phone.key = ch; Snd.tap(); yield .6; }
  phone.codeOk = true; Snd.beep(); yield 1.1; phone.gt = 0;
  // handover
  scene.carry = null; Snd.bag(); for (let k = 0; k < 1; k += DT * 1.1) { scene.door.bagT = k; scene.door.arm = Math.min(1, k * 2); yield 0; }
  scene.door.bagT = 1; phone.gt = .7; phone.mode = 'done'; phone.amount = tr.pay; phone.sub = 'Order #' + tr.order; Snd.cash(); yield 1.3;
  phone.gt = 0;
  const night = env.hour > 18.5 || env.hour < 5;
  yield* speak(c.first, G.p(['Cheers, thanks a lot!', 'Lovely, thank you.', 'Nice one, cheers.']), c.look.female ? 210 : 140);
  yield* speak('You', G.p(['No worries, enjoy!', night ? 'Have a good night.' : 'Have a good day.', 'Enjoy!']), 120);
  for (let o = 1; o > 0; o -= DT * 1.5) { scene.door.open = o; scene.door.arm = 0; if (o < .75) scene.door.bagT = -1; yield 0; }
  scene.door.bagT = -1;
  scene.door.open = 0; Snd.door(); yield .6;
}

function* postTrip(tr) {
  if (!tr.cancelled) { phone.earn += tr.pay; phone.trips++; trips++; }
  phone.mode = 'idle'; phone.gt = 0; nav.wander = true;
  nav.district = world.street.plan.district;
  if (!tr.cancelled) mutter(G.p(['Another one done.', 'Good. Next.', env.rain > .3 ? 'Soaked. Keep going.' : 'Back out again.']), 3);
  yield 1;
}

// ---------- the occasional spot to camera ----------
let merchActive = false;
const MERCH_SCRIPTS = [
  ['Right, quick word from our sponsor... which is me.', 'This is Holy Water. Little flavour drops. Squeeze some in your bottle and tap water tastes like mango.', 'No sugar, no faff. Code KICKING OFF gets you ten percent off. Right, back to work.'],
  ['Hydration check, everyone.', 'Holy Water flavour drops. Two squeezes in your water bottle and you are basically on holiday.', 'Link in the description. Cheers!'],
  ['Sorry, got to do this bit.', 'Holy Water. Peach, lime or cherry. Just drip it into your water.', 'Use code LAST MILE and tell them the rider sent you.'],
];
function sayChain(lines, i, onEnd) {
  if (i >= lines.length) { if (onEnd) onEnd(); return; }
  const text = lines[i], est = Math.max(1.6, text.length * .055 + .7);
  caption('', text, est * 1.8 + .6);
  const tts = Snd.talk(text, 'You', { female: false, pitch: .82, rate: 1.03 });
  if (!tts) Snd.voice(text, 108, .06);
  let waited = 0; world.later = world.later || [];
  const poll = () => {
    waited += .25;
    if ((tts && tts.done) || waited > est * 2.4 + 1.5 || (!tts && waited > est)) sayChain(lines, i + 1, onEnd);
    else world.later.push({ t: world.time + .25, fn: poll });
  };
  world.later.push({ t: world.time + .25, fn: poll });
}
function canMerch() { return !merchActive && scene.rideActive && !world.turn && phone.mode === 'idle' && R.parkZ == null && world.street && !world.street.veh.some(u => u.emerg); }
// a free stretch of kerb ahead where he can stop for the spot to camera
function findBay() {
  // (a street with a finished drop on it is fine: canMerch() only lets this run between orders, and he is
  // nearly always still on the street he delivered to when the phone goes idle)
  const S = world.street; if (!S) return null;
  for (const side of [-1, 1]) for (let z = R.z + 40; z < Math.min(R.z + 110, S.len - 50); z += 2) {
    const a = z - 6, b = z + 3.5; let ok = true;
    for (const c of S.parked) if (c.side === side && c.z + c.len / 2 > a && c.z - c.len / 2 < b) { ok = false; break; }
    if (!ok) continue;
    for (const g of S.gaps[side < 0 ? 'L' : 'R']) if (g.z1 > a - 2 && g.z0 < b + 2) ok = false;
    if (S.zebras.some(zc => zc > a - 6 && zc < b + 6)) ok = false;
    if (S.furn.some(f => (f.k === 'bus' || f.k === 'cones' || f.k === 'phone' || f.k === 'rack' || f.k === 'cabinet' || f.k === 'belisha') && f.side === side && f.z > a - 2 && f.z < b + 2)) ok = false;
    if (S.signal && S.stopZ - z < 30) ok = false;
    if (ok) return { z, x: side * (S.halfW - .85), side };
  }
  return null;
}
function startMerch() {
  if (!canMerch()) return false;
  const bay = findBay(); if (!bay) return false;
  merchActive = true; R.parkZ = bay.z; R.parkX = bay.x; R.merchStop = true; R.parked = false;
  runSub(merchSpot(bay)); return true;
}
function* merchSpot(bay) {
  let t = 0; while (!R.parked && t < 45) { t += DT; yield 0; }
  if (!R.parked) { R.parkZ = null; R.merchStop = false; merchActive = false; return; }
  Snd.stand(); yield .5; yield* fade(1, .3);
  scene.rideActive = false; scene.walking = false; scene.mode = 'selfie';
  scene.selfie = { t: 0, side: bay.side, hold: 0, holdT: 0, flav: 0, flavT: 0, code: 0, codeT: 0, talk: false };
  yield* fade(0, .5); Snd.click(); yield .5;
  const lines = G.p(MERCH_SCRIPTS);
  const cm = lines.join(' ').match(/[Cc]ode ([A-Z][A-Z ]*[A-Z])/); scene.selfie.codeTxt = cm ? cm[1] : null; // the card shows the code he actually reads out
  scene.selfie.holdT = 1; scene.selfie.talk = true;
  for (let i = 0; i < lines.length; i++) {
    if (i === 1) scene.selfie.flavT = 1;
    if (i === 2 && scene.selfie.codeTxt) scene.selfie.codeT = 1;
    yield* speak('You', lines[i], 118, false);
  }
  yield* speak('You', G.p(['Right, back to work!', 'Anyway. Orders to deliver.', 'Cheers. Now, where is that next order?']), 118, false);
  scene.selfie.talk = false; scene.selfie.holdT = 0; scene.selfie.flavT = 0; scene.selfie.codeT = 0; yield .7;
  yield* fade(1, .3);
  scene.mode = 'street'; scene.selfie = null; scene.rideActive = true; R.parked = false; R.parkZ = null; R.merchStop = false; R.v = 0; R.tx = laneX(world.street);
  yield* fade(0, .4); Snd.stand(); yield 2.5; merchActive = false;
}

// a second, independent coroutine for one-off scenes (same yield rules as the main story)
let sub = null;
function runSub(gen) { sub = { gen, waitT: 0, waitFn: null }; }
function stepSub(dt) {
  if (!sub) return;
  if (sub.waitFn) { if (!sub.waitFn(dt)) return; sub.waitFn = null; }
  else if (sub.waitT > 0) { sub.waitT -= dt; if (sub.waitT > 0) return; }
  for (let guard = 0; guard < 50; guard++) {
    const r = sub.gen.next(); if (r.done) { sub = null; return; }
    const y = r.value;
    if (typeof y === 'number') { sub.waitT = Math.max(y, .0001); return; }
    if (typeof y === 'function') { sub.waitFn = y; if (!y(dt)) return; sub.waitFn = null; }
  }
}

let trips = 0;
function* mainStory() {
  scene.fade = 1; yield 0.2; mainGen.started = true;
  yield* fade(0, 3);
  for (;;) {
    const tr = yield* waitForOrder();
    yield* doPickup(tr);
    if (!tr.cancelled) yield* doDelivery(tr);
    yield* postTrip(tr);
  }
}
