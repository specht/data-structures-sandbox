"""
Sorted singly linked list of integers.
Duplicate policy: allowed; every insert stores another occurrence.
Implement the public operations below.
"""

from sandbox import ListNode


class MySortedLinkedList:
    def __init__(self):
        self.head: ListNode | None = None
        self.size = 0  # Number of nodes; update this field yourself.

    def insert(self, value: int) -> bool:
        # TODO: Insert one occurrence in ascending order and return True.
        return False

    def length(self) -> int:
        # TODO: Return the student-maintained size field (no traversal).
        return 0

    def contains(self, value: int) -> bool:
        # TODO: Return True if the list contains value; otherwise return False.
        return False

    def remove(self, value: int) -> bool:
        # TODO: Remove one occurrence of value; return True if it was present.
        return False


# Quick reference · ListNode
#   ListNode(value)   Create a node
#   node.value        Stored int
#   node.next         Successor node or None
#   self.head         First node or None
#   self.size         Student-maintained logical length
