'use strict';
// Traffic simulation, rider autopilot and the swing round corners (continues world.js).
function populate(S) {
  for (let z = 40; z < 150; z += G.r(14, 34) / (S.D.traffic + .2)) S.veh.push(mkVeh(S, 0, z));
  for (let z = 45; z < 160; z += G.r(12, 30) / (S.D.traffic + .2)) S.veh.push(mkVeh(S, 1, z));
  const np = Math.round(S.D.ped * 10);
  for (let i = 0; i < np; i++) S.peds.push(mkPed(S, G.r(12, 130)));
}
function setPrimary(S, z, x) {
  world.street = S; nav.lastName = S.plan.name; nav.district = S.plan.district;
  R.z = z; R.x = R.tx = x; R.pass = null; R.filter = false; R.slowT = 0; R.parkZ = null; R.parked = false; R.ind = 0;
  if (S.dest) { R.parkZ = S.dest.parkZ; R.parkX = S.dest.side * (S.halfW - .6); nav.arrived = false; }
}
function loadStreet(plan) { const S = makeStreet(plan); populate(S); setPrimary(S, 0, laneX(S)); return S; }

function updateTraffic(S, dt, camZ, rid, spawn) {
  const D = S.D, st = S.signal ? sigState(S) : 'green';
  if (spawn) {
    S.spawnT[0] -= dt; S.spawnT[1] -= dt;
    if (S.spawnT[0] <= 0) {
      S.spawnT[0] = G.r(3.5, 9) / (D.traffic + .15);
      const z = camZ + 135; if (!S.veh.some(u => u.lane === 0 && Math.abs(u.z - z) < 25)) S.veh.push(mkVeh(S, 0, z));
    }
    if (S.spawnT[1] <= 0) { S.spawnT[1] = G.r(2.5, 7) / (D.traffic + .15); if (!S.veh.some(u => u.lane === 1 && Math.abs(u.z - (camZ + 150)) < 22)) S.veh.push(mkVeh(S, 1, camZ + 150)); }
    while (S.peds.length < Math.round(D.ped * 10)) S.peds.push(mkPed(S, camZ + G.r(140, 152)));
  }
  updatePeds(S, dt, camZ, st);
  if (S.signal && st === 'red') {
    const ph = (world.time + S.sigOff) % 28, clear = !S.veh.some(u => u.z > S.len - 10 && u.z < S.len + 17) && !S.cross.some(c => Math.abs(c.x) < 4);
    S.crossT -= dt;
    if (S.crossT <= 0 && ph > 19.5 && ph < 23.5 && clear) {
      S.crossT = G.r(1.8, 3.4); const dirn = G.c(.5) ? 1 : -1;
      if (!S.cross.some(c => c.dir === dirn && Math.abs(c.x + dirn * 24) < 14)) {
        const v = mkVeh(S, 0, S.len + 4); v.axis = 'x'; v.dir = dirn; v.x = -dirn * 24; v.v = dirn * (dirn > 0 ? 9 : 8.4); v.z = S.len + 4 + (dirn > 0 ? -1.6 : 1.6); v.lane = 2; if (v.type === 'bike') v.type = 'car'; const d = VDIMS[v.type]; v.w = d[0]; v.len = d[1]; v.h = d[2]; S.cross.push(v);
      }
    }
  }
  for (let i = S.cross.length - 1; i >= 0; i--) { const c = S.cross[i]; c.x += c.v * dt; if (Math.abs(c.x) > 34) S.cross.splice(i, 1); }
  for (let i = S.veh.length - 1; i >= 0; i--) {
    const v = S.veh[i];
    if (v.lane === 1) {
      const sp0 = Math.abs(v.v), ref = rid ? rid.z : camZ;
      if (v.emerg) {
        v.x += ((S.emergX !== undefined ? S.emergX : .1) - v.x) * Math.min(1, dt * 2);
        v.z += v.v * dt;
        const dist = v.z - ref, rv = rid ? rid.v : 0, closing = rv + sp0;
        if (v.siren) {
          const gain = Math.pow(clamp(1 - Math.abs(dist) / 240, 0, 1), 1.4) * .5 * (scene.mode === 'street' || (scene.tun && scene.tun.out) ? 1 : .35);
          const cents = dist > 0 ? 1200 * Math.log2(343 / (343 - closing)) : 1200 * Math.log2(343 / (343 + closing));
          v.siren.set(gain, dist > 0 ? .35 : .55, cents);
        }
        const wa = clamp(1 - Math.abs(dist) / 55, 0, 1);
        if (wa > 0 && S === world.street) world.flashA = Math.max(world.flashA || 0, wa);
        if (v.z < ref - 70) { if (v.siren) v.siren.stop(); S.veh.splice(i, 1); }
        continue;
      }
      let gap = 1e9, lvm = 0;
      for (const u of S.veh) {
        if (u === v || u.lane !== 1 || u.z >= v.z || Math.abs(u.x - v.x) > 1.1) continue;
        const g = v.z - u.z - (u.len + v.len) / 2; if (g < gap) { gap = g; lvm = Math.abs(u.v); }
      }
      let vs = v.v0;
      if (gap < 1e8) { vs = Math.min(vs, lvm + Math.max(0, gap - (2.6 + .4 * sp0)) * .5); if (gap < 2.4) vs = Math.min(vs, lvm * .6); }
      if (S.signal && st !== 'green' && v.z - v.len / 2 > S.len + 14.5) {
        const d = v.z - v.len / 2 - (S.len + 14.5);
        if (st === 'red' || d > sp0 * sp0 / 9 - 1) vs = Math.min(vs, Math.sqrt(2 * 3 * Math.max(d - .4, 0)));
      }
      if (S.zb) for (let zi = 0; zi < S.zebras.length; zi++) if (S.zb[zi] > 0) { const zc = S.zebras[zi] + 3.5, bk = v.z - v.len / 2; if (bk > zc) vs = Math.min(vs, Math.sqrt(2 * 3 * Math.max(bk - zc - .3, 0))); }
      const em = S.veh.find(u => u.emerg && Math.abs(u.z - v.z) < 45);
      const tx = -laneX(S) + (em ? 1.0 : 0); v.x += (tx - v.x) * Math.min(1, dt * 2.5);
      const dv = clamp(vs - sp0, -5.5 * dt, 2.2 * dt), sp = Math.max(0, sp0 + dv); v.brake = dv < -.02; v.v = -sp; v.z += v.v * dt;
      if (rid && !v.passed && v.z < rid.z) { v.passed = true; if (scene.mode === 'street' && !scene.walking && S === world.street) Snd.pass(.55, clamp(1.1 - Math.abs(v.z - rid.z) * .1, .3, 1), rid.v + sp); }
      if (v.z < camZ - 60 || v.z > camZ + 300) S.veh.splice(i, 1);
      continue;
    }
    let gap = 1e9, lv = 0, ld = null;
    for (const u of S.veh) {
      if (u === v || u.lane !== 0 || u.z <= v.z || Math.abs(u.x - v.x) > (u.w + v.w) / 2 - .15) continue;
      const g = u.z - v.z - (u.len + v.len) / 2; if (g < gap) { gap = g; lv = u.v; ld = u; }
    }
    if (rid && rid.z > v.z && Math.abs(rid.x - v.x) < v.w / 2 + .6) { const g = rid.z - v.z - v.len / 2 - .5; if (g < gap) { gap = g; lv = rid.v; ld = null; } }
    let vs = v.v0;
    if (gap < 1e8) { vs = Math.min(vs, lv + Math.max(0, gap - (2.6 + .4 * v.v)) * .5, Math.max(0, lv) + Math.sqrt(2 * 3.6 * Math.max(0, gap - 2))); if (gap < 2.4) vs = Math.min(vs, lv * .6); }
    if (S.signal && v.z + v.len / 2 < S.stopZ && st !== 'green') {
      const d = S.stopZ - v.z - v.len / 2;
      if (st === 'red' || d > v.v * v.v / 9 - 1) vs = Math.min(vs, Math.sqrt(2 * 3 * Math.max(d - .4, 0)));
    }
    if (S.zb) for (let zi = 0; zi < S.zebras.length; zi++) if (S.zb[zi] > 0) { const zc = S.zebras[zi], fr0 = v.z + v.len / 2; if (fr0 < zc - .3) vs = Math.min(vs, Math.sqrt(2 * 3 * Math.max(zc - .3 - fr0 - .3, 0))); }
    const dv = clamp(vs - v.v, -5.5 * dt, 2.2 * dt); v.v = Math.max(0, v.v + dv); v.brake = dv < -.02 || (v.v < .3 && vs < .3);
    v.z += v.v * dt;
    if (ld) { const gn = ld.z - v.z - (ld.len + v.len) / 2; if (gn < .2) { v.z = ld.z - (ld.len + v.len) / 2 - .2; v.v = Math.min(v.v, Math.max(0, ld.v)); } }
    if (v.z > S.len + 140 || v.z < camZ - 50) S.veh.splice(i, 1);
  }
}

function updateRider(dt) {
  const S = world.street, D = S.D;
  const vt = D.cruise * (1 - .12 * env.rain) * (1 + (env.fog > .015 ? -.15 : 0));
  const st = S.signal ? sigState(S) : 'green';
  let gap = 1e9, lv = 0, lead = null;
  for (const u of S.veh) {
    if (u.lane !== 0 || u.z + u.len / 2 < R.z - 1 || Math.abs(u.x - R.x) > u.w / 2 + .6) continue;
    const g = u.z - u.len / 2 - R.z - .9; if (g < gap) { gap = g; lv = u.v; lead = u; }
  }
  if (!R.pass) {
    if (lead && gap < 16 && lead.v < vt - 1.6 && (lead.x + lead.w / 2 + .42) <= .45 && S.len - R.z > 75 && R.v > 3 && !(R.parkZ != null && R.parkZ - R.z < 70)) {
      const clear = !S.veh.some(u => u.lane === 1 && u.z > R.z && u.z < R.z + 100);
      if (clear && (R.slowT += dt) > 2.2) R.pass = lead;
    } else R.slowT = 0;
  } else if (R.z > R.pass.z + R.pass.len / 2 + 4 || !S.veh.includes(R.pass)) R.pass = null;
  let dStop = 1e9;
  if (S.signal && R.z < S.stopZ + .5 && st !== 'green') {
    const d = S.stopZ - R.z - .6;
    if (d > 0 && (st === 'red' || d > R.v * R.v / 9 - 1)) dStop = d;
  }
  R.filter = R.filter ? (R.z < S.stopZ + 1 && !(st === 'green' && R.v > 5 && R.z < S.stopZ - 8)) : (dStop < 30 && lead && lead.v < 1.5 && gap < 16 && dStop < 1e8 && !S.veh.some(u => u.lane === 0 && u.z > R.z - 2 && u.z < R.z + 45 && u.x + u.w / 2 > -.42));
  if (R.filter && R.z > S.stopZ + .8) R.filter = false;
  let vs = vt;
  if (R.pass) vs = Math.min(vt * 1.15, R.pass.v + 5);
  else if (gap < 1e8) { vs = Math.min(vs, lv + Math.max(0, gap - (3 + .45 * R.v)) * .5, Math.max(0, lv) + Math.sqrt(2 * 3.6 * Math.max(0, gap - 2.2))); if (gap < 2.6) vs = Math.min(vs, lv * .6); }
  if (dStop < 1e8) vs = Math.min(vs, R.filter ? 4 : vs, Math.sqrt(2 * 3.2 * Math.max(dStop - .3, 0)));
  if (S.zb) for (let zi = 0; zi < S.zebras.length; zi++) if (S.zb[zi] > 0) { const zc = S.zebras[zi]; if (R.z < zc - .5) vs = Math.min(vs, Math.sqrt(2 * 3.2 * Math.max(zc - .5 - R.z - .3, 0))); }
  const nxt = nav.queue[0];
  if (nxt && R.parkZ == null) {
    const lim = nxt.turn !== 'S' ? 3.6 + .11 * Math.max(0, S.len - 6 - R.z) : 6 + .2 * Math.max(0, S.len - 6 - R.z);
    vs = Math.min(vs, lim);
  }
  if (R.parkZ != null && !R.parked) {
    const d = R.parkZ - R.z;
    vs = Math.min(vs, d > .35 ? Math.sqrt(2 * 2.3 * d) + .3 : 0);
    if (d < 10) R.tx = R.parkX; else R.tx = laneX(S);
  } else {
    R.tx = R.pass ? R.pass.x + R.pass.w / 2 + .42 : R.filter ? 0 : (nxt && nxt.turn === 'R' && S.len - R.z < 45) ? -.3 : laneX(S);
  }
  if (Math.abs(R.x - R.tx) > 1.2 && R.v < 4) vs = Math.min(vs, 2.5);
  // crossing the oncoming lane (to or from the right-hand kerb): wait for a gap rather than cut across a car
  let crossHold = false;
  if (!R.pass && Math.max(R.x, R.tx) > -.5 && Math.abs(R.tx - R.x) > .15) {
    const lo = Math.min(R.x, R.tx) - .45, hi = Math.max(R.x, R.tx) + .45;
    for (const u of S.veh) {
      if (u.lane !== 1 || u.z + u.len / 2 < R.z - 1.2 || u.z - u.len / 2 > R.z + 26) continue;
      const ul = u.x - u.w / 2, uh = u.x + u.w / 2;
      if (uh < lo || ul > hi || !(uh < R.x - .45 || ul > R.x + .45)) continue;
      crossHold = true; break;
    }
    if (crossHold && R.x > 0) vs = 0;
  }
  // hard guard: never ride into anything we overlap sideways (moving, stopped or parked), whatever we are doing
  let block = null, bgap = 1e9;
  for (const arr of [S.veh, S.parked]) for (const u of arr) {
    if (u.type === 'bike' || Math.abs(u.x - R.x) > u.w / 2 + .38) continue;
    const rear = u.z - u.len / 2; if (rear < R.z - .4) continue;
    const g = rear - R.z - 1.0; if (g < bgap) { bgap = g; block = u; }
  }
  if (block) vs = Math.min(vs, Math.max(0, block.v || 0) + Math.sqrt(2 * 4.5 * Math.max(0, bgap - .2)));
  const before = R.v;
  R.v = Math.max(0, R.v + clamp(vs - R.v, -5.5 * dt, 2.4 * dt));
  R.braking = R.v < before - .02;
  R.z += R.v * dt; R.dist += R.v * dt;
  if (lead && !R.pass && !R.filter) { const gn = lead.z - lead.len / 2 - R.z - .9; if (gn < .25) { R.z = lead.z - lead.len / 2 - 1.15; R.v = Math.min(R.v, Math.max(0, lead.v)); } }
  // only snap back behind things that are parked or going our way: an oncoming car (an ambulance on the crown
  // of the road) would otherwise drag the rider backwards down the street for ever
  if (block && !(block.v < 0)) { const lim = block.z - block.len / 2 - 1.0; if (R.z > lim && R.z < lim + 1.2) { R.z = lim; R.v = Math.min(R.v, Math.max(0, block.v || 0)); } }
  if (!crossHold) R.x += (R.tx - R.x) * (1 - Math.exp(-dt * 1.7));
  if (R.parkZ != null && !R.parked && R.v < .05 && R.parkZ - R.z < 1.2 && Math.abs(R.x - R.parkX) < .3) { R.parked = true; R.v = 0; nav.arrived = true; }
  R.ind = (nxt && nxt.turn !== 'S' && S.len - R.z < 70 && R.parkZ == null) ? (nxt.turn === 'L' ? -1 : 1) : (R.parkZ != null && !R.parked && R.parkZ - R.z < 40 ? (S.dest ? S.dest.side : Math.sign(R.parkX)) : (R.pass ? 1 : 0));
}

// ---------- the swing round a corner ----------
function bez(P, u) {
  const m = 1 - u, a = m * m * m, b = 3 * m * m * u, c = 3 * m * u * u, d = u * u * u;
  return { x: a * P[0].x + b * P[1].x + c * P[2].x + d * P[3].x, z: a * P[0].z + b * P[1].z + c * P[2].z + d * P[3].z };
}
function bezD(P, u) {
  const m = 1 - u, a = 3 * m * m, b = 6 * m * u, c = 3 * u * u;
  return { x: a * (P[1].x - P[0].x) + b * (P[2].x - P[1].x) + c * (P[3].x - P[2].x), z: a * (P[1].z - P[0].z) + b * (P[2].z - P[1].z) + c * (P[3].z - P[2].z) };
}
function beginTurn(plan) {
  const S0 = world.street, s = plan.turn === 'L' ? -1 : plan.turn === 'R' ? 1 : 0;
  let S1; if (world.next && world.next.plan === plan) S1 = world.next.S1; else { S1 = makeStreet(plan); populate(S1); }
  world.next = null;
  const Zc = S0.len + 4;
  const fr = s > 0 ? { a: 0, b: 1, c: -1, d: 0, tx: 0, tz: Zc } : s < 0 ? { a: 0, b: -1, c: 1, d: 0, tx: 0, tz: Zc } : { a: 1, b: 0, c: 0, d: 1, tx: 0, tz: Zc };
  const xB = laneX(S1), zB = 13;
  const B = { x: fr.a * xB + fr.b * zB + fr.tx, z: fr.c * xB + fr.d * zB + fr.tz }, A = { x: R.x, z: R.z };
  const f1 = s > 0 ? [1, 0] : s < 0 ? [-1, 0] : [0, 1];
  const k1 = clamp(Zc - A.z, 4, 12) * .9 + 2, k2 = 8;
  const P = [A, { x: A.x, z: A.z + k1 }, { x: B.x - f1[0] * k2, z: B.z - f1[1] * k2 }, B];
  let len = 0, prev = A; for (let i = 1; i <= 16; i++) { const q = bez(P, i / 16); len += Math.hypot(q.x - prev.x, q.z - prev.z); prev = q; }
  if (s === 0) S0.cullFar = S0.len + 14;
  S0.turnSide = s;
  world.turn = { S1, fr, s, P, len, u: 0, plan, zB, xB, th: 0 };
  R.pass = null; R.filter = false; R.ind = s;
}
function updateTurn(dt) {
  const T = world.turn, vt = T.s ? 5.4 : 7.5;
  R.v += clamp(vt - R.v, -4 * dt, 2.5 * dt);
  T.u = Math.min(1, T.u + R.v * dt / T.len);
  const p = bez(T.P, T.u), d = bezD(T.P, T.u);
  R.x = p.x; R.z = p.z; T.th = Math.atan2(d.x, d.z); R.dist += R.v * dt;
  R.ind = T.u < .85 ? T.s : 0;
  if (T.u >= 1) finishTurn();
}
function finishTurn() {
  const T = world.turn, S0 = world.street, f = T.fr;
  const inv = { a: f.a, b: f.c, c: f.b, d: f.d, tx: -(f.a * f.tx + f.c * f.tz), tz: -(f.b * f.tx + f.d * f.tz) };
  world.prev = { S: S0, fr: inv, fwd: f }; world.turn = null;
  setPrimary(T.S1, T.zB, T.xB);
}

function updateWorld(dt) {
  world.time += dt; world.flashA = 0;
  if (world.later) for (let i = world.later.length - 1; i >= 0; i--) if (world.time >= world.later[i].t) { const f = world.later[i].fn; world.later.splice(i, 1); f(); }
  const S = world.street; if (!S) return;
  if (world.turn) {
    const S1 = world.turn.S1, zB = world.turn.zB;
    updateTurn(dt);
    if (world.turn) { updateTraffic(S, dt, R.z, { z: R.z, x: R.x, v: R.v }, true); updateTraffic(S1, dt, zB, null, true); }
    return;
  }
  if (world.prev) {
    const f = world.prev.fwd, cz0 = f.c * R.x + f.d * R.z + f.tz;
    updateTraffic(world.prev.S, dt, cz0, null, false);
    if (R.z > 34) { for (const u of world.prev.S.veh) if (u.siren) u.siren.stop(); world.prev = null; }
  }
  if (scene.rideActive) {
    if (nav.wander && nav.queue.length < 2) {
      const last = nav.queue.length ? nav.queue[nav.queue.length - 1] : S.plan;
      let d = last.district; if (G.c(.12)) d = G.p(NEIGH[d]);
      nav.queue.push(mkPlan(d, null, last.name));
    }
    if (world.next && world.next.plan !== nav.queue[0]) world.next = null;
    if (!world.next && nav.queue[0] && R.parkZ == null && S.len - R.z < 95) prepNext(nav.queue[0]);
    updateRider(dt);
    const st = S.signal ? sigState(S) : 'green';
    if (nav.queue.length && R.parkZ == null && R.z >= S.len - 13 && (st === 'green' || R.z > S.stopZ + .2 || !S.signal) && !S.veh.some(u => u.lane === 0 && u.z > R.z && u.z - u.len / 2 - R.z < 20 && u.v < 3 && Math.abs(u.x - R.x) < u.w / 2 + .9)) beginTurn(nav.queue.shift());
  } else R.v = 0;
  updateTraffic(S, dt, scene.mode === 'street' && !scene.rideActive ? scene.wz : R.z, { z: R.z, x: R.x, v: R.v }, true);
}

// ---------- emergency vehicle ----------
function spawnEmergency() {
  const S = world.street; if (!S || world.turn || !scene.rideActive || S.veh.some(u => u.emerg)) return false;
  const amb = G.c(.4), d = amb ? VDIMS.van : VDIMS.car;
  const v = { type: amb ? 'van' : 'car', lane: 1, z: R.z + 175, x: .1, v: -18.5, v0: 18.5, dir: -1, axis: 'z', w: d[0], len: d[1], h: d[2] + .16, col: amb ? [240, 240, 236] : [236, 238, 242], livery: amb ? 'amb' : 'police', emerg: true, passed: false, ph: 0 };
  v.siren = Snd.sirenLive(amb ? 'amb' : 'police'); S.veh.push(v);
  world.later = world.later || []; world.later.push({ t: world.time + 2.8, fn: () => says("It's all kicking off.", 3.4) });
  return true;
}

function prepNext(plan) {
  const S0 = world.street, s = plan.turn === 'L' ? -1 : plan.turn === 'R' ? 1 : 0, Zc = S0.len + 4;
  const fr = s > 0 ? { a: 0, b: 1, c: -1, d: 0, tx: 0, tz: Zc } : s < 0 ? { a: 0, b: -1, c: 1, d: 0, tx: 0, tz: Zc } : { a: 1, b: 0, c: 0, d: 1, tx: 0, tz: Zc };
  const S1 = makeStreet(plan); populate(S1); world.next = { plan, S1, fr };
}

// ---------- pedestrians: walking, stopping for a phone, chatting, crossing ----------
function startCross(S, p, zc, zi) {
  p.state = 'cross'; p.zebra = zi; p.z = zc; p.cdir = p.x > 0 ? -1 : 1; p.tx = p.cdir * (S.halfW + S.pav * G.r(.3, .85)); p.t = 0;
}
function updatePeds(S, dt, camZ, st) {
  S.zb = S.zebras.map(() => 0);
  const ph = (world.time + S.sigOff) % 28;
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const p = S.peds[i]; p.t += dt; const stt = p.state || 'walk';
    if (stt === 'walk') {
      const z0 = p.z; p.z += p.dz * dt; p.ph += Math.abs(p.dz) * dt * 4.3;
      if (p.t > 2.5 && p.z < S.len + 20) {
        for (let zi = 0; zi < S.zebras.length; zi++) { const zc = S.zebras[zi] + 1.6; if ((z0 - zc) * (p.z - zc) <= 0 && G.n() < .45) { startCross(S, p, zc, zi); break; } }
        if (p.state === 'walk' && S.signal && st === 'red' && ph > 17.4 && ph < 19.5) { const zc = S.stopZ + 2.3; if ((z0 - zc) * (p.z - zc) <= 0 && G.n() < .6) startCross(S, p, zc, -1); }
      }
      if (p.state === 'walk' && p.t > 4 && !p.chatted && G.n() < dt * .012) { p.state = 'stand'; p.t = 0; p.until = G.r(3, 7); p.phone = true; }
    } else if (stt === 'stand') { if (p.t > p.until) { p.state = 'walk'; p.t = 0; p.phone = p.basePhone; } }
    else if (stt === 'chat') { if (p.t > p.until) { p.state = 'walk'; p.t = 0; p.partner = null; } }
    else if (stt === 'cross') {
      p.x += p.cdir * 1.45 * dt; p.ph += 1.45 * dt * 4.3; if (p.zebra >= 0) S.zb[p.zebra]++;
      if ((p.cdir > 0 && p.x >= p.tx) || (p.cdir < 0 && p.x <= p.tx)) { p.state = 'walk'; p.t = 0; p.x = p.tx; p.zebra = -1; }
    }
    if (p.z < camZ - 45 || p.z > camZ + 165) S.peds.splice(i, 1);
  }
  // two people walking towards each other on the same pavement sometimes stop for a chat
  for (let i = 0; i < S.peds.length; i++) for (let j = i + 1; j < S.peds.length; j++) {
    const a = S.peds[i], b = S.peds[j];
    if ((a.state || 'walk') !== 'walk' || (b.state || 'walk') !== 'walk' || a.chatted || b.chatted || a.t < 3 || b.t < 3) continue;
    if (a.x * b.x <= 0 || a.dz * b.dz >= 0 || Math.abs(a.z - b.z) > 1.4 || Math.abs(a.x - b.x) > 2.2) continue;
    if (G.n() < .5) {
      a.state = b.state = 'chat'; a.t = b.t = 0; a.until = b.until = G.r(3.6, 7); a.partner = b; b.partner = a; a.chatted = b.chatted = true;
      if (Snd.on && Math.abs(a.z - camZ) < 28) Snd.voice(G.p(['Alright!', 'Hello mate!', 'Long time no see!', 'How are you?']), a.female ? 210 : 140, .05);
    }
  }
}
