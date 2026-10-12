"""
Linked stack (LIFO).
Duplicate policy: allowed; every push stores another occurrence.
Implement the public operations below.
"""

from sandbox import ListNode


class MyLinkedStack:
    def __init__(self):
        self.head: ListNode | None = None

    def push(self, value: int) -> bool:
        # TODO: Add value to the stack and return True.
        return False

    def pop(self) -> int | None:
        # TODO: Remove and return the top value, or None if the stack is empty.
        return None

    def peek(self) -> int | None:
        # TODO: Return the top value without removing it, or None if empty.
        return None

    def is_empty(self) -> bool:
        # TODO: Return True exactly when the stack contains no elements.
        return False


# Quick reference · ListNode
#   ListNode(value)   Create a node
#   node.value        Stored int
#   node.next         Successor node or None
#   self.head         Top node or None
