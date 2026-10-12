package sandbox;

import java.util.List;

/**
 * Fixed cells for an array stack. The stack class owns its {@code top} index.
 *
 * <pre>
 *   memory.length            physical capacity
 *   memory.get(i)            read a cell: an Integer or null
 *   memory.set(i, value)     write a value (null clears a cell)
 * </pre>
 */
public final class FixedMemory {
    /** The number of physical cells; it never changes. */
    public final int length;

    final Integer[] cells;

    public FixedMemory(int capacity) {
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
        if (Trace.active instanceof Recorders.StackRecorder recorder) recorder.cellWrite(index, before, value);
    }

    List<Integer> copy() {
        return Cells.copy(cells);
    }

    @Override
    public String toString() {
        return "FixedMemory(" + length + ")";
    }
}
