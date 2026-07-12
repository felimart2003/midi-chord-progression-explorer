'use strict';
/* piano.js — minimal line-art SVG keyboard, C2–B5 (matches chord voicings).
   Exposes `Piano`. create(container, onKeyClick) → { highlight, pulse, clear } */
const Piano = (() => {
  const LOW = 36;  // C2
  const HIGH = 83; // B5
  const BLACK = new Set([1, 3, 6, 8, 10]);
  const WHITE_INDEX = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

  function create(container, onKeyClick) {
    const whiteW = 26, whiteH = 118, blackW = 15, blackH = 72;
    let whiteCount = 0;
    for (let m = LOW; m <= HIGH; m++) if (!BLACK.has(m % 12)) whiteCount++;
    const W = whiteCount * whiteW + 2, H = whiteH + 2;

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'piano-svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const keyEls = new Map();
    const whites = [], blacks = [];
    let wx = 1;

    for (let m = LOW; m <= HIGH; m++) {
      const pc = m % 12;
      if (!BLACK.has(pc)) {
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', wx); r.setAttribute('y', 1);
        r.setAttribute('width', whiteW); r.setAttribute('height', whiteH);
        r.setAttribute('rx', 2.5);
        r.setAttribute('class', 'pk-white');
        r.dataset.midi = m;
        whites.push(r);
        keyEls.set(m, r);
        if (pc === 0) {
          const label = document.createElementNS(NS, 'text');
          label.setAttribute('x', wx + whiteW / 2);
          label.setAttribute('y', whiteH - 7);
          label.setAttribute('class', 'pk-label');
          label.textContent = 'C' + (Math.floor(m / 12) - 1);
          blacks.push(label); // draw above whites, below nothing else
        }
        wx += whiteW;
      } else {
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', wx - blackW / 2);
        r.setAttribute('y', 1);
        r.setAttribute('width', blackW); r.setAttribute('height', blackH);
        r.setAttribute('rx', 2);
        r.setAttribute('class', 'pk-black');
        r.dataset.midi = m;
        blacks.push(r);
        keyEls.set(m, r);
      }
    }
    whites.forEach(el => svg.appendChild(el));
    blacks.forEach(el => svg.appendChild(el));

    svg.addEventListener('pointerdown', e => {
      const midi = e.target && e.target.dataset && e.target.dataset.midi;
      if (midi && onKeyClick) onKeyClick(+midi);
    });

    container.appendChild(svg);

    let lit = [];
    function clear() {
      for (const el of lit) el.classList.remove('lit', 'pulse');
      lit = [];
    }
    // Steady highlight (chord selected) — accent fill, no animation.
    function highlight(midiNotes) {
      clear();
      for (const m of midiNotes) {
        const el = keyEls.get(m);
        if (el) { el.classList.add('lit'); lit.push(el); }
      }
    }
    // Playing state — accent fill plus soft animated pulse.
    function pulse(midiNotes) {
      clear();
      for (const m of midiNotes) {
        const el = keyEls.get(m);
        if (el) { el.classList.add('lit', 'pulse'); lit.push(el); }
      }
    }
    return { highlight, pulse, clear };
  }

  return { create, LOW, HIGH };
})();
