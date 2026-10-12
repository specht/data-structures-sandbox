// Fixed-capacity circular queue (FIFO).
// Duplicate policy: allowed; every successful enqueue stores another occurrence.
// Implement the public operations below.

import sandbox.QueueMemory;

class MyArrayQueue {
    QueueMemory memory = new QueueMemory(8);

    public boolean enqueue(int value) {
        // TODO: Add value at the end; return false without changing the queue if full.
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

    public boolean isFull() {
        // TODO: Return true exactly when the queue has reached its capacity.
        return false;
    }
}

// Quick reference · QueueMemory
//   memory.length          Physical capacity (8)
//   memory.get(i)          Read a cell: an Integer or null
//   memory.set(i, value)   Write a value (null clears a cell)
//   memory.front           Index of the next value to dequeue
//   memory.rear            Index of the next free cell
//   memory.size            Current number of stored values
