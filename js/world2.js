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
  if (S.dest) { R.parkZ = S.dest.parkZ; R.parkX = S.dest.side * (S.halfW - .85); nav.arrived = false; }
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
    if (S.spawnT[1] <= 0) { S.spawnT[1] = G.r(2.5, 7) / (D.traffic + .15); S.veh.push(mkVeh(S, 1, camZ + 150)); }
    while (S.peds.length < Math.round(D.ped * 10)) S.peds.push(mkPed(S, camZ + G.r(50, 130)));
  }
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const p = S.peds[i]; p.z += p.dz * dt; p.ph += dt * 7;
    if (p.z < camZ - 45 || p.z > camZ + 160) S.peds.splice(i, 1);
  }
  if (S.signal && st === 'red' && (world.time + S.sigOff) % 28 > 19) {
    S.crossT -= dt;
    if (S.crossT <= 0) {
      S.crossT = G.r(1.6, 3.6); const v = mkVeh(S, 0, S.len + 3.2); const dirn = G.c(.5) ? 1 : -1;
      v.axis = 'x'; v.dir = dirn; v.x = -dirn * 55; v.v = dirn * G.r(8, 12); v.z = S.len + 4 + (dirn > 0 ? -1.6 : 1.6); v.lane = 2; S.cross.push(v);
    }
  }
  for (let i = S.cross.length - 1; i >= 0; i--) { const c = S.cross[i]; c.x += c.v * dt; if (Math.abs(c.x) > 60) S.cross.splice(i, 1); }
  for (let i = S.veh.length - 1; i >= 0; i--) {
    const v = S.veh[i];
    if (v.lane === 1) {
      v.z += v.v * dt;
      if (rid && !v.passed && v.z < rid.z) { v.passed = true; if (scene.mode === 'street' && !scene.walking && S === world.street) Snd.pass(.55, clamp(1.1 - Math.abs(v.z - rid.z) * .1, .3, 1), rid.v - v.v); }
      if (v.z < camZ - 60 || v.z > camZ + 300) S.veh.splice(i, 1);
      continue;
    }
    let gap = 1e9, lv = 0;
    for (const u of S.veh) {
      if (u === v || u.lane !== 0 || u.z <= v.z || Math.abs(u.x - v.x) > 1.1) continue;
      const g = u.z - v.z - (u.len + v.len) / 2; if (g < gap) { gap = g; lv = u.v; }
    }
    if (rid && rid.z > v.z && Math.abs(rid.x - v.x) < 1.1) { const g = rid.z - v.z - v.len / 2 - .5; if (g < gap) { gap = g; lv = rid.v; } }
    let vs = v.v0;
    if (gap < 1e8) { vs = Math.min(vs, lv + Math.max(0, gap - (2.6 + .4 * v.v)) * .5); if (gap < 2.4) vs = Math.min(vs, lv * .6); }
    if (S.signal && v.z + v.len / 2 < S.stopZ && st !== 'green') {
      const d = S.stopZ - v.z - v.len / 2;
      if (st === 'red' || d > v.v * v.v / 9 - 1) vs = Math.min(vs, Math.sqrt(2 * 3 * Math.max(d - .4, 0)));
    }
    const dv = clamp(vs - v.v, -5.5 * dt, 2.2 * dt); v.v = Math.max(0, v.v + dv); v.brake = dv < -.02 || (v.v < .3 && vs < .3);
    v.z += v.v * dt;
    if (v.z > S.len + 140 || v.z < camZ - 50) S.veh.splice(i, 1);
  }
}

function updateRider(dt) {
  const S = world.street, D = S.D;
  const vt = D.cruise * (1 - .12 * env.rain) * (1 + (env.fog > .015 ? -.15 : 0));
  const st = S.signal ? sigState(S) : 'green';
  let gap = 1e9, lv = 0, lead = null;
  for (const u of S.veh) {
    if (u.lane !== 0 || u.z <= R.z || Math.abs(u.x - R.x) > 1.1) continue;
    const g = u.z - u.len / 2 - R.z - .9; if (g < gap) { gap = g; lv = u.v; lead = u; }
  }
  if (!R.pass) {
    if (lead && gap < 16 && lead.v < vt - 1.6 && S.len - R.z > 75 && R.v > 3 && !(R.parkZ != null && R.parkZ - R.z < 70)) {
      const clear = !S.veh.some(u => u.lane === 1 && u.z > R.z && u.z < R.z + 100);
      if (clear && (R.slowT += dt) > 2.2) R.pass = lead;
    } else R.slowT = 0;
  } else if (R.z > R.pass.z + R.pass.len / 2 + 4 || !S.veh.includes(R.pass)) R.pass = null;
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
  if (dStop < 1e8) vs = Math.min(vs, R.filter ? 4 : vs, Math.sqrt(2 * 3.2 * Math.max(dStop - .3, 0)));
  const nxt = nav.queue[0];
  if (nxt && R.parkZ == null) {
    const lim = nxt.turn !== 'S' ? 3.6 + .11 * Math.max(0, S.len - 6 - R.z) : 6 + .2 * Math.max(0, S.len - 6 - R.z);
    vs = Math.min(vs, lim);
  }
  if (R.parkZ != null && !R.parked) {
    const d = R.parkZ - R.z;
    vs = Math.min(vs, d > .35 ? Math.sqrt(2 * 2.3 * d) + .3 : 0);
    if (d < 32) R.tx = R.parkX; else R.tx = laneX(S);
  } else {
    R.tx = R.pass ? .05 : R.filter ? 0 : (nxt && nxt.turn === 'R' && S.len - R.z < 45) ? -.3 : laneX(S);
  }
  const before = R.v;
  R.v = Math.max(0, R.v + clamp(vs - R.v, -5.5 * dt, 2.4 * dt));
  R.braking = R.v < before - .02;
  R.z += R.v * dt; R.dist += R.v * dt;
  R.x += (R.tx - R.x) * (1 - Math.exp(-dt * 1.7));
  if (R.parkZ != null && !R.parked && R.v < .05 && R.parkZ - R.z < 1.2 && Math.abs(R.x - R.parkX) < .3) { R.parked = true; R.v = 0; nav.arrived = true; }
  R.ind = (nxt && nxt.turn !== 'S' && S.len - R.z < 70 && R.parkZ == null) ? (nxt.turn === 'L' ? -1 : 1) : (R.parkZ != null && !R.parked && R.parkZ - R.z < 40 ? S.dest.side : (R.pass ? 1 : 0));
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
  const S1 = makeStreet(plan); populate(S1);
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
  world.time += dt;
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
    if (R.z > 34) world.prev = null;
  }
  if (scene.rideActive) {
    if (nav.wander && nav.queue.length < 2) {
      const last = nav.queue.length ? nav.queue[nav.queue.length - 1] : S.plan;
      let d = last.district; if (G.c(.12)) d = G.p(NEIGH[d]);
      nav.queue.push(mkPlan(d, null, last.name));
    }
    updateRider(dt);
    const st = S.signal ? sigState(S) : 'green';
    if (nav.queue.length && R.parkZ == null && R.z >= S.len - 13 && (st === 'green' || R.z > S.stopZ + .2 || !S.signal)) beginTurn(nav.queue.shift());
  } else R.v = 0;
  updateTraffic(S, dt, scene.mode === 'street' && !scene.rideActive ? scene.wz : R.z, { z: R.z, x: R.x, v: R.v }, true);
}
