package sandbox;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.PrintStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.net.URL;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Worker process for one Java data structure (one revision of one file). Started by the host as
 *
 * <pre>java -cp RUNTIME sandbox.Worker BUILD_DIRECTORY</pre>
 *
 * where the directory holds what sandbox.Daemon built: {@code classes/} (the instrumented copy,
 * compiled), {@code source.txt} (the student's file as built) and {@code build.json} ({kind,
 * className, sourcePath, methods}). It reproduces the Dart worker (lib/worker/session.dart and
 * lib/structures/*.dart) message by message: the same requests (run, reset, validateCall, ping),
 * the same trace events, the same reference models and structural checks.
 * languages/python/sandbox_worker.py and languages/javascript/sandbox_worker.mjs are the same
 * port; all three are kept in step.
 */
public final class Worker {
    static final int MAX_OPERATIONS = 20;
    static final int MAX_VALUE = 999;
    static final String COPY_NAME = "structure.java";

    private static PrintStream protocol;
    private static BufferedReader input;
    private static StudentOutput output;

    private Worker() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 1) {
            System.err.println("usage: sandbox.Worker BUILD_DIRECTORY");
            System.exit(64);
        }
        protocol = new PrintStream(new FileOutputStream(FileDescriptor.out), false, StandardCharsets.UTF_8);
        input = new BufferedReader(new InputStreamReader(new FileInputStream(FileDescriptor.in), StandardCharsets.UTF_8));
        System.setIn(new ByteArrayInputStream(new byte[0]));
        output = new StudentOutput();
        System.setOut(new PrintStream(output, true, StandardCharsets.UTF_8));
        // Deep recursion needs a large stack.
        Thread thread = new Thread(null, () -> serve(new File(args[0])), "student", 512L * 1024 * 1024);
        thread.start();
        thread.join();
        protocol.flush();
        Runtime.getRuntime().halt(0);
    }

    static synchronized void post(Map<String, Object> message) {
        String encoded;
        try {
            encoded = Json.write(message);
        } catch (RuntimeException error) {
            encoded = Json.write(Map.of("type", "error", "message", "Could not encode a worker message: " + error));
        }
        protocol.print(encoded);
        protocol.print('\n');
        protocol.flush();
    }

    static Map<String, Object> message(Object... pairs) {
        return Recorders.event(pairs);
    }

    /** Dart's FormatException: an invalid request, not a student error. */
    static final class RequestError extends RuntimeException {
        private static final long serialVersionUID = 1L;

        RequestError(String message) {
            super(message);
        }

        @Override
        public String toString() {
            return "FormatException: " + getMessage();
        }
    }

    static Throwable unwrap(Throwable error) {
        while ((error instanceof InvocationTargetException || error instanceof ExceptionInInitializerError)
                && error.getCause() != null) {
            error = error.getCause();
        }
        return error;
    }

    /** Return values as JSON: numbers, booleans and text stay, anything else becomes text. */
    static Object jsonValue(Object value) {
        if (value == null || value instanceof Boolean || value instanceof String || value instanceof Integer
                || value instanceof Long) {
            return value;
        }
        if (value instanceof Short || value instanceof Byte) return ((Number) value).intValue();
        if (value instanceof Double || value instanceof Float) {
            double number = ((Number) value).doubleValue();
            return Double.isFinite(number) ? (Object) number : String.valueOf(number);
        }
        if (value instanceof Character c) return String.valueOf(c);
        try {
            return String.valueOf(value);
        } catch (RuntimeException error) {
            return value.getClass().getSimpleName();
        }
    }

    static String joined(List<Integer> values) {
        StringBuilder text = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) text.append(',');
            text.append(values.get(i));
        }
        return text.toString();
    }

    // -------------------------------------------------------------------- methods

    record Param(String name, String type, Class<?> javaType) {}

    record Descriptor(String name, List<Param> params, String returns, int line, Method method) {
        Map<String, Object> json() {
            List<Object> list = new ArrayList<>();
            for (Param param : params) list.add(message("name", param.name, "type", param.type, "named", false));
            return message("name", name, "params", list, "returns", returns);
        }
    }

    static String paramType(Class<?> type) {
        if (type == int.class || type == Integer.class || type == long.class || type == Long.class
                || type == short.class || type == Short.class) {
            return "int";
        }
        if (type == double.class || type == Double.class || type == float.class || type == Float.class) return "double";
        if (type == boolean.class || type == Boolean.class) return "bool";
        if (type == String.class) return "String";
        return null;
    }

    static String returnType(Class<?> type) {
        if (type == void.class) return "void";
        if (type == int.class || type == long.class || type == short.class) return "int";
        if (type == Integer.class || type == Long.class || type == Short.class) return "int?";
        if (type == boolean.class) return "bool";
        if (type == Boolean.class) return "bool?";
        if (type == double.class || type == float.class) return "double";
        if (type == Double.class || type == Float.class) return "double?";
        if (type == String.class) return "String";
        return "dynamic";
    }

    /**
     * The methods that the browser can call, in the order of build.json (the daemon lists the
     * non-private, non-static methods). Standard methods with the right number of parameters get
     * the contract's types, so only the arity is checked, as in the Python and JavaScript ports.
     */
    static List<Descriptor> discoverMethods(Class<?> cls, Adapters.Adapter adapter, List<?> declared) {
        List<Descriptor> result = new ArrayList<>();
        for (Object entry : declared) {
            if (!(entry instanceof Map<?, ?> info) || !(info.get("name") instanceof String name)
                    || !(info.get("params") instanceof List<?> names)) {
                continue;
            }
            Method method = null;
            for (Method candidate : cls.getDeclaredMethods()) {
                if (candidate.getName().equals(name) && candidate.getParameterCount() == names.size()
                        && !candidate.isSynthetic() && !Modifier.isStatic(candidate.getModifiers())
                        && !Modifier.isPrivate(candidate.getModifiers())) {
                    method = candidate;
                    break;
                }
            }
            if (method == null) continue;
            Class<?>[] javaTypes = method.getParameterTypes();
            List<String> types = new ArrayList<>();
            boolean supported = true;
            for (Class<?> type : javaTypes) {
                String mapped = paramType(type);
                if (mapped == null) supported = false;
                types.add(mapped);
            }
            if (!supported) continue;
            String returns = returnType(method.getReturnType());
            if (adapter.standardMethods.contains(name)) {
                String required = adapter.requiredMethodSignature(name);
                String requiredParams = required.substring(required.indexOf('(') + 1, required.length() - 1);
                List<String> requiredTypes = requiredParams.isEmpty() ? List.of()
                        : Arrays.stream(requiredParams.split(",")).map(String::strip).toList();
                if (requiredTypes.size() == javaTypes.length) {
                    types = requiredTypes;
                    returns = required.substring(0, required.indexOf(' '));
                }
            }
            method.setAccessible(true);
            List<Param> params = new ArrayList<>();
            for (int i = 0; i < javaTypes.length; i++) {
                params.add(new Param(String.valueOf(names.get(i)), types.get(i), javaTypes[i]));
            }
            int line = info.get("line") instanceof Number number ? number.intValue() : 0;
            result.add(new Descriptor(name, params, returns, line, method));
        }
        return result;
    }

    // -------------------------------------------------------------------- session

    static final class Session {
        final String kind;
        final String sourcePath;
        final List<String> lines;
        final String sessionId;
        final Adapters.Adapter adapter;
        final List<Descriptor> methods;

        Session(File directory) throws Throwable {
            Map<?, ?> build = (Map<?, ?>) Json.parse(Files.readString(new File(directory, "build.json").toPath()));
            kind = (String) build.get("kind");
            sourcePath = (String) build.get("sourcePath");
            String source = Files.readString(new File(directory, "source.txt").toPath(), StandardCharsets.UTF_8);
            List<String> split = new ArrayList<>(Arrays.asList(source.split("\n", -1)));
            if (!split.isEmpty() && split.get(split.size() - 1).isEmpty()) split.remove(split.size() - 1);
            lines = split;
            sessionId = String.valueOf(System.currentTimeMillis() * 1000);

            URL url = new File(directory, "classes").toURI().toURL();
            URLClassLoader loader = new URLClassLoader(new URL[] {url}, Worker.class.getClassLoader());
            Class<?> cls = Class.forName((String) build.get("className"), true, loader);
            Constructor<?> constructor = cls.getDeclaredConstructor();
            constructor.setAccessible(true);
            adapter = Adapters.create(kind, () -> {
                try {
                    return constructor.newInstance();
                } catch (InvocationTargetException error) {
                    Throwable cause = unwrap(error);
                    if (cause instanceof RuntimeException runtime) throw runtime;
                    if (cause instanceof Error fatal) throw fatal;
                    throw new IllegalStateException(cause);
                } catch (ReflectiveOperationException error) {
                    throw new IllegalStateException(error);
                }
            });
            Object declared = build.get("methods");
            methods = discoverMethods(cls, adapter, declared instanceof List<?> list ? list : List.of());
            boolean trees = adapter instanceof Adapters.Tree;
            boolean nodes = trees || adapter instanceof Adapters.LinkedStack || adapter instanceof Adapters.LinkedQueue
                    || adapter instanceof Adapters.LinkedList_ || adapter instanceof Adapters.Hash;
            Trace.nodeType = !nodes ? null : trees ? TreeNode.class : ListNode.class;
            adapter.reset();
        }

        List<Integer> reference() {
            return adapter.reference;
        }

        Map<String, Object> initial() {
            return envelope(List.of(adapter.createRecorder().snapshot()));
        }

        Map<String, Object> envelope(List<Map<String, Object>> steps) {
            List<Object> described = new ArrayList<>();
            for (Descriptor method : methods) described.add(method.json());
            return message("type", "trace", "structure", kind, "sessionId", kind + ":" + sessionId,
                    "source", message("file", sourcePath, "lines", lines), "steps", new ArrayList<>(steps),
                    "values", new ArrayList<>(reference()), "methods", described, "capacity", adapter.capacity());
        }

        Descriptor descriptor(Object name) {
            for (Descriptor method : methods) if (method.name.equals(name)) return method;
            throw new RequestError("Unknown method: " + name);
        }

        static Object scalar(Object raw, String kind) {
            boolean integer = raw instanceof Long || raw instanceof Integer;
            if (kind.equals("int") && integer && Math.abs(((Number) raw).longValue()) <= MAX_VALUE) {
                return ((Number) raw).intValue();
            }
            if (kind.equals("double") && raw instanceof Number number && Double.isFinite(number.doubleValue())) {
                return number.doubleValue();
            }
            if (kind.equals("bool") && raw instanceof Boolean) return raw;
            if (kind.equals("String") && raw instanceof String text && text.length() <= 256) return raw;
            throw new RequestError("Invalid " + kind + " argument (integer range: -999…999).");
        }

        record Call(String method, List<Object> args) {}

        Call checkedCall(String name, List<?> args) {
            List<Param> params = descriptor(name).params;
            if (args.size() != params.size()) throw new RequestError("Wrong number of arguments.");
            List<Object> values = new ArrayList<>();
            for (int i = 0; i < args.size(); i++) values.add(scalar(args.get(i), params.get(i).type));
            return new Call(name, values);
        }

        List<Call> plan(Map<?, ?> message) {
            if (!"run".equals(message.get("action"))) throw new RequestError("Unknown command.");
            if (message.get("commands") instanceof List<?> sequence) {
                if (sequence.isEmpty() || sequence.size() > MAX_OPERATIONS) {
                    throw new RequestError("Use 1–" + MAX_OPERATIONS + " calls.");
                }
                List<Call> calls = new ArrayList<>();
                for (Object command : sequence) {
                    if (command instanceof Map<?, ?> map && map.get("method") instanceof String name
                            && map.get("arguments") instanceof List<?> arguments) {
                        calls.add(checkedCall(name, arguments));
                    } else {
                        throw new RequestError("Invalid command in sequence.");
                    }
                }
                return calls;
            }
            if (!(message.get("method") instanceof String name)) throw new RequestError("Supply the method arguments.");
            List<Param> params = descriptor(name).params;
            if (message.get("arguments") instanceof List<?> raw) return List.of(checkedCall(name, raw));
            if (message.get("values") instanceof List<?> legacy && params.size() == 1 && params.get(0).type.equals("int")) {
                if (legacy.isEmpty() || legacy.size() > MAX_OPERATIONS) {
                    throw new RequestError("Use 1–" + MAX_OPERATIONS + " calls.");
                }
                List<Call> calls = new ArrayList<>();
                for (Object value : legacy) calls.add(checkedCall(name, List.of(value)));
                return calls;
            }
            throw new RequestError("Supply the method arguments.");
        }

        /** An argument as the Java parameter type expects it. */
        static Object convert(Object value, Class<?> type) {
            if (value instanceof Number number && !(value instanceof Boolean)) {
                if (type == int.class || type == Integer.class) return number.intValue();
                if (type == long.class || type == Long.class) return number.longValue();
                if (type == short.class || type == Short.class) return number.shortValue();
                if (type == double.class || type == Double.class) return number.doubleValue();
                if (type == float.class || type == Float.class) return number.floatValue();
            }
            return value;
        }

        Object invoke(String name, List<Object> args) throws Throwable {
            Descriptor method = descriptor(name);
            Object[] values = new Object[args.size()];
            for (int i = 0; i < values.length; i++) values[i] = convert(args.get(i), method.params.get(i).javaType);
            Object result;
            try {
                result = method.method.invoke(adapter.instance, values);
            } catch (InvocationTargetException error) {
                throw unwrap(error);
            }
            return method.returns.equals("void") ? null : result;
        }

        Object invokeRecorded(Recorders.Base recorder, String name, List<Object> args) throws Throwable {
            Trace.active = recorder;
            try {
                return invoke(name, args);
            } finally {
                Trace.active = null;
            }
        }

        Map<String, Object> validateCall(Map<?, ?> message) throws Throwable {
            Object name = message.get("method");
            Descriptor declared = descriptor(name);
            List<Param> params = declared.params;
            if (!(message.get("arguments") instanceof List<?> raw) || raw.size() != params.size()) {
                throw new RequestError("Wrong number of test arguments.");
            }
            String required = adapter.requiredMethodSignature(declared.name);
            StringBuilder declaredArgs = new StringBuilder();
            for (int i = 0; i < params.size(); i++) {
                if (i > 0) declaredArgs.append(", ");
                declaredArgs.append(params.get(i).type);
            }
            String declaredSignature = declared.returns + " " + declared.name + "(" + declaredArgs + ")";
            if (!required.equals(declaredSignature)) {
                return message("type", "validationCall", "ok", false, "notExecuted", true,
                        "expectedContents", new ArrayList<>(reference()), "actualContents", adapter.actualValues(),
                        "checks", List.of(message("aspect", "Method signature", "expected", required,
                                "actual", declaredSignature)),
                        "message", "Method signature");
            }
            List<Object> args = new ArrayList<>();
            for (int i = 0; i < raw.size(); i++) args.add(scalar(raw.get(i), params.get(i).type));
            Object expected = adapter.expectedReturn(declared.name, args);
            // The instrumented student method expects an active recorder; this one is disposable
            // and never interpreted as a test result.
            Object returned = jsonValue(invokeRecorded(adapter.createRecorder(), declared.name, args));
            adapter.updateReference(declared.name, args, returned);
            List<Integer> expectedContents = new ArrayList<>(reference());
            List<Integer> actualContents = new ArrayList<>(adapter.actualValues());
            List<Object> issues = new ArrayList<>();
            Adapters.Check check = (aspect, wanted, observed) -> {
                if (!Adapters.same(wanted, observed)) {
                    issues.add(message("aspect", aspect, "expected", wanted, "actual", observed));
                }
            };
            if (!adapter.returnMatches(declared.name, expected, returned)) {
                issues.add(message("aspect", "Return value", "expected", expected, "actual", returned));
            }
            boolean unordered = adapter.unorderedContents;
            List<Integer> comparedActual = new ArrayList<>(actualContents);
            List<Integer> comparedExpected = new ArrayList<>(expectedContents);
            if (unordered) {
                comparedActual.sort(null);
                comparedExpected.sort(null);
            }
            if (!joined(comparedExpected).equals(joined(comparedActual))) {
                issues.add(message("aspect", "Contents", "expected", comparedExpected, "actual", comparedActual));
            }
            adapter.structuralChecks(check);
            Map<String, Object> result = message("type", "validationCall", "ok", issues.isEmpty(),
                    "expectedReturn", expected, "actualReturn", returned,
                    "returnIsVoid", declared.returns.equals("void"),
                    "expectedContents", unordered ? comparedExpected : expectedContents,
                    "actualContents", unordered ? comparedActual : actualContents,
                    "contentsComparedAsUnordered", unordered, "checks", issues);
            if (!issues.isEmpty()) {
                List<String> aspects = new ArrayList<>();
                for (Object issue : issues) aspects.add(String.valueOf(((Map<?, ?>) issue).get("aspect")));
                result.put("message", String.join(", ", aspects));
            }
            return result;
        }

        Map<String, Object> execute(Map<?, ?> message) throws Throwable {
            Object action = message.get("action");
            if ("reset".equals(action)) {
                adapter.reset();
                return initial();
            }
            if ("validateCall".equals(action)) return validateCall(message);
            List<Call> commands = plan(message);
            boolean fromEmpty = Boolean.TRUE.equals(message.get("reset"));
            if (fromEmpty) adapter.reset();
            Recorders.Base recorder = adapter.createRecorder();
            recorder.steps.add(recorder.snapshot());
            int completed = 0;
            boolean stoppedEarly = false;
            for (Call command : commands) {
                completed++;
                String name = command.method;
                List<Object> args = command.args;
                Descriptor descriptor = descriptor(name);
                recorder.begin(name, args, descriptor.line);
                Object result;
                try {
                    result = invokeRecorded(recorder, name, args);
                } catch (Throwable error) {
                    if (error instanceof VirtualMachineError && !(error instanceof StackOverflowError)) throw error;
                    Map<String, Object> failure = runtimeFailure(error);
                    if (failure.get("traceIndex") instanceof Integer index && index >= recorder.steps.size()
                            && recorder.steps.size() > 0) {
                        failure.put("traceIndex", recorder.steps.size() - 1);
                    }
                    try {
                        Object line = failure.containsKey("line") ? failure.get("line") : Recorders.Diagnostics.currentLine;
                        recorder.steps.add(message("kind", "executionError", "message", failure.get("message"), "line", line));
                    } catch (Recorders.TraceLimitReached limit) {
                        // The failure metadata still carries the last line.
                    }
                    Map<String, Object> envelope = envelope(recorder.steps.list);
                    envelope.put("type", "executionError");
                    envelope.put("error", failure);
                    return envelope;
                }
                result = jsonValue(result);
                boolean allInts = args.stream().allMatch(Adapters::isInt);
                boolean canVerify = adapter.standardMethods.contains(name)
                        && (List.of("pop", "dequeue", "removeMin", "peek", "isEmpty", "isFull", "length").contains(name)
                                || (args.size() == 1 && allInts) || (args.size() == 2 && allInts));
                boolean checked = adapter.updateReference(name, args, result);
                List<Integer> actual = new ArrayList<>(adapter.actualValues());
                List<Integer> expected = new ArrayList<>(reference());
                if (adapter.unorderedContents) {
                    actual.sort(null);
                    expected.sort(null);
                }
                List<String> problems = adapter.executionProblems();
                boolean ok = checked && joined(actual).equals(joined(expected)) && problems.isEmpty();
                recorder.steps.add(recorder.snapshot());
                boolean returnsVoid = descriptor.returns.equals("void");
                String label = Recorders.operation(name, args);
                String verdict;
                if (!ok) {
                    StringBuilder text = new StringBuilder("CHECK FAILED");
                    for (String problem : problems) text.append(" (").append(problem).append(')');
                    verdict = text.toString();
                } else if (canVerify) {
                    verdict = "checked";
                } else {
                    verdict = "not automatically verified";
                }
                Object shown = descriptor.returns.startsWith("double") && result instanceof Number number
                        ? (Object) number.doubleValue() : result;
                String text = label + " " + (returnsVoid ? "completed" : "⇒ " + Recorders.show(shown)) + " · " + verdict;
                recorder.end(result, ok, returnsVoid, text);
                if (!ok) {
                    stoppedEarly = completed < commands.size();
                    break;
                }
            }
            Map<String, Object> envelope = envelope(recorder.steps.list);
            envelope.put("calls", message("planned", commands.size(), "completed", completed,
                    "stoppedEarly", stoppedEarly, "fromEmpty", fromEmpty));
            return envelope;
        }

        Map<String, Object> runtimeFailure(Throwable error) {
            Integer line = Recorders.Diagnostics.currentLine;
            List<StackTraceElement> frames = new ArrayList<>();
            for (StackTraceElement frame : error.getStackTrace()) {
                if (COPY_NAME.equals(frame.getFileName()) && frame.getLineNumber() > 0) frames.add(frame);
            }
            if (line == null && !frames.isEmpty()) line = frames.get(0).getLineNumber();
            String message;
            if (error instanceof RequestError || error instanceof Recorders.TraceLimitReached) {
                message = error instanceof RequestError ? error.toString() : error.getMessage();
            } else {
                String text = error.getMessage();
                message = error.getClass().getSimpleName() + (text == null || text.isEmpty() ? "" : ": " + text);
            }
            if (message.length() > 2000) message = message.substring(0, 2000);
            Map<String, Object> result = message("kind", "runtime", "message", message);
            if (line != null) result.put("line", line);
            if (Recorders.Diagnostics.currentTraceIndex != null) {
                result.put("traceIndex", Recorders.Diagnostics.currentTraceIndex);
            }
            if (!frames.isEmpty()) {
                String file = new File(sourcePath).getName();
                List<String> stack = new ArrayList<>();
                for (StackTraceElement frame : frames) {
                    if (stack.size() >= 8) break;
                    stack.add(frame.getMethodName() + " (" + file + ":" + frame.getLineNumber() + ")");
                }
                result.put("stack", stack);
            }
            return result;
        }
    }

    // ------------------------------------------------------------------ main loop

    /** System.out of student code → studentOutput messages, bounded. */
    static final class StudentOutput extends OutputStream {
        private final ByteArrayOutputStream line = new ByteArrayOutputStream();
        boolean enabled = false;
        int count = 0;
        int bytes = 0;
        boolean truncated = false;

        void begin() {
            line.reset();
            count = 0;
            bytes = 0;
            truncated = false;
            enabled = true;
        }

        @Override
        public synchronized void write(int b) {
            if (!enabled) return;
            if (b == '\n') {
                emit();
            } else {
                line.write(b);
            }
        }

        @Override
        public synchronized void write(byte[] data, int offset, int length) {
            for (int i = offset; i < offset + length; i++) write(data[i]);
        }

        synchronized void finish() {
            if (enabled && line.size() > 0) emit();
            enabled = false;
        }

        private void emit() {
            String text = line.toString(StandardCharsets.UTF_8);
            line.reset();
            if (text.endsWith("\r")) text = text.substring(0, text.length() - 1);
            int size = text.getBytes(StandardCharsets.UTF_8).length;
            String kind = "stdout";
            if (count < 200 && bytes + size <= 65536) {
                count++;
                bytes += size;
            } else if (!truncated) {
                truncated = true;
                kind = "warning";
                text = "Further print output was truncated.";
            } else {
                return;
            }
            post(message("type", "studentOutput", "kind", kind, "text", text,
                    "line", Recorders.Diagnostics.currentLine, "traceIndex", Recorders.Diagnostics.currentTraceIndex));
        }
    }

    private static void serve(File directory) {
        Session session;
        try {
            session = new Session(directory);
        } catch (Throwable raw) {
            Throwable error = unwrap(raw);
            error.printStackTrace();
            String text = error.getMessage();
            String message = error.getClass().getSimpleName() + (text == null ? "" : ": " + text);
            Map<String, Object> failure = message("kind", "runtime", "message", message);
            for (StackTraceElement frame : error.getStackTrace()) {
                if (COPY_NAME.equals(frame.getFileName()) && frame.getLineNumber() > 0) {
                    failure.put("line", frame.getLineNumber());
                    break;
                }
            }
            post(message("type", "error", "error", failure, "message", message));
            return;
        }
        post(message("type", "hello", "trace", session.initial()));
        for (;;) {
            String raw;
            try {
                raw = input.readLine();
            } catch (IOException error) {
                return;
            }
            if (raw == null) return;
            if (raw.isBlank()) continue;
            Recorders.Diagnostics.reset();
            output.begin();
            try {
                Object parsed;
                try {
                    parsed = Json.parse(raw);
                } catch (RuntimeException error) {
                    throw new RequestError("Invalid request");
                }
                if (!(parsed instanceof Map<?, ?> request)) throw new RequestError("Invalid request");
                if ("ping".equals(request.get("action"))) {
                    output.finish();
                    post(message("type", "pong"));
                    continue;
                }
                if (Boolean.TRUE.equals(request.get("_diagnostics"))) {
                    long[] last = {Long.MIN_VALUE};
                    Recorders.Diagnostics.onLine = (line, traceIndex) -> {
                        long now = System.nanoTime();
                        if (last[0] != Long.MIN_VALUE && now - last[0] < 50_000_000L) return;
                        last[0] = now;
                        post(message("type", "executionProgress", "line", line, "traceIndex", traceIndex));
                    };
                }
                Map<String, Object> response = session.execute(request);
                output.finish();
                post(response);
            } catch (Throwable error) {
                output.finish();
                System.err.println("Student execution failed: " + error);
                post(message("type", "error", "error", session.runtimeFailure(error), "message", String.valueOf(error)));
            } finally {
                Recorders.Diagnostics.onLine = null;
            }
        }
    }
}
