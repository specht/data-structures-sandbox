# Data Structure Sandbox

Mit der Data Structure Sandbox implementiert ihr Datenstrukturen in Dart,
bearbeitet sie im Browser, beobachtet jeden Schritt und prüft sie mit
automatischen Tests.

Ihr arbeitet mit **zwei Git-Repositories**:

| Ordner | Inhalt | Wer ändert es? |
| --- | --- | --- |
| `~/data-structures-sandbox/` | die App | nur die Lehrkraft |
| `~/data-structures-sandbox/structures/` | das **Klassen-Repository** mit euren Implementierungen | ihr, jeweils im eigenen Unterordner |

## 1. Einmalig: Zugang zu GitLab einrichten

Melde dich auf [git.nhcham.org](https://git.nhcham.org/) an. Erzeuge dann im
Terminal einen SSH-Schlüssel (falls `ls ~/.ssh/id_ed25519.pub` noch keinen
findet; alle Rückfragen mit Enter bestätigen) und zeige ihn an:

```bash
ssh-keygen -t ed25519 -C "Vorname Nachname"
cat ~/.ssh/id_ed25519.pub
```

Kopiere die ganze Zeile, die mit `ssh-ed25519` beginnt, nach GitLab unter
**Edit profile → Access → SSH keys → Add new key**. Die private Datei
`~/.ssh/id_ed25519` gibst du nie weiter. Trage zum Schluss deinen Namen und
deine GitLab-E-Mail-Adresse ein und teste die Verbindung:

```bash
git config --global user.name "Vorname Nachname"
git config --global user.email "deine.mail@example.org"
ssh -T git@git.nhcham.org
```

## 2. App und Klassen-Repository klonen

<!--
  Lehrkraft: Jedes Schuljahr nur die URL des Klassen-Repositorys in der
  letzten Zeile des folgenden Blocks anpassen. Alles andere bleibt gleich.
-->

```bash
cd ~
git clone https://github.com/specht/data-structures-sandbox.git
cd data-structures-sandbox
git clone git@git.nhcham.org:specht/data-structure-sandbox-structures-2026.git structures
```

Das Klassen-Repository muss **in** der App liegen und genau `structures`
heißen. Existiert `structures/` schon, klone es nicht noch einmal und lösche
nichts, sondern frag nach.

## 3. Die App starten

```bash
cd ~/data-structures-sandbox
./run
```

Der Browser öffnet sich automatisch. Lass dieses Terminal offen und verwende
für Git ein zweites.

## 4. Deine Datenstruktur anlegen

`./new-structure` (im App-Ordner) zeigt alle Datenstrukturen. Ersetze
`DEIN_NAME` durch deinen Ordnernamen, zum Beispiel für einen Stack mit festem
Array:

```bash
cd ~/data-structures-sandbox
./new-structure DEIN_NAME stack array
```

Das legt `structures/DEIN_NAME/my_array_stack.dart` mit einer unfertigen
Vorlage an; vorhandene Dateien werden nie überschrieben. Weitere Beispiele:
`stack nodes`, `queue circular`, `list sorted-nodes`, `tree bst`, `tree avl`,
`heap array`, `hash`.

Möchtest du eine Datenstruktur **zweimal** implementieren (etwa rekursiv und
iterativ), lege eine Variante an. Sie erscheint im Browser als eigener
Eintrag:

```bash
./new-structure DEIN_NAME tree bst --variant recursive   # my_bst_recursive.dart
```

## 5. Bearbeiten, ausprobieren, testen

Wähle im Browser unter **Student** deinen Ordner und unter **Structure** deine
Datei. Bearbeite den Code direkt im Editor und speichere mit **Ctrl+S**; die
App übersetzt neu und setzt die Datenstruktur zurück. Rufe dann Methoden auf,
etwa `push(5)`, und verfolge sie mit **Step**, **Play** oder **Show result**.
Fehlermeldungen und `print`-Ausgaben erscheinen unter der Darstellung.

Mehrere Aufrufe trennst du mit `;`, zum Beispiel
`insert(1); insert(2); insert(3)` (bis zu 20 auf einmal); **Enter** führt sie
aus. Die Eingabe merkt sich die App für jede Datenstruktur. Schalte
**Repeat** ein, damit diese Aufrufe jedes Mal mit einer leeren Datenstruktur
beginnen und nach jedem Speichern von selbst erneut laufen. So musst du dein
Testszenario nicht immer wieder eintippen.

**Run tests** prüft deine Implementierung mit einem Referenzmodell, einschließlich
der Speicherstruktur. **Class progress** zeigt den Stand der ganzen Klasse.
Was die Methoden tun sollen, steht in den Kommentaren der Vorlage, in
[docs/contracts.md](docs/contracts.md) und [docs/storage-api.md](docs/storage-api.md).

## 6. Veröffentlichen

```bash
cd ~/data-structures-sandbox/structures
git pull
git add DEIN_NAME/
git commit -m "Array-Stack von DEIN_NAME"
git push
```

Füge nur Dateien aus deinem eigenen Ordner hinzu. Lehnt Git den Push ab,
lösche nichts und frag nach.

## 7. Beim nächsten Mal

```bash
cd ~/data-structures-sandbox && git pull
cd structures && git pull
cd .. && ./run
```

## Häufige Probleme

- **`Permission denied (publickey)`**: Der SSH-Schlüssel fehlt in GitLab
  (Schritt 1).
- **Deine Datei erscheint nicht**: Liegt sie in `structures/DEIN_NAME/` und
  heißt sie wie von `./new-structure` angelegt?
- **`File exists; not overwriting`**: Die Datei gibt es schon; bearbeite sie
  einfach weiter.

Mehr: [docs/start-here.md](docs/start-here.md) (erster Einstieg mit dem
Array-Stack), [docs/list-exercises.md](docs/list-exercises.md) (die vier
Listen), [DEVELOPMENT.md](DEVELOPMENT.md) (Technik).
