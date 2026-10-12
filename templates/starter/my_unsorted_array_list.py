"""
Unsorted array list with index-based insert/get/remove operations.
Duplicate policy: allowed; every successful insert stores another occurrence.
"""

from sandbox import ListMemory


class MyUnsortedArrayList:
    def __init__(self):
        self.memory = ListMemory(8)
        self.size = 0  # Number of occupied cells; maintained by student code.

    def insert(self, index: int, value: int) -> bool:
        # TODO: Insert value at index; return False if invalid or full.
        return False

    def get(self, index: int) -> int | None:
        # TODO: Return the indexed value, or None if the index is invalid.
        return None

    def remove_at(self, index: int) -> int | None:
        # TODO: Remove and return the value at index, or None if invalid.
        return None

    def contains(self, value: int) -> bool:
        # TODO: Return whether value is in the list.
        return False

    def length(self) -> int:
        # TODO: Return the student-maintained size, NOT len(self.memory).
        return 0


# Quick reference · ListMemory
#   len(memory)         Physical capacity (8)
#   memory[i]           Read a cell: an int or None
#   memory[i] = value   Write an int (None clears a cell)
#   self.size           Student-maintained logical length
