"""
Unsorted singly linked list with index-based access.
Duplicate policy: allowed; every successful insert stores another occurrence.
"""

from sandbox import ListNode


class MyUnsortedLinkedList:
    def __init__(self):
        self.head: ListNode | None = None
        self.size = 0  # Number of reachable nodes; maintained by student code.

    def insert(self, index: int, value: int) -> bool:
        # TODO: Insert value at index; return False for an invalid index.
        return False

    def get(self, index: int) -> int | None:
        # TODO: Return the value at index, or None if invalid.
        return None

    def remove_at(self, index: int) -> int | None:
        # TODO: Remove and return the value at index, or None if invalid.
        return None

    def contains(self, value: int) -> bool:
        # TODO: Test whether any node contains value.
        return False

    def length(self) -> int:
        # TODO: Return the size field; do not traverse the chain to count.
        return 0


# Quick reference · ListNode
#   ListNode(value)   Create a node
#   node.value        Stored int
#   node.next         Successor node or None
#   self.head         First node or None
#   self.size         Student-maintained logical length
