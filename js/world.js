'use strict';
// Streets, traffic, the rider's autopilot and route navigation.
const world = { time: 0, street: null, trans: null, yaw: 0, tfade: 0 };
const R = { z: 0, x: -1.3, tx: -1.3, v: 0, dist: 0, filter: false, pass: null, slowT: 0, parkZ: null, parkX: 0, parked: false, ind: 0, braking: false };
const nav = { queue: [], district: 'soho', arrived: false, lastName: '', wander: true };

const laneX = S => -S.halfW * 0.33;

// ---------- plans ----------
function streetName(district, avoid) {
  const D = DISTRICTS[district]; let n, k = 0;
  do { n = G.p(D.streets); } while (n === avoid && k++ < 6);
  return n;
}
function mkPlan(district, turn, avoid) {
  const D = DISTRICTS[district];
  return { district, name: streetName(district, avoid), length: G.r(150, 320), turn: turn || G.p(['L', 'R', 'L', 'R', 'S']), signal: G.c(D.signal), seed: (G.n() * 1e9) | 0, dest: null };
}
// n streets starting in district `from`, drifting to `to` half way through if given
function planRoute(from, n, to) {
  const out = []; let prev = nav.lastName, d = from;
  for (let i = 0; i < n; i++) {
    if (to && i === Math.ceil(n / 2)) d = to;
    const p = mkPlan(d, null, prev); prev = p.name; out.push(p);
  }
  return out;
}
function routeLength(plans) { return plans.reduce((a, p) => a + p.length, 0); }
function setDest(plan, type, info) {
  const S_len = plan.length, r = G;
  const tz = S_len * r.r(.4, .58);
  let off = r.c(.5) ? r.r(-3, 5) : r.r(6, 34);
  const side = r.c(.62) ? -1 : 1;
  plan.dest = Object.assign({ type, z: tz, side, parkZ: clamp(tz + off, 10, S_len - 30), lotLen: type === 'restaurant' ? 8 : (type === 'tower' ? 18 : type === 'estate' ? 20 : 7.5) }, info || {});
  return plan.dest;
}

// ---------- street generation ----------
function sigState(S) {
  const p = (world.time + S.sigOff) % 28;
  return p < 15 ? 'green' : p < 18 ? 'amber' : 'red';
}

function makeStreet(plan) {
  const D = DISTRICTS[plan.district], r = new RNG(plan.seed);
  const halfW = D.halfW * r.r(.93, 1.14);
  const S = {
    plan, D, name: plan.name, len: plan.length, halfW, pav: D.pav, seed: plan.seed,
    curve: r.r(-1, 1) * .00052 * D.curvy, signal: plan.signal, sigOff: r.r(0, 28), stopZ: plan.length - 6.5,
    dest: plan.dest, L: [], Rt: [], furn: [], parked: [], patches: [], zebras: [], gaps: { L: [], R: [] },
    veh: [], peds: [], cross: [], spawnT: [0, 0], crossT: 0, yellow: r.c(.6), centre: halfW > 3.6, rng: r,
  };
  // gaps (junction + side streets)
  const jg = { z0: S.len - 4.5, z1: S.len + 7 };
  S.gaps.L.push(jg); S.gaps.Rt = S.gaps.R; S.gaps.R.push(jg);
  const ns = Math.round(S.len / 95);
  for (let i = 0; i < ns; i++) {
    const z = r.r(25, S.len - 35), side = r.c(.5) ? 'L' : 'R', w = r.r(6, 9);
    const dz = S.dest ? S.dest.z : -999;
    if (Math.abs(z - dz) < 16 || (S.dest && Math.abs(z - S.dest.parkZ) < 12)) continue;
    if (S.gaps[side].some(g => Math.abs(g.z0 - z) < 30)) continue;
    S.gaps[side].push({ z0: z, z1: z + w });
  }
  if (r.c(.35)) S.zebras.push(r.r(30, S.len - 40));
  genSide(S, -1, r); genSide(S, 1, r);
  // furniture
  const inGap = (side, z) => S.gaps[side < 0 ? 'L' : 'R'].some(g => z > g.z0 - 1.5 && z < g.z1 + 1.5);
  for (let z = 6 + r.r(0, 8), k = 0; z < S.len + 170; z += 26, k++) {
    const side = k % 2 ? 1 : -1;
    if (!inGap(side, z)) S.furn.push({ k: 'lamp', z, x: side * (halfW + .45), side });
  }
  for (let z = r.r(0, 10); z < S.len + 170; z += r.r(16, 26)) {
    const side = r.c(.5) ? 1 : -1;
    if (inGap(side, z)) continue;
    const q = r.n(), x = side * (halfW + S.pav * .55);
    if (q < D.tree) S.furn.push({ k: 'tree', z, x: side * (halfW + .9), side, hue: r.n(), sz: r.r(.85, 1.2) });
    else if (q < D.tree + .12) S.furn.push({ k: 'bin', z, x: side * (halfW + S.pav - .5), side });
    else if (q < D.tree + .16) S.furn.push({ k: 'post', z, x: side * (halfW + .9), side });
    else if (q < D.tree + .19 && D.shop > .3) S.furn.push({ k: 'phone', z, x: side * (halfW + .9), side });
    else if (q < D.tree + .24) S.furn.push({ k: 'bus', z, x: side * (halfW + .8), side });
    else if (q < D.tree + .32) S.furn.push({ k: 'bollard', z, x: side * (halfW + .3), side });
  }
  // parked cars
  for (const side of [-1, 1]) {
    const pr = side < 0 ? D.parked : D.parked * .55; let z = r.r(-40, -30);
    while (z < S.len + 150) {
      const type = r.c(.14) ? 'van' : 'car', len = type === 'van' ? 5.2 : r.r(3.9, 4.6);
      const ok = !inGap(side, z - 1) && !inGap(side, z + len + 1) && !(S.dest && S.dest.side === side && Math.abs(z + len / 2 - S.dest.parkZ) < 4.2) && !S.furn.some(f => f.k === 'bus' && f.side === side && Math.abs(f.z - z) < 7);
      if (r.c(pr) && ok) S.parked.push({ z: z + len / 2, x: side * (halfW - 1.0), len, w: 1.8, h: type === 'van' ? 2.3 : 1.42, type, col: type === 'van' ? r.p([[220, 220, 224], [190, 190, 194], [40, 60, 100]]) : r.p(CAR_COLS), side });
      z += len + r.r(.5, 3);
    }
  }
  for (let i = 0; i < S.len / 9; i++) S.patches.push({ z: r.r(-30, S.len + 120), x: r.r(-halfW + .5, halfW - .5), w: r.r(.5, 1.6), l: r.r(1, 3.5), s: r.r(.7, 1.15) });
  return S;
}

function genSide(S, side, r) {
  const D = S.D, arr = side < 0 ? S.L : S.Rt, gaps = S.gaps[side < 0 ? 'L' : 'R'];
  let z = -60, placed = false;
  const dest = S.dest && S.dest.side === side ? S.dest : null;
  let guard = 0;
  while (z < S.len + 190 && guard++ < 400) {
    const g = gaps.find(g => z < g.z1 && z + 3 > g.z0);
    if (g && z >= g.z0 - .01) { z = g.z1; continue; }
    let len = r.r(D.lot[0], D.lot[1]);
    if (g && z + len > g.z0) len = g.z0 - z;
    if (dest && !placed) {
      const a = dest.z - dest.lotLen / 2;
      if (z + len > a - .1) {
        if (a - z >= 3) { arr.push(mkLot(S, side, z, a, r, null)); }
        arr.push(mkLot(S, side, a, a + dest.lotLen, r, dest)); placed = true; z = a + dest.lotLen; continue;
      }
    }
    if (len < 3) { z += Math.max(len, .5); continue; }
    arr.push(mkLot(S, side, z, z + len, r, null)); z += len;
  }
}

function mkLot(S, side, z0, z1, r, dest) {
  const D = S.D; let kind;
  if (dest) {
    kind = dest.type === 'restaurant' ? 'shop' : dest.type === 'tower' ? 'glass' : dest.type === 'estate' ? 'block'
      : dest.type === 'flat' ? (D.floors[1] >= 5 || D.kind === 'estate' ? 'block' : 'house') : 'house';
  } else if (D.kind === 'towers') kind = r.c(.12) ? 'shop' : 'glass';
  else if (D.kind === 'estate') kind = r.c(D.shop) ? 'shop' : r.c(.6) ? 'block' : 'house';
  else kind = r.c(D.shop) ? 'shop' : 'house';
  const palName = kind === 'glass' ? 'glass' : (kind === 'block' ? r.p(['concrete', 'brick', 'modern']) : r.p(D.pal));
  const col = r.p(PAL[palName]);
  let floors = kind === 'glass' ? r.i(D.floors[0], D.floors[1]) : kind === 'block' ? r.i(5, 8) : r.i(D.floors[0], D.floors[1]);
  if (kind === 'shop') floors = Math.max(2, floors);
  const gh = { shop: 3.7, house: 3.3, block: 3.4, glass: 5 }[kind], fh = kind === 'glass' ? 3.8 : 3;
  let setback = kind === 'shop' ? 0 : r.r(D.setback[0], D.setback[1]);
  if (kind === 'glass') setback = r.r(D.setback[0], D.setback[1]);
  if (dest && (dest.type === 'house')) setback = Math.max(setback, 3.2);
  if (dest && (dest.type === 'direct' || dest.type === 'flat') && kind === 'house') setback = Math.min(setback, .6);
  if (dest && dest.type === 'restaurant') setback = 0;
  if (dest && (dest.type === 'estate' || dest.type === 'tower')) setback = Math.max(setback, 4);
  const cu = dest ? CUISINES.find(c => c.k === dest.cuisine) : null;
  return {
    z0, z1, side, x: side * (S.halfW + S.pav + setback), setback, kind, floors, gh, fh, h: gh + (floors - 1) * fh,
    col, trim: mixc(col, [255, 255, 255], .35), seed: (r.n() * 1e6) | 0, wp: { shop: 2.5, house: 2.4, block: 2.8, glass: 2.6 }[kind],
    ww: kind === 'glass' ? .92 : kind === 'block' ? .55 : .48, lit: r.r(.12, .6), doorU: dest ? .5 : r.r(.25, .75),
    shopCol: cu ? cu.col : r.p(FASCIA), name: dest && dest.type === 'restaurant' ? dest.name : r.p(SHOPS), dest: dest || null,
    front: setback > 1 ? (r.c(.55) ? 'hedge' : r.c(.5) ? 'brick' : 'rail') : null, gcol: r.c(.7) ? [64, 104, 54] : [112, 106, 98],
    chim: r.c(.25), roof: r.c(.5) ? 1 : 0, cornice: r.c(.6),
  };
}

// ---------- vehicles / pedestrians ----------
const VDIMS = { car: [1.8, 4.3, 1.45], cab: [1.9, 4.6, 1.75], van: [2.0, 5.3, 2.4], bus: [2.55, 10.8, 4.3], bike: [.6, 1.7, 1.7] };
function mkVeh(S, lane, z) {
  const r = G, q = r.n();
  let type = q < .66 ? 'car' : q < .76 ? 'cab' : q < .86 ? 'van' : q < .93 ? 'bus' : 'bike';
  if (lane === 1 && type === 'bike') type = 'car';
  const d = VDIMS[type];
  const col = type === 'cab' ? [22, 22, 26] : type === 'bus' ? [196, 30, 36] : type === 'van' ? r.p([[224, 224, 228], [200, 200, 204], [50, 70, 110], [230, 230, 230]]) : r.p(CAR_COLS);
  const v0 = S.D.cruise * r.r(.62, 1.0) * (type === 'bus' ? .8 : 1);
  const v = { type, lane, z, w: d[0], len: d[1], h: d[2], col, axis: 'z', ph: r.n() * 6 };
  if (lane === 0) { v.x = type === 'bike' ? -S.halfW * .62 : laneX(S) + r.r(-.15, .15); v.v0 = type === 'bike' ? 4.5 : v0; v.v = v.v0 * .9; v.dir = 1; }
  else { v.x = -laneX(S) + r.r(-.15, .15); v.v = -r.r(6, 11); v.dir = -1; v.passed = false; }
  return v;
}
function mkPed(S, z) {
  const r = G, side = r.c(.5) ? 1 : -1;
  return { z, x: side * (S.halfW + S.pav * r.r(.3, .85)), dz: (r.c(.5) ? 1 : -1) * r.r(1.05, 1.6), skin: r.p(SKIN), hair: r.p(HAIR), top: r.p(CLOTHES), bot: r.p([[40, 44, 60], [30, 30, 34], [70, 80, 110], [90, 76, 60]]), umb: r.c(.85) ? r.p([[30, 30, 36], [140, 30, 40], [40, 60, 110]]) : null, h: r.r(1.55, 1.85), ph: r.n() * 6, phone: r.c(.25) };
}

function loadStreet(plan) {
  const S = makeStreet(plan);
  world.street = S; nav.lastName = plan.name; nav.district = plan.district;
  R.z = 0; R.x = R.tx = laneX(S); R.pass = null; R.filter = false; R.slowT = 0;
  R.parkZ = null; R.parked = false; R.ind = 0;
  if (S.dest) { R.parkZ = S.dest.parkZ; R.parkX = S.dest.side * (S.halfW - .85); nav.arrived = false; }
  for (let z = 22; z < 140; z += G.r(14, 34) / (S.D.traffic + .2)) S.veh.push(mkVeh(S, 0, z));
  for (let z = 30; z < 150; z += G.r(12, 30) / (S.D.traffic + .2)) S.veh.push(mkVeh(S, 1, z));
  const np = Math.round(S.D.ped * 10);
  for (let i = 0; i < np; i++) S.peds.push(mkPed(S, G.r(-20, 130)));
  return S;
}

function updateTraffic(dt, camZ) {
  const S = world.street, D = S.D, st = S.signal ? sigState(S) : 'green';
  // spawn
  S.spawnT[0] -= dt; S.spawnT[1] -= dt;
  if (S.spawnT[0] <= 0) {
    S.spawnT[0] = G.r(3.5, 9) / (D.traffic + .15);
    const z = camZ + 135; if (!S.veh.some(u => u.lane === 0 && Math.abs(u.z - z) < 25)) S.veh.push(mkVeh(S, 0, z));
  }
  if (S.spawnT[1] <= 0) {
    S.spawnT[1] = G.r(2.5, 7) / (D.traffic + .15);
    S.veh.push(mkVeh(S, 1, camZ + 150));
  }
  // pedestrians
  while (S.peds.length < Math.round(D.ped * 10)) S.peds.push(mkPed(S, camZ + G.r(50, 130)));
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const p = S.peds[i]; p.z += p.dz * dt; p.ph += dt * 7;
    if (p.z < camZ - 45 || p.z > camZ + 160) S.peds.splice(i, 1);
  }
  // cross traffic while our light is red
  if (S.signal && st === 'red' && (world.time + S.sigOff) % 28 > 19) {
    S.crossT -= dt;
    if (S.crossT <= 0) {
      S.crossT = G.r(1.6, 3.6); const v = mkVeh(S, 0, S.len + 3.2); const dirn = G.c(.5) ? 1 : -1;
      v.axis = 'x'; v.dir = dirn; v.x = -dirn * 55; v.v = dirn * G.r(8, 12); v.z = S.len + 3.2 + (dirn > 0 ? 0 : 3.4); v.lane = 2; S.cross.push(v);
    }
  }
  for (let i = S.cross.length - 1; i >= 0; i--) { const c = S.cross[i]; c.x += c.v * dt; if (Math.abs(c.x) > 60) S.cross.splice(i, 1); }
  // car following
  for (let i = S.veh.length - 1; i >= 0; i--) {
    const v = S.veh[i];
    if (v.lane === 1) {
      v.z += v.v * dt;
      if (!v.passed && v.z < R.z) { v.passed = true; if (scene.mode === 'street' && !scene.walking) Snd.pass(.55, clamp(1.1 - Math.abs(v.z - R.z) * .1, .3, 1), R.v - v.v); }
      if (v.z < camZ - 60 || v.z > camZ + 300) S.veh.splice(i, 1);
      continue;
    }
    let gap = 1e9, lv = 0;
    for (const u of S.veh) {
      if (u === v || u.lane !== 0 || u.z <= v.z || Math.abs(u.x - v.x) > 1.1) continue;
      const g = u.z - v.z - (u.len + v.len) / 2; if (g < gap) { gap = g; lv = u.v; }
    }
    if (R.z > v.z && Math.abs(R.x - v.x) < 1.1) { const g = R.z - v.z - v.len / 2 - .5; if (g < gap) { gap = g; lv = R.v; } }
    let vs = v.v0;
    if (gap < 1e8) { vs = Math.min(vs, lv + Math.max(0, gap - (2.6 + .4 * v.v)) * .5); if (gap < 2.4) vs = Math.min(vs, lv * .6); }
    if (S.signal && v.z + v.len / 2 < S.stopZ && st !== 'green') {
      const d = S.stopZ - v.z - v.len / 2;
      if (st === 'red' || d > v.v * v.v / 9 - 1) vs = Math.min(vs, Math.sqrt(2 * 3 * Math.max(d - .4, 0)));
    }
    const dv = clamp(vs - v.v, -5.5 * dt, 2.2 * dt); v.v = Math.max(0, v.v + dv); v.brake = dv < -.02 || v.v < .3 && vs < .3;
    v.z += v.v * dt;
    if (v.z > S.len + 140 || v.z < camZ - 50) S.veh.splice(i, 1);
  }
}

function updateRider(dt) {
  const S = world.street, D = S.D;
  let vt = D.cruise * (1 - .12 * env.rain) * (1 + (env.fog > .015 ? -.15 : 0));
  const st = S.signal ? sigState(S) : 'green';
  let gap = 1e9, lv = 0, lead = null;
  for (const u of S.veh) {
    if (u.lane !== 0 || u.z <= R.z || Math.abs(u.x - R.x) > 1.1) continue;
    const g = u.z - u.len / 2 - R.z - .9; if (g < gap) { gap = g; lv = u.v; lead = u; }
  }
  // overtaking a slow leader
  if (!R.pass) {
    if (lead && gap < 16 && lead.v < vt - 1.6 && S.len - R.z > 75 && R.v > 3 && !(R.parkZ != null && R.parkZ - R.z < 70)) {
      const clear = !S.veh.some(u => u.lane === 1 && u.z > R.z && u.z < R.z + 100);
      if (clear && (R.slowT += dt) > 2.2) R.pass = lead;
    } else R.slowT = 0;
  } else if (R.z > R.pass.z + R.pass.len / 2 + 4 || !S.veh.includes(R.pass)) R.pass = null;
  // traffic signal
  let dStop = 1e9;
  if (S.signal && R.z < S.stopZ + .5 && st !== 'green') {
    const d = S.stopZ - R.z - .6;
    if (d > 0 && (st === 'red' || d > R.v * R.v / 9 - 1)) dStop = d;
  }
  R.filter = R.filter ? (R.z < S.stopZ + 1 && !(st === 'green' && R.v > 5 && R.z < S.stopZ - 8)) : (dStop < 30 && lead && lead.v < 1.5 && gap < 16 && dStop < 1e8);
  if (R.filter && R.z > S.stopZ + .8) R.filter = false;
  let vs = vt;
  if (R.pass) vs = Math.min(vt * 1.15, R.pass.v + 5);
  else if (gap < 1e8) { vs = Math.min(vs, lv + Math.max(0, gap - (3 + .45 * R.v)) * .5); if (gap < 2.6) vs = Math.min(vs, lv * .6); }
  if (dStop < 1e8) vs = Math.min(vs, R.filter ? 4 : vs, Math.sqrt(2 * 3.2 * Math.max(dStop - .3, 0)) + (R.filter ? 0 : 0));
  const nxt = nav.queue[0];
  if (nxt && nxt.turn !== 'S' && R.parkZ == null) vs = Math.min(vs, 3.4 + .11 * Math.max(0, S.len - R.z));
  if (R.parkZ != null && !R.parked) {
    const d = R.parkZ - R.z;
    vs = Math.min(vs, d > .35 ? Math.sqrt(2 * 2.3 * d) + .3 : 0);
    if (d < 32) R.tx = R.parkX; else R.tx = laneX(S);
  } else {
    R.tx = R.pass ? .05 : R.filter ? 0 : laneX(S);
  }
  const before = R.v;
  R.v = Math.max(0, R.v + clamp(vs - R.v, -5.5 * dt, 2.4 * dt));
  R.braking = R.v < before - .02;
  R.z += R.v * dt; R.dist += R.v * dt;
  R.x += (R.tx - R.x) * (1 - Math.exp(-dt * 1.7));
  if (R.parkZ != null && !R.parked && R.v < .05 && R.parkZ - R.z < 1.2 && Math.abs(R.x - R.parkX) < .3) { R.parked = true; R.v = 0; nav.arrived = true; }
  R.ind = (nxt && nxt.turn !== 'S' && S.len - R.z < 70 && R.parkZ == null) ? (nxt.turn === 'L' ? -1 : 1) : (R.parkZ != null && !R.parked && R.parkZ - R.z < 40 ? S.dest.side : (R.pass ? 1 : 0));
}

// junction transitions (the "edit cut" between streets)
function startTrans(plan) {
  const s = plan.turn === 'L' ? -1 : plan.turn === 'R' ? 1 : 0;
  world.trans = { t: 0, s, plan, swapped: false, T: s ? .85 : .25 };
}
function updateTrans(dt) {
  const tr = world.trans; tr.t += dt;
  const e = p => p * p * (3 - 2 * p);
  if (!tr.swapped) {
    const p = clamp(tr.t / tr.T, 0, 1);
    world.yaw = -tr.s * .45 * e(p); world.tfade = clamp((p - .5) / .5, 0, 1);
    R.z += R.v * dt; R.v = Math.max(0, R.v - 2 * dt);
    if (p >= 1) { tr.swapped = true; tr.t = 0; loadStreet(tr.plan); }
  } else {
    const p = clamp(tr.t / tr.T, 0, 1);
    world.yaw = tr.s * .45 * (1 - e(p)); world.tfade = 1 - clamp(p / .6, 0, 1);
    R.z += R.v * dt; R.v = Math.min(D_cruise(), R.v + 2.6 * dt); R.x = R.tx = laneX(world.street);
    if (p >= 1) { world.trans = null; world.yaw = 0; world.tfade = 0; }
  }
}
function D_cruise() { return world.street ? world.street.D.cruise * .8 : 8; }

function updateWorld(dt) {
  world.time += dt;
  if (!world.street) return;
  if (world.trans) { updateTrans(dt); updateTraffic(dt, R.z); return; }
  if (scene.rideActive) {
    if (nav.wander && nav.queue.length < 2) {
      const last = nav.queue.length ? nav.queue[nav.queue.length - 1] : world.street.plan;
      let d = last.district; if (G.c(.12)) d = G.p(NEIGH[d]);
      nav.queue.push(mkPlan(d, null, last.name));
    }
    updateRider(dt);
    if (R.z >= world.street.len - 1.2 && nav.queue.length && R.parkZ == null) startTrans(nav.queue.shift());
  } else { R.v = 0; }
  updateTraffic(dt, scene.mode === 'street' ? (scene.rideActive ? R.z : cam.z) : R.z);
}
