import '../../lib/tree_sandbox.dart';

// Ordinary, UNBALANCED binary search tree. Equal keys are ignored.
// Compare sorted insertion orders with other insertion orders.
class MyBST {
  TreeNode? root;

  void insert(int value) {
    if (root == null) {
      root = TreeNode(value);
      return;
    }
    TreeNode? current = root;
    while (current != null) {
      if (value == current.value) return;
      if (value < current.value) {
        if (current.left == null) {
          current.left = TreeNode(value);
          return;
        }
        current = current.left;
      } else {
        if (current.right == null) {
          current.right = TreeNode(value);
          return;
        }
        current = current.right;
      }
    }
  }

  bool contains(int value) {
    TreeNode? current = root;
    while (current != null) {
      if (value == current.value) return true;
      current = value < current.value ? current.left : current.right;
    }
    return false;
  }

  bool remove(int value) {
    TreeNode? parent;
    TreeNode? current = root;
    while (current != null && current.value != value) {
      parent = current;
      current = value < current.value ? current.left : current.right;
    }
    if (current == null) return false;
    if (current.left != null && current.right != null) {
      TreeNode successorParent = current;
      TreeNode successor = current.right!;
      while (successor.left != null) {
        successorParent = successor;
        successor = successor.left!;
      }
      current.value = successor.value;
      parent = successorParent;
      current = successor;
    }
    final child = current.left ?? current.right;
    if (parent == null) {
      root = child;
    } else if (identical(parent.left, current)) {
      parent.left = child;
    } else {
      parent.right = child;
    }
    return true;
  }
}
