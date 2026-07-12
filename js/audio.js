'use strict';
/* audio.js — Web Audio synth. Rhodes-ish tone: sine fundamental + soft octave
   partial + fast-decaying "tine" transient, through a lowpass with envelope.
   Exposes `Synth`. */
const Synth = (() => {
  let ctx = null;
  let master = null;

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);

  // One Rhodes-ish voice. `when` is AudioContext time; dur in seconds.
  function playNote(midi, when, dur, velocity = 0.8) {
    ensureCtx();
    const f = midiToFreq(midi);
    const t = Math.max(when, ctx.currentTime);
    const end = t + dur;

    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(Math.min(f * 7, 9000), t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(f * 2.2, 500), t + 0.35);
    amp.connect(filter);
    filter.connect(master);

    // Amplitude envelope: fast attack, exponential-ish decay, gentle release.
    const peak = 0.24 * velocity;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(peak, t + 0.006);
    amp.gain.setTargetAtTime(peak * 0.45, t + 0.006, 0.9);
    amp.gain.setTargetAtTime(0.0001, end, 0.09);

    const voices = [];
    const mk = (freq, type, gain, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g);
      g.connect(amp);
      o.start(t);
      o.stop(end + 0.8);
      voices.push(o);
      return g;
    };

    mk(f, 'sine', 1.0);              // fundamental
    mk(f, 'triangle', 0.16, 5);      // warmth, slight detune shimmer
    mk(f * 2, 'sine', 0.22, -4);     // octave partial

    // "Tine" attack transient: bright partial that dies in ~120 ms.
    const tine = mk(f * 4, 'sine', 0.0);
    tine.gain.setValueAtTime(0.28 * velocity, t);
    tine.gain.setTargetAtTime(0.0001, t + 0.01, 0.045);

    return voices;
  }

  // Chord with a tiny strum stagger so it doesn't hit like a block.
  function playChord(midiNotes, when = 0, dur = 1.4, velocity = 0.8) {
    ensureCtx();
    const t0 = when || ctx.currentTime;
    midiNotes.forEach((m, i) => playNote(m, t0 + i * 0.012, dur, velocity));
  }

  // Metronome click: filtered noise tick, brighter on the accent.
  function click(when, accent = false) {
    ensureCtx();
    const t = Math.max(when, ctx.currentTime);
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = accent ? 1900 : 1250;
    const g = ctx.createGain();
    g.gain.setValueAtTime(accent ? 0.16 : 0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.06);
  }

  return {
    playNote: (m, dur = 1.2, vel = 0.8) => { ensureCtx(); playNote(m, ctx.currentTime, dur, vel); },
    playChord,
    click,
    now: () => ensureCtx().currentTime,
    ensure: ensureCtx,
  };
})();
