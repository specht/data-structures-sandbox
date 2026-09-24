/*
Stack mit verketteten Knoten (LIFO).
Aufgabe: Implementiere push, pop, peek und isEmpty selbst.
*/

import '../../lib/sandbox.dart';

class MyLinkedStack {
  ListNode? head;

  bool push(int value) {
    // TODO: Allocate ListNode(value), link it to head, update head.
    return false;
  }

  int? pop() {
    // TODO: Return null if empty; otherwise return and unlink the head value.
    return null;
  }

  int? peek() {
    // TODO: Inspect the head without unlinking it.
    return null;
  }

  bool isEmpty() {
    // TODO: Prüfe selbst, ob der Stack leer ist.
    return false;
  }
}

/*
HILFE: ListNode und die Stack-Schnittstelle

  ListNode(value)       Erzeugt einen neuen Knoten mit int-Wert.
  node.value            Liest den Integer des Knotens.
  node.next             Liest den nächsten Knoten (ListNode? oder null).
  node.next = other;    Verändert die Verknüpfung (other: ListNode?).
  head                  Dein Feld: Verweis auf den obersten Knoten, anfangs null.

  Beispiel für die Knoten-API (KEINE Stack-Implementierung):
    final knot = ListNode(42);
    knot.next = null;
    int zahl = knot.value;

  Es gibt keinen int top und keinen FixedMemory-Speicher bei dieser Variante.
  Die Knoten bleiben erhalten, solange head sie über next erreicht.
  push(value): neuen Knoten oben ablegen, true zurückgeben.
  pop(): obersten Wert entfernen, bei leerem Stack null zurückgeben.
  peek(): obersten Wert ohne Entfernen lesen, sonst null.
  isEmpty(): true genau dann, wenn der Stack leer ist.
  Doppelte Werte sind erlaubt. Auch isEmpty implementierst du selbst.
*/
