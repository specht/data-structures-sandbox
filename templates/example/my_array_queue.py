from sandbox import QueueMemory


# Circular queue: cells stay at fixed indices, even when front/rear wrap.
# memory.front = index of the next item to dequeue;
# memory.rear  = index of the next empty cell to enqueue into.
# Both are 0 when the queue starts. size distinguishes full from empty.
# Duplicate policy: allowed; every successful enqueue stores another occurrence.
class MyArrayQueue:
    def __init__(self):
        self.memory = QueueMemory(8)

    def enqueue(self, value: int) -> bool:
        memory = self.memory
        if memory.size == len(memory):
            return False
        memory[memory.rear] = value
        memory.rear = (memory.rear + 1) % len(memory)
        memory.size = memory.size + 1
        return True

    def dequeue(self) -> int | None:
        memory = self.memory
        if memory.size == 0:
            return None
        value = memory[memory.front]
        memory[memory.front] = None
        memory.front = (memory.front + 1) % len(memory)
        memory.size = memory.size - 1
        return value

    def peek(self) -> int | None:
        if self.memory.size == 0:
            return None
        return self.memory[self.memory.front]

    def is_empty(self) -> bool:
        return self.memory.size == 0

    def is_full(self) -> bool:
        return self.memory.size == len(self.memory)
