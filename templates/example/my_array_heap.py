from sandbox import HeapMemory


# Min-heap: the smallest key is at index 0. This is a DYNAMIC array, not
# linked nodes. Indices describe one contiguous, complete binary tree.
# Duplicate policy: allowed; every insert stores another occurrence.
class MyArrayHeap:
    def __init__(self):
        self.memory = HeapMemory()

    def insert(self, value: int) -> None:
        memory = self.memory
        memory.append(value)
        i = len(memory) - 1
        while i > 0:
            parent = (i - 1) // 2
            if memory[parent] <= memory[i]:
                break
            memory.swap(parent, i)
            i = parent

    def peek(self) -> int | None:
        if self.memory.is_empty():
            return None
        return self.memory[0]

    def remove_min(self) -> int | None:
        memory = self.memory
        if memory.is_empty():
            return None
        minimum = memory[0]
        last = memory.pop()
        if memory.is_empty():
            return minimum
        memory[0] = last
        i = 0
        while True:
            left = 2 * i + 1
            if left >= len(memory):
                break
            right = left + 1
            smaller = left
            if right < len(memory) and memory[right] < memory[left]:
                smaller = right
            if memory[i] <= memory[smaller]:
                break
            memory.swap(i, smaller)
            i = smaller
        return minimum

    def is_empty(self) -> bool:
        return self.memory.is_empty()
