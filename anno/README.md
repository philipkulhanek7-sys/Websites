# ANNO – Geschichtsrätsel ohne Tageslimit

Ein deutsches Mini-Kreuzworträtsel rund um **Geschichte**, im Format täglicher Mini-Kreuzworträtsel wie xwort.com, aber ohne Tageslimit:
nach jedem Rätsel kommt sofort das nächste.

- **Dichtes Raster** (bis 5×5): Jeder Buchstabe gehört zu einem waagerechten und einem senkrechten Wort.
- **Lernmodus**: 💡 deckt das aktuelle Wort auf und erklärt, was dahintersteckt. Nach jedem Rätsel gibt es Lernkarten zu allen Begriffen.
- **Prüfen** färbt richtige Buchstaben grün, falsche rot.
- Statistik (gelöst, Bestzeit, Serie ohne Hilfe, gelernte Begriffe) und Fortschritt werden im Browser gespeichert.
- Jedes Rätsel hat eine Nummer (`#r12` in der Adresse).

## Spielen

`index.html` im Browser öffnen. Es wird kein Server benötigt.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `index.html`, `style.css`, `game.js` | Spieloberfläche |
| `puzzles.js` | Erzeugte Rätsel und die Hinweise/Erklärungen der darin verwendeten Wörter |
| `tools/vocab*.txt` | Wortschatz: `ANTWORT\|Hinweis\|Erklärung` (Umlaute als AE/OE/UE, ß als SS) |
| `tools/gen.py` | Rätselgenerator |
| `tools/bundle.py` | Fasst alles zu einer einzelnen HTML-Datei zusammen |

## Neue Rätsel erzeugen

```bash
cd tools
python3 gen.py 600 ../puzzles.js   # 600 Sekunden suchen, neue Rätsel werden ergänzt
```

Mehr Begriffe in `tools/vocab*.txt` ergeben mehr und abwechslungsreichere Rätsel.

## Veröffentlichung auf kulhanek.at

Bei jedem Push auf `main` veröffentlicht `.github/workflows/pages.yml` die Seite über GitHub Pages.
Einmalig nötig:

1. GitHub → Repository **Settings → Pages** → *Source*: **GitHub Actions**.
2. Unter *Custom domain* `kulhanek.at` eintragen, speichern, später **Enforce HTTPS** anhaken.
3. Beim Domain-Anbieter (DNS) eintragen:
   - `A`-Records für `kulhanek.at`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` für `www`: `philipkulhanek7-sys.github.io`
