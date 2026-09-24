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
REFERENCE: TreeNode and the node-based min-heap contract

  TreeNode(value)         Create a node containing an int.
  node.value             Read or write its int value.
  node.left              Read the left child (TreeNode?; may be null).
  node.right             Read the right child (TreeNode?; may be null).
  node.left = child;     Set a nullable left reference (TreeNode?).
  node.right = child;    Set a nullable right reference (TreeNode?).
  root                   Root reference (TreeNode?; initially null).
  size                   Number of reachable nodes (int; initially 0).

  The heap must be a complete binary tree: levels fill left to right.
  Every parent value must be <= its children's values; node identities
  remain stable as values are reordered. Duplicate values are permitted.
  There is no array backing this representation.

  insert returns void. removeMin and peek return int? (null if empty).
  peek leaves the heap unchanged. isEmpty returns bool.
*/
