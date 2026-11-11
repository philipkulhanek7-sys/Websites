(() => {
  'use strict';

  // ---------- Hilfsfunktionen ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ---------- Generator ----------
  const SIZE = 6;            // maximale Rastergröße (Mini-Format)
  const MIN_WORDS = 6;
  const POOL = window.XWORT_WORDS.filter(w => /^[A-Z]+$/.test(w.a) && w.a.length >= 3 && w.a.length <= SIZE);

  function tryLayout(rnd) {
    const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    const used = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ({ A: false, D: false })));
    const placed = [];
    const at = (r, c) => (r < 0 || c < 0 || r >= SIZE || c >= SIZE) ? null : g[r][c];

    function check(word, r, c, dir) {
      const dr = dir === 'D' ? 1 : 0, dc = dir === 'A' ? 1 : 0;
      const er = r + dr * (word.length - 1), ec = c + dc * (word.length - 1);
      if (r < 0 || c < 0 || er >= SIZE || ec >= SIZE) return -1;
      if (at(r - dr, c - dc) || at(er + dr, ec + dc)) return -1;
      let cross = 0;
      for (let i = 0; i < word.length; i++) {
        const rr = r + dr * i, cc = c + dc * i, ch = g[rr][cc];
        if (ch) {
          if (ch !== word[i] || used[rr][cc][dir]) return -1;
          cross++;
        } else if (at(rr + dc, cc + dr) || at(rr - dc, cc - dr)) return -1;
      }
      if (cross === word.length) return -1;
      return cross;
    }
    function put(w, r, c, dir) {
      const dr = dir === 'D' ? 1 : 0, dc = dir === 'A' ? 1 : 0;
      for (let i = 0; i < w.a.length; i++) { g[r + dr * i][c + dc * i] = w.a[i]; used[r + dr * i][c + dc * i][dir] = true; }
      placed.push({ a: w.a, clue: w.c, r, c, dir });
    }

    const pool = POOL.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }

    // erstes Wort: lang, waagerecht oder senkrecht
    const firstIdx = pool.findIndex(w => w.a.length >= SIZE - 1);
    const first = pool.splice(firstIdx, 1)[0];
    const fdir = rnd() < 0.5 ? 'A' : 'D';
    const off = Math.floor(rnd() * (SIZE - first.a.length + 1));
    const line = Math.floor(rnd() * SIZE);
    fdir === 'A' ? put(first, line, off, 'A') : put(first, off, line, 'D');

    const answers = new Set([first.a]);
    for (const w of pool) {
      if (placed.length >= 10) break;
      if (answers.has(w.a)) continue;
      const cands = [];
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (!g[r][c]) continue;
        for (let i = 0; i < w.a.length; i++) {
          if (w.a[i] !== g[r][c]) continue;
          for (const dir of ['A', 'D']) {
            const sr = dir === 'D' ? r - i : r, sc = dir === 'A' ? c - i : c;
            const x = check(w.a, sr, sc, dir);
            if (x > 0) cands.push({ r: sr, c: sc, dir, x });
          }
        }
      }
      if (!cands.length) continue;
      const best = Math.max(...cands.map(k => k.x));
      const top = cands.filter(k => k.x === best);
      const k = top[Math.floor(rnd() * top.length)];
      put(w, k.r, k.c, k.dir);
      answers.add(w.a);
    }
    let filled = 0; g.forEach(row => row.forEach(ch => ch && filled++));
    return { g, placed, filled };
  }

  function generate(seed) {
    const rnd = mulberry32(seed);
    let best = null;
    for (let t = 0; t < 40; t++) {
      const L = tryLayout(rnd);
      const hasA = L.placed.some(p => p.dir === 'A'), hasD = L.placed.some(p => p.dir === 'D');
      if (!hasA || !hasD) continue;
      const score = L.filled * 2 + L.placed.length * 3;
      if (!best || score > best.score) best = { ...L, score };
      if (best.placed.length >= 9 && best.filled >= 24) break;
    }
    // auf belegten Bereich zuschneiden
    let r0 = SIZE, r1 = -1, c0 = SIZE, c1 = -1;
    best.g.forEach((row, r) => row.forEach((ch, c) => { if (ch) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); } }));
    const rows = r1 - r0 + 1, cols = c1 - c0 + 1;
    const sol = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => best.g[r + r0][c + c0]));
    const words = best.placed.map(p => ({ ...p, r: p.r - r0, c: p.c - c0 }));
    // Nummerierung in Leserichtung
    const starts = {}; let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (words.some(w => w.r === r && w.c === c)) starts[`${r},${c}`] = ++n;
    }
    words.forEach(w => { w.num = starts[`${w.r},${w.c}`]; w.cells = Array.from({ length: w.a.length }, (_, i) => w.dir === 'A' ? [w.r, w.c + i] : [w.r + i, w.c]); });
    words.sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === 'A' ? -1 : 1));
    return { seed, rows, cols, sol, words, starts, good: best.placed.length >= MIN_WORDS };
  }

  function newSeed() {
    // Rätsel mit zu wenigen Wörtern überspringen
    for (;;) {
      const s = Math.floor(Math.random() * 999999) + 1;
      if (generate(s).good) return s;
    }
  }

  // ---------- Spielzustand ----------
  let P, entry, marks, cur, dir, seconds, timerId, finished, helped;
  const gridEl = $('grid');

  function wordAt(r, c, d) { return P.words.find(w => w.dir === d && w.cells.some(([rr, cc]) => rr === r && cc === c)); }
  function curWord() { return wordAt(cur[0], cur[1], dir) || wordAt(cur[0], cur[1], dir === 'A' ? 'D' : 'A'); }

  function load(seed) {
    P = generate(seed);
    const saved = store.get('xwu-current', null);
    if (saved && saved.seed === seed) {
      entry = saved.entry; marks = saved.marks; seconds = saved.seconds; finished = saved.finished; helped = saved.helped;
    } else {
      entry = P.sol.map(row => row.map(() => ''));
      marks = P.sol.map(row => row.map(() => ''));
      seconds = 0; finished = false; helped = false;
    }
    const w0 = P.words[0];
    cur = [w0.r, w0.c]; dir = w0.dir;
    history.replaceState(null, '', `?p=${seed}`);
    $('pid').textContent = `Rätsel #${seed}`;
    buildGrid(); buildLists(); render(); startTimer();
    if (finished) render();
  }

  function save() { store.set('xwu-current', { seed: P.seed, entry, marks, seconds, finished, helped }); }

  function buildGrid() {
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `repeat(${P.cols}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${P.rows}, 1fr)`;
    gridEl.style.setProperty('--ar', `${P.cols} / ${P.rows}`);
    for (let r = 0; r < P.rows; r++) for (let c = 0; c < P.cols; c++) {
      const d = document.createElement('div');
      d.className = 'cell' + (P.sol[r][c] ? '' : ' block');
      d.dataset.r = r; d.dataset.c = c;
      if (P.sol[r][c]) {
        const num = P.starts[`${r},${c}`];
        d.innerHTML = (num ? `<span class="num">${num}</span>` : '') + '<span class="ch"></span>';
        d.addEventListener('click', () => {
          if (cur[0] === r && cur[1] === c) toggleDir();
          else { cur = [r, c]; if (!wordAt(r, c, dir)) dir = dir === 'A' ? 'D' : 'A'; }
          render();
        });
      }
      gridEl.appendChild(d);
    }
  }

  function buildLists() {
    for (const [d, el] of [['A', $('listA')], ['D', $('listD')]]) {
      el.innerHTML = '';
      P.words.filter(w => w.dir === d).forEach(w => {
        const li = document.createElement('li');
        li.innerHTML = `<b>${w.num}</b><span></span>`;
        li.querySelector('span').textContent = w.clue;
        li.addEventListener('click', () => { focusWord(w); });
        w.li = li; el.appendChild(li);
      });
    }
  }

  function focusWord(w) {
    dir = w.dir;
    const empty = w.cells.find(([r, c]) => !entry[r][c]);
    cur = (empty || w.cells[0]).slice();
    render();
  }

  function render() {
    const w = curWord();
    const inWord = new Set(w ? w.cells.map(([r, c]) => `${r},${c}`) : []);
    [...gridEl.children].forEach(el => {
      const r = +el.dataset.r, c = +el.dataset.c;
      if (!P.sol[r][c]) return;
      el.querySelector('.ch').textContent = entry[r][c];
      el.classList.toggle('word', !finished && inWord.has(`${r},${c}`));
      el.classList.toggle('cur', !finished && cur[0] === r && cur[1] === c);
      el.classList.toggle('wrong', marks[r][c] === 'wrong' && entry[r][c] !== '');
      el.classList.toggle('revealed', marks[r][c] === 'rev');
      el.classList.toggle('solved', finished);
    });
    P.words.forEach(x => {
      x.li.classList.toggle('active', x === w);
      x.li.classList.toggle('done', x.cells.every(([r, c]) => entry[r][c]));
    });
    if (w) $('clueNow').innerHTML = `<b>${w.num}${w.dir === 'A' ? 'W' : 'S'}</b><span></span>`, $('clueNow').querySelector('span').textContent = w.clue;
    $('timer').textContent = fmt(seconds);
  }

  function toggleDir() { const o = dir === 'A' ? 'D' : 'A'; if (wordAt(cur[0], cur[1], o)) dir = o; }

  function step(delta) {
    const w = curWord(); if (!w) return;
    const i = w.cells.findIndex(([r, c]) => r === cur[0] && c === cur[1]);
    const j = i + delta;
    if (j >= 0 && j < w.cells.length) cur = w.cells[j].slice();
  }

  function nextWord(delta) {
    const w = curWord();
    let i = P.words.indexOf(w);
    for (let k = 0; k < P.words.length; k++) {
      i = (i + delta + P.words.length) % P.words.length;
      const x = P.words[i];
      if (delta < 0 || x.cells.some(([r, c]) => !entry[r][c]) || k === P.words.length - 1) { focusWord(x); return; }
    }
  }

  function type(ch) {
    if (finished) return;
    const [r, c] = cur;
    entry[r][c] = ch; if (marks[r][c] === 'wrong') marks[r][c] = '';
    const w = curWord();
    const i = w.cells.findIndex(([rr, cc]) => rr === r && cc === c);
    // zum nächsten leeren Feld im Wort, sonst nächstes Wort
    const nextEmpty = w.cells.slice(i + 1).find(([rr, cc]) => !entry[rr][cc]);
    if (nextEmpty) cur = nextEmpty.slice();
    else if (w.cells.every(([rr, cc]) => entry[rr][cc])) { if (!isSolved() && !isFull()) nextWord(1); else step(1); }
    else step(1);
    afterChange();
  }

  function backspace() {
    if (finished) return;
    const [r, c] = cur;
    if (entry[r][c] && marks[r][c] !== 'rev') entry[r][c] = '';
    else { step(-1); const [r2, c2] = cur; if (marks[r2][c2] !== 'rev') entry[r2][c2] = ''; }
    marks[cur[0]][cur[1]] = marks[cur[0]][cur[1]] === 'rev' ? 'rev' : '';
    afterChange();
  }

  function move(dr, dc) {
    const want = dr ? 'D' : 'A';
    if (dir !== want && wordAt(cur[0], cur[1], want)) { dir = want; render(); return; }
    let r = cur[0] + dr, c = cur[1] + dc;
    while (r >= 0 && c >= 0 && r < P.rows && c < P.cols) {
      if (P.sol[r][c]) { cur = [r, c]; if (!wordAt(r, c, dir)) toggleDir(); break; }
      r += dr; c += dc;
    }
    render();
  }

  function isSolved() { return P.sol.every((row, r) => row.every((ch, c) => !ch || entry[r][c] === ch)); }
  function isFull() { return P.sol.every((row, r) => row.every((ch, c) => !ch || entry[r][c])); }

  function afterChange() {
    if (isSolved()) win();
    else if (isFull()) toast('Noch nicht ganz richtig …');
    render(); save();
  }

  // ---------- Timer ----------
  function startTimer() {
    clearInterval(timerId);
    timerId = setInterval(() => {
      if (finished || document.hidden || document.querySelector('.modal.open')) return;
      seconds++; $('timer').textContent = fmt(seconds);
      if (seconds % 5 === 0) save();
    }, 1000);
  }

  // ---------- Statistik ----------
  function stats() { return store.get('xwu-stats', { played: 0, clean: 0, best: null, total: 0, streak: 0, maxStreak: 0, solved: [] }); }
  function statsHTML(s) {
    const avg = s.played ? fmt(Math.round(s.total / s.played)) : '–';
    return `<div><b>${s.played}</b><span>Gelöst</span></div>
            <div><b>${s.best != null ? fmt(s.best) : '–'}</b><span>Bestzeit</span></div>
            <div><b>${avg}</b><span>Ø Zeit</span></div>
            <div><b>${s.streak}</b><span>Serie ohne Hilfe</span></div>`;
  }

  function win() {
    if (finished) return;
    finished = true;
    const s = stats();
    if (!s.solved.includes(P.seed)) {
      s.solved.push(P.seed); if (s.solved.length > 500) s.solved.shift();
      s.played++; s.total += seconds;
      if (!helped) { s.clean++; s.streak++; s.maxStreak = Math.max(s.maxStreak, s.streak); if (s.best == null || seconds < s.best) s.best = seconds; }
      else s.streak = 0;
      store.set('xwu-stats', s);
    }
    $('winTitle').textContent = helped ? 'Gelöst ✔' : 'Geschafft! 🎉';
    $('winText').textContent = helped ? `Mit Hilfe gelöst in ${fmt(seconds)}.` : `Du hast das Rätsel in ${fmt(seconds)} gelöst!`;
    $('winStats').innerHTML = statsHTML(s);
    save(); render();
    setTimeout(() => open('mWin'), 350);
  }

  // ---------- Hilfen ----------
  function check() {
    let wrong = 0;
    P.sol.forEach((row, r) => row.forEach((ch, c) => { if (ch && entry[r][c] && entry[r][c] !== ch) { marks[r][c] = 'wrong'; wrong++; } }));
    helped = true;
    toast(wrong ? `${wrong} falsche${wrong === 1 ? 'r' : ''} Buchstabe${wrong === 1 ? '' : 'n'}` : 'Bisher alles richtig!');
    render(); save();
  }
  function reveal(cells) {
    if (finished) return;
    cells.forEach(([r, c]) => { if (entry[r][c] !== P.sol[r][c]) { entry[r][c] = P.sol[r][c]; marks[r][c] = 'rev'; } });
    helped = true; afterChange();
  }

  // ---------- UI ----------
  function open(id) { $(id).classList.add('open'); }
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
    if (e.target === m || e.target.hasAttribute('data-close')) m.classList.remove('open');
  }));
  function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 1600); }

  function newPuzzle() { document.querySelectorAll('.modal').forEach(m => m.classList.remove('open')); load(newSeed()); }

  $('btnNew').onclick = () => {
    if (!finished && entry.some(row => row.some(Boolean)) && !confirm('Neues Rätsel starten? Der aktuelle Fortschritt geht verloren.')) return;
    newPuzzle();
  };
  $('btnNext').onclick = newPuzzle;
  $('btnCheck').onclick = check;
  $('btnReveal').onclick = () => { const w = curWord(); if (w) reveal(w.cells); };
  $('btnSolve').onclick = () => { if (confirm('Ganzes Rätsel aufdecken?')) reveal(P.words.flatMap(w => w.cells)); };
  $('btnStats').onclick = () => { $('statsBox').innerHTML = statsHTML(stats()); open('mStats'); };
  $('btnHelp').onclick = () => open('mHelp');
  $('prevClue').onclick = () => nextWord(-1);
  $('nextClue').onclick = () => nextWord(1);
  $('clueNow').onclick = () => { toggleDir(); render(); };
  $('btnShare').onclick = async () => {
    const text = `XWORT Unlimited #${P.seed}\n${helped ? 'Mit Hilfe gelöst' : 'Gelöst'} in ${fmt(seconds)} ⏱️\n${location.origin}${location.pathname}?p=${P.seed}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert'); }
    } catch {}
  };

  // Bildschirmtastatur (QWERTZ)
  const rows = ['QWERTZUIOP', 'ASDFGHJKL', '⌫YXCVBNM↹'];
  const kb = $('kb');
  rows.forEach(line => {
    const row = document.createElement('div'); row.className = 'row';
    [...line].forEach(k => {
      const b = document.createElement('button');
      b.textContent = k === '↹' ? '⇄' : k;
      if (k === '⌫' || k === '↹') b.className = 'wide';
      b.addEventListener('click', () => {
        if (k === '⌫') backspace();
        else if (k === '↹') { toggleDir(); render(); }
        else type(k);
      });
      row.appendChild(b);
    });
    kb.appendChild(row);
  });

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('.modal.open')) { if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.classList.remove('open')); return; }
    const k = e.key;
    const map = { 'ä': 'AE', 'ö': 'OE', 'ü': 'UE', 'ß': 'SS', 'Ä': 'AE', 'Ö': 'OE', 'Ü': 'UE' };
    if (/^[a-zA-Z]$/.test(k)) { type(k.toUpperCase()); e.preventDefault(); }
    else if (map[k]) { [...map[k]].forEach(type); e.preventDefault(); }
    else if (k === 'Backspace' || k === 'Delete') { backspace(); e.preventDefault(); }
    else if (k === 'ArrowLeft') { move(0, -1); e.preventDefault(); }
    else if (k === 'ArrowRight') { move(0, 1); e.preventDefault(); }
    else if (k === 'ArrowUp') { move(-1, 0); e.preventDefault(); }
    else if (k === 'ArrowDown') { move(1, 0); e.preventDefault(); }
    else if (k === ' ') { toggleDir(); render(); e.preventDefault(); }
    else if (k === 'Tab' || k === 'Enter') { nextWord(e.shiftKey ? -1 : 1); e.preventDefault(); }
  });

  // Start
  const q = parseInt(new URLSearchParams(location.search).get('p'), 10);
  const last = store.get('xwu-current', null);
  const startSeed = q > 0 ? q : (last && !last.finished ? last.seed : newSeed());
  load(startSeed);
  if (!store.get('xwu-seen-help', false)) { open('mHelp'); store.set('xwu-seen-help', true); }
})();
