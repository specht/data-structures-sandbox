/*
Binary search tree of integers.
Implement the public operations below.
*/

import '../../lib/tree_sandbox.dart';

class MyBST {
  TreeNode? root;

  void insert(int value) {
    // TODO: Insert value if absent; preserve the binary search tree property.
  }

  bool contains(int value) {
    // TODO: Return true if value is present; otherwise return false.
    return false;
  }

  bool remove(int value) {
    // TODO: Remove value if present; return true if a value was removed.
    return false;
  }
}

/*
REFERENCE: TreeNode and the binary search tree contract

  TreeNode(value)         Create a node containing an int.
  node.value             Read or write its int value.
  node.left              Read the left child (TreeNode?; may be null).
  node.right             Read the right child (TreeNode?; may be null).
  node.left = child;     Set a nullable left reference (TreeNode?).
  node.right = child;    Set a nullable right reference (TreeNode?).
  root                   Root reference (TreeNode?; initially null).

  All keys in a left subtree are smaller than the node's key; all keys
  in a right subtree are greater. Duplicate keys are ignored.
  Preserve existing node identities when they remain in the tree.
  insert returns void. contains and remove return bool.
  The tree has no automatic height-balancing requirement.
*/
