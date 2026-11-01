/*
Height-balanced binary search tree (AVL).
Duplicate policy: not allowed; inserting an existing value changes nothing.
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


  // Write recursive helper functions to visit nodes in the requested order.
  // The Sandbox supplies visit and checks the sequence of callback calls.
  void inorder(void Function(int value) visit) {
    // TODO: Left subtree, node, right subtree.
  }

  void preorder(void Function(int value) visit) {
    // TODO: Node, left subtree, right subtree.
  }

  void postorder(void Function(int value) visit) {
    // TODO: Left subtree, right subtree, node.
  }

  void breadthFirst(void Function(int value) visit) {
    // TODO: Visit by level; use TreeNodeQueue with one of your own queues.
  }

  bool dfs(int target) {
    // TODO: Depth-first search; return true if target exists.
    return false;
  }

  bool bfs(int target) {
    // TODO: Breadth-first search; use one of your own queues.
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
