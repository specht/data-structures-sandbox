/*
Height-balanced binary search tree (AVL).
Implement the public operations below.
*/

import '../../lib/tree_sandbox.dart';

class MyAVL {
  TreeNode? root;

  void insert(int value) {
    // TODO: Insert value if absent; preserve BST order and AVL balance.
  }

  bool contains(int value) {
    // TODO: Return true if value is present; otherwise return false.
    return false;
  }

  bool remove(int value) {
    // TODO: Remove value if present; preserve AVL invariants and report success.
    return false;
  }
}

/*
Quick reference · TreeNode
  TreeNode(value)   Create a node
  node.value       Stored int
  node.left/right  Nullable child references
  node.height      Stored subtree height
  root             Nullable root reference
  Details: docs/contracts.md
*/
