"""
Height-balanced binary search tree (AVL).
Duplicate policy: not allowed; inserting an existing value changes nothing.
Implement the public operations below.
"""

from sandbox import TreeNode


class MyAVL:
    def __init__(self):
        self.root: TreeNode | None = None

    def insert(self, value: int) -> None:
        # TODO: Insert value if absent; preserve BST order and AVL balance.
        pass

    def contains(self, value: int) -> bool:
        # TODO: Return True if value is present; otherwise return False.
        return False

    def remove(self, value: int) -> bool:
        # TODO: Remove value if present; preserve AVL invariants and report success.
        return False


# Quick reference · TreeNode
#   TreeNode(value)         Create a node
#   node.value              Stored int
#   node.left / node.right  Child nodes or None
#   node.height             Stored subtree height (a leaf has height 1)
#   self.root               Root node or None
