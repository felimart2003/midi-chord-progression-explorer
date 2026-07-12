'use strict';
/* smoke.js — logic tests for theory, suggestions, and MIDI export.
   Run: node test/smoke.js */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = ['js/theory.js', 'js/suggest.js', 'js/midi.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8'))
  .join('\n') + '\nglobalThis.__api = { Theory, Suggest, MidiExport };';
eval(src);
const { Theory: T, Suggest: S, MidiExport: M } = globalThis.__api;

let fails = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) console.log(`  ok  ${label}`);
  else { fails++; console.error(`FAIL  ${label}\n      got ${a}\n      want ${e}`); }
}
function ok(cond, label) {
  if (cond) console.log(`  ok  ${label}`);
  else { fails++; console.error(`FAIL  ${label}`); }
}

// ---- key spelling -----------------------------------------------------------
const cMaj = T.getKey(0, 'major');
eq(cMaj.name, 'C major', 'C major name');
eq(cMaj.scale.map(d => d.name), ['C', 'D', 'E', 'F', 'G', 'A', 'B'], 'C major scale');

const fsMaj = T.getKey(6, 'major');
eq(fsMaj.scale.map(d => d.name), ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯'], 'F♯ major uses E♯');

const ebMin = T.getKey(3, 'minor');
eq(ebMin.scale.map(d => d.name), ['E♭', 'F', 'G♭', 'A♭', 'B♭', 'C♭', 'D♭'], 'E♭ minor uses C♭');

// ---- diatonic chords ----------------------------------------------------------
eq(T.diatonicChords(cMaj).map(c => c.roman),
   ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], 'C major romans');
eq(T.diatonicChords(cMaj).map(c => c.symbol),
   ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'], 'C major symbols');

const aMin = T.getKey(9, 'minor');
eq(T.diatonicChords(aMin).map(c => c.roman),
   ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'], 'A minor romans');
eq(T.diatonicChords(aMin).map(c => c.symbol),
   ['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G'], 'A minor symbols');

const dDor = T.getKey(2, 'dorian');
eq(T.diatonicChords(dDor).map(c => c.roman),
   ['i', 'ii', '♭III', 'IV', 'v', 'vi°', '♭VII'], 'D dorian romans');

// ---- voicings -------------------------------------------------------------------
const cChord = T.diatonicChords(cMaj)[0];
eq(cChord.midi, [36, 48, 52, 55], 'C chord voicing (doubled root, root position)');
for (let pc = 0; pc < 12; pc++) {
  const notes = T.chordFromDescriptor(cMaj, { rootOffset: pc, quality: 'dom7' }).midi;
  ok(notes.every(n => n >= 36 && n <= 83), `voicing in piano range for offset ${pc}`);
}

// ---- key-relative transposition ---------------------------------------------------
const desc = { rootOffset: 7, quality: 'maj' };
eq(T.chordFromDescriptor(cMaj, desc).symbol, 'G', 'descriptor V in C = G');
eq(T.chordFromDescriptor(T.getKey(2, 'major'), desc).symbol, 'A', 'descriptor V in D = A');

// ---- suggestions -------------------------------------------------------------------
const start = S.suggest(cMaj, [], false);
ok(start.length >= 3 && start.length <= 4, `start suggestions count (${start.length})`);

const afterV = S.suggest(cMaj, [{ rootOffset: 7, quality: 'maj' }], false);
ok(afterV[0].chord.roman === 'I' && /resolution/.test(afterV[0].why),
   'after V, top pick is I (strong resolution)');
ok(afterV.every(p => !(p.chord.rootOffset === 7 && p.chord.quality === 'maj')),
   'never suggests repeating the same chord');

const adv = S.suggest(cMaj, [{ rootOffset: 0, quality: 'maj' }], true);
ok(adv.some(p => p.adventurous), 'adventurous mode surfaces spicy picks');
ok(adv.length <= 4, 'adventurous still capped at 4');

const afterSecDom = S.suggest(cMaj, [{ rootOffset: 2, quality: 'dom7' }], false);
eq(afterSecDom[0].chord.rootOffset, 7, 'V/V resolves to V');

const minorSugg = S.suggest(aMin, [{ rootOffset: 7, quality: 'maj' }], false);
ok(minorSugg[0].chord.roman === 'i', 'minor: after V, top pick is i');

const modal = S.suggest(dDor, [{ rootOffset: 0, quality: 'min' }], false);
ok(modal.length >= 3, 'modal fallback produces suggestions');

// ---- MIDI ----------------------------------------------------------------------------
const chords = [T.diatonicChords(cMaj)[0], T.diatonicChords(cMaj)[4]];
const bytes = M.build(chords, { bpm: 100, beatsPerChord: 2 });
eq(String.fromCharCode(...bytes.slice(0, 4)), 'MThd', 'MIDI header chunk');
eq(String.fromCharCode(...bytes.slice(14, 18)), 'MTrk', 'MIDI track chunk');
const trackLen = (bytes[18] << 24) | (bytes[19] << 16) | (bytes[20] << 8) | bytes[21];
eq(bytes.length, 22 + trackLen, 'track length matches byte count');
let noteOns = 0, noteOffs = 0;
for (let i = 0; i < bytes.length - 2; i++) {
  if (bytes[i] === 0x90 && bytes[i + 2] > 0) noteOns++;
  if (bytes[i] === 0x80) noteOffs++;
}
ok(noteOns === 8 && noteOffs === 8, `8 note-ons + 8 note-offs (got ${noteOns}/${noteOffs})`);

console.log(fails ? `\n${fails} failure(s)` : '\nAll tests passed.');
process.exit(fails ? 1 : 0);
