/*
Aufsteigend sortierte, einfach verkettete Liste.
Aufgabe: Implementiere insert, contains und remove selbst.
*/

import '../../lib/sandbox.dart';

class MyLinkedList {
  ListNode? head;

  void insert(int value) {
    // TODO: Find the insertion position, link a fresh ListNode(value).
  }

  bool contains(int value) {
    // TODO: Traverse the chain, return true if one node holds value.
    return false;
  }

  bool remove(int value) {
    // TODO: Unlink only the first matching node, return whether it existed.
    return false;
  }
}

/*
HILFE: ListNode und sortierte Liste

  ListNode(value)        Erzeugt einen neuen Knoten mit int-Wert.
  node.value             Liest den Integer des Knotens.
  node.next              Liest den Nachfolger (ListNode? oder null).
  node.next = other;     Setzt den Nachfolger (other: ListNode?).
  head                   Dein Verweis auf den ersten Knoten, anfangs null.

  Beispiel für die Knoten-API (KEINE Listen-Implementierung):
    final knot = ListNode(42);
    knot.next = null;

  insert(value): immer so einfügen, dass die Liste aufsteigend sortiert
  bleibt. Doppelte Werte sind erlaubt.
  contains(value): true, falls ein Knoten den Wert enthält.
  remove(value): genau EIN Vorkommen entfernen; true bei Erfolg,
  false, wenn der Wert nicht vorkam. Vergiss den Sonderfall am Kopf nicht.
  Die next-Verweise bilden eine einfache Kette, keinen Kreis.
*/
