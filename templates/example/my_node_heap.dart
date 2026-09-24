import '../../lib/tree_sandbox.dart';

// A complete, node-based MIN-heap. There is no backing array: the binary
// representation of a 1-based position tells us which reference to follow.
// The students can inspect both the physical pointers and the value swaps.
// Duplicate values are allowed, and inserting a value creates a fresh node.
class MyNodeHeap {
  TreeNode? root;
  int size = 0;

  TreeNode _at(int index) {
    if (index == 1) return root!;
    TreeNode node = root!;
    var bit = 1 << (index.bitLength - 2);
    while (bit > 0) {
      node = ((index & bit) == 0 ? node.left : node.right)!;
      bit >>= 1;
    }
    return node;
  }

  void insert(int value) {
    final fresh = TreeNode(value);
    final index = size + 1;
    if (index == 1) {
      root = fresh;
      size = 1;
      return;
    }
    final parent = _at(index ~/ 2);
    if (index.isEven) {
      parent.left = fresh;
    } else {
      parent.right = fresh;
    }
    size = index;
    var current = fresh;
    var position = index;
    while (position > 1) {
      final parentPosition = position ~/ 2;
      final above = _at(parentPosition);
      if (above.value <= current.value) break;
      final temp = above.value;
      above.value = current.value;
      current.value = temp;
      current = above;
      position = parentPosition;
    }
  }

  int? peek() => root?.value;

  int? removeMin() {
    if (size == 0) return null;
    final minimum = root!.value;
    if (size == 1) {
      root = null;
      size = 0;
      return minimum;
    }
    final last = _at(size);
    final replacement = last.value;
    final parent = _at(size ~/ 2);
    if (size.isEven) {
      parent.left = null;
    } else {
      parent.right = null;
    }
    size--;
    root!.value = replacement;
    var index = 1;
    var current = root!;
    while (index * 2 <= size) {
      var childIndex = index * 2;
      var child = current.left!;
      if (childIndex + 1 <= size && current.right!.value < child.value) {
        childIndex++;
        child = current.right!;
      }
      if (current.value <= child.value) break;
      final temp = current.value;
      current.value = child.value;
      child.value = temp;
      current = child;
      index = childIndex;
    }
    return minimum;
  }

  bool isEmpty() => size == 0;
}
