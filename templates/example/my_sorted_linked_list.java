import sandbox.ListNode;

// Sorted singly linked list.
// Public methods with simple arguments appear automatically in the browser.
// Duplicate policy: allowed; every insert stores another occurrence.
class MySortedLinkedList {
    ListNode head = null;
    int size = 0; // Maintained by the student, not calculated by the recorder.

    public boolean insert(int value) {
        ListNode current = head;
        ListNode previous = null;
        while (current != null && current.value < value) {
            previous = current;
            current = current.next;
        }
        ListNode fresh = new ListNode(value);
        fresh.next = current;
        if (previous == null) {
            head = fresh;
        } else {
            previous.next = fresh;
        }
        size++;
        return true;
    }

    public int length() {
        return size;
    }

    public boolean contains(int value) {
        ListNode current = head;
        while (current != null) {
            if (current.value == value) return true;
            current = current.next;
        }
        return false;
    }

    public boolean remove(int value) {
        ListNode current = head;
        ListNode previous = null;
        while (current != null) {
            if (current.value == value) {
                if (previous == null) {
                    head = current.next;
                } else {
                    previous.next = current.next;
                }
                size--;
                return true;
            }
            previous = current;
            current = current.next;
        }
        return false;
    }
}
