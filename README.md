# Chordfolio — chord progression explorer

**[Live demo](https://felimart2003.github.io/midi-chord-progression-explorer/)** · [Source](https://github.com/felimart2003/midi-chord-progression-explorer)

A zero-signup web tool for exploring chord progressions: pick a key, click
diatonic chords to hear them and build a progression, get harmonically sensible
"next chord" suggestions, loop the result with a metronome, and export it as a
standard MIDI file you can drag straight into a DAW.

Everything is vanilla HTML/CSS/JS with the Web Audio API — no build step, no
dependencies, no server code.

## Run it

Just open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).
It works straight from `file://`.

If you prefer a local server (or want to share it on your LAN):

```
# any of these, from the project folder:
npx serve .
python -m http.server 8000
```

then visit `http://localhost:8000`.

> Browsers require a user gesture before audio can start — the first chord you
> click unlocks the synth.

## Using it

- **Key selector (top):** all 12 tonics plus a mode dropdown — Major, Minor,
  and the five other diatonic modes (Dorian, Phrygian, Lydian, Mixolydian,
  Locrian). Key names are spelled correctly per key (F♯ major gets E♯,
  E♭ minor gets C♭).
- **Diatonic chord cards:** the seven chords of the key (I, ii, iii, IV, V, vi,
  vii°). Clicking a card plays it through a warm Rhodes-style Web Audio synth
  (sine fundamental + octave partial + fast-decaying "tine" transient, filtered
  and compressed — not a bare sine) and appends it to the timeline.
- **Suggest next chord:** 3–4 statistically/harmonically sensible follow-ups to
  your progression, each with a one-line reason ("V→I: strong resolution",
  "vi→IV: pop staple"). Scores combine curated transition tables for major and
  minor, root-motion heuristics for the other modes, and a common-tone
  voice-leading bonus. Toggle **adventurous mode** to surface modal interchange
  (borrowed iv, ♭VI, ♭VII, Neapolitan ♭II, Picardy) and secondary dominants
  (V/V, V/vi, V/ii, V/IV) — and once a secondary dominant is in the timeline,
  the top suggestion resolves it down a fifth.
- **Fretboard & keyboard:** minimal line-art SVG instruments. They highlight
  the current chord's notes in the single accent color — a soft animated pulse
  while a chord is actually sounding, steady when merely selected. Piano keys
  are clickable to audition single notes; the fretboard shows every position of
  the chord's pitch classes over 12 frets (standard tuning), roots as filled
  dots.
- **Timeline (bottom bar):** your progression as chips. Drag to reorder, click
  a chip to remove it, **▶ Play** (or space bar) to loop the whole progression
  — two beats per chord — with an optional metronome click. BPM is adjustable
  (40–220). The progression is stored key-relative, so switching key or mode
  transposes it instantly.
- **Export MIDI:** downloads a format-0 `.mid` file (480 tpq, tempo + time
  signature embedded, Electric Piano program, root-position voicings with the
  root doubled an octave below) — drag it into Ableton/Logic/FL/Reaper as-is.
- **Theme:** dark by default; the ☀/☾ button toggles light mode (persisted in
  `localStorage`).

## Project layout

```
index.html          page shell
css/style.css       editorial line-art styling, dark/light themes, accent color
js/theory.js        keys, modes, correct spelling, diatonic chords, voicings
js/audio.js         Web Audio Rhodes-ish synth + metronome click
js/suggest.js       next-chord suggestion engine (+ adventurous mode)
js/midi.js          Standard MIDI File writer + download
js/piano.js         SVG keyboard (C2–B5) with highlight/pulse states
js/fretboard.js     SVG guitar fretboard (12 frets, standard tuning)
js/app.js           state, playback scheduler, timeline, wiring
test/smoke.js       logic tests (theory, suggestions, MIDI bytes)
test/instruments.html  visual render check for the SVG instruments
```

## Tests

Logic tests run in Node (no browser needed):

```
node test/smoke.js
```

They cover key spelling edge cases, diatonic chord qualities and roman
numerals across modes, voicing ranges, key-relative transposition, suggestion
behavior (resolution, no-repeat, adventurous picks, secondary-dominant
targets), and the binary layout of the exported MIDI file.

`test/instruments.html` renders the fretboard and keyboard with a highlighted
chord for a quick visual check.

## Notes on the audio scheduling

Playback uses a look-ahead scheduler: a 40 ms interval schedules chords ~180 ms
ahead on the AudioContext clock, so looping stays sample-accurate regardless of
UI jank; DOM highlights are synced separately with `setTimeout` against the
audio clock.

## Persistence and accessibility

Progressions, key, mode, and tempo save automatically in this browser. Up to 64 chords can be arranged. Invalid saved state is ignored safely. Timeline chips are keyboard buttons: Enter removes a chord, Alt + Left/Right moves it. Focus rings and reduced-motion preferences are supported. Stop cancels sounding and scheduled voices; playback also stops when the page is hidden.

## Deployment

GitHub Actions runs the musical logic regression suite and deploys only `index.html`, `css/`, and `js/` to **GitHub Pages**. No API keys, dependencies, or environment variables are required. Push to `main` to redeploy.

The app uses Web Audio synthesis, SVG instrument views, a hand-written Standard MIDI File encoder, and key-relative chord descriptors. Audio requires a user gesture. MIDI export is a file download, not a connection to physical MIDI hardware. Browser storage is local to this device.
