from sandbox import FixedMemory


# Fixed-capacity stack: no list.append(), no list.pop().
# The fixed array indices stay stable; only values and top change.
# Duplicate policy: allowed; every successful push stores another occurrence.
class MyArrayStack:
    def __init__(self):
        self.memory = FixedMemory(8)
        # The stack owns its logical top; FixedMemory contains only its cells.
        self.top = -1

    def push(self, value: int) -> bool:
        if self.top + 1 == len(self.memory):
            return False
        self.top = self.top + 1
        self.memory[self.top] = value
        return True

    def pop(self) -> int | None:
        if self.top < 0:
            return None
        value = self.memory[self.top]
        self.memory[self.top] = None
        self.top = self.top - 1
        return value

    def peek(self) -> int | None:
        if self.top < 0:
            return None
        return self.memory[self.top]

    def is_empty(self) -> bool:
        return self.top == -1
