package sandbox;

import com.sun.source.tree.AssignmentTree;
import com.sun.source.tree.BlockTree;
import com.sun.source.tree.CaseTree;
import com.sun.source.tree.CatchTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.CompoundAssignmentTree;
import com.sun.source.tree.DoWhileLoopTree;
import com.sun.source.tree.EnhancedForLoopTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.ForLoopTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.IfTree;
import com.sun.source.tree.LabeledStatementTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.StatementTree;
import com.sun.source.tree.SwitchTree;
import com.sun.source.tree.SynchronizedTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.TryTree;
import com.sun.source.tree.UnaryTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.tree.WhileLoopTree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.SourcePositions;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.Trees;
import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.SimpleJavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;

/**
 * The checks and the instrumented copy of a Java data structure, built with the JDK's own compiler
 * API (no other dependencies). Mirrors tool/instrument.dart: every method gets a line event on
 * entry and every statement one before it runs (loops also once per iteration). Because Java
 * cannot intercept field assignments, the copy also reports assignments to node fields, queue
 * markers and the student's own top/size/head/root/tail fields, and reads of {@code value} (see
 * sandbox.Trace). Insertions never contain line breaks, so the line numbers are the student's.
 */
final class JavaSource {
    private JavaSource() {}

    private static final JavaCompiler COMPILER = ToolProvider.getSystemJavaCompiler();
    static final String CHECKPOINT = "__sandbox.Checkpoint.";

    /** An in-memory source; any class name is allowed in any file name. */
    static final class Source extends SimpleJavaFileObject {
        final String content;

        Source(String name, String content) {
            super(URI.create("string:///" + name), Kind.SOURCE);
            this.content = content;
        }

        @Override
        public CharSequence getCharContent(boolean ignoreEncodingErrors) {
            return content;
        }

        @Override
        public boolean isNameCompatible(String simpleName, Kind kind) {
            return kind == Kind.SOURCE;
        }
    }

    static Map<String, Object> diagnostic(long line, long column, long length, String message) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("line", Math.max(1, line));
        result.put("column", Math.max(1, column));
        result.put("length", Math.max(1, Math.min(40, length)));
        result.put("message", message);
        result.put("severity", "error");
        return result;
    }

    static List<Map<String, Object>> errors(DiagnosticCollector<JavaFileObject> collector) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Diagnostic<? extends JavaFileObject> d : collector.getDiagnostics()) {
            if (d.getKind() != Diagnostic.Kind.ERROR) continue;
            long length = d.getEndPosition() > d.getStartPosition() && d.getStartPosition() >= 0
                    ? d.getEndPosition() - d.getStartPosition() : 1;
            // "cannot find symbol\n  symbol: variable lenght\n  location: …"
            String[] lines = d.getMessage(Locale.ENGLISH).split("\n");
            String message = lines[0].strip();
            for (int i = 1; i < lines.length; i++) {
                String detail = lines[i].strip();
                if (detail.startsWith("symbol:")) message += ": " + detail.substring(7).strip();
            }
            result.add(diagnostic(d.getLineNumber(), d.getColumnNumber(), length, message));
            if (result.size() >= 30) break;
        }
        return result;
    }

    static final class Problem extends RuntimeException {
        private static final long serialVersionUID = 1L;
        final transient Tree tree;
        final Integer length;

        Problem(Tree tree, String message, Integer length) {
            super(message);
            this.tree = tree;
            this.length = length;
        }
    }

    /** A parsed and attributed file. */
    static final class Analyzed {
        final String content;
        final CompilationUnitTree unit;
        final SourcePositions positions;
        final Trees trees;
        final List<Map<String, Object>> errors;

        Analyzed(String content, CompilationUnitTree unit, Trees trees, List<Map<String, Object>> errors) {
            this.content = content;
            this.unit = unit;
            this.trees = trees;
            this.positions = trees.getSourcePositions();
            this.errors = errors;
        }

        long start(Tree tree) {
            return positions.getStartPosition(unit, tree);
        }

        long end(Tree tree) {
            return positions.getEndPosition(unit, tree);
        }

        int line(Tree tree) {
            return (int) unit.getLineMap().getLineNumber(start(tree));
        }

        String text(Tree tree) {
            return content.substring((int) start(tree), (int) end(tree));
        }

        Map<String, Object> diagnostic(Tree tree, String message, Integer length) {
            if (tree == null) return JavaSource.diagnostic(1, 1, 1, message);
            long start = start(tree);
            long end = end(tree);
            int line = (int) unit.getLineMap().getLineNumber(start);
            int column = (int) unit.getLineMap().getColumnNumber(start);
            int span = length != null ? length
                    : end > start && unit.getLineMap().getLineNumber(end) == line ? (int) (end - start) : 5;
            return JavaSource.diagnostic(line, column, span, message);
        }
    }

    /** Parses and attributes [content] against the sandbox runtime; errors are compile errors. */
    static Analyzed analyze(String content, String classpath) {
        DiagnosticCollector<JavaFileObject> collector = new DiagnosticCollector<>();
        JavacTask task = (JavacTask) COMPILER.getTask(null, null, collector,
                List.of("-proc:none", "-classpath", classpath, "-Xlint:none", "-nowarn"), null,
                List.of(new Source("algorithm.java", content)));
        try {
            CompilationUnitTree unit = task.parse().iterator().next();
            Trees trees = Trees.instance(task);
            List<Map<String, Object>> parseErrors = errors(collector);
            if (parseErrors.isEmpty()) task.analyze();
            return new Analyzed(content, unit, trees, errors(collector));
        } catch (IOException error) {
            throw new IllegalStateException(error);
        }
    }

    // ------------------------------------------------------------------ the contract

    /** The one top-level class named [className]; throws Problem. */
    static ClassTree structureClass(Analyzed analyzed, String className) {
        if (analyzed.unit.getPackageName() != null) {
            throw new Problem(analyzed.unit.getPackage(),
                    "Remove the package line: data structures live in the default package.", null);
        }
        List<ClassTree> classes = new ArrayList<>();
        for (Tree declaration : analyzed.unit.getTypeDecls()) {
            if (declaration instanceof ClassTree cls && cls.getKind() == Tree.Kind.CLASS
                    && cls.getSimpleName().contentEquals(className)) {
                classes.add(cls);
            }
        }
        if (classes.size() != 1) {
            throw new Problem(null, "Expected one top-level class named " + className
                    + " (keep the name from the starter).", null);
        }
        ClassTree cls = classes.get(0);
        if (cls.getModifiers().getFlags().contains(Modifier.ABSTRACT)) {
            throw new Problem(cls, "The class must not be abstract.", 5);
        }
        boolean anyConstructor = false;
        boolean noArgumentConstructor = false;
        for (Tree member : cls.getMembers()) {
            if (member instanceof MethodTree method && method.getName().contentEquals("<init>")) {
                anyConstructor = true;
                if (method.getParameters().isEmpty()) noArgumentConstructor = true;
            }
        }
        if (anyConstructor && !noArgumentConstructor) {
            throw new Problem(cls, "The sandbox cannot create new " + className
                    + "(): the class needs a constructor without parameters.", 5);
        }
        if (methods(analyzed, cls).isEmpty()) throw new Problem(cls, "No public methods found.", 5);
        return cls;
    }

    /** The methods the browser can call: [{name, line, params}], the first of each name. */
    static List<Map<String, Object>> methods(Analyzed analyzed, ClassTree cls) {
        List<Map<String, Object>> result = new ArrayList<>();
        Set<String> names = new HashSet<>();
        for (Tree member : cls.getMembers()) {
            if (!(member instanceof MethodTree method) || method.getName().contentEquals("<init>")) continue;
            Set<Modifier> flags = method.getModifiers().getFlags();
            String name = method.getName().toString();
            if (flags.contains(Modifier.PRIVATE) || flags.contains(Modifier.STATIC) || name.startsWith("_")
                    || method.getBody() == null || !names.add(name)) {
                continue;
            }
            List<String> params = new ArrayList<>();
            for (VariableTree parameter : method.getParameters()) params.add(parameter.getName().toString());
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("name", name);
            entry.put("line", analyzed.line(method));
            entry.put("params", params);
            result.add(entry);
        }
        return result;
    }

    // --------------------------------------------------------------------- compiling

    /** Compiles [content] as [fileName] into [out]; returns the errors (empty on success). */
    static List<Map<String, Object>> compile(String fileName, String content, File out, String classpath) {
        out.mkdirs();
        DiagnosticCollector<JavaFileObject> collector = new DiagnosticCollector<>();
        try (StandardJavaFileManager files = COMPILER.getStandardFileManager(collector, Locale.ENGLISH, null)) {
            boolean ok = COMPILER.getTask(null, files, collector,
                    List.of("-proc:none", "-g", "-nowarn", "-Xlint:none", "-encoding", "UTF-8",
                            "-classpath", classpath, "-d", out.getPath()),
                    null, List.of(new Source(fileName, content))).call();
            List<Map<String, Object>> errors = errors(collector);
            if (!ok && errors.isEmpty()) errors.add(diagnostic(1, 1, 1, "Java could not compile this file."));
            return errors;
        } catch (IOException error) {
            throw new IllegalStateException(error);
        }
    }

    // ----------------------------------------------------------- the instrumented copy

    /** Text inserted at [at]; at one position, edits apply in ascending [rank]. */
    private record Edit(long at, long rank, String text) {}

    static final long FIRST = Long.MIN_VALUE / 2;
    static final long LAST = Long.MAX_VALUE / 2;

    static final Set<String> NODE_FIELDS_LIST = Set.of("next", "value");
    static final Set<String> NODE_FIELDS_TREE = Set.of("left", "right", "height", "value");
    static final Set<String> QUEUE_MARKERS = Set.of("front", "rear", "size");

    /** The student-owned fields whose assignments the Dart instrumenter records, per structure. */
    static Set<String> ownerFields(String kind) {
        return switch (kind) {
            case "stack" -> Set.of("top");
            case "linked_stack" -> Set.of("head");
            case "linked_queue" -> Set.of("head", "tail");
            case "sorted_array_list", "unsorted_array_list" -> Set.of("size");
            case "sorted_linked_list", "unsorted_linked_list" -> Set.of("size", "head");
            case "tree", "avl" -> Set.of("root");
            default -> Set.of();
        };
    }

    static String copy(Analyzed analyzed, ClassTree cls, String kind) {
        List<Edit> edits = new ArrayList<>();
        Expressions expressions = new Expressions(analyzed, cls, ownerFields(kind), edits);
        expressions.scan(new TreePath(analyzed.unit), null);
        new Statements(analyzed, expressions.nodeVariables, edits).unit();
        edits.sort((a, b) -> a.at != b.at ? Long.compare(a.at, b.at) : Long.compare(a.rank, b.rank));
        StringBuilder out = new StringBuilder(analyzed.content.length() + edits.size() * 40);
        int position = 0;
        for (Edit edit : edits) {
            out.append(analyzed.content, position, (int) edit.at);
            position = (int) edit.at;
            out.append(edit.text);
        }
        out.append(analyzed.content.substring(position));
        return out.toString();
    }

    private static String literal(String text) {
        String collapsed = text.replaceAll("\\s+", " ").strip();
        StringBuilder out = new StringBuilder("\"");
        for (char c : collapsed.toCharArray()) {
            if (c == '"' || c == '\\') out.append('\\');
            out.append(c);
        }
        return out.append('"').toString();
    }

    /**
     * Field assignments and value reads, found with the attributed tree (so `current.next` is
     * known to be a ListNode field). Also collects the local variables of node type.
     */
    private static final class Expressions extends TreePathScanner<Void, Void> {
        final Analyzed analyzed;
        final ClassTree cls;
        final Set<String> ownerFields;
        final List<Edit> edits;
        final Set<VariableTree> nodeVariables = new HashSet<>();
        long sequence = 0;
        Element owner;

        Expressions(Analyzed analyzed, ClassTree cls, Set<String> ownerFields, List<Edit> edits) {
            this.analyzed = analyzed;
            this.cls = cls;
            this.ownerFields = ownerFields;
            this.edits = edits;
        }

        Element element(TreePath path) {
            try {
                return analyzed.trees.getElement(path);
            } catch (RuntimeException error) {
                return null;
            }
        }

        static String typeName(Element element) {
            return element == null ? "" : element.asType().toString();
        }

        static boolean isNodeType(String type) {
            return type.equals("sandbox.ListNode") || type.equals("sandbox.TreeNode");
        }

        @Override
        public Void visitClass(ClassTree tree, Void unused) {
            if (tree == cls) owner = element(getCurrentPath());
            return super.visitClass(tree, unused);
        }

        @Override
        public Void visitVariable(VariableTree tree, Void unused) {
            Element element = element(getCurrentPath());
            if (element != null && (element.getKind() == ElementKind.LOCAL_VARIABLE
                    || element.getKind() == ElementKind.RESOURCE_VARIABLE
                    || element.getKind() == ElementKind.EXCEPTION_PARAMETER)
                    && isNodeType(typeName(element))) {
                nodeVariables.add(tree);
            }
            return super.visitVariable(tree, unused);
        }

        /** identifiers, `this` and field selections: safe to evaluate more than once. */
        boolean simplePath(ExpressionTree tree) {
            if (tree instanceof IdentifierTree) return true;
            if (tree instanceof MemberSelectTree select) return simplePath(select.getExpression());
            return false;
        }

        /** [object, field, old] for an assignment target that is traced, or null. */
        String[] target(ExpressionTree variable) {
            TreePath path = new TreePath(getCurrentPath(), variable);
            Element element = element(path);
            if (element == null || element.getKind() != ElementKind.FIELD) return null;
            String field = element.getSimpleName().toString();
            Element enclosing = element.getEnclosingElement();
            String enclosingName = enclosing instanceof TypeElement type ? type.getQualifiedName().toString() : "";
            boolean traced = switch (enclosingName) {
                case "sandbox.ListNode" -> NODE_FIELDS_LIST.contains(field);
                case "sandbox.TreeNode" -> NODE_FIELDS_TREE.contains(field);
                case "sandbox.QueueMemory" -> QUEUE_MARKERS.contains(field);
                default -> owner != null && enclosing.equals(owner) && ownerFields.contains(field)
                        && !element.getModifiers().contains(Modifier.STATIC);
            };
            if (!traced) return null;
            if (variable instanceof IdentifierTree) {
                // An unqualified field of the student's class.
                if (!enclosing.equals(owner)) return null;
                return new String[] {cls.getSimpleName() + ".this", field, field};
            }
            if (!(variable instanceof MemberSelectTree select) || !simplePath(select.getExpression())) return null;
            String object = analyzed.text(select.getExpression());
            if (object.contains("/")) return null; // A comment inside the path.
            object = object.replaceAll("\\s+", "");
            return new String[] {object, field, object + "." + field};
        }

        void wrap(ExpressionTree assignment, ExpressionTree variable) {
            String[] target = target(variable);
            if (target == null) return;
            long rank = ++sequence;
            edits.add(new Edit(analyzed.start(assignment), rank, CHECKPOINT + "wrote(" + target[0] + ", \""
                    + target[1] + "\", " + target[2] + ", ("));
            edits.add(new Edit(analyzed.end(assignment), -rank, "))"));
        }

        @Override
        public Void visitAssignment(AssignmentTree tree, Void unused) {
            wrap(tree, tree.getVariable());
            // The target itself is not a read: scan only the value.
            scan(tree.getExpression(), unused);
            if (tree.getVariable() instanceof MemberSelectTree select) {
                scan(select.getExpression(), unused);
            }
            return null;
        }

        @Override
        public Void visitCompoundAssignment(CompoundAssignmentTree tree, Void unused) {
            wrap(tree, tree.getVariable());
            scan(tree.getExpression(), unused);
            if (tree.getVariable() instanceof MemberSelectTree select) {
                scan(select.getExpression(), unused);
            }
            return null;
        }

        @Override
        public Void visitUnary(UnaryTree tree, Void unused) {
            Tree.Kind kind = tree.getKind();
            if (kind == Tree.Kind.PREFIX_INCREMENT || kind == Tree.Kind.PREFIX_DECREMENT
                    || kind == Tree.Kind.POSTFIX_INCREMENT || kind == Tree.Kind.POSTFIX_DECREMENT) {
                wrap(tree, tree.getExpression());
                if (tree.getExpression() instanceof MemberSelectTree select) {
                    scan(select.getExpression(), unused);
                }
                return null;
            }
            return super.visitUnary(tree, unused);
        }

        @Override
        public Void visitMemberSelect(MemberSelectTree tree, Void unused) {
            if (tree.getIdentifier().contentEquals("value")) {
                Element element = element(getCurrentPath());
                Element enclosing = element == null ? null : element.getEnclosingElement();
                if (element != null && element.getKind() == ElementKind.FIELD && enclosing instanceof TypeElement type
                        && isNodeType(type.getQualifiedName().toString())) {
                    ExpressionTree object = tree.getExpression();
                    long rank = ++sequence;
                    edits.add(new Edit(analyzed.start(object), rank, CHECKPOINT + "visit("));
                    edits.add(new Edit(analyzed.end(object), -rank, ", " + literal(analyzed.text(object)) + ")"));
                }
            }
            return super.visitMemberSelect(tree, unused);
        }
    }

    /**
     * Line events: `Object __frame = …enter(line);` at the start of every method and
     * `…at(line, __frame, "name", name, …);` before every statement, with the node-typed local
     * variables that are definitely assigned there (declared with an initializer, loop and catch
     * variables). Lambdas, anonymous and local classes run without line events.
     */
    private static final class Statements {
        final Analyzed analyzed;
        final Set<VariableTree> nodeVariables;
        final List<Edit> edits;

        Statements(Analyzed analyzed, Set<VariableTree> nodeVariables, List<Edit> edits) {
            this.analyzed = analyzed;
            this.nodeVariables = nodeVariables;
            this.edits = edits;
        }

        void unit() {
            for (Tree declaration : analyzed.unit.getTypeDecls()) {
                if (declaration instanceof ClassTree cls && cls.getKind() == Tree.Kind.CLASS) type(cls);
            }
        }

        void type(ClassTree cls) {
            for (Tree member : cls.getMembers()) {
                if (member instanceof ClassTree nested) {
                    if (nested.getKind() == Tree.Kind.CLASS) type(nested);
                } else if (member instanceof MethodTree method && method.getBody() != null
                        && !method.getName().contentEquals("<init>")) {
                    BlockTree body = method.getBody();
                    edits.add(new Edit(analyzed.start(body) + 1, FIRST,
                            " Object __frame = " + CHECKPOINT + "enter(" + analyzed.line(method) + "); "));
                    block(body, new ArrayList<>());
                }
            }
        }

        String call(int line, List<String> visible) {
            StringBuilder text = new StringBuilder(CHECKPOINT).append("at(").append(line).append(", __frame");
            for (String name : visible) text.append(", \"").append(name).append("\", ").append(name);
            return text.append("); ").toString();
        }

        void add(List<String> visible, VariableTree variable) {
            if (!nodeVariables.contains(variable)) return;
            String name = variable.getName().toString();
            visible.remove(name);
            visible.add(name);
        }

        void block(BlockTree block, List<String> visible) {
            statements(block.getStatements(), visible);
        }

        void statements(List<? extends StatementTree> statements, List<String> visible) {
            List<String> local = new ArrayList<>(visible);
            long previous = -1;
            for (StatementTree statement : statements) {
                // `int i = 0, j = 1;` is two declarations that start at the same position.
                long start = analyzed.start(statement);
                if (start != previous) edits.add(new Edit(start, FIRST, call(analyzed.line(statement), local)));
                previous = start;
                statement(statement, local);
                if (statement instanceof VariableTree variable && variable.getInitializer() != null) add(local, variable);
            }
        }

        /** A statement where only one is allowed: braces around it and its checkpoint. */
        void single(StatementTree statement, List<String> visible) {
            if (statement == null) return;
            if (statement instanceof BlockTree block) {
                block(block, visible);
                return;
            }
            edits.add(new Edit(analyzed.start(statement), FIRST, "{ " + call(analyzed.line(statement), visible)));
            edits.add(new Edit(analyzed.end(statement), LAST, " }"));
            statement(statement, visible);
        }

        /** The body of a loop: one line event per iteration, then the body's own. */
        void loopBody(StatementTree loop, StatementTree body, List<String> visible) {
            String iteration = call(analyzed.line(loop), visible);
            if (body instanceof BlockTree block) {
                edits.add(new Edit(analyzed.start(block) + 1, FIRST, " " + iteration));
                block(block, visible);
                return;
            }
            edits.add(new Edit(analyzed.start(body), FIRST, "{ " + iteration + call(analyzed.line(body), visible)));
            edits.add(new Edit(analyzed.end(body), LAST, " }"));
            statement(body, visible);
        }

        void statement(StatementTree statement, List<String> visible) {
            if (statement instanceof BlockTree block) {
                block(block, visible);
            } else if (statement instanceof IfTree branch) {
                single(branch.getThenStatement(), visible);
                single(branch.getElseStatement(), visible);
            } else if (statement instanceof ForLoopTree loop) {
                List<String> inner = new ArrayList<>(visible);
                for (StatementTree initializer : loop.getInitializer()) {
                    if (initializer instanceof VariableTree variable && variable.getInitializer() != null) {
                        add(inner, variable);
                    }
                }
                loopBody(loop, loop.getStatement(), inner);
            } else if (statement instanceof EnhancedForLoopTree loop) {
                List<String> inner = new ArrayList<>(visible);
                add(inner, loop.getVariable());
                loopBody(loop, loop.getStatement(), inner);
            } else if (statement instanceof WhileLoopTree loop) {
                loopBody(loop, loop.getStatement(), visible);
            } else if (statement instanceof DoWhileLoopTree loop) {
                loopBody(loop, loop.getStatement(), visible);
            } else if (statement instanceof LabeledStatementTree labeled) {
                statement(labeled.getStatement(), visible);
            } else if (statement instanceof SwitchTree choice) {
                for (CaseTree branch : choice.getCases()) {
                    if (branch.getCaseKind() == CaseTree.CaseKind.STATEMENT) {
                        statements(branch.getStatements(), visible);
                    } else if (branch.getBody() instanceof BlockTree body) {
                        block(body, visible);
                    }
                }
            } else if (statement instanceof TryTree attempt) {
                List<String> inner = new ArrayList<>(visible);
                for (Tree resource : attempt.getResources()) {
                    if (resource instanceof VariableTree variable) add(inner, variable);
                }
                block(attempt.getBlock(), inner);
                for (CatchTree handler : attempt.getCatches()) block(handler.getBlock(), visible);
                if (attempt.getFinallyBlock() != null) block(attempt.getFinallyBlock(), visible);
            } else if (statement instanceof SynchronizedTree synchronizedBlock) {
                block(synchronizedBlock.getBlock(), visible);
            }
        }
    }
}
