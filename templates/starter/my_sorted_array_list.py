"""
Sorted ascending array list with capacity 8.
Duplicate policy: allowed; every successful insert stores another occurrence.
"""

from sandbox import ListMemory


class MySortedArrayList:
    def __init__(self):
        self.memory = ListMemory(8)
        self.size = 0  # Number of occupied cells; maintained by student code.

    def insert(self, value: int) -> bool:
        # TODO: Insert value in ascending order; return False if full.
        return False

    def contains(self, value: int) -> bool:
        # TODO: Search for the value without changing the list.
        return False

    def remove(self, value: int) -> bool:
        # TODO: Remove one matching value and report whether it existed.
        return False

    def length(self) -> int:
        # TODO: Return the current number of stored values.
        return 0


# Quick reference · ListMemory
#   len(memory)         Physical capacity (8)
#   memory[i]           Read a cell: an int or None
#   memory[i] = value   Write an int (None clears a cell)
#   self.size           Student-maintained logical length
