'use strict';
// Frame loop, camera, overlays, HUD, ambient events.
const hudEl = document.getElementById('hud'), streetEl = document.getElementById('street');
const STEPS = +(QP.get('speed') || 1);
let last = performance.now(), hudT = 0, ambT = { horn: G.r(20, 50), siren: G.r(60, 140), bird: 6, chat: G.r(40, 80) }, streetShown = '';

function updateCamera(dt) {
  const S = world.street; if (!S) return;
  const tgt = scene.rideActive ? 1.22 : 1.62;
  scene.eyeH = scene.eyeH === undefined ? 1.22 : scene.eyeH + (tgt - scene.eyeH) * (1 - Math.exp(-dt * 2.5));
  HZ = HZ0;
  if (scene.rideActive) {
    const sp = Math.min(R.v / 8, 1), T = world.turn;
    cam.z = R.z; cam.x = R.x + Math.sin(R.dist * .35) * .03;
    cam.h = scene.eyeH + Math.sin(R.dist * 2.1) * .008 * sp + (Math.sin(R.dist * 9.1) + Math.sin(R.dist * 13.7)) * .0035 * sp;
    cam.yawPx = 0;
    if (T) { setHeading(T.th); cam.roll = T.s * .16 * Math.sin(Math.PI * T.u); }
    else { setHeading(0); cam.roll = (R.x - R.tx) * .01; }
    scene.pitch += ((R.braking ? .012 : 0) - scene.pitch) * (1 - Math.exp(-dt * 4));
    HZ = HZ0 + scene.pitch * SH;
  } else {
    cam.z = scene.wz; cam.x = scene.wx + Math.sin(scene.wph) * .03; setHeading(scene.wdir > 0 ? 0 : Math.PI);
    cam.h = scene.eyeH + Math.abs(Math.sin(scene.wph)) * .04;
    cam.yawPx = scene.look * SW * .3;
    cam.roll = Math.sin(scene.wph) * .003;
  }
}

function ambient(dt) {
  if (!Snd.on) return;
  const out = scene.mode === 'street' || (scene.mode === 'tunnel' && scene.tun && scene.tun.out);
  if (!out) return;
  const D = world.street ? world.street.D : DISTRICTS.soho;
  if ((ambT.horn -= dt) < 0) { ambT.horn = G.r(30, 90) / (D.traffic + .3); if (Math.random() < .6) Snd.horn(G.r(-.8, .8)); }
  if ((ambT.siren -= dt) < 0) { ambT.siren = G.r(90, 240); Snd.siren(); }
  if ((ambT.bird -= dt) < 0) { ambT.bird = G.r(4, 12); if (env.day > .5 && env.rain < .3) Snd.bird(); }
  if ((ambT.chat -= dt) < 0) {
    ambT.chat = G.r(50, 110);
    if (scene.rideActive && phone.mode === 'idle') {
      const pool = [];
      if (env.rain > .3) pool.push('Roads are slick tonight.', 'Visor keeps steaming up.');
      if (env.night > .6) pool.push('Quiet out here tonight.', 'Nice when the traffic thins out.');
      if (env.day > .5) pool.push('Nice bit of sun today.', 'Lots of tourists about.');
      pool.push('Should get something soon.', 'Battery\'s holding up well.', 'Bus lane\'s handy here.');
      mutter(G.p(pool), 3.4);
    }
  }
}

function render(dt) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SW, SH);
  scene.t += dt;
  if (scene.mode === 'street') {
    ctx.save();
    ctx.translate(SW / 2, SH / 2); ctx.rotate(cam.roll || 0); ctx.scale(1.04, 1.04); ctx.translate(-SW / 2, -SH / 2);
    renderStreet(dt);
    ctx.restore();
    drawWeatherFx(dt, scene.rideActive);
    if (scene.rideActive) { drawBike(dt); drawPhone(dt, true); }
    else { if (scene.carry) drawBag(SW * .82, SH * 1.02 + Math.abs(Math.sin(scene.wph)) * -6, SH * .32, scene.carry); if (phone.g > .03) drawPhone(dt, false); }
  } else if (scene.mode === 'tunnel') {
    renderTunnel(dt);
    if (scene.tun && scene.tun.out) drawWeatherFx(dt, false);
    if (scene.carry) drawBag(SW * .82, SH * 1.02 + Math.abs(Math.sin(scene.wph)) * -6, SH * .32, scene.carry);
    if (phone.g > .03) drawPhone(dt, false);
  } else if (scene.mode === 'shop') {
    renderShop(dt);
    if (phone.g > .03) drawPhone(dt, false);
  }
  drawVignette();
  streetEl.style.visibility = scene.mode === 'street' ? 'visible' : 'hidden';
  const f = Math.max(scene.fade, world.tfade);
  if (f > .003) { ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, f).toFixed(3) + ')'; ctx.fillRect(0, 0, SW, SH); }
}

function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now; DT = dt;
  for (let i = 0; i < STEPS; i++) { updateEnv(dt); updateWorld(dt); stepStory(dt); }
  updateCamera(dt);
  render(dt);
  if (capTimer > 0) { capTimer -= dt; if (capTimer <= 0) capEl.classList.remove('on'); }
  ambient(dt);
  const S = world.street;
  Snd.update({ speed: R.v, scene: scene.mode === 'tunnel' ? (scene.tun && scene.tun.out ? 'street' : 'tunnel') : scene.mode, riding: scene.mode === 'street' && scene.rideActive,
    rain: env.rain, wet: env.wet, wind: env.fog, traffic: S ? S.D.traffic : .5, night: env.night, busy: scene.shop ? scene.shop.others.length : 0 });
  hudT -= dt;
  if (hudT <= 0 && S) {
    hudT = .5;
    hudEl.textContent = clockStr() + '   ' + money(phone.earn) + '   ' + phone.trips + (phone.trips === 1 ? ' drop' : ' drops') + '   ' + (env.rain > .5 ? 'Rain' : env.rain > .1 ? 'Drizzle' : env.fog > .015 ? 'Fog' : env.cloud > .7 ? 'Overcast' : env.cloud > .35 ? 'Cloudy' : env.day > .3 ? 'Clear' : 'Clear night');
    const nm = S.name + ' · ' + S.D.name;
    if (nm !== streetShown) { streetShown = nm; streetEl.textContent = nm; streetEl.classList.remove('on'); void streetEl.offsetWidth; streetEl.classList.add('on'); }
  }
  requestAnimationFrame(frame);
}

// ---------- boot ----------
resize();
{
  const d0 = QP.get('d') || G.p(Object.keys(DISTRICTS)); nav.district = d0;
  const first = mkPlan(d0, 'S', ''); first.signal = false;
  loadStreet(first);
  R.z = 30; R.v = 6;
  nav.queue = [];
  mainGen = mainStory();
}
document.getElementById('go').addEventListener('click', () => {
  Snd.start(); document.getElementById('intro').classList.add('gone');
});
window.addEventListener('keydown', e => {
  if (e.key === 'm' || e.key === 'M') { Snd.start(); const m = Snd.toggleMute(); document.getElementById('mute').textContent = m ? 'Sound off' : 'Sound on'; }
  if (e.key === 'f' || e.key === 'F') toggleFs();
});
document.getElementById('mute').addEventListener('click', () => { Snd.start(); const m = Snd.toggleMute(); document.getElementById('mute').textContent = m ? 'Sound off' : 'Sound on'; });
function toggleFs() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); }
document.getElementById('fs').addEventListener('click', toggleFs);
window.dbg = { env, R, nav, world, scene, phone };
requestAnimationFrame(frame);
