// Run from the repository root: dart test/instrument_daemon_test.dart
// Exercises multiple successful requests and a syntax error in ONE process.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

void check(bool condition, String message) {
  if (!condition) throw StateError(message);
}

Future<void> main() async {
  final directory = await Directory.systemTemp.createTemp('instrument-daemon-');
  final source = File('${directory.path}/my_array_stack.dart');
  final original = File('templates/example/my_array_stack.dart').readAsStringSync();
  await source.writeAsString(original);
  final process = await Process.start(
    Platform.resolvedExecutable, ['run', 'tool/instrument_daemon.dart'],
  );
  final output = StreamIterator(
    process.stdout.transform(utf8.decoder).transform(const LineSplitter()),
  );
  final errors = StringBuffer();
  process.stderr.transform(utf8.decoder).listen(errors.write);
  Future<Map<String, dynamic>> next() async {
    if (!await output.moveNext().timeout(const Duration(seconds: 45))) {
      throw StateError('Daemon exited early: $errors');
    }
    final result = jsonDecode(output.current);
    if (result is! Map<String, dynamic>) throw StateError('Invalid protocol reply: $result');
    return result;
  }
  Future<Map<String, dynamic>> request(int id, String out) async {
    process.stdin.writeln(jsonEncode({
      'id': id, 'kind': 'stack', 'source': source.path, 'out': out,
    }));
    await process.stdin.flush();
    final result = await next();
    check(result['id'] == id, 'Unexpected response ID: $result');
    return result;
  }

  try {
    final ready = await next();
    check(ready['type'] == 'ready' && ready['pid'] is int,
        'Persistent instrumenter did not start: $ready');
    final first = await request(1, '${directory.path}/first');
    check(first['ok'] == true, 'First source failed: $first');
    check(File('${directory.path}/first/my_array_stack.dart').existsSync(),
        'Instrumented first source was not written.');
    check(File('${directory.path}/first/stack_methods.dart').existsSync(),
        'The first method dispatcher was not written.');

    await source.writeAsString('class MyArrayStack {\n  int x = ;\n}');
    final invalid = await request(2, '${directory.path}/invalid');
    check(invalid['ok'] == false &&
        (invalid['error'] as String).contains('Dart source:'),
        'Syntax diagnostics were lost: $invalid');
    final issues = invalid['diagnostics'] as List?;
    check(issues != null && issues.isNotEmpty,
        'Structured syntax diagnostics were not returned: $invalid');
    check(issues!.any((issue) => issue['line'] == 2 &&
        issue['column'] is int && issue['message'] is String),
        'Diagnostics must refer to line 2 in the original source: $issues');

    await source.writeAsString(original);
    final third = await request(3, '${directory.path}/third');
    check(third['ok'] == true, 'Daemon did not recover after syntax error: $third');
    check(File('${directory.path}/third/stack_methods.dart').existsSync(),
        'Third method dispatcher was not written.');
    check(process.kill(ProcessSignal.sigterm), 'The daemon exited unexpectedly.');
    print('PASS: one persistent instrumenter processed valid, invalid and valid requests.');
  } finally {
    process.kill();
    await process.stdin.close();
    await output.cancel();
    await directory.delete(recursive: true);
  }
}
