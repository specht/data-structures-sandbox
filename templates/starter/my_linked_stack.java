// Linked stack (LIFO).
// Duplicate policy: allowed; every push stores another occurrence.
// Implement the public operations below.

import sandbox.ListNode;

class MyLinkedStack {
    ListNode head = null;

    public boolean push(int value) {
        // TODO: Add value to the stack and return true.
        return false;
    }

    public Integer pop() {
        // TODO: Remove and return the top value, or null if the stack is empty.
        return null;
    }

    public Integer peek() {
        // TODO: Return the top value without removing it, or null if empty.
        return null;
    }

    public boolean isEmpty() {
        // TODO: Return true exactly when the stack contains no elements.
        return false;
    }
}

// Quick reference · ListNode
//   new ListNode(value)   Create a node
//   node.value            Stored int
//   node.next             Successor node or null
//   head                  Top node or null
