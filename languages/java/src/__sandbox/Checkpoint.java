package __sandbox;

import sandbox.Trace;

/**
 * Called by the instrumented copy of a student's data structure (see sandbox.Trace):
 *
 * <pre>
 *   Object __frame = __sandbox.Checkpoint.enter(12);        at the start of every method
 *   __sandbox.Checkpoint.at(13, __frame, "current", current); before every statement
 * </pre>
 *
 * <p>The calls are inserted on the statement's own line, so line numbers stay the student's. The
 * package name keeps the calls clear of the student's own names.
 */
public final class Checkpoint {
    private Checkpoint() {}

    public static Object enter(int line) {
        return Trace.enter(line);
    }

    public static void at(int line, Object frame, Object... namesAndValues) {
        Trace.at(line, frame, namesAndValues);
    }

    public static <T> T wrote(Object target, String field, Object before, T result) {
        return Trace.wrote(target, field, before, result);
    }

    public static <T> T visit(T node, String text) {
        return Trace.visit(node, text);
    }
}
