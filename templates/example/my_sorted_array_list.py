from sandbox import ListMemory


# Fixed-capacity array list in nondecreasing order.
# Duplicate policy: allowed; every successful insert stores another occurrence.
class MySortedArrayList:
    def __init__(self):
        self.memory = ListMemory(8)
        self.size = 0  # Number of occupied cells; maintained by student code.

    def insert(self, value: int) -> bool:
        if self.size == len(self.memory):
            return False
        index = 0
        while index < self.size and self.memory[index] <= value:
            index += 1
        for i in range(self.size, index, -1):
            self.memory[i] = self.memory[i - 1]
        self.memory[index] = value
        self.size = self.size + 1
        return True

    def contains(self, value: int) -> bool:
        for i in range(self.size):
            if self.memory[i] == value:
                return True
            if self.memory[i] > value:
                return False
        return False

    def remove(self, value: int) -> bool:
        index = 0
        while index < self.size and self.memory[index] < value:
            index += 1
        if index == self.size or self.memory[index] != value:
            return False
        for i in range(index, self.size - 1):
            self.memory[i] = self.memory[i + 1]
        self.memory[self.size - 1] = None
        self.size = self.size - 1
        return True

    def length(self) -> int:
        return self.size
