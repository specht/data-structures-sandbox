// The structure-independent part of every worker process: request parsing,
// tracing, verification against the adapter's reference model, runtime error
// reporting and the stdin/stdout protocol with tool/host.dart.
//
// A worker is generated for exactly one selected student file (see
// tool/specialize_worker.dart). It runs as a separate Dart process, so a
// stuck method cannot block the browser server.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../trace_budget.dart' as trace_runtime;
import 'adapter.dart';

// One run is bounded for trace readability; a structure is not capped at 20
// nodes (students build larger ones over several runs). A runaway program is
// still bounded by the event log, the host deadline and the message size.
const maxOperations = 20, maxValue = 999;

class BrowserSession {
  BrowserSession(this.adapter, {required this.sourcePath, required this.generatedFile}) {
    lines = File(sourcePath).readAsLinesSync();
    methods = (jsonDecode(adapter.methodsJson) as List)
        .map((entry) => Map<String, dynamic>.from(entry as Map))
        .toList();
    adapter.reset();
  }

  final StructureAdapter adapter;

  /// The student's file as shown in the browser.
  final String sourcePath;

  /// The instrumented copy's file name as it appears in stack frames. It keeps
  /// the starter's name even for a variant such as my_bst_recursive.dart.
  final String generatedFile;

  final String sessionId = DateTime.now().microsecondsSinceEpoch.toString();
  late final List<String> lines;
  late final List<Map<String, dynamic>> methods;

  String get kind => adapter.kind;
  List<int> get reference => adapter.reference;

  Map<String, Object?> initial() {
    final r = adapter.createRecorder(lines);
    return envelope([r.snapshot()]);
  }

  Map<String, Object?> envelope(List<Map<String, Object?>> steps) => {
        'type': 'trace', 'structure': kind, 'sessionId': '$kind:$sessionId',
        'source': {'file': sourcePath, 'lines': lines},
        'steps': steps, 'values': [...reference], 'methods': methods,
        'capacity': adapter.capacity,
      };

  Map<String, dynamic> descriptor(String name) => methods.firstWhere(
      (m) => m['name'] == name,
      orElse: () => throw FormatException('Unknown method: $name'));

  Object? scalar(Object? raw, String type) => switch (type) {
        'int' when raw is int && raw.abs() <= maxValue => raw,
        'double' when raw is num && raw.isFinite => raw.toDouble(),
        'bool' when raw is bool => raw,
        'String' when raw is String && raw.length <= 256 => raw,
        _ => throw FormatException('Invalid $type argument (integer range: -999…999).'),
      };

  List<Map<String, Object?>> plan(Map<String, dynamic> message) {
    if (message['action'] != 'run') throw const FormatException('Unknown command.');
    Map<String, Object?> checkedCall(String name, List<Object?> args) {
      final params = (descriptor(name)['params'] as List).cast<Map<String, dynamic>>();
      if (args.length != params.length) {
        throw const FormatException('Wrong number of arguments.');
      }
      return <String, Object?>{
        'method': name,
        'args': [for (var i = 0; i < args.length; i++) scalar(args[i], params[i]['type'] as String)],
      };
    }

    final sequence = message['commands'];
    if (sequence is List) {
      if (sequence.isEmpty || sequence.length > maxOperations) {
        throw const FormatException('Use 1–$maxOperations calls.');
      }
      return [
        for (final command in sequence)
          if (command is Map && command['method'] is String && command['arguments'] is List)
            checkedCall(command['method'] as String, (command['arguments'] as List).cast<Object?>())
          else
            throw const FormatException('Invalid command in sequence.')
      ];
    }
    final name = message['method'] as String;
    final params = (descriptor(name)['params'] as List).cast<Map<String, dynamic>>();
    final raw = message['arguments'], legacy = message['values'];
    if (raw is List) return [checkedCall(name, raw.cast<Object?>())];
    if (legacy is List && params.length == 1 && params.single['type'] == 'int') {
      if (legacy.isEmpty || legacy.length > maxOperations) {
        throw const FormatException('Use 1–$maxOperations calls.');
      }
      return [for (final value in legacy) checkedCall(name, <Object?>[value])];
    }
    throw const FormatException('Supply the method arguments.');
  }

  /// Runs one student method with [recorder] receiving the instrumented
  /// events; recorders are always detached afterwards.
  Object? invokeRecorded(dynamic recorder, String name, List<Object?> args) {
    try {
      adapter.activate(recorder);
      return adapter.invoke(name, args);
    } finally {
      deactivateRecorders();
    }
  }

  /// All independently observable parts of a contract are checked after EACH
  /// operation, not only when a later get()/contains()/peek() is called.
  Map<String, Object?> validateCall(Map<String, dynamic> message) {
    final name = message['method'] as String;
    final declared = descriptor(name);
    final params = (declared['params'] as List).cast<Map<String, dynamic>>();
    final raw = message['arguments'];
    if (raw is! List || raw.length != params.length) {
      throw const FormatException('Wrong number of test arguments.');
    }
    final requiredSignature = adapter.requiredMethodSignature(name);
    final declaredArgs = params
        .map((param) => param['named'] == true ? 'named ${param['type']}' : '${param['type']}')
        .join(', ');
    final declaredSignature = "${declared['returns']} $name($declaredArgs)";
    if (requiredSignature != declaredSignature) {
      return {
        'type': 'validationCall', 'ok': false, 'notExecuted': true,
        'expectedContents': List<int>.of(reference),
        'actualContents': adapter.actualValues(),
        'checks': [
          {'aspect': 'Method signature', 'expected': requiredSignature, 'actual': declaredSignature}
        ],
        'message': 'Method signature',
      };
    }
    final args = <Object?>[
      for (var i = 0; i < raw.length; i++) scalar(raw[i], params[i]['type'] as String),
    ];
    final expected = adapter.expectedReturn(name, args);
    // Instrumented student methods expect an active recorder. This one is
    // disposable; its trace is never interpreted as a test result.
    final returned = invokeRecorded(adapter.createRecorder(lines), name, args);
    // Advance the reference model regardless of a wrong return, so that the
    // report identifies return AND storage failures separately.
    adapter.updateReference(name, args, returned);
    final expectedContents = List<int>.of(reference);
    final actualContents = adapter.actualValues();
    final issues = <Map<String, Object?>>[];
    void check(String aspect, Object? wanted, Object? observed, [bool? passed]) {
      if (!(passed ?? wanted == observed)) {
        issues.add({'aspect': aspect, 'expected': wanted, 'actual': observed});
      }
    }

    check('Return value', expected, returned, adapter.returnMatches(name, expected, returned));
    final unordered = adapter.unorderedContents;
    final comparedActual = List<int>.of(actualContents);
    final comparedExpected = List<int>.of(expectedContents);
    if (unordered) {
      comparedActual.sort();
      comparedExpected.sort();
    }
    check('Contents', comparedExpected, comparedActual,
        comparedExpected.join(',') == comparedActual.join(','));
    adapter.structuralChecks(check);
    return {
      'type': 'validationCall', 'ok': issues.isEmpty,
      'expectedReturn': expected, 'actualReturn': returned,
      'returnIsVoid': declared['returns'] == 'void',
      'expectedContents': unordered ? comparedExpected : expectedContents,
      'actualContents': unordered ? comparedActual : actualContents,
      'contentsComparedAsUnordered': unordered,
      'checks': issues,
      if (issues.isNotEmpty) 'message': issues.map((issue) => issue['aspect']).join(', '),
    };
  }

  Map<String, Object?> execute(Map<String, dynamic> message) {
    if (message['action'] == 'reset') {
      adapter.reset();
      return initial();
    }
    if (message['action'] == 'validateCall') return validateCall(message);
    final commands = plan(message);
    // "Repeat" in the browser: the calls describe a scenario that always
    // starts from an empty structure. Reset only after the request is valid.
    final fromEmpty = message['reset'] == true;
    if (fromEmpty) adapter.reset();
    final r = adapter.createRecorder(lines);
    r.steps.add(r.snapshot());
    var completed = 0, stoppedEarly = false;
    for (final command in commands) {
      completed++;
      final name = command['method'] as String;
      final args = command['args'] as List<Object?>;
      r.begin(name, args);
      Object? result;
      Object? executionError;
      StackTrace? executionStack;
      try {
        result = invokeRecorded(r, name, args);
      } catch (error, stack) {
        executionError = error;
        executionStack = stack;
      }
      if (executionError != null) {
        final failure = runtimeFailure(executionError, executionStack!);
        final failureIndex = failure['traceIndex'];
        if (failureIndex is int && failureIndex >= r.steps.length && r.steps.isNotEmpty) {
          failure['traceIndex'] = r.steps.length - 1;
        }
        try {
          r.steps.add({
            'kind': 'executionError', 'message': failure['message'],
            'line': failure['line'] ?? trace_runtime.ExecutionDiagnostics.currentLine,
          });
        } catch (_) {
          // A trace-budget error already filled the event log. The failure
          // metadata still carries its last source line to the browser.
        }
        return {
          ...envelope(r.steps.cast<Map<String, Object?>>()),
          'type': 'executionError', 'error': failure,
        };
      }
      final canVerify = adapter.standardMethods.contains(name) &&
          (const {'pop', 'dequeue', 'removeMin', 'peek', 'isEmpty', 'isFull', 'length'}
                  .contains(name) ||
              (args.length == 1 && args.single is int) ||
              (args.length == 2 && args.every((arg) => arg is int)));
      final checked = adapter.updateReference(name, args, result);
      final actual = List<int>.of(adapter.actualValues());
      final expected = List<int>.of(reference);
      if (adapter.unorderedContents) {
        actual.sort();
        expected.sort();
      }
      final problems = adapter.executionProblems();
      final ok = checked && actual.join(',') == expected.join(',') && problems.isEmpty;
      r.steps.add(r.snapshot());
      final returnsVoid = descriptor(name)['returns'] == 'void';
      final label = '$name(${args.join(', ')})';
      final verdict = !ok
          ? 'CHECK FAILED${problems.map((problem) => ' ($problem)').join()}'
          : canVerify
              ? 'checked'
              : 'not automatically verified';
      final message = '$label ${returnsVoid ? 'completed' : '⇒ $result'} · $verdict';
      r.end(result, ok, returnedVoid: returnsVoid, message: message);
      if (!ok) {
        stoppedEarly = completed < commands.length;
        break;
      }
    }
    return {
      ...envelope(r.steps.cast<Map<String, Object?>>()),
      'calls': {
        'planned': commands.length, 'completed': completed,
        'stoppedEarly': stoppedEarly, 'fromEmpty': fromEmpty,
      },
    };
  }

  Map<String, Object?> runtimeFailure(Object error, StackTrace stack) {
    final sourceName = generatedFile;
    int? line = trace_runtime.ExecutionDiagnostics.currentLine;
    int? column;
    final studentFrames = <String>[];
    for (final frame in stack.toString().split('\n')) {
      if (!frame.contains('/$sourceName:') && !frame.contains('\\$sourceName:')) continue;
      final match = RegExp(r':(\d+):(\d+)\)?$').firstMatch(frame.trim());
      if (match != null) {
        line ??= int.tryParse(match.group(1)!);
        column ??= int.tryParse(match.group(2)!);
      }
      if (studentFrames.length < 8) {
        final function = RegExp(r'^#\d+\s+([^\s(]+)').firstMatch(frame.trim())?.group(1);
        studentFrames.add(
            '${function ?? 'student code'} ($sourceName:${match?.group(1) ?? '?'}:${match?.group(2) ?? '?'})');
      }
    }
    final message = '$error';
    return {
      'kind': 'runtime',
      'message': message.length > 2000 ? message.substring(0, 2000) : message,
      if (line != null) 'line': line,
      if (column != null) 'column': column,
      if (trace_runtime.ExecutionDiagnostics.currentTraceIndex != null)
        'traceIndex': trace_runtime.ExecutionDiagnostics.currentTraceIndex,
      if (studentFrames.isNotEmpty) 'stack': studentFrames,
    };
  }
}

/// The worker's main loop: one JSON request per stdin line, one or more JSON
/// lines on stdout (progress, print output, then the response).
Future<void> runWorker(StructureAdapter adapter,
    {required String sourcePath, required String generatedFile}) async {
  final session =
      BrowserSession(adapter, sourcePath: sourcePath, generatedFile: generatedFile);
  stdout.writeln(jsonEncode({'type': 'hello', 'trace': session.initial()}));
  await for (final line in stdin.transform(utf8.decoder).transform(const LineSplitter())) {
    final progressClock = Stopwatch()..start();
    var lastProgressMicros = -100000, printCount = 0, printBytes = 0;
    var printTruncated = false;
    trace_runtime.ExecutionDiagnostics.reset();
    try {
      final message = jsonDecode(line);
      if (message is! Map<String, dynamic>) throw const FormatException('Invalid request');
      if (message['action'] == 'ping') {
        stdout.writeln('{"type":"pong"}');
        continue;
      }
      if (message['_diagnostics'] == true) {
        trace_runtime.ExecutionDiagnostics.onLine = (sourceLine, traceIndex) {
          final now = progressClock.elapsedMicroseconds;
          if (now - lastProgressMicros < 50000) return;
          lastProgressMicros = now;
          stdout.writeln(jsonEncode(
              {'type': 'executionProgress', 'line': sourceLine, 'traceIndex': traceIndex}));
        };
      }
      final response = runZoned<Map<String, Object?>>(
        () => session.execute(message),
        zoneSpecification: ZoneSpecification(print: (self, parent, zone, text) {
          final encoded = utf8.encode(text);
          if (printCount < 200 && printBytes + encoded.length <= 65536) {
            printCount++;
            printBytes += encoded.length;
            stdout.writeln(jsonEncode({
              'type': 'studentOutput', 'kind': 'stdout', 'text': text,
              'line': trace_runtime.ExecutionDiagnostics.currentLine,
              'traceIndex': trace_runtime.ExecutionDiagnostics.currentTraceIndex,
            }));
          } else if (!printTruncated) {
            printTruncated = true;
            stdout.writeln(jsonEncode({
              'type': 'studentOutput', 'kind': 'warning',
              'text': 'Further print output was truncated.',
              'line': trace_runtime.ExecutionDiagnostics.currentLine,
              'traceIndex': trace_runtime.ExecutionDiagnostics.currentTraceIndex,
            }));
          }
        }),
      );
      stdout.writeln(jsonEncode(response));
    } catch (error, stack) {
      stderr.writeln('Student execution failed: $error\n$stack');
      stdout.writeln(jsonEncode(
          {'type': 'error', 'error': session.runtimeFailure(error, stack), 'message': '$error'}));
    } finally {
      trace_runtime.ExecutionDiagnostics.onLine = null;
    }
  }
}
