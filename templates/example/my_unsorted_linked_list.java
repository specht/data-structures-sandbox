import sandbox.ListNode;

// Unsorted singly linked list with index-based operations.
// Duplicate policy: allowed; every successful insert stores another occurrence.
class MyUnsortedLinkedList {
    ListNode head = null;
    int size = 0; // Number of reachable nodes; maintained by student code.

    public boolean insert(int index, int value) {
        if (index < 0) return false;
        if (index == 0) {
            ListNode fresh = new ListNode(value);
            fresh.next = head;
            head = fresh;
            size++;
            return true;
        }
        ListNode previous = head;
        int i = 0;
        while (i < index - 1 && previous != null) {
            previous = previous.next;
            i++;
        }
        if (previous == null) return false;
        ListNode fresh = new ListNode(value);
        fresh.next = previous.next;
        previous.next = fresh;
        size++;
        return true;
    }

    public Integer get(int index) {
        if (index < 0) return null;
        ListNode current = head;
        int i = 0;
        while (i < index && current != null) {
            current = current.next;
            i++;
        }
        return current == null ? null : current.value;
    }

    public Integer removeAt(int index) {
        if (index < 0 || head == null) return null;
        if (index == 0) {
            int removed = head.value;
            head = head.next;
            size--;
            return removed;
        }
        ListNode previous = head;
        int i = 0;
        while (i < index - 1 && previous != null) {
            previous = previous.next;
            i++;
        }
        if (previous == null || previous.next == null) return null;
        ListNode removedNode = previous.next;
        previous.next = removedNode.next;
        size--;
        return removedNode.value;
    }

    public boolean contains(int value) {
        ListNode current = head;
        while (current != null) {
            if (current.value == value) return true;
            current = current.next;
        }
        return false;
    }

    public int length() {
        return size;
    }
}
