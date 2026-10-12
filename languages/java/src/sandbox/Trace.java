package sandbox;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * What the instrumented copy of a student's class calls (through {@code __sandbox.Checkpoint}).
 * Internal to the sandbox; student code does not use it.
 *
 * <p>Java cannot intercept field assignments, so the copy reports them itself:
 *
 * <pre>
 *   node.next = fresh;      →  __sandbox.Checkpoint.wrote(node, "next", node.next, (node.next = fresh));
 *   size++;                 →  __sandbox.Checkpoint.wrote(MyList.this, "size", size, (size++));
 *   current.value           →  __sandbox.Checkpoint.visit(current, "current").value
 * </pre>
 *
 * <p>Insertions never contain line breaks, so line numbers stay the student's.
 */
public final class Trace {
    private Trace() {}

    /** The recorder of the running operation, or null (then nothing is recorded). */
    static Recorders.Base active;
    /** The student's object: assignments to its fields named below are recorded. */
    static Object owner;
    static Set<String> indexFields = Set.of();
    static Set<String> pointerFields = Set.of();
    /** ListNode or TreeNode: node-typed locals become variableWrite events. */
    static Class<?> nodeType;

    private static final Object UNSET = new Object();

    /** The local variables of one method call that were reported last. */
    static final class Frame {
        final Map<String, Object> nodes = new HashMap<>();
    }

    public static Object enter(int line) {
        Recorders.Base recorder = active;
        if (recorder != null) recorder.atLine(line);
        return new Frame();
    }

    /** Before a statement: node-typed locals as {@code "name", value} pairs. */
    public static void at(int line, Object frame, Object... namesAndValues) {
        Recorders.Base recorder = active;
        if (recorder == null) return;
        if (frame instanceof Frame locals && namesAndValues.length > 0) references(locals, namesAndValues, recorder);
        recorder.atLine(line);
    }

    private static void references(Frame frame, Object[] namesAndValues, Recorders.Base recorder) {
        boolean chains = recorder instanceof Recorders.Recorder;
        boolean trees = recorder instanceof Recorders.TreeRecorder;
        if (!chains && !trees) return;
        for (int i = 0; i + 1 < namesAndValues.length; i += 2) {
            String name = (String) namesAndValues[i];
            Object value = namesAndValues[i + 1];
            if (value != null && !(chains ? value instanceof ListNode : value instanceof TreeNode)) continue;
            Integer id = Recorders.idOf(value);
            Object before = frame.nodes.getOrDefault(name, UNSET);
            if (before != UNSET && Objects.equals(before, id)) continue;
            frame.nodes.put(name, id);
            recorder.steps.add(Recorders.event("kind", "variableWrite", "name", name, "to", id,
                    "line", recorder.sourceLine));
        }
    }

    /** After an assignment to {@code target.field} (the assignment is {@code result}). */
    public static <T> T wrote(Object target, String field, Object before, T result) {
        Recorders.Base recorder = active;
        if (recorder == null || target == null) return result;
        if (target instanceof ListNode node) {
            if (field.equals("next") && recorder instanceof Recorders.Recorder chains) {
                chains.pointerWrite("node:" + node.id + ".next", before, node.next);
            }
        } else if (target instanceof TreeNode node) {
            if (recorder instanceof Recorders.TreeRecorder tree) {
                switch (field) {
                    case "left" -> tree.pointerWrite("node:" + node.id + ".left", before, node.left);
                    case "right" -> tree.pointerWrite("node:" + node.id + ".right", before, node.right);
                    case "height" -> tree.heightWrite(node, before, node.height);
                    case "value" -> tree.valueWrite();
                    default -> { }
                }
            }
        } else if (target instanceof QueueMemory memory) {
            if (recorder instanceof Recorders.QueueRecorder) recorder.indexWrite(field, before, memory.marker(field));
        } else if (target == owner) {
            Object after = read(target, field);
            if (indexFields.contains(field)) {
                recorder.indexWrite(field, before, after);
            } else if (pointerFields.contains(field)) {
                if (recorder instanceof Recorders.Recorder chains) chains.pointerWrite("root:" + field, before, after);
                if (recorder instanceof Recorders.TreeRecorder tree) tree.pointerWrite("root:" + field, before, after);
            }
        }
        return result;
    }

    /** Before {@code node.value} is read. */
    public static <T> T visit(T node, String text) {
        if (node == null) {
            throw new NullPointerException("Cannot read field \"value\" because \"" + text + "\" is null");
        }
        Recorders.Base recorder = active;
        if (node instanceof ListNode list && recorder instanceof Recorders.Recorder chains) chains.visit(list);
        if (node instanceof TreeNode tree && recorder instanceof Recorders.TreeRecorder trees) trees.visit(tree);
        return node;
    }

    /** A field of the student's object by name (any visibility), or null. */
    static Object read(Object target, String name) {
        if (target == null) return null;
        for (Class<?> type = target.getClass(); type != null && type != Object.class; type = type.getSuperclass()) {
            try {
                Field field = type.getDeclaredField(name);
                field.setAccessible(true);
                return field.get(target);
            } catch (NoSuchFieldException error) {
                // Look in the superclass.
            } catch (ReflectiveOperationException | RuntimeException error) {
                return null;
            }
        }
        return null;
    }
}
