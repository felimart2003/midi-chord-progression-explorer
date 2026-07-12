'use strict';
/* suggest.js — "next chord" suggestions from common-progression statistics and
   root-motion/voice-leading heuristics. Exposes `Suggest`.
   Candidates are key-relative descriptors {rootOffset, quality} + a reason. */
const Suggest = (() => {
  const T = Theory;

  // s(offset, quality, weight, reason)
  const s = (rootOffset, quality, w, why) => ({ rootOffset, quality, w, why });

  // ---- Diatonic transition tables (weights ~ how common the move is) -------
  // Keyed by the previous chord's rootOffset within the key.
  const MAJOR = {
    0:  [s(7, 'maj', 10, 'I→V: sets up tension to resolve'),
         s(5, 'maj', 9,  'I→IV: warm, open plagal motion'),
         s(9, 'min', 8,  'I→vi: gentle slide to the relative minor'),
         s(2, 'min', 6,  'ii: smooth step toward the dominant')],
    2:  [s(7, 'maj', 10, 'ii→V: the textbook pre-dominant move'),
         s(11, 'dim', 5, 'vii°: shares the tritone pull of V'),
         s(5, 'maj', 4,  'IV: stays in pre-dominant territory'),
         s(0, 'maj', 3,  'back to I: soft landing')],
    4:  [s(9, 'min', 8,  'iii→vi: falling thirds, very vocal'),
         s(5, 'maj', 7,  'iii→IV: bright stepwise lift'),
         s(2, 'min', 4,  'ii: keeps the descent rolling')],
    5:  [s(7, 'maj', 10, 'IV→V: the classic build'),
         s(0, 'maj', 8,  'IV→I: plagal ("amen") cadence'),
         s(2, 'min', 5,  'ii: sidestep that keeps motion alive'),
         s(9, 'min', 4,  'vi: darkens the color a shade')],
    7:  [s(0, 'maj', 10, 'V→I: strong resolution'),
         s(9, 'min', 8,  'V→vi: deceptive cadence — expected home, got melancholy'),
         s(5, 'maj', 5,  'V→IV: backdoor rock move'),
         s(2, 'min', 3,  'ii: restart the cadence engine')],
    9:  [s(5, 'maj', 9,  'vi→IV: pop staple, instantly familiar'),
         s(2, 'min', 8,  'vi→ii: descending thirds toward the cadence'),
         s(7, 'maj', 6,  'V: jump straight to the tension'),
         s(0, 'maj', 4,  'I: quick return home')],
    11: [s(0, 'maj', 10, 'vii°→I: leading-tone pull home'),
         s(4, 'min', 4,  'iii: soft deceptive slide'),
         s(7, 'maj', 3,  'V: reinforces the dominant')],
  };

  const MINOR = {
    0:  [s(5, 'min', 9,  'i→iv: deepens the minor mood'),
         s(8, 'maj', 8,  '♭VI: epic lift out of the tonic'),
         s(7, 'maj', 8,  'major V: harmonic-minor pull home'),
         s(10, 'maj', 7, '♭VII: modal rock motion')],
    2:  [s(7, 'maj', 10, 'ii°→V: minor’s pre-dominant workhorse'),
         s(0, 'min', 4,  'back to i: unresolved brooding')],
    3:  [s(8, 'maj', 8,  '♭III→♭VI: chain of falling fifths'),
         s(5, 'min', 6,  'iv: back toward the dark'),
         s(10, 'maj', 6, '♭VII: keeps the modal wheel turning')],
    5:  [s(7, 'maj', 9,  'iv→V: minor cadence setup'),
         s(0, 'min', 8,  'iv→i: minor plagal sigh'),
         s(8, 'maj', 6,  '♭VI: widescreen turn'),
         s(10, 'maj', 5, '♭VII: Aeolian cadence route')],
    7:  [s(0, 'min', 10, 'V→i: strong resolution'),
         s(8, 'maj', 7,  'V→♭VI: deceptive cadence, extra drama'),
         s(5, 'min', 4,  'iv: sidestep the resolution')],
    8:  [s(10, 'maj', 9, '♭VI→♭VII: anthem walk-up to i'),
         s(5, 'min', 6,  'iv: melts back down'),
         s(7, 'maj', 6,  'V: sharpen into a real cadence')],
    10: [s(0, 'min', 10, '♭VII→i: Aeolian rock cadence'),
         s(8, 'maj', 7,  '♭VI: rocking between the pillars'),
         s(3, 'maj', 5,  '♭III: brightens without leaving home')],
  };

  // ---- Adventurous options -------------------------------------------------
  const ADV_MAJOR = [
    s(5, 'min', 7,   'borrowed iv: adds melancholy'),
    s(10, 'maj', 7,  'borrowed ♭VII: Mixolydian swagger'),
    s(8, 'maj', 6,   'borrowed ♭VI: dramatic lift from the parallel minor'),
    s(2, 'dom7', 7,  'II7 (V/V): secondary dominant aimed at V'),
    s(4, 'dom7', 6,  'III7 (V/vi): tension pointing at vi'),
    s(9, 'dom7', 5,  'VI7 (V/ii): pushes hard into ii'),
    s(0, 'dom7', 5,  'I7 (V/IV): dominant lean into IV'),
    s(1, 'maj', 4,   'Neapolitan ♭II: dark, dramatic pre-dominant'),
  ];
  const ADV_MINOR = [
    s(0, 'maj', 6,   'Picardy I: major chord on a minor home'),
    s(5, 'maj', 6,   'Dorian IV: a brighter shade of minor'),
    s(1, 'maj', 5,   'Neapolitan ♭II: operatic pre-dominant'),
    s(2, 'dom7', 6,  'II7 (V/V): secondary dominant aimed at V'),
    s(0, 'dom7', 5,  'I7 (V/iv): dominant push into iv'),
    s(7, 'dom7', 6,  'V7: full dominant seventh, maximum pull'),
  ];

  const isMinorish = modeId =>
    modeId === 'minor' || modeId === 'dorian' || modeId === 'phrygian' || modeId === 'locrian';

  const keyOf = c => `${T.mod12(c.rootOffset)}:${c.quality}`;

  // Common tones between two chords (voice-leading smoothness bonus).
  function commonTones(a, b) {
    const pcsA = new Set(T.QUALITIES[a.quality].intervals.map(iv => T.mod12(a.rootOffset + iv)));
    return T.QUALITIES[b.quality].intervals
      .map(iv => T.mod12(b.rootOffset + iv))
      .filter(pc => pcsA.has(pc)).length;
  }

  // Generic fallback for modes without a curated table: rank the mode's
  // diatonic chords by root motion from the previous chord.
  function modalCandidates(key, prev) {
    return T.diatonicChords(key)
      .filter(c => keyOf(c) !== keyOf(prev))
      .map(c => {
        const motion = T.mod12(c.rootOffset - prev.rootOffset);
        let w = 3, why = `${c.roman}: stays in the mode`;
        if (motion === 5) { w = 9; why = `${c.roman}: down a fifth — strong root motion`; }
        else if (motion === 7) { w = 6; why = `${c.roman}: up a fifth, opens outward`; }
        else if (motion === 2 || motion === 10) { w = 6; why = `${c.roman}: stepwise, smooth voice-leading`; }
        else if (c.rootOffset === 0) { w = 7; why = `${c.roman}: back to the modal center`; }
        return s(c.rootOffset, c.quality, w, why);
      });
  }

  function startingCandidates(key) {
    const dia = T.diatonicChords(key);
    const first = dia[0];
    const out = [s(first.rootOffset, first.quality, 10, `${first.roman}: establish home base`)];
    for (const idx of [5, 3, 1]) {
      const c = dia[idx];
      out.push(s(c.rootOffset, c.quality, 6 - out.length, `${c.roman}: start away from home for intrigue`));
    }
    return out;
  }

  /**
   * suggest(key, progression, adventurous) → up to 4 of
   * { chord, why, adventurous } where chord is a full Theory chord object.
   * progression: array of descriptors {rootOffset, quality, roman}.
   */
  function suggest(key, progression, adventurous = false) {
    let cands;
    const prev = progression[progression.length - 1];

    if (!prev) {
      cands = startingCandidates(key);
    } else if (prev.quality === 'dom7') {
      // Any dominant wants to fall a fifth; offer the target first.
      const target = T.mod12(prev.rootOffset + 5);
      const tq = isMinorish(key.modeId) && (target === 0 || target === 5) ? 'min' : 'maj';
      cands = [s(target, target === 0 && !isMinorish(key.modeId) ? 'maj' : tq, 12,
                 'resolves the dominant down a fifth')];
      const table = isMinorish(key.modeId) ? MINOR : MAJOR;
      cands = cands.concat(table[target] ? table[target].slice(0, 2) : modalCandidates(key, prev).slice(0, 2));
    } else if (key.modeId === 'major' || key.modeId === 'lydian' || key.modeId === 'mixolydian') {
      cands = MAJOR[T.mod12(prev.rootOffset)] || modalCandidates(key, prev);
    } else if (key.modeId === 'minor') {
      cands = MINOR[T.mod12(prev.rootOffset)] || modalCandidates(key, prev);
    } else {
      cands = modalCandidates(key, prev);
    }

    cands = cands.map(c => ({ ...c, adventurous: false }));

    if (adventurous) {
      const adv = (isMinorish(key.modeId) ? ADV_MINOR : ADV_MAJOR)
        .map(c => ({ ...c, adventurous: true }));
      cands = cands.concat(adv);
    }

    // Score: table weight + voice-leading bonus; drop repeats of the last chord.
    const seen = new Set();
    const scored = [];
    for (const c of cands) {
      const k = keyOf(c);
      if (seen.has(k)) continue;
      if (prev && k === keyOf(prev)) continue;
      seen.add(k);
      const vl = prev ? commonTones(prev, c) * 0.6 : 0;
      scored.push({ ...c, score: c.w + vl });
    }
    scored.sort((a, b) => b.score - a.score);

    // Keep 3–4: in adventurous mode reserve at least 2 slots for spicy picks.
    let picks;
    if (adventurous) {
      const spicy = scored.filter(c => c.adventurous).slice(0, 2);
      const plain = scored.filter(c => !c.adventurous).slice(0, 2);
      picks = plain.concat(spicy).sort((a, b) => b.score - a.score).slice(0, 4);
    } else {
      picks = scored.slice(0, 4);
    }

    return picks.map(c => ({
      chord: T.chordFromDescriptor(key, { rootOffset: c.rootOffset, quality: c.quality }),
      why: c.why,
      adventurous: c.adventurous,
    }));
  }

  const api = { suggest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
