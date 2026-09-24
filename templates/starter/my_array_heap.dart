/*
Min-Heap mit vergrößerbarem Array.
Aufgabe: Implementiere insert, removeMin, peek und isEmpty.
*/

import '../../lib/heap_sandbox.dart';

class MyArrayHeap {
  final HeapMemory memory = HeapMemory();

  void insert(int value) {
    // TODO: Append and sift the new value upward.
  }

  int? removeMin() {
    // TODO: Return null when empty; move last value to root and sift down.
    return null;
  }

  int? peek() {
    // TODO: Return smallest value without removing it, or null if empty.
    return null;
  }

  bool isEmpty() {
    // TODO: Prüfe selbst, ob der Heap leer ist.
    return false;
  }
}

/*
HILFE: HeapMemory und Min-Heap

  memory ist eine WACHSENDE Folge von int-Zellen (anfangs leer).
  memory.length          Anzahl belegter Zellen.
  memory[index]          int an einem bestehenden Index lesen.
  memory[index] = value; int an einem bestehenden Index überschreiben.
  memory.add(value);     Eine neue Zelle am Ende anhängen.
  memory.removeLast();   Letzten Wert entfernen und zurückgeben (int).
  memory.swap(a, b);     Werte zweier vorhandener Indizes vertauschen.

  Beispiel für die Speicher-API (KEINE Heap-Implementierung):
    memory.add(42);
    int gelesen = memory[0];
    memory[0] = 21;

  Ein Schreibzugriff auf memory[memory.length] erweitert den Speicher
  NICHT; verwende dafür add. Greife nie außerhalb 0..length-1 zu.
  Der kleinste Wert gehört an Index 0; für Index i liegen die Kinder
  bei 2*i+1 und 2*i+2, der Elternindex bei (i-1) ~/ 2.
  Jeder Elternwert muss <= beiden vorhandenen Kinderwerten sein.
  insert(value): Element aufnehmen und Min-Heap-Eigenschaft herstellen.
  removeMin(): kleinstes Element entfernen, bei leer null zurückgeben.
  peek(): Minimum ohne Entfernen lesen, bei leer null.
  isEmpty(): Leerzustand selbst prüfen. Doppelte Werte sind erlaubt.
*/
