/*
Warteschlange mit festem Ringpuffer (FIFO).
Aufgabe: Implementiere enqueue, dequeue, peek, isEmpty und isFull.
*/

import '../../lib/queue_sandbox.dart';

class MyArrayQueue {
  final QueueMemory memory = QueueMemory(8);
  int get front => memory.front;
  set front(int index) => memory.front = index;
  int get rear => memory.rear;
  set rear(int index) => memory.rear = index;
  int get size => memory.size;
  set size(int value) => memory.size = value;

  bool enqueue(int value) {
    // TODO: Return false when full; write at rear and advance modulo capacity.
    return false;
  }

  int? dequeue() {
    // TODO: Return null when empty; clear front, advance, decrease size.
    return null;
  }

  int? peek() {
    // TODO: Inspect the front item, or return null when empty.
    return null;
  }

  bool isEmpty() {
    // TODO: Prüfe selbst, ob die Queue leer ist.
    return false;
  }

  bool isFull() {
    // TODO: Prüfe selbst, ob die Queue voll ist.
    return false;
  }
}

/*
HILFE: QueueMemory und Ringpuffer

  memory = QueueMemory(8) hat acht feste Zellen mit Indizes 0 bis 7.
  memory.length            Anzahl der Zellen (Kapazität).
  memory[index]            Zelle lesen; Ergebnis int? (ggf. null).
  memory[index] = value;   Integer schreiben.
  memory[index] = null;    Entfernte Zelle leeren.

  front, rear und size sind deine logischen Zustandsvariablen. Die
  bereitgestellten get/set-Zugriffe leiten Zuweisungen an QueueMemory
  weiter, damit die Visualisierung jede Änderung zeigen kann.
  front: Index des nächsten zu entnehmenden Elements.
  rear: Index der nächsten Schreibposition.
  size: Anzahl der gespeicherten Elemente (anfangs 0).
  Anfänglich sind front = 0 und rear = 0. Beim Umlauf darfst du mit
  (index + 1) % memory.length rechnen. front == rear allein unterscheidet
  einen leeren Ringpuffer NICHT von einem vollen.

  enqueue(value): false bei voll, sonst anhängen und true zurückgeben.
  dequeue(): ältestes Element entfernen, bei leer null zurückgeben.
  peek(): ältestes Element ohne Entfernen lesen, bei leer null.
  isEmpty() / isFull(): prüfe beide Zustände selbst.
  Die Zellen bleiben physisch am selben Index; kein List.add/removeAt.
*/
