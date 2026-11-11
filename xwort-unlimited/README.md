# XWORT Geschichte – unbegrenzt

Ein deutsches Mini-Kreuzworträtsel rund um **Geschichte**, im Stil von xwort.com, aber ohne Tageslimit:
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
