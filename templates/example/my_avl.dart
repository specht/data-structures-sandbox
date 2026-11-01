import '../../lib/tree_sandbox.dart';
import 'my_linked_queue.dart';

// AVL tree. Height 1 means a leaf; null has height 0.
// Duplicate policy: not allowed; inserting an existing value changes nothing.
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

  // Depth-first traversals: the order of visit(value) relative to the two
  // recursive calls is the only difference between them.
  void preorder(void Function(int value) visit) => _preorder(root, visit);
  void inorder(void Function(int value) visit) => _inorder(root, visit);
  void postorder(void Function(int value) visit) => _postorder(root, visit);

  void _preorder(TreeNode? node, void Function(int value) visit) {
    if (node == null) return;
    visit(node.value);
    _preorder(node.left, visit);
    _preorder(node.right, visit);
  }

  void _inorder(TreeNode? node, void Function(int value) visit) {
    if (node == null) return;
    _inorder(node.left, visit);
    visit(node.value);
    _inorder(node.right, visit);
  }

  void _postorder(TreeNode? node, void Function(int value) visit) {
    if (node == null) return;
    _postorder(node.left, visit);
    _postorder(node.right, visit);
    visit(node.value);
  }

  // Breadth-first: the own linked queue stores the nodes still to visit.
  void breadthFirst(void Function(int value) visit) {
    final queue = TreeNodeQueue(MyLinkedQueue());
    if (root != null) queue.enqueue(root!);
    while (!queue.isEmpty) {
      final current = queue.dequeue()!;
      visit(current.value);
      if (current.left != null) queue.enqueue(current.left!);
      if (current.right != null) queue.enqueue(current.right!);
    }
  }
}
