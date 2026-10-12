// Linked queue (FIFO).
// Duplicate policy: allowed; every enqueue stores another occurrence.
// Implement the public operations below.

import sandbox.ListNode;

class MyLinkedQueue {
    ListNode head = null;
    ListNode tail = null;

    public boolean enqueue(int value) {
        // TODO: Add value at the end of the queue and return true.
        return false;
    }

    public Integer dequeue() {
        // TODO: Remove and return the oldest value, or null if the queue is empty.
        return null;
    }

    public Integer peek() {
        // TODO: Return the oldest value without removing it, or null if empty.
        return null;
    }

    public boolean isEmpty() {
        // TODO: Return true exactly when the queue contains no elements.
        return false;
    }
}

// Quick reference · ListNode
//   new ListNode(value)   Create a node
//   node.value            Stored int
//   node.next             Successor node or null
//   head / tail           Oldest / newest node (null if empty)
