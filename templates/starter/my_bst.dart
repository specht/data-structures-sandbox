/*
Binärer Suchbaum ohne automatischen Höhenausgleich.
Aufgabe: Implementiere insert, contains und remove selbst.
*/

import '../../lib/tree_sandbox.dart';

class MyBST {
  TreeNode? root;

  void insert(int value) {
    // TODO: Insert a fresh TreeNode at the correct empty child reference.
  }

  bool contains(int value) {
    // TODO: Follow the ordering to search, not an exhaustive traversal.
    return false;
  }

  bool remove(int value) {
    // TODO: Handle leaf, one child, and two children; return whether present.
    return false;
  }
}

/*
HILFE: TreeNode und binärer Suchbaum

  TreeNode(value)         Erzeugt einen Knoten mit Integerwert.
  node.value             Integer lesen oder mit node.value = zahl setzen.
  node.left / node.right  Linkes/rechtes Kind (TreeNode? oder null).
  node.left = child;      Verknüpfung ändern; analog node.right = child.
  root                    Dein Verweis auf die Wurzel (anfangs null).

  Beispiel für die Knoten-API (KEINE Baum-Implementierung):
    final knot = TreeNode(42);
    knot.left = null;
    int gelesen = knot.value;

  Suchbaumregel: links stehen ausschließlich kleinere, rechts ausschließlich
  größere Werte als am jeweiligen Knoten. Doppelte Schlüssel ignorieren.
  insert(value): bei unbekanntem Wert einen neuen Knoten einfügen.
  contains(value): entlang der Suchbaumregel suchen, Ergebnis bool.
  remove(value): Wert entfernen, bool für gefunden/nicht gefunden; dabei
  auch Knoten ohne, mit einem und mit zwei Kindern berücksichtigen.
  Bereits vorhandene Knoten nicht unnötig durch neue Objekte ersetzen.
*/
