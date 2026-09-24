// Discover callable methods from the real Dart AST, then instrument a COPY.
// The original file is never edited; only a documented subset of method
// signatures is exposed in this linked-list prototype.
import 'dart:convert';
import 'dart:io';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/dart/analysis/utilities.dart';

const configs = <String, Map<String,String>>{
  'list': {'file':'my_linked_list','class':'MyLinkedList','recorder':'Recorder','node':'ListNode','root':'head'},
  'tree': {'file':'my_bst','class':'MyBST','recorder':'TreeRecorder','node':'TreeNode','root':'root'},
  'stack': {'file':'my_array_stack','class':'MyArrayStack','recorder':'StackRecorder','node':'','root':''},
  'linked_stack': {'file':'my_linked_stack','class':'MyLinkedStack','recorder':'Recorder','node':'ListNode','root':'head'},
  'linked_queue': {'file':'my_linked_queue','class':'MyLinkedQueue','recorder':'Recorder','node':'ListNode','root':'head','tail':'tail'},
  'array_queue': {'file':'my_array_queue','class':'MyArrayQueue','recorder':'QueueRecorder','node':'','root':''},
};
late Map<String,String> config;
late String sourcePath;
String outputDirectory = 'tool/generated';
String? selectedSource;
String? overrideKind;



class Edit {
  final int position;
  final String text;
  final int priority;
  Edit(this.position, this.text, [this.priority = 0]);
}

class MethodInfo {
  final String name;
  final List<Map<String, Object?>> params;
  final String result;
  final MethodDeclaration ast;
  MethodInfo(this.name, this.params, this.result, this.ast);
  Map<String, Object?> toJson() => {'name': name, 'params': params, 'returns': result};
}

String quote(String s) => jsonEncode(s); // Valid string literals for generated Dart.
String? supportedType(String type) {
  const types = {'int', 'double', 'bool', 'String'};
  return types.contains(type) ? type : null;
}

MethodInfo? describe(MethodDeclaration m) {
  if (m.isStatic || m.isGetter || m.isSetter || m.name.lexeme.startsWith('_')) return null;
  final result = m.returnType?.toSource() ?? 'dynamic';
  final inputs = <Map<String, Object?>>[];
  for (final p in m.parameters?.parameters ?? <FormalParameter>[]) {
    // This v0.8 bridge intentionally accepts only REQUIRED, scalar arguments.
    // Other signatures remain legal Dart; they simply aren't exposed as buttons.
    if (p.isOptionalPositional || (p.isNamed && !p.isRequiredNamed)) return null;
    final raw = p.toSource().trim();
    final match = RegExp(r'^(?:required\s+)?(int|double|bool|String)\s+([A-Za-z_]\w*)$').firstMatch(raw);
    if (match == null || supportedType(match.group(1)!) == null) return null;
    inputs.add({'name': match.group(2)!, 'type': match.group(1)!, 'named': p.isNamed});
  }
  return MethodInfo(m.name.lexeme, inputs, result, m);
}

class MethodCollector extends RecursiveAstVisitor<void> {
  final methods = <MethodDeclaration>[];
  @override
  void visitMethodDeclaration(MethodDeclaration method) { methods.add(method); }
}

class BodyInstrumenter extends RecursiveAstVisitor<void> {
  final String source;
  final List<Edit> edits;
  final String method;
  final int lineOffset;
  final Set<String> nodeLocals = {};
  BodyInstrumenter(this.source, this.edits, this.method, this.lineOffset);

  int line(int offset) => '\n'.allMatches(source.substring(0, offset)).length + 1;
  void at(int position, String code, [int priority = 0]) => edits.add(Edit(position, code, priority));

  @override
  void visitVariableDeclarationStatement(VariableDeclarationStatement s) {
    final declaration = s.variables;
    for (final variable in declaration.variables) {
      final declared = declaration.type?.toSource().replaceAll('?', '') == config['node'];
      final initializer = variable.initializer?.toSource() ?? '';
      if (declared || (config['node']!.isNotEmpty && initializer.startsWith('${config['node']}(')) ||
          (initializer == config['root'] && declaration.type?.toSource() == '${config['node']}?')) {
        nodeLocals.add(variable.name.lexeme);
      }
    }
    instrument(s, after: [
      for (final v in declaration.variables)
        if (nodeLocals.contains(v.name.lexeme))
          'trace.reference(${quote(v.name.lexeme)}, ${v.name.lexeme});'
    ].join(' '));
    super.visitVariableDeclarationStatement(s);
  }

  @override
  void visitExpressionStatement(ExpressionStatement s) {
    final expr = s.expression;
    var before = '';
    var after = '';
    if (expr is AssignmentExpression) {
      final lhs = expr.leftHandSide.toSource();
      if ((lhs == config['root'] || lhs == config['tail']) &&
          lhs.isNotEmpty && expr.operator.lexeme == '=') {
        final old = '__previousRoot_${s.offset}';
        before = 'final $old = $lhs;';
        after = "trace.pointerWrite('root:$lhs', $old, $lhs);";
      } else if (nodeLocals.contains(lhs) && expr.operator.lexeme == '=') {
        after = 'trace.reference(${quote(lhs)}, $lhs);';
      }
    }
    instrument(s, before: before, after: after);
    super.visitExpressionStatement(s);
  }

  @override
  void visitReturnStatement(ReturnStatement s) { instrument(s); super.visitReturnStatement(s); }

  @override
  void visitIfStatement(IfStatement s) { instrument(s); super.visitIfStatement(s); }

  @override
  void visitWhileStatement(WhileStatement s) {
    instrument(s);
    // This event occurs for every successful loop iteration, including when
    // the original while statement is written on a single line.
    final body = s.body;
    if (body is Block) {
      at(body.leftBracket.end, ' trace.atLine(${line(s.offset)}); ');
    } else {
      at(body.offset, '{ trace.atLine(${line(s.offset)}); ', -10);
      at(body.end, ' }', 10);
    }
    super.visitWhileStatement(s);
  }

  void instrument(Statement s, {String before = '', String after = ''}) {
    final prefix = 'trace.atLine(${line(s.offset)}); $before ';
    final parent = s.parent;
    // A non-block if/else body needs braces to keep tracing in that branch.
    // While non-block bodies are wrapped in visitWhileStatement instead.
    if (parent is IfStatement) {
      at(s.offset, '{ $prefix', -5);
      at(s.end, ' $after }', 5);
    } else if (parent is WhileStatement) {
      at(s.offset, '$prefix');
      if (after.isNotEmpty) at(s.end, ' $after');
    } else {
      at(s.offset, '$prefix');
      if (after.isNotEmpty) at(s.end, ' $after');
    }
  }
}

String generateCalls(List<MethodInfo> methods) {
  final out = StringBuffer("import '${config['file']}.dart';\n");
  out.writeln('const discoveredMethodsJson = ${quote(jsonEncode(methods.map((m) => m.toJson()).toList()))};');
  out.writeln('Object? invokeDiscovered(${config['class']} list, String name, List<Object?> args) {');
  out.writeln('switch(name) {');
  for (final m in methods) {
    final args = <String>[];
    for (var i = 0; i < m.params.length; i++) {
      final p = m.params[i];
      final type = p['type'];
      final conversion = 'args[$i] as $type';
      args.add(p['named'] == true ? '${p['name']}: $conversion' : conversion);
    }
    out.writeln('case ${quote(m.name)}:');
    out.writeln('if (args.length != ${m.params.length}) throw ArgumentError("Incorrect argument count");');
    if (m.result == 'void') {
      out.writeln('list.${m.name}(${args.join(', ')}); return null;');
    } else {
      out.writeln('return list.${m.name}(${args.join(', ')});');
    }
  }
  out.writeln('default: throw ArgumentError("Unknown method: \$name");');
  out.writeln('}}');
  return out.toString();
}

void main(List<String> arguments) {
  // ./run passes an explicit source and a private output directory. Existing
  // single-argument invocations continue to work for the example sources.
  final args = [...arguments];
  final kinds = args.isNotEmpty && !args.first.startsWith('--') ? args.removeAt(0) : 'all';
  while (args.isNotEmpty) {
    final flag = args.removeAt(0);
    if (args.isEmpty || !{'--source','--out','--override-kind'}.contains(flag)) {
      stderr.writeln('Usage: instrument.dart KIND [--source FILE] [--out DIR]');
      exitCode = 64; return;
    }
    final value = args.removeAt(0);
    if (flag == '--source') selectedSource = value;
    if (flag == '--out') outputDirectory = value;
    if (flag == '--override-kind') overrideKind = value;
  }
  if (kinds == 'all') {
    if (selectedSource != null && overrideKind == null) {
      stderr.writeln('--source with all requires --override-kind');exitCode=64;return;
    }
    final overrideFile=selectedSource;
    for (final kind in configs.keys) {
      selectedSource = kind == overrideKind ? overrideFile :
        'templates/example/${configs[kind]!['file']}.dart';
      generate(kind);
      if (exitCode != 0) return;
    }
  } else { generate(kinds); }
}

void generate(String kind) {
  exitCode=0;
  final requestedKind = kind;
  config = configs[requestedKind] ?? (throw ArgumentError('Unknown structure: $requestedKind'));
  sourcePath = selectedSource ?? 'structures/example/${config['file']}.dart';
  final original = File(sourcePath);
  if (!original.existsSync()) { stderr.writeln('Student source not found: $sourcePath'); exitCode = 66; return; }
  final source = original.readAsStringSync();
  final parsed = parseString(content: source, path: sourcePath, throwIfDiagnostics: false);
  if (parsed.errors.isNotEmpty) {
    for (final e in parsed.errors) stderr.writeln('Dart source: $e');
    exitCode = 65; return;
  }
  final classes = parsed.unit.declarations.whereType<ClassDeclaration>().where((c) => c.name.lexeme == config['class']).toList();
  if (classes.length != 1) { stderr.writeln('Expected one class named ${config['class']}.'); exitCode = 65; return; }
  final methods = <MethodInfo>[];
  final edits = <Edit>[];
  final collector = MethodCollector();
  classes.single.accept(collector);
  for (final member in collector.methods) {
    final m = describe(member);
    if (m == null) continue;
    methods.add(m);
    final body = member.body;
    if (body is BlockFunctionBody) {
      final block = body.block;
      final startLine = '\n'.allMatches(source.substring(0, member.offset)).length + 1;
      edits.add(Edit(block.leftBracket.end, ' final trace = ${config['recorder']}.active!; trace.atLine($startLine); '));
      final visitor = BodyInstrumenter(source, edits, m.name, 0);
      // Collect node-typed variables in advance, including declarations after
      // earlier assignments within other branches.
      for (final declaration in block.statements.whereType<VariableDeclarationStatement>()) {
        if (declaration.variables.type?.toSource().replaceAll('?', '') == config['node']) {
          visitor.nodeLocals.addAll(declaration.variables.variables.map((v) => v.name.lexeme));
        }
      }
      block.accept(visitor);
    }
  }
  if (methods.isEmpty) { stderr.writeln('No public methods with supported parameter types found.'); exitCode = 65; return; }
  // Multiple inserts at the same offset are concatenated deterministically.
  final changes = <int, List<Edit>>{};
  for (final edit in edits) changes.putIfAbsent(edit.position, () => []).add(edit);
  var transformed = source;
  for (final pos in changes.keys.toList()..sort((a,b) => b.compareTo(a))) {
    transformed = transformed.replaceRange(pos, pos, (changes[pos]!..sort((a,b) => a.priority.compareTo(b.priority))).map((e) => e.text).join(' '));
  }
  // Generated copies live outside the student repository. Their historical
  // ../../lib imports no longer resolve from the private staging directory.
  // Only the supported sandbox API imports are rewritten; other relative
  // imports must be resolved explicitly rather than silently miscompiled.
  for (final lib in ['sandbox','tree_sandbox','stack_sandbox','queue_sandbox']) {
    for (final quote in ["'", '"']) {
      transformed = transformed.replaceAll(
        'import $quote../../lib/$lib.dart$quote;',
        "import 'package:data_structure_sandbox_browser/$lib.dart';",
      );
    }
  }
  final generated = Directory(outputDirectory)..createSync(recursive: true);
  File('${generated.path}/${config['file']}.dart').writeAsStringSync(transformed);
  File('${generated.path}/${requestedKind}_methods.dart').writeAsStringSync(generateCalls(methods));
  stdout.writeln('Discovered ${methods.length} method(s): ${methods.map((m) => m.name).join(', ')}.');
}
