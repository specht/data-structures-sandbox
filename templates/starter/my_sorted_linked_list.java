// Sorted singly linked list of integers.
// Duplicate policy: allowed; every insert stores another occurrence.
// Implement the public operations below.

import sandbox.ListNode;

class MySortedLinkedList {
    ListNode head = null;
    int size = 0; // Number of nodes; update this field yourself.

    public boolean insert(int value) {
        // TODO: Insert one occurrence in ascending order and return true.
        return false;
    }

    public int length() {
        // TODO: Return the student-maintained size field (no traversal).
        return 0;
    }

    public boolean contains(int value) {
        // TODO: Return true if the list contains value; otherwise return false.
        return false;
    }

    public boolean remove(int value) {
        // TODO: Remove one occurrence of value; return true if it was present.
        return false;
    }
}

// Quick reference · ListNode
//   new ListNode(value)   Create a node
//   node.value            Stored int
//   node.next             Successor node or null
//   head                  First node or null
//   size                  Student-maintained logical length
