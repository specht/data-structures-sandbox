package sandbox;

import java.util.List;

/**
 * Fixed cells plus the circular-queue markers.
 *
 * <pre>
 *   memory.length            physical capacity
 *   memory.get(i)            read a cell: an Integer or null
 *   memory.set(i, value)     write a value (null clears a cell)
 *   memory.front             index of the next value to dequeue
 *   memory.rear              index of the next free cell
 *   memory.size              current number of stored values
 * </pre>
 */
public final class QueueMemory {
    /** The number of physical cells; it never changes. */
    public final int length;

    public int front = 0;
    public int rear = 0;
    public int size = 0;

    final Integer[] cells;

    public QueueMemory(int capacity) {
        length = Cells.capacity(capacity);
        cells = new Integer[capacity];
    }

    public Integer get(int index) {
        return cells[Cells.index(length, index, "memory")];
    }

    public void set(int index, Integer value) {
        Cells.index(length, index, "memory");
        Integer before = cells[index];
        cells[index] = value;
        if (Trace.active instanceof Recorders.QueueRecorder recorder) recorder.cellWrite(index, before, value);
    }

    int marker(String name) {
        return switch (name) {
            case "front" -> front;
            case "rear" -> rear;
            default -> size;
        };
    }

    List<Integer> copy() {
        return Cells.copy(cells);
    }

    @Override
    public String toString() {
        return "QueueMemory(" + length + ")";
    }
}
