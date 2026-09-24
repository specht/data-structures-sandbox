/*
Stack mit festem Array (LIFO).
Aufgabe: Implementiere push, pop, peek und isEmpty selbst.
*/

import '../../lib/stack_sandbox.dart';

class MyArrayStack {
  final FixedMemory memory = FixedMemory(8);
  // Student-owned logical state. -1 means no element is stored.
  int top = -1;

  bool push(int value) {
    // TODO: Check capacity, move top, write value into memory[top].
    return false;
  }

  int? pop() {
    // TODO: Return null when empty. Clear the old cell and move top down.
    return null;
  }

  int? peek() {
    // TODO: Return the current top value without removing it.
    return null;
  }

  bool isEmpty() {
    // TODO: Prüfe selbst, ob der Stack leer ist.
    return false;
  }
}

/*
HILFE: FixedMemory und die Stack-Schnittstelle

  memory ist ein FixedMemory(8): genau 8 feste Zellen (Indizes 0 bis 7).
  memory.length                 Anzahl der Zellen (hier 8)
  memory[index]                 Zelle lesen; Ergebnis ist int? (auch null)
  memory[index] = value;        Integer in eine Zelle schreiben
  memory[index] = null;         Zelle leeren

  Beispiel für die Speicher-API (KEINE Stack-Implementierung):
    int? gelesen = memory[0];
    memory[0] = 42;
    memory[0] = null;

  FixedMemory kennt weder push/pop noch top, add oder removeLast.
  DU verwaltest das Feld top selbst: zu Beginn -1, sonst Index der
  obersten belegten Zelle. Der Sandbox-Zeiger folgt deinen Zuweisungen.
  Schreibe nur über memory[index]; nutze keine separate Dart-Liste.

  push(value): true bei Erfolg, false bei vollem Stack; nichts überschreiben.
  pop(): obersten Wert entfernen und zurückgeben; null bei leerem Stack.
  peek(): obersten Wert lesen, ohne ihn zu entfernen; null bei leerem Stack.
  isEmpty(): true genau dann, wenn der Stack leer ist.
  Doppelte Werte sind erlaubt. Auch isEmpty gehört zu deiner Aufgabe.
*/
