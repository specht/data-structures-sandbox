// Fixed-capacity array stack (LIFO).
// Duplicate policy: allowed; every successful push stores another occurrence.
// Implement the public operations below.

import sandbox.FixedMemory;

class MyArrayStack {
    FixedMemory memory = new FixedMemory(8);
    // Student-owned logical state. -1 means no element is stored.
    int top = -1;

    public boolean push(int value) {
        // TODO: Add value to the stack; return false without changing it if full.
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

// Quick reference · FixedMemory
//   memory.length          Physical capacity (8)
//   memory.get(i)          Read a cell: an Integer or null
//   memory.set(i, value)   Write a value (null clears a cell)
//   top                    Student-maintained top index (-1 if empty)
