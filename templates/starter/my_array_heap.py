"""
Array-based min-heap of integers.
Duplicate policy: allowed; every insert stores another occurrence.
Implement the public operations below.
"""

from sandbox import HeapMemory


class MyArrayHeap:
    def __init__(self):
        self.memory = HeapMemory()

    def insert(self, value: int) -> None:
        # TODO: Insert value while preserving the min-heap property.
        pass

    def remove_min(self) -> int | None:
        # TODO: Remove and return the minimum value, or None if the heap is empty.
        return None

    def peek(self) -> int | None:
        # TODO: Return the minimum value without removing it, or None if empty.
        return None

    def is_empty(self) -> bool:
        # TODO: Return True exactly when the heap contains no elements.
        return False


# Quick reference · HeapMemory
#   len(memory)           Number of stored values
#   memory[i]             Read the int at index i
#   memory[i] = value     Replace an existing value
#   memory.append(value)  Append a value
#   memory.pop()          Remove and return the last value
#   memory.swap(i, j)     Exchange two indexed values
