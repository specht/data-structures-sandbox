from sandbox import ListNode


# LIFO linked stack: head is the TOP. No fixed capacity or sorted ordering.
# Duplicate policy: allowed; every push stores another occurrence.
class MyLinkedStack:
    def __init__(self):
        self.head: ListNode | None = None

    def push(self, value: int) -> bool:
        fresh = ListNode(value)
        fresh.next = self.head
        self.head = fresh
        return True

    def pop(self) -> int | None:
        if self.head is None:
            return None
        value = self.head.value
        self.head = self.head.next
        return value

    def peek(self) -> int | None:
        if self.head is None:
            return None
        return self.head.value

    def is_empty(self) -> bool:
        return self.head is None
