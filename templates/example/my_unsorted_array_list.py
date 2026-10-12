from sandbox import ListMemory


# Unsorted, fixed-capacity array list. The list owns its logical size.
# Values are stored contiguously in cells 0 … size-1.
# Duplicate policy: allowed; every successful insert stores another occurrence.
class MyUnsortedArrayList:
    def __init__(self):
        self.memory = ListMemory(8)
        self.size = 0  # Number of occupied cells; maintained by student code.

    def insert(self, index: int, value: int) -> bool:
        if index < 0 or index > self.size or self.size == len(self.memory):
            return False
        for i in range(self.size, index, -1):
            self.memory[i] = self.memory[i - 1]
        self.memory[index] = value
        self.size = self.size + 1
        return True

    def get(self, index: int) -> int | None:
        if index < 0 or index >= self.size:
            return None
        return self.memory[index]

    def remove_at(self, index: int) -> int | None:
        if index < 0 or index >= self.size:
            return None
        removed = self.memory[index]
        for i in range(index, self.size - 1):
            self.memory[i] = self.memory[i + 1]
        self.memory[self.size - 1] = None
        self.size = self.size - 1
        return removed

    def contains(self, value: int) -> bool:
        for i in range(self.size):
            if self.memory[i] == value:
                return True
        return False

    def length(self) -> int:
        return self.size
