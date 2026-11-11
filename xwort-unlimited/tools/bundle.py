"""Fasst index.html, style.css, puzzles.js und game.js zu einer einzelnen HTML-Datei zusammen.
Aufruf: python3 bundle.py <ausgabe.html> [--fragment]
--fragment lässt <html>/<head>/<body> weg (für Seiten, die ein eigenes Gerüst bekommen).
"""
import os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
read = lambda f: open(os.path.join(ROOT, f), encoding='utf-8').read()

html = read('index.html')
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + read('style.css') + '</style>')
html = html.replace('<script src="puzzles.js"></script>', '<script>\n' + read('puzzles.js') + '</script>')
html = html.replace('<script src="game.js"></script>', '<script>\n' + read('game.js') + '</script>')

if '--fragment' in sys.argv:
    head = re.search(r'<head>(.*?)</head>', html, re.S).group(1)
    body = re.search(r'<body>(.*?)</body>', html, re.S).group(1)
    head = re.sub(r'<meta charset[^>]*>\s*', '', head)
    head = re.sub(r'<meta name="viewport"[^>]*>\s*', '', head)
    html = head.strip() + '\n' + body.strip() + '\n'

open(sys.argv[1], 'w', encoding='utf-8').write(html)
print('geschrieben:', sys.argv[1], len(html) // 1024, 'KB')
