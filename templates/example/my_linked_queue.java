import sandbox.ListNode;

// FIFO queue: head is the next element to leave; tail is the newest element.
// Empty iff BOTH references are null.
// Duplicate policy: allowed; every enqueue stores another occurrence.
class MyLinkedQueue {
    ListNode head = null;
    ListNode tail = null;

    public boolean enqueue(int value) {
        ListNode fresh = new ListNode(value);
        if (tail == null) {
            head = fresh;
        } else {
            tail.next = fresh;
        }
        tail = fresh;
        return true;
    }

    public Integer dequeue() {
        if (head == null) return null;
        int value = head.value;
        head = head.next;
        if (head == null) tail = null;
        return value;
    }

    public Integer peek() {
        if (head == null) return null;
        return head.value;
    }

    public boolean isEmpty() {
        return head == null;
    }
}
