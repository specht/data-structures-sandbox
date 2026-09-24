/*
Warteschlange mit verketteten Knoten (FIFO).
Aufgabe: Implementiere enqueue, dequeue, peek und isEmpty.
*/

import '../../lib/sandbox.dart';

class MyLinkedQueue {
  ListNode? head;
  ListNode? tail;

  bool enqueue(int value) {
    // TODO: Append a new node. Update both references when initially empty.
    return false;
  }

  int? dequeue() {
    // TODO: Remove head; make tail null as well if removing the last node.
    return null;
  }

  int? peek() {
    // TODO: Return null when empty; otherwise inspect head.
    return null;
  }

  bool isEmpty() {
    // TODO: Prüfe selbst, ob die Queue leer ist.
    return false;
  }
}

/*
HILFE: ListNode und FIFO-Warteschlange

  ListNode(value)       Erzeugt einen neuen Knoten mit int-Wert.
  node.value            Liest den Integer des Knotens.
  node.next             Liest den Nachfolger (ListNode? oder null).
  node.next = other;    Setzt den Nachfolger (other: ListNode?).
  head                  Dein Verweis auf das älteste Element.
  tail                  Dein Verweis auf das neueste Element.

  Beispiel für die Knoten-API (KEINE Queue-Implementierung):
    final knot = ListNode(42);
    knot.next = null;

  Anfangs sind head und tail null. Nach dem Entfernen des letzten
  Elements müssen BEIDE null sein; tail.next muss immer null sein.
  enqueue(value): hinten einfügen, true zurückgeben.
  dequeue(): ältestes Element entfernen, bei leer null.
  peek(): ältestes Element ohne Entfernen lesen, bei leer null.
  isEmpty(): den Leerzustand selbst prüfen.
  Doppelte Werte sind erlaubt; es gibt keine feste Kapazität.
*/
