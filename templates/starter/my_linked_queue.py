"""
Linked queue (FIFO).
Duplicate policy: allowed; every enqueue stores another occurrence.
Implement the public operations below.
"""

from sandbox import ListNode


class MyLinkedQueue:
    def __init__(self):
        self.head: ListNode | None = None
        self.tail: ListNode | None = None

    def enqueue(self, value: int) -> bool:
        # TODO: Add value at the end of the queue and return True.
        return False

    def dequeue(self) -> int | None:
        # TODO: Remove and return the oldest value, or None if the queue is empty.
        return None

    def peek(self) -> int | None:
        # TODO: Return the oldest value without removing it, or None if empty.
        return None

    def is_empty(self) -> bool:
        # TODO: Return True exactly when the queue contains no elements.
        return False


# Quick reference · ListNode
#   ListNode(value)       Create a node
#   node.value            Stored int
#   node.next             Successor node or None
#   self.head / self.tail Oldest / newest node (None if empty)
