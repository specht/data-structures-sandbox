import sandbox.QueueMemory;

// Circular queue: cells stay at fixed indices, even when front/rear wrap.
// memory.front = index of the next item to dequeue;
// memory.rear  = index of the next empty cell to enqueue into.
// Both are 0 when the queue starts. size distinguishes full from empty.
// Duplicate policy: allowed; every successful enqueue stores another occurrence.
class MyArrayQueue {
    QueueMemory memory = new QueueMemory(8);

    public boolean enqueue(int value) {
        if (memory.size == memory.length) return false;
        memory.set(memory.rear, value);
        memory.rear = (memory.rear + 1) % memory.length;
        memory.size = memory.size + 1;
        return true;
    }

    public Integer dequeue() {
        if (memory.size == 0) return null;
        Integer value = memory.get(memory.front);
        memory.set(memory.front, null);
        memory.front = (memory.front + 1) % memory.length;
        memory.size = memory.size - 1;
        return value;
    }

    public Integer peek() {
        if (memory.size == 0) return null;
        return memory.get(memory.front);
    }

    public boolean isEmpty() {
        return memory.size == 0;
    }

    public boolean isFull() {
        return memory.size == memory.length;
    }
}
