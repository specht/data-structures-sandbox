import '../../lib/tree_sandbox.dart';

// Tree (AVL): BST invariant, stored height (leaf 1 / empty 0), balance
// factor in [-1, 1] at the end of each public method. Ignore duplicates.
class MyAVL {
  TreeNode? root;

  void insert(int value) {
    // TODO: BST insertion, refresh heights and rebalance with rotations.
  }

  bool contains(int value) {
    // TODO: Search using the BST ordering.
    return false;
  }

  bool remove(int value) {
    // TODO: BST removal, refresh heights and rebalance after unlinking.
    return false;
  }
}
