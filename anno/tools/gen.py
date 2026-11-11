"""Erzeugt dichte Mini-Kreuzworträtsel (bis 5x5) aus dem Geschichts-Wortschatz.

Jede weiße Zelle gehört zu einem waagerechten UND einem senkrechten Wort (Länge >= 3).
Aufruf: python3 gen.py <anzahl> <ausgabe.js>
"""
import itertools, random, sys, json, glob, os, time

HERE = os.path.dirname(os.path.abspath(__file__))


def load_vocab():
    vocab = {}
    for f in sorted(glob.glob(os.path.join(HERE, 'vocab*.txt'))):
        for line in open(f, encoding='utf-8'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            parts = line.split('|')
            if len(parts) != 3:
                raise SystemExit(f'Formatfehler in {f}: {line}')
            a = parts[0].strip().upper()
            if parts[1].strip() in ('-', '') or not a.isalpha():
                continue
            if not a.isalpha() or not a.isascii():
                raise SystemExit(f'Ungültige Antwort: {a}')
            if a not in vocab:
                vocab[a] = (parts[1].strip(), parts[2].strip())
    # ausführliche Erklärungen (expl*.txt) ersetzen die kurzen
    for f in sorted(glob.glob(os.path.join(HERE, 'expl*.txt'))):
        for line in open(f, encoding='utf-8'):
            line = line.strip()
            if not line or '|' not in line:
                continue
            a, e = line.split('|', 1)
            if a in vocab:
                vocab[a] = (vocab[a][0], e.strip())
                EXPLAINED.add(a)
    return vocab


EXPLAINED = set()


def runs(mask, R, C):
    """Liefert Slots [(dir, cells)] oder None, wenn das Muster ungültig ist."""
    slots = []
    for r in range(R):
        c = 0
        while c < C:
            if mask[r][c]:
                s = c
                while c < C and mask[r][c]:
                    c += 1
                if c - s < 3:
                    return None
                slots.append(('A', [(r, k) for k in range(s, c)]))
            else:
                c += 1
    for c in range(C):
        r = 0
        while r < R:
            if mask[r][c]:
                s = r
                while r < R and mask[r][c]:
                    r += 1
                if r - s < 3:
                    return None
                slots.append(('D', [(k, c) for k in range(s, r)]))
            else:
                r += 1
    return slots


def connected(mask, R, C):
    cells = [(r, c) for r in range(R) for c in range(C) if mask[r][c]]
    if not cells:
        return False
    seen = {cells[0]}
    stack = [cells[0]]
    while stack:
        r, c = stack.pop()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (r + dr, c + dc)
            if 0 <= n[0] < R and 0 <= n[1] < C and mask[n[0]][n[1]] and n not in seen:
                seen.add(n)
                stack.append(n)
    return len(seen) == len(cells)


def templates():
    out = []
    for R, C, maxb in ((5, 5, 6), (4, 5, 3), (5, 4, 3), (4, 4, 2)):
        cells = [(r, c) for r in range(R) for c in range(C)]
        for nb in range(0, maxb + 1):
            for blocks in itertools.combinations(cells, nb):
                mask = [[True] * C for _ in range(R)]
                for r, c in blocks:
                    mask[r][c] = False
                # keine komplett leeren Randzeilen/-spalten
                if any(not any(mask[r]) for r in (0, R - 1)):
                    continue
                if any(not any(mask[r][c] for r in range(R)) for c in (0, C - 1)):
                    continue
                sl = runs(mask, R, C)
                if not sl or not connected(mask, R, C):
                    continue
                white = sum(map(sum, mask))
                out.append((R, C, mask, sl, white))
    return out


class Filler:
    def __init__(self, words, rnd):
        self.rnd = rnd
        self.by_len = {}
        for w in words:
            self.by_len.setdefault(len(w), []).append(w)
        # Index: (len, pos, letter) -> set
        self.idx = {}
        for w in words:
            for i, ch in enumerate(w):
                self.idx.setdefault((len(w), i, ch), set()).add(w)

    def candidates(self, pattern, used):
        L = len(pattern)
        sets = [self.idx.get((L, i, ch), set()) for i, ch in enumerate(pattern) if ch]
        if sets:
            sets.sort(key=len)
            res = set(sets[0])
            for s in sets[1:]:
                res &= s
                if not res:
                    return []
        else:
            res = set(self.by_len.get(L, []))
        return [w for w in res if w not in used]

    def fill(self, R, C, slots, deadline):
        grid = [[None] * C for _ in range(R)]
        used = set()
        assign = [None] * len(slots)

        def pattern(i):
            return [grid[r][c] for r, c in slots[i][1]]

        def rec():
            if time.time() > deadline:
                return False
            best, bestc = None, None
            for i in range(len(slots)):
                if assign[i] is None:
                    cs = self.candidates(pattern(i), used)
                    if not cs:
                        return False
                    if best is None or len(cs) < len(bestc):
                        best, bestc = i, cs
            if best is None:
                return True
            self.rnd.shuffle(bestc)
            for w in bestc[:40]:
                cells = slots[best][1]
                old = [grid[r][c] for r, c in cells]
                for (r, c), ch in zip(cells, w):
                    grid[r][c] = ch
                assign[best] = w
                used.add(w)
                # gekreuzte, nun volle Slots müssen echte Wörter sein (durch candidates garantiert)
                if rec():
                    return True
                used.discard(w)
                assign[best] = None
                for (r, c), ch in zip(cells, old):
                    grid[r][c] = ch
            return False

        if rec():
            return grid, assign
        return None


def worker(args):
    seed, seconds = args
    vocab = load_vocab()
    words = [w for w in vocab if 3 <= len(w) <= 5 and w in EXPLAINED]
    rnd = random.Random(seed)
    F = Filler(words, rnd)
    tpls = [t for t in templates() if t[4] >= 18]
    weights = [(t[4] - 17) ** 2 for t in tpls]
    out = []
    end = time.time() + seconds
    while time.time() < end:
        R, C, mask, slots, white = rnd.choices(tpls, weights)[0]
        res = F.fill(R, C, slots, time.time() + 0.5)
        if res:
            grid = res[0]
            out.append([''.join(grid[r][c] or '#' for c in range(C)) for r in range(R)])
    return out


def main():
    seconds = int(sys.argv[1]) if len(sys.argv) > 1 else 60
    outp = sys.argv[2] if len(sys.argv) > 2 else None
    cap = 40
    import multiprocessing as mp
    vocab = load_vocab()
    procs = mp.cpu_count()
    with mp.Pool(procs) as pool:
        results = pool.map(worker, [(1000 + i + int(time.time()), seconds) for i in range(procs)])
    puzzles, seen, use = [], set(), {}
    allp = [p for r in results for p in r]
    random.Random(7).shuffle(allp)
    for rows in allp:
        ws = words_in(rows)
        key = tuple(sorted(ws))
        if key in seen or len(set(ws)) != len(ws):
            continue
        if any(use.get(w, 0) >= cap for w in ws):
            continue
        seen.add(key)
        for w in ws:
            use[w] = use.get(w, 0) + 1
        puzzles.append(rows)
    print('Rätsel:', len(puzzles), 'von', len(allp), 'Wörter genutzt:', len(use), file=sys.stderr)
    if outp:
        old = []
        if os.path.exists(os.path.join(HERE, 'puzzles.json')):
            old = json.load(open(os.path.join(HERE, 'puzzles.json')))
        keys = {tuple(sorted(words_in(p))) for p in old}
        for p in puzzles:
            k = tuple(sorted(words_in(p)))
            if k not in keys:
                old.append(p); keys.add(k)
        json.dump(old, open(os.path.join(HERE, 'puzzles.json'), 'w'))
        used = sorted({w for p in old for w in words_in(p)})
        data = {'puzzles': old, 'clues': {w: list(vocab[w]) for w in used}}
        with open(outp, 'w', encoding='utf-8') as f:
            f.write('window.XWORT_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
        print('gesamt gespeichert:', len(old), file=sys.stderr)


def words_in(rows):
    R, C = len(rows), len(rows[0])
    out = []
    for r in range(R):
        for seg in rows[r].split('#'):
            if len(seg) >= 3:
                out.append(seg)
    for c in range(C):
        col = ''.join(rows[r][c] for r in range(R))
        for seg in col.split('#'):
            if len(seg) >= 3:
                out.append(seg)
    return out


if __name__ == '__main__':
    main()
