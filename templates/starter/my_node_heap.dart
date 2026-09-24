/*
Min-Heap als vollständiger Binärbaum aus Knoten.
Aufgabe: Implementiere insert, removeMin, peek und isEmpty.
*/

import '../../lib/tree_sandbox.dart';

class MyNodeHeap {
  TreeNode? root;
  int size = 0;

  void insert(int value) {
    // TODO: Link a new node in the next complete-tree slot, then sift up.
  }

  int? removeMin() {
    // TODO: Unlink the last node, replace root value, then sift down.
    return null;
  }

  int? peek() {
    // TODO: Lies das Minimum, ohne es zu entfernen; null bei leerem Heap.
    return null;
  }

  bool isEmpty() {
    // TODO: Prüfe selbst, ob der Heap leer ist.
    return false;
  }
}

/*
HILFE: TreeNode und knotenbasierter Min-Heap

  TreeNode(value)         Erzeugt einen Knoten mit Integerwert.
  node.value             Lesen oder schreiben (node.value = zahl;).
  node.left / node.right  Linkes und rechtes Kind (je TreeNode? oder null).
  node.left = child;      Verweis ändern; analog node.right = child.
  root                    Dein Verweis auf die Wurzel (anfangs null).
  size                    Dein Zähler aller erreichbaren Knoten (anfangs 0).

  Beispiel für die Knoten-API (KEINE Heap-Implementierung):
    final knot = TreeNode(42);
    knot.left = null;
    int gelesen = knot.value;

  Hier gibt es KEIN HeapMemory-Array. Die Knoten bilden einen vollständigen
  Binärbaum: Jede Ebene wird von links nach rechts gefüllt. Für eine
  gedankliche Nummerierung ab 1 hat Position i die Kinder 2*i und 2*i+1;
  du musst die Verweise zu dieser Position selbst finden. Jeder Elternwert
  muss <= beiden vorhandenen Kinderwerten sein. Vertausche ggf. WERTE,
  nicht die Identität bereits verbundener Knoten.
  insert(value): Knoten einfügen, Struktur und Heap-Ordnung erhalten.
  removeMin(): Minimum entfernen, bei leer null zurückgeben.
  peek(): Minimum ohne Entfernen lesen, bei leer null.
  isEmpty(): Leerzustand selbst prüfen. Doppelte Werte sind erlaubt.
*/
