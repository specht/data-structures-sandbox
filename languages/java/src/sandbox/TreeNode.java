package sandbox;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A binary tree node: {@code value}, {@code left}, {@code right} and {@code height} (a leaf has
 * height 1).
 */
public final class TreeNode {
    static int nextId = 0;
    static final Map<Integer, TreeNode> registry = new LinkedHashMap<>();

    static void resetIds() {
        nextId = 0;
        registry.clear();
    }

    final int id;
    public int value;
    public int height = 1;
    public TreeNode left = null;
    public TreeNode right = null;

    public TreeNode(int value) {
        this.id = ++nextId;
        this.value = value;
        if (Trace.active instanceof Recorders.TreeRecorder recorder) recorder.createNode(this);
    }

    @Override
    public String toString() {
        return "TreeNode(" + value + ")";
    }
}
