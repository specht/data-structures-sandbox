import '../../lib/tree_sandbox.dart';

// AVL tree. Duplicate keys are ignored. Height 1 means a leaf; null has height 0.
// Rotations relink existing TreeNode objects: node IDs remain stable.
class MyAVL {
  TreeNode? root;

  void insert(int value) { root = _insert(root, value); }

  bool contains(int value) {
    TreeNode? node = root;
    while (node != null) {
      if (value == node.value) return true;
      node = value < node.value ? node.left : node.right;
    }
    return false;
  }

  bool remove(int value) {
    if (!contains(value)) return false;
    root = _remove(root, value);
    return true;
  }

  int _height(TreeNode? node) => node?.height ?? 0;
  int _balance(TreeNode node) => _height(node.left) - _height(node.right);

  void _refresh(TreeNode node) {
    final leftHeight = _height(node.left);
    final rightHeight = _height(node.right);
    node.height = 1 + (leftHeight > rightHeight ? leftHeight : rightHeight);
  }

  TreeNode _rotateLeft(TreeNode node) {
    final newRoot = node.right!;
    node.right = newRoot.left; // First retarget pointers, then move nodes.
    newRoot.left = node;
    _refresh(node);
    _refresh(newRoot);
    return newRoot;
  }

  TreeNode _rotateRight(TreeNode node) {
    final newRoot = node.left!;
    node.left = newRoot.right;
    newRoot.right = node;
    _refresh(node);
    _refresh(newRoot);
    return newRoot;
  }

  TreeNode _rebalance(TreeNode node) {
    _refresh(node);
    final b = _balance(node);
    if (b > 1) {
      if (_balance(node.left!) < 0) node.left = _rotateLeft(node.left!);
      return _rotateRight(node);
    }
    if (b < -1) {
      if (_balance(node.right!) > 0) node.right = _rotateRight(node.right!);
      return _rotateLeft(node);
    }
    return node;
  }

  TreeNode _insert(TreeNode? node, int value) {
    if (node == null) return TreeNode(value);
    if (value < node.value) {
      node.left = _insert(node.left, value);
    } else if (value > node.value) {
      node.right = _insert(node.right, value);
    } else {
      return node;
    }
    return _rebalance(node);
  }

  TreeNode? _remove(TreeNode? node, int value) {
    if (node == null) return null;
    if (value < node.value) {
      node.left = _remove(node.left, value);
    } else if (value > node.value) {
      node.right = _remove(node.right, value);
    } else {
      if (node.left == null) return node.right;
      if (node.right == null) return node.left;
      // Replace this node's key with its in-order successor, then remove the
      // successor from the right subtree. The original node ID is preserved.
      TreeNode successor = node.right!;
      while (successor.left != null) successor = successor.left!;
      node.value = successor.value;
      node.right = _remove(node.right, successor.value);
    }
    return _rebalance(node);
  }
}
