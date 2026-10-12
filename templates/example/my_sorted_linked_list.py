from sandbox import ListNode


# Sorted singly linked list.
# Public methods with simple arguments appear automatically in the browser.
# Duplicate policy: allowed; every insert stores another occurrence.
class MySortedLinkedList:
    def __init__(self):
        self.head: ListNode | None = None
        self.size = 0  # Maintained by the student, not calculated by the recorder.

    def insert(self, value: int) -> bool:
        current: ListNode | None = self.head
        previous: ListNode | None = None
        while current is not None and current.value < value:
            previous = current
            current = current.next
        fresh = ListNode(value)
        fresh.next = current
        if previous is None:
            self.head = fresh
        else:
            previous.next = fresh
        self.size += 1
        return True

    def length(self) -> int:
        return self.size

    def contains(self, value: int) -> bool:
        current: ListNode | None = self.head
        while current is not None:
            if current.value == value:
                return True
            current = current.next
        return False

    def remove(self, value: int) -> bool:
        current: ListNode | None = self.head
        previous: ListNode | None = None
        while current is not None:
            if current.value == value:
                if previous is None:
                    self.head = current.next
                else:
                    previous.next = current.next
                self.size -= 1
                return True
            previous = current
            current = current.next
        return False
