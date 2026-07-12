'use strict';
/* app.js — wires theory, synth, instruments, suggestions, timeline, MIDI. */
(() => {
  const BEATS_PER_CHORD = 2;
  const $ = sel => document.querySelector(sel);

  const state = {
    tonicPc: 0,
    modeId: 'major',
    key: null,
    progression: [],   // descriptors {rootOffset, quality} — key-relative
    bpm: 100,
    metronome: true,
    adventurous: false,
    playing: false,
  };

  let piano, fretboard;
  let selectedChord = null;
  let selectTimer = null;

  // ---------- instruments ----------------------------------------------------
  function showChord(chord, pulsing) {
    if (pulsing) {
      piano.pulse(chord.midi);
      fretboard.pulse(chord.pcs, chord.rootPc);
    } else {
      piano.highlight(chord.midi);
      fretboard.highlight(chord.pcs, chord.rootPc);
    }
  }

  function previewChord(chord) {
    selectedChord = chord;
    Synth.playChord(chord.midi, 0, 1.5);
    showChord(chord, true);
    clearTimeout(selectTimer);
    selectTimer = setTimeout(() => {
      if (!state.playing && selectedChord === chord) showChord(chord, false);
    }, 900);
  }

  // ---------- key selector ----------------------------------------------------
  function renderTonics() {
    const row = $('#tonics');
    row.innerHTML = '';
    for (let pc = 0; pc < 12; pc++) {
      const b = document.createElement('button');
      b.className = 'tonic-btn' + (pc === state.tonicPc ? ' active' : '');
      b.textContent = Theory.tonicNameFor(pc, state.modeId);
      b.addEventListener('click', () => { state.tonicPc = pc; setKey(); });
      row.appendChild(b);
    }
  }

  function renderModeSelect() {
    const sel = $('#mode-select');
    sel.innerHTML = '';
    const groups = { main: document.createElement('optgroup'), mode: document.createElement('optgroup') };
    groups.main.label = 'Major / Minor';
    groups.mode.label = 'Modes';
    for (const [id, m] of Object.entries(Theory.MODES)) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = m.label;
      groups[m.group].appendChild(o);
    }
    sel.appendChild(groups.main);
    sel.appendChild(groups.mode);
    sel.value = state.modeId;
    sel.addEventListener('change', () => { state.modeId = sel.value; renderTonics(); setKey(); });
  }

  function setKey() {
    state.key = Theory.getKey(state.tonicPc, state.modeId);
    document.querySelectorAll('.tonic-btn').forEach((b, i) =>
      b.classList.toggle('active', i === state.tonicPc));
    $('#key-name').textContent = state.key.name;
    selectedChord = null;
    piano.clear();
    fretboard.clear();
    renderChordCards();
    renderTimeline();   // progression is key-relative → re-spells automatically
    renderSuggestions();
  }

  // ---------- chord cards -----------------------------------------------------
  function cardEl(chord, why, spicy) {
    const card = document.createElement('button');
    card.className = 'chord-card' + (why ? ' suggestion' : '') + (spicy ? ' spicy' : '');
    const roman = document.createElement('span');
    roman.className = 'card-roman';
    roman.textContent = chord.roman;
    const sym = document.createElement('span');
    sym.className = 'card-symbol';
    sym.textContent = chord.symbol;
    card.appendChild(roman);
    card.appendChild(sym);
    if (why) {
      const w = document.createElement('span');
      w.className = 'card-why';
      w.textContent = why;
      card.appendChild(w);
    }
    card.addEventListener('click', () => {
      previewChord(chord);
      addToProgression(chord);
      card.classList.add('played');
      setTimeout(() => card.classList.remove('played'), 550);
    });
    return card;
  }

  function renderChordCards() {
    const row = $('#chords');
    row.innerHTML = '';
    for (const chord of Theory.diatonicChords(state.key)) row.appendChild(cardEl(chord));
  }

  function renderSuggestions() {
    const row = $('#suggestions');
    row.innerHTML = '';
    const picks = Suggest.suggest(state.key, currentChords(), state.adventurous);
    for (const p of picks) row.appendChild(cardEl(p.chord, p.why, p.adventurous));
    $('#suggest-hint').textContent = state.progression.length
      ? 'Given your progression so far:'
      : 'Good places to start:';
  }

  // ---------- progression timeline ---------------------------------------------
  const currentChords = () =>
    state.progression.map(d => Theory.chordFromDescriptor(state.key, d));

  function addToProgression(chord) {
    state.progression.push({ rootOffset: chord.rootOffset, quality: chord.quality });
    renderTimeline();
    renderSuggestions();
  }

  function removeAt(ix) {
    state.progression.splice(ix, 1);
    if (!state.progression.length) stopPlayback();
    renderTimeline();
    renderSuggestions();
  }

  function moveChip(from, to) {
    if (from === to) return;
    const [d] = state.progression.splice(from, 1);
    state.progression.splice(to, 0, d);
    renderTimeline();
    renderSuggestions();
  }

  let dragIx = null;

  function renderTimeline() {
    const row = $('#timeline');
    row.innerHTML = '';
    const chords = currentChords();
    if (!chords.length) {
      const empty = document.createElement('span');
      empty.className = 'timeline-empty';
      empty.textContent = 'Click chords above to build a progression';
      row.appendChild(empty);
    }
    chords.forEach((chord, ix) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      chip.draggable = true;
      chip.dataset.ix = ix;
      chip.title = 'Drag to reorder · click to remove';
      chip.innerHTML = `<span class="chip-roman">${chord.roman}</span>` +
                       `<span class="chip-symbol">${chord.symbol}</span>` +
                       `<span class="chip-x" aria-hidden="true">×</span>`;
      chip.addEventListener('click', () => removeAt(ix));
      chip.addEventListener('dragstart', e => {
        dragIx = ix;
        chip.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(ix));
      });
      chip.addEventListener('dragend', () => { dragIx = null; chip.classList.remove('dragging'); });
      chip.addEventListener('dragover', e => { e.preventDefault(); chip.classList.add('drag-over'); });
      chip.addEventListener('dragleave', () => chip.classList.remove('drag-over'));
      chip.addEventListener('drop', e => {
        e.preventDefault();
        chip.classList.remove('drag-over');
        if (dragIx !== null) moveChip(dragIx, ix);
      });
      row.appendChild(chip);
    });
    $('#btn-play').disabled = !chords.length;
    $('#btn-export').disabled = !chords.length;
    $('#btn-clear').disabled = !chords.length;
  }

  function setActiveChip(ix) {
    document.querySelectorAll('#timeline .chip').forEach(c =>
      c.classList.toggle('active', +c.dataset.ix === ix));
  }

  // ---------- playback (lookahead scheduler, loops the progression) ------------
  let schedTimer = null, nextTime = 0, stepIx = 0;

  function schedule() {
    if (!state.progression.length) { stopPlayback(); return; }
    const secPerBeat = 60 / state.bpm;
    const chordDur = BEATS_PER_CHORD * secPerBeat;
    while (nextTime < Synth.now() + 0.18) {
      const ix = stepIx % state.progression.length;
      const chord = Theory.chordFromDescriptor(state.key, state.progression[ix]);
      Synth.playChord(chord.midi, nextTime, chordDur * 0.95);
      if (state.metronome)
        for (let b = 0; b < BEATS_PER_CHORD; b++)
          Synth.click(nextTime + b * secPerBeat, b === 0 && ix === 0);
      const at = nextTime;
      setTimeout(() => {
        if (!state.playing) return;
        setActiveChip(ix);
        showChord(chord, true);
      }, Math.max(0, (at - Synth.now()) * 1000));
      nextTime += chordDur;
      stepIx++;
    }
  }

  function startPlayback() {
    if (!state.progression.length) return;
    Synth.ensure();
    state.playing = true;
    stepIx = 0;
    nextTime = Synth.now() + 0.1;
    schedule();
    schedTimer = setInterval(schedule, 40);
    $('#btn-play').textContent = '◼ Stop';
    $('#btn-play').classList.add('playing');
  }

  function stopPlayback() {
    if (!state.playing && !schedTimer) return;
    state.playing = false;
    clearInterval(schedTimer);
    schedTimer = null;
    setActiveChip(-1);
    piano.clear();
    fretboard.clear();
    const btn = $('#btn-play');
    btn.textContent = '▶ Play';
    btn.classList.remove('playing');
  }

  // ---------- export ------------------------------------------------------------
  function exportMidi() {
    const chords = currentChords();
    if (!chords.length) return;
    const safe = state.key.name.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/\s+/g, '-');
    MidiExport.download(chords, {
      bpm: state.bpm,
      beatsPerChord: BEATS_PER_CHORD,
      filename: `progression-${safe}`,
      name: `${state.key.name} progression`,
    });
  }

  // ---------- theme ---------------------------------------------------------------
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('mcpe-theme', theme); } catch (e) { /* private mode */ }
    $('#btn-theme').textContent = theme === 'dark' ? '☀' : '☾';
  }

  // ---------- init -----------------------------------------------------------------
  function init() {
    let theme = 'dark';
    try { theme = localStorage.getItem('mcpe-theme') || 'dark'; } catch (e) { /* ignore */ }
    setTheme(theme);
    $('#btn-theme').addEventListener('click', () =>
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

    piano = Piano.create($('#piano'), midi => Synth.playNote(midi));
    fretboard = Fretboard.create($('#fretboard'));

    renderModeSelect();
    renderTonics();
    setKey();

    $('#btn-play').addEventListener('click', () =>
      state.playing ? stopPlayback() : startPlayback());
    $('#btn-clear').addEventListener('click', () => {
      stopPlayback();
      state.progression = [];
      renderTimeline();
      renderSuggestions();
    });
    $('#btn-export').addEventListener('click', exportMidi);

    const bpm = $('#bpm');
    bpm.value = state.bpm;
    bpm.addEventListener('change', () => {
      state.bpm = Math.min(220, Math.max(40, +bpm.value || 100));
      bpm.value = state.bpm;
    });
    $('#metronome').checked = state.metronome;
    $('#metronome').addEventListener('change', e => { state.metronome = e.target.checked; });
    $('#adventurous').addEventListener('change', e => {
      state.adventurous = e.target.checked;
      renderSuggestions();
    });

    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && !/INPUT|SELECT|BUTTON/.test(e.target.tagName)) {
        e.preventDefault();
        state.playing ? stopPlayback() : startPlayback();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
