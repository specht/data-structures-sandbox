"""
Fixed-capacity circular queue (FIFO).
Duplicate policy: allowed; every successful enqueue stores another occurrence.
Implement the public operations below.
"""

from sandbox import QueueMemory


class MyArrayQueue:
    def __init__(self):
        self.memory = QueueMemory(8)

    def enqueue(self, value: int) -> bool:
        # TODO: Add value at the end; return False without changing the queue if full.
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

    def is_full(self) -> bool:
        # TODO: Return True exactly when the queue has reached its capacity.
        return False


# Quick reference · QueueMemory
#   len(memory)           Physical capacity (8)
#   memory[i]             Read a cell: an int or None
#   memory[i] = value     Write an int (None clears a cell)
#   memory.front          Index of the next value to dequeue
#   memory.rear           Index of the next free cell
#   memory.size           Current number of stored values
