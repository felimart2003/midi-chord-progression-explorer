'use strict';
/* fretboard.js — minimal line-art SVG guitar fretboard (standard tuning,
   12 frets). Highlights every position matching the chord's pitch classes;
   roots get a filled dot, other tones an outlined dot. Exposes `Fretboard`. */
const Fretboard = (() => {
  // Standard tuning, low → high; drawn with the low E at the bottom.
  const STRINGS = [
    { name: 'E', midi: 40 },
    { name: 'A', midi: 45 },
    { name: 'D', midi: 50 },
    { name: 'G', midi: 55 },
    { name: 'B', midi: 59 },
    { name: 'E', midi: 64 },
  ];
  const FRETS = 12;
  const MARKERS = [3, 5, 7, 9, 12];

  function create(container) {
    const NS = 'http://www.w3.org/2000/svg';
    const fretW = 58, stringGap = 17, left = 34, top = 16;
    const W = left + FRETS * fretW + 14;
    const H = top + (STRINGS.length - 1) * stringGap + 30;

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'fret-svg');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const line = (x1, y1, x2, y2, cls) => {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.setAttribute('class', cls);
      svg.appendChild(l);
      return l;
    };
    const yFor = si => top + (STRINGS.length - 1 - si) * stringGap;

    // Nut + frets.
    line(left, top - 4, left, yFor(0) + 4, 'fb-nut');
    for (let f = 1; f <= FRETS; f++)
      line(left + f * fretW, top - 2, left + f * fretW, yFor(0) + 2, 'fb-fret');
    // Strings.
    STRINGS.forEach((st, si) => {
      line(left, yFor(si), left + FRETS * fretW, yFor(si), 'fb-string');
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', left - 12); t.setAttribute('y', yFor(si) + 3.5);
      t.setAttribute('class', 'fb-label');
      t.textContent = st.name;
      svg.appendChild(t);
    });
    // Fret markers + numbers below.
    for (const f of MARKERS) {
      const cx = left + (f - 0.5) * fretW;
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x', cx); t.setAttribute('y', H - 6);
      t.setAttribute('class', 'fb-marker-num');
      t.textContent = f;
      svg.appendChild(t);
    }

    // Pre-create a dot for every string/fret position (0 = open string).
    const dots = []; // { el, pc }
    STRINGS.forEach((st, si) => {
      for (let f = 0; f <= FRETS; f++) {
        const cx = f === 0 ? left - 0.5 : left + (f - 0.5) * fretW;
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('cx', cx); c.setAttribute('cy', yFor(si));
        c.setAttribute('r', f === 0 ? 4.5 : 6);
        c.setAttribute('class', 'fb-dot');
        c.style.display = 'none';
        svg.appendChild(c);
        dots.push({ el: c, pc: (st.midi + f) % 12 });
      }
    });

    container.appendChild(svg);

    let shown = [];
    function clear() {
      for (const d of shown) {
        d.el.style.display = 'none';
        d.el.classList.remove('root', 'pulse');
      }
      shown = [];
    }
    function show(pcs, rootPc, pulsing) {
      clear();
      const set = new Set(pcs);
      for (const d of dots) {
        if (!set.has(d.pc)) continue;
        d.el.style.display = '';
        if (d.pc === rootPc) d.el.classList.add('root');
        if (pulsing) d.el.classList.add('pulse');
        shown.push(d);
      }
    }
    return {
      highlight: (pcs, rootPc) => show(pcs, rootPc, false),
      pulse: (pcs, rootPc) => show(pcs, rootPc, true),
      clear,
    };
  }

  return { create };
})();
