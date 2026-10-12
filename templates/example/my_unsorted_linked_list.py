from sandbox import ListNode


# Unsorted singly linked list with index-based operations.
# Duplicate policy: allowed; every successful insert stores another occurrence.
class MyUnsortedLinkedList:
    def __init__(self):
        self.head: ListNode | None = None
        self.size = 0  # Number of reachable nodes; maintained by student code.

    def insert(self, index: int, value: int) -> bool:
        if index < 0:
            return False
        if index == 0:
            fresh = ListNode(value)
            fresh.next = self.head
            self.head = fresh
            self.size += 1
            return True
        previous: ListNode | None = self.head
        i = 0
        while i < index - 1 and previous is not None:
            previous = previous.next
            i += 1
        if previous is None:
            return False
        fresh = ListNode(value)
        fresh.next = previous.next
        previous.next = fresh
        self.size += 1
        return True

    def get(self, index: int) -> int | None:
        if index < 0:
            return None
        current: ListNode | None = self.head
        i = 0
        while i < index and current is not None:
            current = current.next
            i += 1
        return None if current is None else current.value

    def remove_at(self, index: int) -> int | None:
        if index < 0 or self.head is None:
            return None
        if index == 0:
            removed = self.head.value
            self.head = self.head.next
            self.size -= 1
            return removed
        previous: ListNode | None = self.head
        i = 0
        while i < index - 1 and previous is not None:
            previous = previous.next
            i += 1
        if previous is None or previous.next is None:
            return None
        removed_node = previous.next
        previous.next = removed_node.next
        self.size -= 1
        return removed_node.value

    def contains(self, value: int) -> bool:
        current: ListNode | None = self.head
        while current is not None:
            if current.value == value:
                return True
            current = current.next
        return False

    def length(self) -> int:
        return self.size
