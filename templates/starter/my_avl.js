// Height-balanced binary search tree (AVL).
// Duplicate policy: not allowed; inserting an existing value changes nothing.
// Implement the public operations below.

import { TreeNode } from "sandbox";

export default class MyAVL {
  constructor() {
    this.root = null;
  }

  insert(value) {
    // TODO: Insert value if absent; preserve BST order and AVL balance.
  }

  contains(value) {
    // TODO: Return true if value is present; otherwise return false.
    return false;
  }

  remove(value) {
    // TODO: Remove value if present; preserve AVL invariants and report success.
    return false;
  }
}

// Quick reference · TreeNode
//   new TreeNode(value)     Create a node
//   node.value              Stored integer
//   node.left / node.right  Child nodes or null
//   node.height             Stored subtree height (a leaf has height 1)
//   this.root               Root node or null
