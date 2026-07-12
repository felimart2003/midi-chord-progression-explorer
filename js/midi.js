'use strict';
/* midi.js — Standard MIDI File (format 0) writer for the progression.
   Exposes `MidiExport`. */
const MidiExport = (() => {
  const TPQ = 480; // ticks per quarter note

  function vlq(n) {
    // variable-length quantity
    const bytes = [n & 0x7f];
    n >>= 7;
    while (n > 0) { bytes.unshift((n & 0x7f) | 0x80); n >>= 7; }
    return bytes;
  }
  const u32 = n => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  const u16 = n => [(n >> 8) & 0xff, n & 0xff];
  const str = t => Array.from(t, ch => ch.charCodeAt(0) & 0x7f);

  /**
   * build(chords, opts) → Uint8Array of a .mid file.
   * chords: array of { midi: number[] } (Theory chord objects work as-is).
   * opts: { bpm = 100, beatsPerChord = 2, velocity = 90, name = 'Progression' }
   */
  function build(chords, opts = {}) {
    const bpm = opts.bpm || 100;
    const beats = opts.beatsPerChord || 2;
    const vel = opts.velocity || 90;
    const track = [];

    // Track name + tempo + 4/4 time signature.
    track.push(...vlq(0), 0xff, 0x03, ...vlq((opts.name || 'Progression').length),
               ...str(opts.name || 'Progression'));
    const usPerQuarter = Math.round(60000000 / bpm);
    track.push(...vlq(0), 0xff, 0x51, 0x03,
               (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff);
    track.push(...vlq(0), 0xff, 0x58, 0x04, 4, 2, 24, 8);
    // Program change: 4 = Electric Piano 1 (Rhodes) to match the app's tone.
    track.push(...vlq(0), 0xc0, 4);

    const dur = beats * TPQ;
    for (const chord of chords) {
      const notes = chord.midi;
      notes.forEach((n, i) => track.push(...vlq(0), 0x90, n & 0x7f, i === 0 ? vel : vel - 8));
      notes.forEach((n, i) => track.push(...vlq(i === 0 ? dur : 0), 0x80, n & 0x7f, 0));
    }
    track.push(...vlq(0), 0xff, 0x2f, 0x00); // end of track

    const bytes = [
      ...str('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(TPQ),
      ...str('MTrk'), ...u32(track.length), ...track,
    ];
    return new Uint8Array(bytes);
  }

  function download(chords, opts = {}) {
    const data = build(chords, opts);
    const blob = new Blob([data], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (opts.filename || 'progression') + '.mid';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const api = { build, download, TPQ };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
