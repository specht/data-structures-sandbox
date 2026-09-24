import '../../lib/tree_sandbox.dart';

// Heap (node-based): complete binary tree of TreeNode objects, MIN-heap
// order, duplicates allowed. size is number of reachable nodes.
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

  int? peek() => root?.value;
  bool isEmpty() => size == 0;
}
