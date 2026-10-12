// Unsorted singly linked list with index-based access.
// Duplicate policy: allowed; every successful insert stores another occurrence.

import sandbox.ListNode;

class MyUnsortedLinkedList {
    ListNode head = null;
    int size = 0; // Number of reachable nodes; maintained by student code.

    public boolean insert(int index, int value) {
        // TODO: Insert value at index; return false for an invalid index.
        return false;
    }

    public Integer get(int index) {
        // TODO: Return the value at index, or null if invalid.
        return null;
    }

    public Integer removeAt(int index) {
        // TODO: Remove and return the value at index, or null if invalid.
        return null;
    }

    public boolean contains(int value) {
        // TODO: Test whether any node contains value.
        return false;
    }

    public int length() {
        // TODO: Return the size field; do not traverse the chain to count.
        return 0;
    }
}

// Quick reference · ListNode
//   new ListNode(value)   Create a node
//   node.value            Stored int
//   node.next             Successor node or null
//   head                  First node or null
//   size                  Student-maintained logical length
