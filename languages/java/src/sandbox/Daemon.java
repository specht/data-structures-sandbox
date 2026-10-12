package sandbox;

import com.sun.source.tree.ClassTree;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Keeps the Java compiler and formatter loaded between edits. One JSON request and one JSON reply
 * per line (like tool/instrument_daemon.dart):
 *
 * <pre>
 *   {"id": 1, "op": "build", "kind": "stack", "className": "MyArrayStack",
 *    "source": "/…/alice/my_array_stack.java", "out": "DIR"}
 *   {"id": 2, "op": "format", "content": "…"}
 * </pre>
 *
 * <p>{@code build} checks and compiles the student's file, then writes DIR/classes (the
 * instrumented copy, compiled), DIR/source.txt (the file as built) and DIR/build.json. This
 * process never runs student code.
 *
 * <p>Started as {@code java … -cp RUNTIME sandbox.Daemon RUNTIME google-java-format-*.jar…}: the
 * formatter jars are loaded on demand, the newest one that this JDK can run.
 */
public final class Daemon {
    private final String runtimeClasspath;
    private final JavaFormatter formatter;

    private Daemon(String runtimeClasspath, List<String> formatterJars) {
        this.runtimeClasspath = runtimeClasspath;
        this.formatter = new JavaFormatter(formatterJars);
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("usage: sandbox.Daemon RUNTIME_CLASSES [GOOGLE_JAVA_FORMAT_JAR...]");
            System.exit(64);
        }
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), false, StandardCharsets.UTF_8);
        System.setOut(System.err); // Nothing but replies on the protocol channel.
        Daemon daemon = new Daemon(args[0], List.of(args).subList(1, args.length));
        out.print(Json.write(Recorders.event("type", "ready", "pid", ProcessHandle.current().pid())) + "\n");
        out.flush();
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        for (String line; (line = in.readLine()) != null; ) {
            if (line.isBlank()) continue;
            Object id = null;
            Map<String, Object> reply = new LinkedHashMap<>();
            try {
                Object parsed = Json.parse(line);
                if (!(parsed instanceof Map<?, ?> request) || !(request.get("id") instanceof Long)) {
                    throw new IllegalArgumentException("Invalid request.");
                }
                id = request.get("id");
                reply.putAll(daemon.handle(request));
            } catch (Throwable error) {
                reply.put("ok", false);
                reply.put("error", String.valueOf(error.getMessage() != null ? error.getMessage() : error));
                reply.put("internal", true);
            }
            Map<String, Object> answer = new LinkedHashMap<>();
            answer.put("id", id);
            answer.putAll(reply);
            out.print(Json.write(answer) + "\n");
            out.flush();
        }
    }

    private Map<String, Object> handle(Map<?, ?> request) throws Exception {
        Object op = request.get("op");
        if ("build".equals(op)) {
            if (!(request.get("kind") instanceof String kind) || !(request.get("className") instanceof String className)
                    || !(request.get("source") instanceof String source) || !(request.get("out") instanceof String out)) {
                throw new IllegalArgumentException("Invalid build request.");
            }
            return build(kind, className, source, new File(out));
        }
        if ("format".equals(op)) {
            if (!(request.get("content") instanceof String content)) throw new IllegalArgumentException("Invalid format request.");
            return format(content);
        }
        throw new IllegalArgumentException("Unknown operation: " + op);
    }

    private static Map<String, Object> failure(String error, List<Map<String, Object>> diagnostics) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", false);
        result.put("error", error);
        result.put("diagnostics", diagnostics);
        return result;
    }

    private Map<String, Object> build(String kind, String className, String source, File out) throws Exception {
        String content = Files.readString(new File(source).toPath(), StandardCharsets.UTF_8);
        JavaSource.Analyzed analyzed = JavaSource.analyze(content, runtimeClasspath);
        if (!analyzed.errors.isEmpty()) {
            return failure("Fix the errors in your Java source and save again.", analyzed.errors);
        }
        ClassTree cls;
        try {
            cls = JavaSource.structureClass(analyzed, className);
        } catch (JavaSource.Problem problem) {
            return failure(problem.getMessage(), List.of(analyzed.diagnostic(problem.tree, problem.getMessage(), problem.length)));
        }
        String copy = JavaSource.copy(analyzed, cls, kind);
        List<Map<String, Object>> errors = JavaSource.compile(Worker.COPY_NAME, copy, new File(out, "classes"),
                runtimeClasspath);
        if (!errors.isEmpty()) {
            return failure("Your code is valid Java, but the step-by-step visualizer cannot transform the marked "
                    + "line(s) yet. Try writing them more simply.", errors);
        }
        Files.writeString(new File(out, "source.txt").toPath(), content, StandardCharsets.UTF_8);
        Map<String, Object> build = new LinkedHashMap<>();
        build.put("kind", kind);
        build.put("className", className);
        build.put("sourcePath", source);
        build.put("methods", JavaSource.methods(analyzed, cls));
        Files.writeString(new File(out, "build.json").toPath(), Json.write(build), StandardCharsets.UTF_8);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        return result;
    }

    // ------------------------------------------------------------------- formatting

    /** google-java-format in AOSP style (four spaces), see JavaFormatter. */
    private Map<String, Object> format(String content) {
        return formatter.format(content);
    }
}
