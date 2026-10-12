import { TreeNode } from "sandbox";

// AVL tree. Height 1 means a leaf; null has height 0.
// Duplicate policy: not allowed; inserting an existing value changes nothing.
// Rotations relink existing TreeNode objects: node IDs remain stable.
export default class MyAVL {
  constructor() {
    this.root = null;
  }

  insert(value) {
    this.root = this._insert(this.root, value);
  }

  contains(value) {
    let node = this.root;
    while (node !== null) {
      if (value === node.value) return true;
      node = value < node.value ? node.left : node.right;
    }
    return false;
  }

  remove(value) {
    if (!this.contains(value)) return false;
    this.root = this._remove(this.root, value);
    return true;
  }

  _height(node) {
    return node === null ? 0 : node.height;
  }

  _balance(node) {
    return this._height(node.left) - this._height(node.right);
  }

  _refresh(node) {
    node.height = 1 + Math.max(this._height(node.left), this._height(node.right));
  }

  _rotateLeft(node) {
    const newRoot = node.right;
    node.right = newRoot.left; // First retarget pointers, then move nodes.
    newRoot.left = node;
    this._refresh(node);
    this._refresh(newRoot);
    return newRoot;
  }

  _rotateRight(node) {
    const newRoot = node.left;
    node.left = newRoot.right;
    newRoot.right = node;
    this._refresh(node);
    this._refresh(newRoot);
    return newRoot;
  }

  _rebalance(node) {
    this._refresh(node);
    const balance = this._balance(node);
    if (balance > 1) {
      if (this._balance(node.left) < 0) node.left = this._rotateLeft(node.left);
      return this._rotateRight(node);
    }
    if (balance < -1) {
      if (this._balance(node.right) > 0) node.right = this._rotateRight(node.right);
      return this._rotateLeft(node);
    }
    return node;
  }

  _insert(node, value) {
    if (node === null) return new TreeNode(value);
    if (value < node.value) {
      node.left = this._insert(node.left, value);
    } else if (value > node.value) {
      node.right = this._insert(node.right, value);
    } else {
      return node;
    }
    return this._rebalance(node);
  }

  _remove(node, value) {
    if (node === null) return null;
    if (value < node.value) {
      node.left = this._remove(node.left, value);
    } else if (value > node.value) {
      node.right = this._remove(node.right, value);
    } else {
      if (node.left === null) return node.right;
      if (node.right === null) return node.left;
      // Replace this node's key with its in-order successor, then remove
      // the successor from the right subtree. The node ID is preserved.
      let successor = node.right;
      while (successor.left !== null) {
        successor = successor.left;
      }
      node.value = successor.value;
      node.right = this._remove(node.right, successor.value);
    }
    return this._rebalance(node);
  }
}
