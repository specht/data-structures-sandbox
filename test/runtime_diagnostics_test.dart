import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../tool/host.dart' as host;
import '../tool/prepare.dart';

void require(bool condition, String message) {
  if (!condition) throw StateError(message);
}

Future<Map<String, dynamic>> nextMessage(StreamIterator<String> output) async {
  require(
    await output.moveNext().timeout(const Duration(seconds: 45)),
    'Worker exited before sending a response.',
  );
  return Map<String, dynamic>.from(jsonDecode(output.current) as Map);
}

Future<void> main() async {
  final root = Directory.systemTemp.createTempSync('sandbox-runtime-console-');
  Process? process;
  host.StudentWorker? hangingWorker;
  try {
    final student = Directory('${root.path}/alice')
      ..createSync(recursive: true);
    final example = File(
      'templates/example/my_array_stack.dart',
    ).readAsStringSync();
    const failingLine = '    memory[99] = value;';
    final source = example.replaceFirst(
      '    if (top + 1 == memory.length) return false;',
      "    print('pushing \$value');\n$failingLine",
    );
    File('${student.path}/my_array_stack.dart').writeAsStringSync(source);
    final expectedLine = source.split('\n').indexOf(failingLine) + 1;

    final workerPath = await prepare('alice', 'stack', root.path);
    process = await Process.start(Platform.resolvedExecutable, [
      workerPath,
    ], workingDirectory: Directory.current.path);
    final output = StreamIterator(
      process.stdout.transform(utf8.decoder).transform(const LineSplitter()),
    );
    require(
      (await nextMessage(output))['type'] == 'hello',
      'Generated worker did not initialize.',
    );
    process.stdin.writeln(
      jsonEncode({
        'action': 'run',
        'method': 'push',
        'arguments': [7],
      }),
    );
    await process.stdin.flush();

    Map<String, dynamic>? printed;
    Map<String, dynamic>? failure;
    while (failure == null) {
      final message = await nextMessage(output);
      if (message['type'] == 'studentOutput') printed = message;
      if (message['type'] == 'executionError') failure = message;
    }
    require(
      printed?['text'] == 'pushing 7',
      'print() output was not captured by the worker protocol.',
    );
    require(
      printed?['line'] is int && printed?['traceIndex'] is int,
      'print() output needs a source line and trace position.',
    );
    final error = Map<String, dynamic>.from(failure['error'] as Map);
    require(
      error['line'] == expectedLine,
      'Runtime error should point to original source line $expectedLine: $error',
    );
    require(
      error['stack'] is List && (error['stack'] as List).isNotEmpty,
      'Runtime error should include student-source stack frames.',
    );
    require(
      (failure['steps'] as List).whereType<Map>().any(
        (step) => step['kind'] == 'executionError',
      ),
      'Runtime failure should retain a step-through partial trace.',
    );

    process.kill(ProcessSignal.sigkill);
    process = null;

    final hanging = File('${root.path}/hanging_worker.dart')
      ..writeAsStringSync(r'''
import 'dart:async';
import 'dart:convert';
import 'dart:io';
Future<void> main() async {
  stdout.writeln(jsonEncode({'type':'hello'}));
  await for (final _ in stdin.transform(utf8.decoder).transform(const LineSplitter())) {
    stdout.writeln(jsonEncode({'type':'executionProgress','line':37,'traceIndex':9}));
    stdout.writeln(jsonEncode({'type':'studentOutput','kind':'stdout',
      'text':'still looping','line':37,'traceIndex':9}));
    await Completer<void>().future;
  }
}
''');
    final hangingProcess = await Process.start(Platform.resolvedExecutable, [
      hanging.path,
    ], workingDirectory: Directory.current.path);
    hangingWorker = host.StudentWorker(hangingProcess);
    require(
      (await hangingWorker.next(host.startupTimeout))['type'] == 'hello',
      'Hanging test worker did not initialize.',
    );
    try {
      await hangingWorker.request({'action': 'run'});
      throw StateError('Hanging student code did not time out.');
    } on host.StudentExecutionTimeout catch (error) {
      require(
        error.line == 37 && error.traceIndex == 9,
        'Timeout should retain the last active trace location.',
      );
      require(
        error.console.single['text'] == 'still looping',
        'Timeout should retain print output emitted before it stopped.',
      );
    }

    print(
      'PASS: print capture, partial runtime trace, source location and timeout diagnostics.',
    );
  } finally {
    process?.kill(ProcessSignal.sigkill);
    hangingWorker?.kill();
    root.deleteSync(recursive: true);
  }
  // prepare() owns a persistent analyzer daemon for the application. This
  // standalone integration test has finished all assertions and cleanup.
  exit(0);
}
