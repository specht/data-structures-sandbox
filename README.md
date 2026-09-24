# Data Structure Sandbox

Mit der Data Structure Sandbox könnt ihr Datenstrukturen in Dart selbst
implementieren, direkt im Browser bearbeiten, beobachten und mit automatischen Tests überprüfen.

## Was liegt wo?

Ihr arbeitet mit **zwei getrennten Git-Repositories**:

- `~/data-structures-sandbox/` enthält die App, die Vorlagen und die Tests.
  Dieses Repository wird von der Lehrkraft gepflegt.
- `~/data-structures-sandbox/structures/` enthält die Implementierungen der
  Klasse. **Hier** bearbeitet und veröffentlicht ihr eure Dateien.

Jede Person arbeitet in einem eigenen Unterordner von `structures/`. Ändert
keine Dateien anderer Personen und keine Dateien der App. Falls die App in
eurem Workspace unter einem anderen Namen liegt, verwendet ihr diesen Pfad
anstelle von `~/data-structures-sandbox`.

## 1. Bei GitLab anmelden

Öffne [git.nhcham.org](https://git.nhcham.org/) im Browser und melde dich an.

## 2. SSH-Schlüssel erstellen

Prüfe zunächst, ob dein Workspace bereits einen öffentlichen SSH-Schlüssel hat:

```bash
ls ~/.ssh/id_ed25519.pub
```

Falls die Datei nicht existiert, erzeuge einen Schlüssel:

```bash
ssh-keygen -t ed25519 -C "Vorname Nachname"
```

Bestätige den vorgeschlagenen Speicherort mit Enter. Im Schul-Workspace kannst
du die Passphrase leer lassen und die nächsten Rückfragen mit Enter bestätigen.
Zeige danach deinen **öffentlichen** Schlüssel an:

```bash
cat ~/.ssh/id_ed25519.pub
```

Kopiere die gesamte Zeile, die mit `ssh-ed25519` beginnt. Öffne in GitLab
**Edit profile → Access → SSH keys → Add new key**, füge den Schlüssel ein und
speichere ihn. **Gib niemals deine private Datei** `~/.ssh/id_ed25519` weiter.

Teste die Verbindung:

```bash
ssh -T git@git.nhcham.org
```

Bestätige bei der ersten Verbindung den angezeigten Hostschlüssel nur, wenn er
zu eurem GitLab-Server gehört. Danach sollte GitLab dich begrüßen.

## 3. Git einmalig einrichten

Trage deinen Namen und die E-Mail-Adresse deines GitLab-Kontos ein:

```bash
git config --global user.name "Vorname Nachname"
git config --global user.email "deine.mail@example.org"
```

Das ist in jedem Workspace nur einmal nötig.

## 4. Das Klassen-Repository klonen

Falls die App noch nicht in deinem Workspace vorhanden ist, klone sie zuerst:

```bash
cd ~
git clone https://github.com/specht/data-structures-sandbox.git data-structures-sandbox
```

Wechsle in das **äußere** App-Verzeichnis. Die Lehrkraft gibt euch die
SSH-Adresse des gemeinsamen Klassen-Repositories. Ersetze im folgenden Befehl
`GITLAB_SSH_URL_DER_KLASSE` durch diese Adresse:

```bash
cd ~/data-structures-sandbox
git clone GITLAB_SSH_URL_DER_KLASSE structures
```

Der Zielordner muss **genau** `structures` heißen. Klone das Klassen-Repository
nicht in einen Ordner neben der App und nicht in den Ordner eines Mitschülers.
Falls `structures/` bereits existiert, klone es **nicht erneut** und lösche
keine vorhandenen Dateien. Prüfe mit der Lehrkraft, ob es schon das gemeinsame
Klassen-Repository oder nur ein lokal angelegter Beispielordner ist.

Wenn das Klassen-Repository bereits eingerichtet ist, aktualisiere es so:

```bash
cd ~/data-structures-sandbox/structures
git pull
```

## 5. Die App starten

Starte die App im **äußeren** Verzeichnis:

```bash
cd ~/data-structures-sandbox
./run
```

Der Browser öffnet sich automatisch. Bei einer frischen Installation bleibt die
App zunächst **leer**: Sie erstellt weder einen Beispielnutzer noch den Ordner
`structures/`. Klone das Klassen-Repository wie in Schritt 4 beschrieben,
bevor du eine eigene Datenstruktur anlegst. Lass das App-Terminal geöffnet;
für Git verwendest du weiterhin ein zweites Terminal.

## 6. Deine Datenstruktur hinzufügen

Hole zunächst im zweiten Terminal den aktuellen Stand des Klassen-Repositories:

```bash
cd ~/data-structures-sandbox/structures
git pull
```

Wechsle dann zurück in das **äußere App-Verzeichnis** und zeige die verfügbaren
Datenstrukturen und Varianten an:

```bash
cd ~/data-structures-sandbox
./new-structure
```

Ersetze `DEIN_NAME` durch deinen vereinbarten Ordnernamen. Um beispielsweise
einen Stack mit festem Array zu erstellen, führe aus:

```bash
./new-structure DEIN_NAME stack array
```

Der Befehl legt die Datei
`structures/DEIN_NAME/my_array_stack.dart` an. Sie enthält eine **unfertige
Vorlage**: Du implementierst die Methoden selbst. Bereits vorhandene Dateien
werden nicht überschrieben.

Du kannst auf dieselbe Weise weitere Datenstrukturen anlegen, zum Beispiel:

```bash
./new-structure DEIN_NAME stack nodes
./new-structure DEIN_NAME queue circular
./new-structure DEIN_NAME queue nodes
./new-structure DEIN_NAME list
./new-structure DEIN_NAME tree bst
./new-structure DEIN_NAME tree avl
./new-structure DEIN_NAME heap array
./new-structure DEIN_NAME heap nodes
./new-structure DEIN_NAME hash
```

Die Varianten sind eigenständige Dateien. Wenn du einen Stack mit Knoten
implementieren möchtest, verwende `stack nodes` statt `stack array`.

Wähle im Browser deine Datei und klicke im Quelltextbereich auf **Edit**.
Der einfache, lokal mitgelieferte Editor unterstützt Tab, automatische
Einrückung nach `{`, Rückgängig und **Ctrl+S** bzw. **Save**. Änderungen werden
**nur beim Speichern** in dieselbe Datei unter `structures/` geschrieben, die
du auch im Workspace-Editor öffnen kannst. Ein Dateikonflikt wird gemeldet,
statt fremde Änderungen zu überschreiben. Wechsle über **Cancel** zurück zur
Visualisierung, ohne Änderungen zu speichern. Deine Git-Commits und Pushes
führst du wie bisher im Terminal aus.

Die Kommentare in der Dart-Datei erläutern die geforderte Wirkung der Methoden
und die bereitgestellte Speicher-API. Hinweise
zu den Schnittstellen und zulässigen Zuständen stehen außerdem in
[docs/contracts.md](docs/contracts.md) und
[docs/storage-api.md](docs/storage-api.md). Die Darstellung im Browser musst
du nicht selbst programmieren.

## 7. Deine Implementierung ausprobieren und testen

Wähle im Browser unter **Student** deinen Ordner und unter **Structure** deine
Datenstruktur aus. Führe einzelne Methoden aus, etwa `push(5)` oder `pop()`.
Mit **Step**, **Play** und **Show result** kannst du die Ausführung verfolgen.

Speichere deine Änderungen im Browser mit **Save** (oder im Workspace-Editor).
Die laufende App lädt die geänderte Implementierung automatisch neu; dabei
wird der Zustand der ausgewählten
Datenstruktur zurückgesetzt. Bei einem Kompilierungsfehler korrigiere die im
Browser bzw. Terminal angezeigte Fehlermeldung.

Klicke auf **Test implementation**, um das Testfenster zu öffnen. Dort siehst
du den Fortschritt, die Ergebnisse der einzelnen Testgruppen und das
Gesamtergebnis. Mit **Run tests again** kannst du die Tests erneut ausführen.
Die Schaltfläche zeigt das zuletzt gespeicherte Gesamtergebnis für genau diese
Codeversion an. Nach einer Änderung am Quelltext gilt das alte Ergebnis nicht
mehr. Die Tests überprüfen die öffentliche Schnittstelle, nicht die konkrete
Umsetzung. Sie laufen in einem **separaten Testprozess** und verändern die
Datenstruktur im normalen Visualisierungsbereich nicht. Auch bestandene Tests
beweisen nicht, dass ein Programm in jeder Situation korrekt ist.

## 8. Deine Datenstruktur veröffentlichen

Wechsle in das **Klassen-Repository** und prüfe die Änderungen:

```bash
cd ~/data-structures-sandbox/structures
git status
```

Füge nur deine eigene Datei hinzu (hier das Beispiel mit dem Array-Stack):

```bash
git add DEIN_NAME/my_array_stack.dart
git commit -m "Add array stack by DEIN_NAME"
git push
```

Verwendest du eine andere Datenstruktur, ersetze den Dateinamen im `git add`-
Befehl entsprechend. Nach dem Push können andere eure Änderungen mit
`git pull` erhalten. Überschreibe keine fremden Dateien.

Falls Git den Push wegen neuer Änderungen im Klassen-Repository ablehnt, lösche
nichts und bitte um Hilfe beim Zusammenführen.

## 9. Beim nächsten Mal weiterarbeiten

Aktualisiere zuerst die App und anschließend das Klassen-Repository:

```bash
cd ~/data-structures-sandbox
git pull
cd structures
git pull
cd ..
./run
```

Arbeite immer an deiner Datei im eigenen Ordner unter `structures/`.

## Häufige Probleme

- **`Permission denied (publickey)`**: Prüfe deinen öffentlichen SSH-Schlüssel
  in GitLab und teste `ssh -T git@git.nhcham.org` erneut.
- **`structures` existiert bereits**: Klone nicht darüber. Prüfe zuerst, ob
  dort schon das Klassen-Repository oder vorhandene Arbeit liegt.
- **`File exists; not overwriting`**: Deine Starter-Datei existiert bereits.
  Öffne und bearbeite sie; der Befehl löscht oder überschreibt sie nicht.
- **Deine Datenstruktur erscheint nicht**: Prüfe den Dateinamen, den
  persönlichen Unterordner und eventuelle Dart-Fehler im Browser oder Terminal.
- **`git push` wird abgelehnt**: Überschreibe nichts und lass dir beim
  Zusammenführen helfen.

Die bisherige technische Projektdokumentation steht in
[DEVELOPMENT.md](DEVELOPMENT.md). Für einen ersten Einstieg in den Array-Stack
gibt es außerdem [docs/start-here.md](docs/start-here.md).

## Hintergrundbild lokal mitliefern

Zum einmaligen Herunterladen des Hintergrundbildes aus dem 2D-Projekt:

```bash
./web/fetch-background.sh
git add web/background.jpg
git commit -m "Bundle sandbox background"
```

Das Bild wird als lokale Datei `web/background.jpg` ausgeliefert; nach dem
Herunterladen benötigt die App dafür keine Internetverbindung. Der Browser-
Editor benötigt keine externen Bibliotheken und speichert nur auf **Save**.
