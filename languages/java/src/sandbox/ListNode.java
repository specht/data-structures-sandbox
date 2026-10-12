package sandbox;

import java.util.LinkedHashMap;
import java.util.Map;

/** A node of a singly linked chain: {@code node.value} and {@code node.next}. */
public final class ListNode {
    static int nextId = 0;
    static final Map<Integer, ListNode> registry = new LinkedHashMap<>();

    static void resetIds() {
        nextId = 0;
        registry.clear();
    }

    final int id;
    public int value;
    public ListNode next = null;

    public ListNode(int value) {
        this.id = ++nextId;
        this.value = value;
        if (Trace.active instanceof Recorders.Recorder recorder) recorder.createNode(this);
    }

    @Override
    public String toString() {
        return "ListNode(" + value + ")";
    }
}
