// Binary search tree of integers.
// Duplicate policy: not allowed; inserting an existing value changes nothing.
// Implement the public operations below.

import sandbox.TreeNode;

class MyBST {
    TreeNode root = null;

    public void insert(int value) {
        // TODO: Insert value if absent; preserve the binary search tree property.
    }

    public boolean contains(int value) {
        // TODO: Return true if value is present; otherwise return false.
        return false;
    }

    public boolean remove(int value) {
        // TODO: Remove value if present; return true if a value was removed.
        return false;
    }
}

// Quick reference · TreeNode
//   new TreeNode(value)       Create a node
//   node.value                Stored int
//   node.left / node.right    Child nodes or null
//   root                      Root node or null
