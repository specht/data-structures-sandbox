// Height-balanced binary search tree (AVL).
// Duplicate policy: not allowed; inserting an existing value changes nothing.
// Implement the public operations below.

import sandbox.TreeNode;

class MyAVL {
    TreeNode root = null;

    public void insert(int value) {
        // TODO: Insert value if absent; preserve BST order and AVL balance.
    }

    public boolean contains(int value) {
        // TODO: Return true if value is present; otherwise return false.
        return false;
    }

    public boolean remove(int value) {
        // TODO: Remove value if present; preserve AVL invariants and report success.
        return false;
    }
}

// Quick reference · TreeNode
//   new TreeNode(value)       Create a node
//   node.value                Stored int
//   node.left / node.right    Child nodes or null
//   node.height               Stored subtree height (a leaf has height 1)
//   root                      Root node or null
