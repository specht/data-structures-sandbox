"""
Fixed-capacity array stack (LIFO).
Duplicate policy: allowed; every successful push stores another occurrence.
Implement the public operations below.
"""

from sandbox import FixedMemory


class MyArrayStack:
    def __init__(self):
        self.memory = FixedMemory(8)
        # Student-owned logical state. -1 means no element is stored.
        self.top = -1

    def push(self, value: int) -> bool:
        # TODO: Add value to the stack; return False without changing it if full.
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


# Quick reference · FixedMemory
#   len(memory)         Physical capacity (8)
#   memory[i]           Read a cell: an int or None
#   memory[i] = value   Write an int (None clears a cell)
#   self.top            Student-maintained top index (-1 if empty)
