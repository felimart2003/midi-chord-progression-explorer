'use strict';
/* theory.js — keys, scales, spelling, diatonic chords, voicings.
   Plain script (no modules) so the app runs from file://. Exposes `Theory`. */
const Theory = (() => {
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const MAJOR_IV = [0, 2, 4, 5, 7, 9, 11];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

  const MODES = {
    major:      { label: 'Major (Ionian)',  short: 'major',      intervals: [0, 2, 4, 5, 7, 9, 11], group: 'main' },
    minor:      { label: 'Minor (Aeolian)', short: 'minor',      intervals: [0, 2, 3, 5, 7, 8, 10], group: 'main' },
    dorian:     { label: 'Dorian',          short: 'Dorian',     intervals: [0, 2, 3, 5, 7, 9, 10], group: 'mode' },
    phrygian:   { label: 'Phrygian',        short: 'Phrygian',   intervals: [0, 1, 3, 5, 7, 8, 10], group: 'mode' },
    lydian:     { label: 'Lydian',          short: 'Lydian',     intervals: [0, 2, 4, 6, 7, 9, 11], group: 'mode' },
    mixolydian: { label: 'Mixolydian',      short: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10], group: 'mode' },
    locrian:    { label: 'Locrian',         short: 'Locrian',    intervals: [0, 1, 3, 5, 6, 8, 10], group: 'mode' },
  };

  const QUALITIES = {
    maj:  { intervals: [0, 4, 7],     suffix: '' },
    min:  { intervals: [0, 3, 7],     suffix: 'm' },
    dim:  { intervals: [0, 3, 6],     suffix: '°' },
    aug:  { intervals: [0, 4, 8],     suffix: '+' },
    dom7: { intervals: [0, 4, 7, 10], suffix: '7' },
  };

  const mod12 = n => ((n % 12) + 12) % 12;

  function accidental(alter) {
    if (alter === 0) return '';
    return (alter > 0 ? '♯' : '♭').repeat(Math.abs(alter));
  }
  const spellingName = sp => sp.letter + accidental(sp.alter);

  // All single-accidental spellings of a pitch class (e.g. pc 6 → F♯ and G♭).
  function candidateSpellings(pc) {
    const out = [];
    for (const letter of LETTERS) {
      let alter = pc - NAT[letter];
      if (alter > 6) alter -= 12;
      if (alter < -6) alter += 12;
      if (Math.abs(alter) <= 1) out.push({ letter, alter });
    }
    return out;
  }

  // Spell a scale with consecutive letters so every degree gets its own letter
  // (F♯ major yields E♯, E♭ minor yields C♭, etc).
  function spellScale(tonicSpelling, intervals) {
    const tonicPc = mod12(NAT[tonicSpelling.letter] + tonicSpelling.alter);
    const startIdx = LETTERS.indexOf(tonicSpelling.letter);
    return intervals.map((iv, i) => {
      const letter = LETTERS[(startIdx + i) % 7];
      const pc = mod12(tonicPc + iv);
      let alter = pc - NAT[letter];
      if (alter > 6) alter -= 12;
      if (alter < -6) alter += 12;
      return { letter, alter, pc, name: spellingName({ letter, alter }) };
    });
  }

  // Pick the tonic spelling that minimizes accidentals in the resulting scale.
  // Ties (6♯ vs 6♭) break toward sharps in major-ish modes, flats otherwise.
  function bestTonicSpelling(pc, modeId) {
    const intervals = MODES[modeId].intervals;
    const preferSharpOnTie = modeId === 'major' || modeId === 'lydian' || modeId === 'mixolydian';
    let best = null, bestCost = Infinity;
    for (const cand of candidateSpellings(pc)) {
      const scale = spellScale(cand, intervals);
      let cost = scale.reduce((s, d) => s + Math.abs(d.alter), 0);
      if (preferSharpOnTie ? cand.alter > 0 : cand.alter < 0) cost -= 0.1;
      if (cost < bestCost) { bestCost = cost; best = cand; }
    }
    return best;
  }

  const tonicNameFor = (pc, modeId) => spellingName(bestTonicSpelling(pc, modeId));

  function getKey(pc, modeId) {
    const tonic = bestTonicSpelling(pc, modeId);
    const scale = spellScale(tonic, MODES[modeId].intervals);
    return {
      pc: mod12(pc),
      modeId,
      mode: MODES[modeId],
      tonic,
      scale,
      name: `${spellingName(tonic)} ${MODES[modeId].short}`,
    };
  }

  // Name a pitch class inside a key: use the scale degree's spelling when
  // diatonic, otherwise fall back to flat names (borrowed chords are flat-side).
  function nameForPc(key, pc) {
    pc = mod12(pc);
    const deg = key.scale.find(d => d.pc === pc);
    return deg ? deg.name : FLAT_NAMES[pc];
  }

  function triadQuality(third, fifth) {
    if (third === 4 && fifth === 7) return 'maj';
    if (third === 3 && fifth === 7) return 'min';
    if (third === 3 && fifth === 6) return 'dim';
    if (third === 4 && fifth === 8) return 'aug';
    return 'maj';
  }

  // Roman numeral with ♭/♯ prefix relative to the major scale (♭VII, ♯iv°, …).
  function romanFor(degreeIndex, quality, intervalFromTonic) {
    const diff = intervalFromTonic - MAJOR_IV[degreeIndex];
    const prefix = diff === 0 ? '' : diff < 0 ? '♭'.repeat(-diff) : '♯'.repeat(diff);
    let r = ROMAN[degreeIndex];
    if (quality === 'min' || quality === 'dim') r = r.toLowerCase();
    if (quality === 'dim') r += '°';
    if (quality === 'aug') r += '+';
    return prefix + r;
  }

  // Roman numeral for an arbitrary semitone offset from the tonic.
  function romanForOffset(offset, quality) {
    offset = mod12(offset);
    let i = MAJOR_IV.indexOf(offset), prefix = '';
    if (i < 0) { i = MAJOR_IV.indexOf(mod12(offset + 1)); prefix = '♭'; }
    if (i < 0) { i = MAJOR_IV.indexOf(mod12(offset - 1)); prefix = '♯'; }
    let r = ROMAN[i];
    if (quality === 'min' || quality === 'dim') r = r.toLowerCase();
    let suffix = '';
    if (quality === 'dim') suffix = '°';
    if (quality === 'aug') suffix = '+';
    if (quality === 'dom7') suffix = '7';
    return prefix + r + suffix;
  }

  // Root-position voicing around C3, with the root doubled an octave below.
  function voice(rootPc, intervals) {
    const root = 48 + mod12(rootPc); // C3..B3
    return [root - 12, ...intervals.map(iv => root + iv)];
  }

  function makeChord({ rootPc, rootName, quality, roman, degree = null, rootOffset }) {
    const q = QUALITIES[quality];
    rootPc = mod12(rootPc);
    return {
      rootPc,
      rootName,
      quality,
      roman,
      degree,
      rootOffset: mod12(rootOffset),
      pcs: q.intervals.map(iv => mod12(rootPc + iv)),
      midi: voice(rootPc, q.intervals),
      symbol: rootName + q.suffix,
      id: `${rootPc}:${quality}`,
    };
  }

  function diatonicChords(key) {
    return key.scale.map((deg, i) => {
      const t = key.scale[(i + 2) % 7], f = key.scale[(i + 4) % 7];
      const quality = triadQuality(mod12(t.pc - deg.pc), mod12(f.pc - deg.pc));
      const rootOffset = mod12(deg.pc - key.pc);
      return makeChord({
        rootPc: deg.pc,
        rootName: deg.name,
        quality,
        roman: romanFor(i, quality, key.mode.intervals[i]),
        degree: i,
        rootOffset,
      });
    });
  }

  // descriptor: { rootOffset, quality, roman } — key-relative, so progressions
  // transpose automatically when the user changes key.
  function chordFromDescriptor(key, d) {
    const rootPc = mod12(key.pc + d.rootOffset);
    return makeChord({
      rootPc,
      rootName: nameForPc(key, rootPc),
      quality: d.quality,
      roman: d.roman || romanForOffset(d.rootOffset, d.quality),
      rootOffset: d.rootOffset,
    });
  }

  const api = {
    MODES, QUALITIES, ROMAN, mod12,
    getKey, tonicNameFor, nameForPc, diatonicChords, chordFromDescriptor,
    romanFor, romanForOffset, spellingName,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
