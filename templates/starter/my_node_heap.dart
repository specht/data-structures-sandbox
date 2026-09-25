/*
Node-based min-heap of integers.
Implement the public operations below.
*/

import '../../lib/tree_sandbox.dart';

class MyNodeHeap {
  TreeNode? root;
  int size = 0;

  void insert(int value) {
    // TODO: Insert value while preserving heap order and complete-tree shape.
  }

  int? removeMin() {
    // TODO: Remove and return the minimum value, or null if the heap is empty.
    return null;
  }

  int? peek() {
    // TODO: Return the minimum value without removing it, or null if empty.
    return null;
  }

  bool isEmpty() {
    // TODO: Return true exactly when the heap contains no elements.
    return false;
  }
}

/*
Quick reference · TreeNode
  TreeNode(value)   Create a node
  node.value       Stored int
  node.left/right  Nullable child references
  root             Nullable root reference
  size             Student-maintained node count
  Details: docs/node-heap.md
*/
