import { TreeNode } from "sandbox";

// Ordinary, UNBALANCED binary search tree.
// Duplicate policy: not allowed; inserting an existing value changes nothing.
// Compare sorted insertion orders with other insertion orders.
export default class MyBST {
  constructor() {
    this.root = null;
  }

  insert(value) {
    if (this.root === null) {
      this.root = new TreeNode(value);
      return;
    }
    let current = this.root;
    while (current !== null) {
      if (value === current.value) return;
      if (value < current.value) {
        if (current.left === null) {
          current.left = new TreeNode(value);
          return;
        }
        current = current.left;
      } else {
        if (current.right === null) {
          current.right = new TreeNode(value);
          return;
        }
        current = current.right;
      }
    }
  }

  contains(value) {
    let current = this.root;
    while (current !== null) {
      if (value === current.value) return true;
      current = value < current.value ? current.left : current.right;
    }
    return false;
  }

  remove(value) {
    let parent = null;
    let current = this.root;
    while (current !== null && current.value !== value) {
      parent = current;
      current = value < current.value ? current.left : current.right;
    }
    if (current === null) return false;
    if (current.left !== null && current.right !== null) {
      let successorParent = current;
      let successor = current.right;
      while (successor.left !== null) {
        successorParent = successor;
        successor = successor.left;
      }
      current.value = successor.value;
      parent = successorParent;
      current = successor;
    }
    const child = current.left !== null ? current.left : current.right;
    if (parent === null) {
      this.root = child;
    } else if (parent.left === current) {
      parent.left = child;
    } else {
      parent.right = child;
    }
    return true;
  }
}
