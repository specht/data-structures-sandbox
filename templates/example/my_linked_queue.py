from sandbox import ListNode


# FIFO queue: head is the next element to leave; tail is the newest element.
# Empty iff BOTH references are None.
# Duplicate policy: allowed; every enqueue stores another occurrence.
class MyLinkedQueue:
    def __init__(self):
        self.head: ListNode | None = None
        self.tail: ListNode | None = None

    def enqueue(self, value: int) -> bool:
        fresh = ListNode(value)
        if self.tail is None:
            self.head = fresh
        else:
            self.tail.next = fresh
        self.tail = fresh
        return True

    def dequeue(self) -> int | None:
        if self.head is None:
            return None
        value = self.head.value
        self.head = self.head.next
        if self.head is None:
            self.tail = None
        return value

    def peek(self) -> int | None:
        if self.head is None:
            return None
        return self.head.value

    def is_empty(self) -> bool:
        return self.head is None
