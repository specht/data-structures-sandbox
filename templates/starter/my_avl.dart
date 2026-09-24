/*
Height-balanced binary search tree (AVL).
Implement the public operations below.
*/

import '../../lib/tree_sandbox.dart';

class MyAVL {
  TreeNode? root;

  void insert(int value) {
    // TODO: Insert value if absent; preserve BST order and AVL balance.
  }

  bool contains(int value) {
    // TODO: Return true if value is present; otherwise return false.
    return false;
  }

  bool remove(int value) {
    // TODO: Remove value if present; preserve AVL invariants and report success.
    return false;
  }
}

/*
REFERENCE: TreeNode and the AVL contract

  TreeNode(value)         Create a node containing an int.
  node.value             Read or write its int value.
  node.left              Read the left child (TreeNode?; may be null).
  node.right             Read the right child (TreeNode?; may be null).
  node.left = child;     Set a nullable left reference (TreeNode?).
  node.right = child;    Set a nullable right reference (TreeNode?).
  node.height            Read or write stored height (int).
  root                   Root reference (TreeNode?; initially null).

  A missing subtree has height 0; a leaf has height 1.
  Balance factor = height(left subtree) - height(right subtree).
  After every public operation, every node must have a correct stored
  height and a balance factor in [-1, 1]. All left-subtree keys are smaller
  and all right-subtree keys are greater; duplicate keys are ignored.
  insert returns void. contains and remove return bool.
*/
