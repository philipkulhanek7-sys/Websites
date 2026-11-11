(() => {
  'use strict';
  const DATA = window.XWORT_DATA;
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* egal */ } },
  };
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ---------- Rätsel aufbereiten ----------
  function parse(idx) {
    const rows = DATA.puzzles[idx];
    const R = rows.length, C = rows[0].length;
    const sol = rows.map(r => [...r].map(ch => (ch === '#' ? null : ch)));
    const words = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (!sol[r][c]) continue;
      if ((c === 0 || !sol[r][c - 1]) && c + 1 < C && sol[r][c + 1]) {
        const cells = []; for (let k = c; k < C && sol[r][k]; k++) cells.push([r, k]);
        words.push({ dir: 'A', r, c, cells });
      }
      if ((r === 0 || !sol[r - 1][c]) && r + 1 < R && sol[r + 1][c]) {
        const cells = []; for (let k = r; k < R && sol[k][c]; k++) cells.push([k, c]);
        words.push({ dir: 'D', r, c, cells });
      }
    }
    const nums = {}; let n = 0;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (words.some(w => w.r === r && w.c === c)) nums[`${r},${c}`] = ++n;
    }
    words.forEach(w => {
      w.num = nums[`${w.r},${w.c}`];
      w.answer = w.cells.map(([r, c]) => sol[r][c]).join('');
      const info = DATA.clues[w.answer] || ['?', ''];
      w.clue = info[0]; w.expl = info[1];
    });
    words.sort((a, b) => (a.dir === b.dir ? a.num - b.num : a.dir === 'A' ? -1 : 1));
    return { idx, R, C, sol, words, nums };
  }

  // ---------- Zustand ----------
  let P, entry, marks, cur, dir, seconds, finished, helped, revealed;
  const gridEl = $('grid');

  const wordAt = (r, c, d) => P.words.find(w => w.dir === d && w.cells.some(([a, b]) => a === r && b === c));
  const curWord = () => wordAt(cur[0], cur[1], dir) || wordAt(cur[0], cur[1], dir === 'A' ? 'D' : 'A');
  const isSolved = () => P.sol.every((row, r) => row.every((ch, c) => !ch || entry[r][c] === ch));
  const isFull = () => P.sol.every((row, r) => row.every((ch, c) => !ch || entry[r][c]));

  function save() {
    store.set('xwg-cur', { idx: P.idx, entry, marks, seconds, finished, helped, revealed });
  }

  function pickNew() {
    const played = new Set(store.get('xwg-played', []));
    let pool = DATA.puzzles.map((_, i) => i).filter(i => !played.has(i) && (!P || i !== P.idx));
    if (!pool.length) { store.set('xwg-played', []); pool = DATA.puzzles.map((_, i) => i).filter(i => !P || i !== P.idx); }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function load(idx) {
    P = parse(idx);
    const s = store.get('xwg-cur', null);
    if (s && s.idx === idx && s.entry && s.entry.length === P.R) {
      ({ entry, marks, seconds, finished, helped } = s); revealed = s.revealed || [];
    } else {
      entry = P.sol.map(row => row.map(() => ''));
      marks = P.sol.map(row => row.map(() => ''));
      seconds = 0; finished = false; helped = false; revealed = [];
    }
    const w0 = P.words[0]; cur = [w0.r, w0.c]; dir = w0.dir;
    try { history.replaceState(null, '', `#r${idx + 1}`); } catch (e) { /* egal */ }
    $('pnr').textContent = `#${idx + 1}`;
    buildGrid(); render(); save();
  }

  function buildGrid() {
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `repeat(${P.C}, 1fr)`;
    gridEl.style.setProperty('--ar', `${P.C / P.R}`);
    for (let r = 0; r < P.R; r++) for (let c = 0; c < P.C; c++) {
      const d = document.createElement('div');
      d.className = 'cell' + (P.sol[r][c] ? '' : ' block');
      d.dataset.r = r; d.dataset.c = c;
      if (P.sol[r][c]) {
        const n = P.nums[`${r},${c}`];
        d.innerHTML = (n ? `<span class="n">${n}</span>` : '') + '<span class="ch"></span>';
        d.addEventListener('click', () => {
          if (cur[0] === r && cur[1] === c) toggleDir();
          else { cur = [r, c]; if (!wordAt(r, c, dir)) toggleDir(); }
          render();
        });
      }
      gridEl.appendChild(d);
    }
  }

  function render() {
    const w = curWord();
    const inW = new Set(w ? w.cells.map(x => x.join()) : []);
    for (const el of gridEl.children) {
      const r = +el.dataset.r, c = +el.dataset.c;
      if (!P.sol[r][c]) continue;
      el.querySelector('.ch').textContent = entry[r][c];
      const m = marks[r][c];
      el.classList.toggle('word', !finished && inW.has(`${r},${c}`));
      el.classList.toggle('cur', !finished && cur[0] === r && cur[1] === c);
      el.classList.toggle('ok', m === 'ok');
      el.classList.toggle('bad', m === 'bad');
      el.classList.toggle('rev', m === 'rev' && !finished);
      el.classList.toggle('won', finished);
    }
    if (w) {
      const clue = $('clue');
      clue.innerHTML = '<small></small><span></span>';
      clue.firstChild.textContent = `${w.num}${w.dir === 'A' ? '→' : '↓'}`;
      clue.lastChild.textContent = w.clue;
    }
    $('timer').textContent = fmt(seconds);
  }

  function toggleDir() { const o = dir === 'A' ? 'D' : 'A'; if (wordAt(cur[0], cur[1], o)) dir = o; }

  function focusWord(w) {
    dir = w.dir;
    const empty = w.cells.find(([r, c]) => !entry[r][c]);
    cur = (empty || w.cells[0]).slice();
    render();
  }

  function nextWord(delta) {
    const w = curWord();
    let i = P.words.indexOf(w);
    for (let k = 0; k < P.words.length; k++) {
      i = (i + delta + P.words.length) % P.words.length;
      const x = P.words[i];
      if (delta < 0 || isFull() || x.cells.some(([r, c]) => !entry[r][c])) { focusWord(x); return; }
    }
  }

  function type(ch) {
    if (finished) return;
    const [r, c] = cur;
    if (marks[r][c] !== 'rev') { entry[r][c] = ch; marks[r][c] = ''; }
    const w = curWord();
    const i = w.cells.findIndex(([a, b]) => a === r && b === c);
    const after = w.cells.slice(i + 1).find(([a, b]) => !entry[a][b]);
    const before = w.cells.slice(0, i).find(([a, b]) => !entry[a][b]);
    if (after) cur = after.slice();
    else if (before) cur = before.slice();
    else if (!isFull()) nextWord(1);
    else if (i + 1 < w.cells.length) cur = w.cells[i + 1].slice();
    afterChange();
  }

  function backspace() {
    if (finished) return;
    const [r, c] = cur;
    if (entry[r][c] && marks[r][c] !== 'rev') { entry[r][c] = ''; marks[r][c] = ''; }
    else {
      const w = curWord();
      const i = w.cells.findIndex(([a, b]) => a === r && b === c);
      if (i > 0) {
        cur = w.cells[i - 1].slice();
        const [a, b] = cur;
        if (marks[a][b] !== 'rev') { entry[a][b] = ''; marks[a][b] = ''; }
      }
    }
    render(); save();
  }

  function move(dr, dc) {
    const want = dr ? 'D' : 'A';
    if (dir !== want && wordAt(cur[0], cur[1], want)) { dir = want; render(); return; }
    let r = cur[0] + dr, c = cur[1] + dc;
    while (r >= 0 && c >= 0 && r < P.R && c < P.C) {
      if (P.sol[r][c]) { cur = [r, c]; break; }
      r += dr; c += dc;
    }
    render();
  }

  function afterChange() {
    if (isSolved()) win();
    else if (isFull()) toast('Noch nicht ganz richtig – tippe auf „Prüfen“');
    render(); save();
  }

  // ---------- Hilfen ----------
  function check() {
    if (finished) return;
    let bad = 0, any = 0;
    P.sol.forEach((row, r) => row.forEach((ch, c) => {
      if (!ch || !entry[r][c] || marks[r][c] === 'rev') return;
      any++;
      marks[r][c] = entry[r][c] === ch ? 'ok' : 'bad';
      if (marks[r][c] === 'bad') bad++;
    }));
    if (!any) { toast('Noch nichts eingetragen'); return; }
    helped = true;
    toast(bad ? `${bad} falsch` : 'Alles richtig bisher!');
    render(); save();
  }

  function explain(w, title) {
    $('sheetTag').textContent = title;
    $('sheetAnswer').textContent = w.answer;
    $('sheetClue').textContent = w.clue;
    $('sheetExpl').textContent = w.expl;
    $('sheetHintRow').hidden = true; $('sheetOk').hidden = false;
    open('sheet');
  }

  // Antwort im Erklärungstext verdecken (inkl. Umlaut-Schreibweise)
  function masked(text, answer) {
    const forms = new Set([answer, answer.replace(/AE/g, 'Ä').replace(/OE/g, 'Ö').replace(/UE/g, 'Ü'),
      answer.replace(/SS/g, 'ß'), answer.replace(/AE/g, 'Ä').replace(/OE/g, 'Ö').replace(/UE/g, 'Ü').replace(/SS/g, 'ß')]);
    const lower = text.toLowerCase();
    const isL = ch => !!ch && /\p{L}/u.test(ch);
    const hits = [];
    [...forms].sort((x, y) => y.length - x.length).forEach(f => {
      const fl = f.toLowerCase();
      for (let i = lower.indexOf(fl); i >= 0; i = lower.indexOf(fl, i + 1)) {
        const edge = !isL(text[i - 1]) || !isL(text[i + f.length]);
        if (answer.length > 3 || edge) hits.push([i, i + f.length]);
      }
    });
    hits.sort((x, y) => x[0] - y[0]);
    const frag = document.createDocumentFragment();
    let last = 0;
    hits.forEach(([s, e]) => {
      if (s < last) return;
      frag.append(text.slice(last, s));
      const m = document.createElement('span'); m.className = 'mask'; m.textContent = '＿'.repeat(e - s);
      frag.append(m); last = e;
    });
    frag.append(text.slice(last));
    return frag;
  }

  function hint(w) {
    $('sheetTag').textContent = 'Hinweis';
    $('sheetAnswer').textContent = w.cells.map(([r, c]) => entry[r][c] && marks[r][c] === 'rev' ? entry[r][c] : '＿').join(' ');
    $('sheetClue').textContent = w.clue;
    const ex = $('sheetExpl'); ex.textContent = ''; ex.append(masked(w.expl, w.answer));
    $('sheetHintRow').hidden = false; $('sheetOk').hidden = true;
    $('sheetReveal').onclick = () => { closeAll(); revealWord(w); };
    open('sheet');
  }

  function info() {
    const w = curWord(); if (!w) return;
    const right = w.cells.every(([r, c]) => entry[r][c] === P.sol[r][c]);
    if (finished || right) explain(w, 'Gut zu wissen'); else hint(w);
  }

  function revealWord(w) {
    if (!w) return;
    const wasRight = w.cells.every(([r, c]) => entry[r][c] === P.sol[r][c]);
    if (!finished && !wasRight) {
      w.cells.forEach(([r, c]) => { if (entry[r][c] !== P.sol[r][c]) { entry[r][c] = P.sol[r][c]; marks[r][c] = 'rev'; } });
      helped = true;
      if (!revealed.includes(w.answer)) revealed.push(w.answer);
    }
    render(); save();
    explain(w, wasRight ? 'Gut zu wissen' : 'Aufgedeckt');
    if (!finished && isSolved()) { pendingWin = true; }
  }

  let pendingWin = false;

  function revealAll() {
    P.words.forEach(w => {
      if (w.cells.some(([r, c]) => entry[r][c] !== P.sol[r][c]) && !revealed.includes(w.answer)) revealed.push(w.answer);
    });
    P.sol.forEach((row, r) => row.forEach((ch, c) => { if (ch && entry[r][c] !== ch) { entry[r][c] = ch; marks[r][c] = 'rev'; } }));
    helped = true;
    afterChange();
  }

  // ---------- Statistik & Sieg ----------
  const stats = () => store.get('xwg-stats', { solved: 0, clean: 0, best: null, total: 0, streak: 0, learned: 0 });
  function statsHTML(s) {
    return `<div><b>${s.solved}</b><span>Gelöst</span></div>
      <div><b>${s.best != null ? fmt(s.best) : '–'}</b><span>Bestzeit</span></div>
      <div><b>${s.streak}</b><span>Serie ohne Hilfe</span></div>
      <div><b>${s.learned}</b><span>Begriffe gelernt</span></div>`;
  }

  function learnHTML() {
    const box = document.createElement('div');
    P.words.forEach(w => {
      const it = document.createElement('div');
      it.className = 'it' + (revealed.includes(w.answer) ? ' helped' : '');
      it.innerHTML = '<div class="w"></div><div class="c"></div><div class="e"></div>';
      it.children[0].textContent = w.answer + (revealed.includes(w.answer) ? '  · aufgedeckt' : '');
      it.children[1].textContent = w.clue;
      it.children[2].textContent = w.expl;
      box.appendChild(it);
    });
    return box;
  }

  function win() {
    if (finished) return;
    finished = true;
    const s = stats();
    const played = store.get('xwg-played', []);
    if (!played.includes(P.idx)) {
      played.push(P.idx); store.set('xwg-played', played);
      const lex = new Set(store.get('xwg-lex', []));
      P.words.forEach(w => lex.add(w.answer)); store.set('xwg-lex', [...lex]);
      s.solved++; s.total += seconds; s.learned += P.words.length;
      if (!helped) { s.clean++; s.streak++; if (s.best == null || seconds < s.best) s.best = seconds; }
      else s.streak = 0;
      store.set('xwg-stats', s);
    }
    showWin();
    save();
  }

  function showWin() {
    const s = stats();
    $('winTitle').textContent = helped ? 'Gelöst!' : 'Geschafft! 🎉';
    $('winText').textContent = helped
      ? `Mit ${revealed.length ? revealed.length + ' aufgedeckten Wörtern' : 'Prüfhilfe'} gelöst in ${fmt(seconds)}.`
      : `Ohne Hilfe gelöst in ${fmt(seconds)}.`;
    $('winStats').innerHTML = statsHTML(s);
    const list = $('learnList'); list.innerHTML = ''; list.appendChild(learnHTML());
    setTimeout(() => { $('toast').hidden = true; open('mWin'); }, 450);
  }

  // ---------- Lexikon ----------
  function lexWords() {
    const lex = new Set(store.get('xwg-lex', []));
    store.get('xwg-played', []).forEach(i => {
      if (DATA.puzzles[i]) parse(i).words.forEach(w => lex.add(w.answer));
    });
    return [...lex].filter(a => DATA.clues[a]).sort((a, b) => a.localeCompare(b, 'de'));
  }
  function renderLex() {
    const all = lexWords();
    const q = $('lexSearch').value.trim().toLowerCase();
    const list = $('lexList'); list.innerHTML = '';
    $('lexInfo').textContent = all.length
      ? `${all.length} Begriffe aus deinen gelösten Rätseln. Tippe auf einen Begriff, um die Erklärung zu lesen.`
      : 'Noch leer. Sobald du ein Rätsel löst, landen alle seine Begriffe mit Erklärung hier.';
    all.filter(a => !q || a.toLowerCase().includes(q) || DATA.clues[a].join(' ').toLowerCase().includes(q)).forEach(a => {
      const d = document.createElement('details');
      d.innerHTML = '<summary><div class="w"></div><div class="c"></div></summary><div class="e"></div>';
      d.querySelector('.w').textContent = a;
      d.querySelector('.c').textContent = DATA.clues[a][0];
      d.querySelector('.e').textContent = DATA.clues[a][1];
      list.appendChild(d);
    });
  }

  // ---------- UI ----------
  function open(id) { $(id).hidden = false; }
  function closeAll() {
    document.querySelectorAll('.modal, .sheet').forEach(m => { m.hidden = true; });
    if (pendingWin) { pendingWin = false; win(); render(); }
  }
  document.querySelectorAll('.modal, .sheet').forEach(m => m.addEventListener('click', e => {
    if (e.target === m || e.target.closest('[data-close]')) closeAll();
  }));
  function toast(t) {
    const el = $('toast'); el.textContent = t; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 1700);
  }
  function confirmBox(title, text, yes, onYes) {
    $('cTitle').textContent = title; $('cText').textContent = text; $('cYes').textContent = yes;
    $('cYes').onclick = () => { closeAll(); onYes(); };
    open('mConfirm');
  }
  const anyProgress = () => entry.some(row => row.some(Boolean));
  function newPuzzle() { closeAll(); load(pickNew()); }
  function askNew() {
    closeAll();
    if (!finished && anyProgress()) confirmBox('Neues Rätsel?', 'Dein Fortschritt in diesem Rätsel geht verloren.', 'Neues Rätsel', newPuzzle);
    else newPuzzle();
  }

  $('btnHelp').onclick = () => open('mHelp');
  $('btnStats').onclick = () => { $('statsBox').innerHTML = statsHTML(stats()); open('mStats'); };
  $('btnMenu').onclick = () => open('mMenu');
  $('mNew').onclick = askNew;
  $('mRevealWord').onclick = () => { closeAll(); revealWord(curWord()); };
  $('mRevealAll').onclick = () => { closeAll(); confirmBox('Auflösen?', 'Alle Wörter werden aufgedeckt. Danach siehst du alle Erklärungen.', 'Auflösen', revealAll); };
  $('mLearn').onclick = () => {
    closeAll();
    if (finished) { showWin(); return; }
    confirmBox('Lernkarten zeigen?', 'Die Karten verraten alle Lösungen. Das Rätsel wird dabei aufgelöst.', 'Zeigen', revealAll);
  };
  $('btnNext').onclick = newPuzzle;
  $('infoClue').onclick = info;
  $('mLex').onclick = () => { closeAll(); $('lexSearch').value = ''; renderLex(); open('mLexikon'); };
  $('lexSearch').addEventListener('input', renderLex);
  $('prevClue').onclick = () => nextWord(-1);
  $('nextClue').onclick = () => nextWord(1);
  $('clue').onclick = () => { toggleDir(); render(); };

  // Tastatur (QWERTZ wie im Original)
  const ICON_BACK = '<svg viewBox="0 0 24 24"><path d="M20 12H5M11 6l-6 6 6 6"/></svg>';
  const layout = [[...'QWERTZUIOP'], [...'ASDFGHJKL', 'BACK'], ['TIPP', ...'YXCVBNM', 'CHECK']];
  layout.forEach(keys => {
    const row = document.createElement('div'); row.className = 'r';
    keys.forEach(k => {
      const b = document.createElement('button');
      if (k === 'BACK') { b.innerHTML = ICON_BACK; b.setAttribute('aria-label', 'Löschen'); b.onclick = backspace; }
      else if (k === 'TIPP') { b.textContent = '💡'; b.setAttribute('aria-label', 'Wort aufdecken und erklären'); b.onclick = () => revealWord(curWord()); }
      else if (k === 'CHECK') { b.textContent = 'Prüfen'; b.className = 'wide'; b.onclick = check; }
      else { b.textContent = k; b.onclick = () => type(k); }
      row.appendChild(b);
    });
    $('kb').appendChild(row);
  });

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const openModal = [...document.querySelectorAll('.modal, .sheet')].some(m => !m.hidden);
    if (openModal) { if (e.key === 'Escape' || e.key === 'Enter') { closeAll(); e.preventDefault(); } return; }
    const k = e.key;
    const uml = { 'ä': 'AE', 'ö': 'OE', 'ü': 'UE', 'ß': 'SS', 'Ä': 'AE', 'Ö': 'OE', 'Ü': 'UE' };
    if (/^[a-zA-Z]$/.test(k)) type(k.toUpperCase());
    else if (uml[k]) [...uml[k]].forEach(type);
    else if (k === 'Backspace' || k === 'Delete') backspace();
    else if (k === 'ArrowLeft') move(0, -1);
    else if (k === 'ArrowRight') move(0, 1);
    else if (k === 'ArrowUp') move(-1, 0);
    else if (k === 'ArrowDown') move(1, 0);
    else if (k === ' ') { toggleDir(); render(); }
    else if (k === 'Tab' || k === 'Enter') nextWord(e.shiftKey ? -1 : 1);
    else return;
    e.preventDefault();
  });

  // Timer
  setInterval(() => {
    if (!P || finished || document.hidden) return;
    if ([...document.querySelectorAll('.modal, .sheet')].some(m => !m.hidden)) return;
    seconds++; $('timer').textContent = fmt(seconds);
    if (seconds % 5 === 0) save();
  }, 1000);

  // Start
  function fromHash() {
    const m = /^#r(\d+)$/.exec(location.hash || '');
    const i = m ? parseInt(m[1], 10) - 1 : -1;
    return i >= 0 && i < DATA.puzzles.length ? i : -1;
  }
  window.addEventListener('hashchange', () => { const i = fromHash(); if (i >= 0 && (!P || i !== P.idx)) load(i); });
  const h = fromHash();
  const last = store.get('xwg-cur', null);
  load(h >= 0 ? h : (last && !last.finished && last.idx < DATA.puzzles.length ? last.idx : pickNew()));
  if (!store.get('xwg-help-seen', false)) { open('mHelp'); store.set('xwg-help-seen', true); }
})();
