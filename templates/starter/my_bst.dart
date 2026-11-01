/*
Binary search tree of integers.
Duplicate policy: not allowed; inserting an existing value changes nothing.
Implement the public operations below.
*/

import '../../lib/tree_sandbox.dart';

class MyBST {
  TreeNode? root;

  void insert(int value) {
    // TODO: Insert value if absent; preserve the binary search tree property.
  }

  bool contains(int value) {
    // TODO: Return true if value is present; otherwise return false.
    return false;
  }

  bool remove(int value) {
    // TODO: Remove value if present; return true if a value was removed.
    return false;
  }

  // Traversals: the Sandbox supplies visit and checks the order of your
  // visit(value) calls. Private recursive helper methods are welcome.
  void preorder(void Function(int value) visit) {
    // TODO: Node, left subtree, right subtree.
  }

  void inorder(void Function(int value) visit) {
    // TODO: Left subtree, node, right subtree.
  }

  void postorder(void Function(int value) visit) {
    // TODO: Left subtree, right subtree, node.
  }

  void breadthFirst(void Function(int value) visit) {
    // TODO: Visit level by level, left to right, with one of your own queues:
    // import 'my_linked_queue.dart'; (or 'my_array_queue.dart') at the top,
    // then use TreeNodeQueue(MyLinkedQueue()) (or MyArrayQueue()).
  }
}

/*
Quick reference · TreeNode
  TreeNode(value)   Create a node
  node.value       Stored int
  node.left/right  Nullable child references
  root             Nullable root reference
  Details: docs/contracts.md
*/
