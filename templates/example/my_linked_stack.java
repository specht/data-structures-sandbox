import sandbox.ListNode;

// LIFO linked stack: head is the TOP. No fixed capacity or sorted ordering.
// Duplicate policy: allowed; every push stores another occurrence.
class MyLinkedStack {
    ListNode head = null;

    public boolean push(int value) {
        ListNode fresh = new ListNode(value);
        fresh.next = head;
        head = fresh;
        return true;
    }

    public Integer pop() {
        if (head == null) return null;
        int value = head.value;
        head = head.next;
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
