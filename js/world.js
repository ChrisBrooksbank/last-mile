'use strict';
// Streets, traffic, the rider's autopilot and route navigation.
const world = { time: 0, street: null, trans: null, yaw: 0, tfade: 0 };
const R = { z: 0, x: -1.3, tx: -1.3, v: 0, dist: 0, filter: false, pass: null, slowT: 0, parkZ: null, parkX: 0, parked: false, ind: 0, braking: false };
const nav = { queue: [], district: 'soho', arrived: false, lastName: '', wander: true };

const laneX = S => -clamp(S.halfW - 2.9, 1.25, 3.1);

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
  const jg = { z0: S.len - 6, z1: S.len + 14 }, eg = { z0: -14, z1: 10 };
  S.gaps.L.push(jg, eg); S.gaps.R.push(jg, eg); S.jg = jg;
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
  for (let z = 12 + r.r(0, 8), k = 0; z < S.len + 170; z += 26, k++) {
    const side = k % 2 ? 1 : -1;
    if (!inGap(side, z)) S.furn.push({ k: 'lamp', z, x: side * (halfW + .45), side });
  }
  for (let z = 12 + r.r(0, 10); z < S.len + 170; z += r.r(16, 26)) {
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
    const pr = (halfW >= Math.abs(laneX(S)) + 2.9) ? (side < 0 ? D.parked : D.parked * .55) : 0; let z = r.r(10, 14);
    while (z < S.len + 150) {
      const type = r.c(.14) ? 'van' : 'car', len = type === 'van' ? 5.2 : r.r(3.9, 4.6);
      const ok = !inGap(side, z - 1) && !inGap(side, z + len + 1) && !(S.dest && S.dest.side === side && (z + len + 1 > S.dest.parkZ - 11 && z - 1 < S.dest.parkZ + 9)) && !S.furn.some(f => f.k === 'bus' && f.side === side && Math.abs(f.z - z) < 7);
      if (r.c(pr) && ok) S.parked.push({ z: z + len / 2, x: side * (halfW - .95), len, w: 1.8, h: type === 'van' ? 2.3 : 1.42, type, col: type === 'van' ? r.p([[220, 220, 224], [190, 190, 194], [40, 60, 100]]) : r.p(CAR_COLS), side });
      z += len + r.r(.5, 3);
    }
  }
  S.lw = S.parked.length ? (halfW - 1.85) - Math.abs(laneX(S)) - .12 : 9; // half-width a moving vehicle may have without clipping parked cars
  for (let i = 0; i < S.len / 9; i++) S.patches.push({ z: r.r(-30, S.len + 120), x: r.r(-halfW + .5, halfW - .5), w: r.r(.5, 1.6), l: r.r(1, 3.5), s: r.r(.7, 1.15) });
  return S;
}

function genSide(S, side, r) {
  const D = S.D, arr = side < 0 ? S.L : S.Rt, gaps = S.gaps[side < 0 ? 'L' : 'R'];
  let z = 10, placed = false;
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
    chim: r.c(.25), roof: r.c(.5) ? 1 : 0, cornice: r.c(.6), pal: palName, id: D.id, num: dest && dest.cust ? dest.cust.num : r.i(2, 90), building: dest && dest.cust ? dest.cust.building : '', graffiti: (D.id === 'shoreditch' || D.id === 'camden' || D.id === 'peckham') && r.c(.45),
  };
}

// ---------- vehicles / pedestrians ----------
const VDIMS = { car: [1.8, 4.3, 1.45], cab: [1.9, 4.6, 1.75], van: [2.0, 5.3, 2.4], bus: [2.55, 10.8, 4.3], bike: [.6, 1.7, 1.7] };
function mkVeh(S, lane, z) {
  const r = G, q = r.n();
  let type = q < .66 ? 'car' : q < .76 ? 'cab' : q < .86 ? 'van' : q < .93 ? 'bus' : 'bike';
  if (lane === 1 && type === 'bike') type = 'car';
  if (VDIMS[type][0] / 2 > (S.lw === undefined ? 9 : S.lw)) type = 'car';
  const d = VDIMS[type];
  const col = type === 'cab' ? [22, 22, 26] : type === 'bus' ? [196, 30, 36] : type === 'van' ? r.p([[224, 224, 228], [200, 200, 204], [50, 70, 110], [230, 230, 230]]) : r.p(CAR_COLS);
  const v0 = S.D.cruise * r.r(.62, 1.0) * (type === 'bus' ? .8 : 1);
  const v = { type, lane, z, w: d[0], len: d[1], h: d[2], col, axis: 'z', ph: r.n() * 6 };
  if (lane === 0) { v.x = type === 'bike' ? laneX(S) - .35 : laneX(S) + r.r(-.08, .08); v.v0 = type === 'bike' ? 4.5 : v0; v.v = v.v0 * .9; v.dir = 1; }
  else { v.x = -laneX(S) + r.r(-.08, .08); v.v0 = r.r(6, 11) * (type === 'bus' ? .8 : 1); v.v = -v.v0; v.dir = -1; v.passed = false; }
  return v;
}
function mkPed(S, z) {
  const r = G, side = r.c(.5) ? 1 : -1, ph = r.c(.25);
  return Object.assign(randomLook(r), { z, x: side * (S.halfW + S.pav * r.r(.3, .85)), dz: (r.c(.5) ? 1 : -1) * r.r(1.05, 1.6), umb: r.c(.85) ? r.p([[30, 30, 36], [140, 30, 40], [40, 60, 110]]) : null, h: r.r(1.55, 1.85), ph: r.n() * 6, phone: ph, basePhone: ph, state: 'walk', t: r.r(0, 6), bag: r.c(.2) ? r.p([[90, 60, 40], [30, 30, 34], [150, 40, 50]]) : null });
}
