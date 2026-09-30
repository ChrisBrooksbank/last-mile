'use strict';
// Fully synthesised soundscape (WebAudio). Nothing to download.
const Snd = (() => {
  let ctx = null, master, nbuf, started = false, muted = false;
  const B = {}; // continuous beds
  let lastPass = 0;

  function mkNoise() {
    const len = ctx.sampleRate * 4, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * .1848) * .11;
    }
    return b;
  }
  function bed(type, freq, q) {
    const s = ctx.createBufferSource(); s.buffer = nbuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || .7;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(master); s.start(0, Math.random() * 3);
    return { f, g };
  }
  function osc(type, freq) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; return o;
  }
  function start() {
    if (started) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    started = true;
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain(); master.gain.value = muted ? 0 : .9;
    master.connect(comp); comp.connect(ctx.destination);
    nbuf = mkNoise();
    B.city = bed('lowpass', 520, .5);
    B.hiss = bed('bandpass', 1700, .6);
    B.road = bed('bandpass', 380, .9);
    B.wind = bed('lowpass', 260, .4);
    B.rain = bed('highpass', 3200, .5);
    B.rainLo = bed('bandpass', 1100, .5);
    B.room = bed('lowpass', 240, .5);
    B.crowd = bed('bandpass', 620, 1.2);
    B.kitchen = bed('highpass', 4200, .5);
    // electric motor: soft hum + whine
    B.mg = ctx.createGain(); B.mg.gain.value = 0; B.mg.connect(master);
    B.o1 = osc('sine', 110); B.o2 = osc('triangle', 220); B.o3 = osc('sine', 900);
    const g3 = ctx.createGain(); g3.gain.value = .12;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
    B.o1.connect(lp); B.o2.connect(lp); B.o3.connect(g3); g3.connect(lp); lp.connect(B.mg);
    B.o1.start(); B.o2.start(); B.o3.start();
    // slow wobble for the ambience
    const lfo = osc('sine', .13), lg = ctx.createGain(); lg.gain.value = 120;
    lfo.connect(lg); lg.connect(B.city.f.frequency); lfo.start();
    const lfo2 = osc('sine', .7), lg2 = ctx.createGain(); lg2.gain.value = 140;
    lfo2.connect(lg2); lg2.connect(B.crowd.f.frequency); lfo2.start();
  }
  const T = (p, v, tc) => p.setTargetAtTime(v, ctx.currentTime, tc || .25);

  // s: {speed, scene ('street'|'shop'|'tunnel'|'black'), indoor, rain, traffic, night, walking}
  function update(s) {
    if (!started) return;
    const out = s.scene === 'street', sp = s.speed || 0;
    const mu = out ? 1 : (s.scene === 'shop' ? .08 : .22);
    T(B.city.g.gain, (.05 + .06 * (s.traffic || .5)) * mu * (1 - .3 * s.night));
    T(B.hiss.g.gain, .006 * mu * (s.traffic || .5));
    const riding = out && s.riding;
    T(B.road.g.gain, riding ? Math.min(.11, sp * .009) * (1 + s.wet * .5) : 0, .3);
    T(B.wind.g.gain, riding ? Math.min(.1, sp * sp * .0007) : out ? .012 + .02 * s.wind : 0, .3);
    T(B.rain.g.gain, s.rain * .05 * (out ? 1 : .3), .6);
    T(B.rainLo.g.gain, s.rain * .05 * (out ? 1 : .35), .6);
    T(B.room.g.gain, out ? 0 : .05);
    T(B.crowd.g.gain, s.scene === 'shop' ? .07 + .03 * (s.busy || 0) : 0, .4);
    T(B.kitchen.g.gain, s.scene === 'shop' ? .012 : 0, .4);
    const v = riding ? sp : 0;
    T(B.mg.gain, riding ? .012 + Math.min(.05, v * .0045) : 0, .2);
    T(B.o1.frequency, 90 + v * 17, .1); T(B.o2.frequency, 180 + v * 34, .1); T(B.o3.frequency, 700 + v * 60, .1);
  }

  function env(g, t0, a, dur, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  function tone(freq, type, dur, vol, delay, to, pan) {
    if (!started) return;
    const t0 = ctx.currentTime + (delay || 0), o = osc(type || 'sine', freq), g = ctx.createGain();
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    env(g, t0, .008, dur, vol);
    o.connect(g); let dest = g;
    if (pan !== undefined && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); dest = p; }
    dest.connect(master); o.start(t0); o.stop(t0 + dur + .05);
  }
  function burst(dur, ft, f0, q, vol, delay, f1, pan, att) {
    if (!started) return;
    const t0 = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(); s.buffer = nbuf;
    const f = ctx.createBiquadFilter(); f.type = ft; f.frequency.setValueAtTime(f0, t0); f.Q.value = q || 1;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = ctx.createGain(); env(g, t0, att || .01, dur, vol);
    s.connect(f); f.connect(g);
    let dest = g;
    if (pan !== undefined && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); dest = p; }
    dest.connect(master); s.start(t0, Math.random() * 3, dur + .1);
  }

  const api = {
    start, update,
    get on() { return started; },
    toggleMute() { muted = !muted; if (master) T(master.gain, muted ? 0 : .9, .1); return muted; },
    ping() { tone(988, 'sine', .35, .09); tone(1318, 'sine', .5, .09, .13); tone(1760, 'sine', .6, .05, .26); },
    buzz() { for (let i = 0; i < 2; i++) tone(84, 'square', .18, .05, i * .26); burst(.4, 'lowpass', 300, 1, .05); },
    tap() { burst(.05, 'bandpass', 2200, 2, .12); tone(1400, 'sine', .05, .04); },
    cash() { [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 'sine', .55, .07, i * .09)); },
    sad() { tone(440, 'sine', .4, .06); tone(330, 'sine', .6, .06, .18); },
    step(kind) {
      const f = kind === 'stairs' ? 420 : kind === 'indoor' ? 340 : 260;
      burst(.07, 'lowpass', f, .8, kind === 'indoor' || kind === 'stairs' ? .13 : .09, 0, f * .5);
      burst(.03, 'highpass', 2500, 1, .015);
    },
    bell() { tone(1318, 'sine', .9, .06); tone(1046, 'sine', 1.1, .06, .22); },
    doorBell() { tone(659, 'sine', 1.1, .09); tone(523, 'sine', 1.6, .09, .55); },
    buzzer() { tone(180, 'sawtooth', 1.2, .05); tone(190, 'square', 1.2, .03); },
    click() { burst(.04, 'bandpass', 1800, 3, .1); },
    door() { burst(.35, 'lowpass', 500, 1, .12, 0, 180); tone(70, 'sine', .3, .1); },
    creak() { tone(300, 'sawtooth', .6, .015, 0, 520); },
    stand() { tone(110, 'sine', .25, .2); burst(.12, 'bandpass', 900, 2, .1); },
    bag() { for (let i = 0; i < 4; i++) burst(.09, 'highpass', 2600, .8, .05, i * .07); },
    lift() { tone(880, 'sine', .8, .06); tone(660, 'sine', 1, .05, .35); },
    horn(pan) { tone(410, 'square', .35, .018, 0, undefined, pan); tone(520, 'square', .35, .018, 0, undefined, pan); },
    siren() {
      const t = ctx.currentTime; const o = osc('sawtooth', 700), g = ctx.createGain(), f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 1100; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.014, t + 1.5); g.gain.linearRampToValueAtTime(0, t + 6);
      for (let i = 0; i < 6; i++) o.frequency.setValueAtTime(i % 2 ? 960 : 720, t + i);
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 6.2);
    },
    bird() { if (!started) return; const n = 2 + (Math.random() * 3 | 0), f0 = 2600 + Math.random() * 1600; for (let i = 0; i < n; i++) tone(f0, 'sine', .09, .012, i * .12, f0 * (1.2 + Math.random() * .3), Math.random() * 1.4 - .7); },
    dog() { for (let i = 0; i < 3; i++) { tone(330, 'sawtooth', .16, .06, i * .3, 210); burst(.14, 'bandpass', 900, 2, .06, i * .3); } },
    pass(pan, vol, spd) {
      if (!started || ctx.currentTime - lastPass < .35) return; lastPass = ctx.currentTime;
      const d = clamp(1.3 - (spd || 8) * .04, .5, 1.3);
      burst(d, 'bandpass', 250 + (spd || 8) * 20, 1.2, .16 * vol, 0, 900, pan, d * .45);
    },
    indicator(on) { if (on) burst(.02, 'highpass', 3000, 1, .06); else burst(.03, 'bandpass', 1500, 3, .05); },
    clatter() { for (let i = 0; i < 3; i++) burst(.06, 'bandpass', 2000 + Math.random() * 3000, 4, .03, Math.random() * .3); },
    voice(text, pitch, vol) {
      if (!started) return 1;
      const syl = clamp(Math.ceil(text.length / 3.1), 3, 30); let t = ctx.currentTime + .03;
      const f1 = 380 + Math.random() * 300, f2 = 1200 + Math.random() * 900;
      for (let i = 0; i < syl; i++) {
        const d = .075 + Math.random() * .07, o = osc('sawtooth', pitch * (.88 + Math.random() * .28));
        o.frequency.linearRampToValueAtTime(pitch * (.85 + Math.random() * .3), t + d);
        const a = ctx.createBiquadFilter(); a.type = 'bandpass'; a.frequency.value = f1 * (.8 + Math.random() * .5); a.Q.value = 5;
        const b = ctx.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = f2 * (.8 + Math.random() * .5); b.Q.value = 6;
        const g = ctx.createGain(); env(g, t, .02, d, vol || .07);
        o.connect(a); o.connect(b); a.connect(g); b.connect(g); g.connect(master);
        o.start(t); o.stop(t + d + .05);
        t += d + (i % 4 === 3 ? .09 : .012);
      }
      return t - ctx.currentTime;
    },
  };
  return api;
})();
