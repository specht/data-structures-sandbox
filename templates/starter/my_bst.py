"""
Binary search tree of integers.
Duplicate policy: not allowed; inserting an existing value changes nothing.
Implement the public operations below.
"""

from sandbox import TreeNode


class MyBST:
    def __init__(self):
        self.root: TreeNode | None = None

    def insert(self, value: int) -> None:
        # TODO: Insert value if absent; preserve the binary search tree property.
        pass

    def contains(self, value: int) -> bool:
        # TODO: Return True if value is present; otherwise return False.
        return False

    def remove(self, value: int) -> bool:
        # TODO: Remove value if present; return True if a value was removed.
        return False


# Quick reference · TreeNode
#   TreeNode(value)         Create a node
#   node.value              Stored int
#   node.left / node.right  Child nodes or None
#   self.root               Root node or None
