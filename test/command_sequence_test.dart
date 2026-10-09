import 'dart:async';
import 'dart:convert';
import 'dart:io';

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
  final root = Directory.systemTemp.createTempSync('sandbox-command-sequence-');
  Process? process;
  try {
    final student = Directory('${root.path}/alice')
      ..createSync(recursive: true);
    File('${student.path}/my_avl.dart').writeAsStringSync(
      File('templates/example/my_avl.dart').readAsStringSync(),
    );

    final workerPath = await prepare('alice', 'avl', root.path);
    process = await Process.start(
      Platform.resolvedExecutable,
      [workerPath],
      workingDirectory: Directory.current.path,
    );
    final output = StreamIterator(
      process.stdout.transform(utf8.decoder).transform(const LineSplitter()),
    );
    require(
      (await nextMessage(output))['type'] == 'hello',
      'Generated AVL worker did not initialize.',
    );

    process.stdin.writeln(jsonEncode({
      'action': 'run',
      'commands': [
        {'method': 'insert', 'arguments': [30]},
        {'method': 'insert', 'arguments': [20]},
        {'method': 'insert', 'arguments': [10]},
        {'method': 'contains', 'arguments': [20]},
      ],
    }));
    await process.stdin.flush();
    final reply = await nextMessage(output);
    require(reply['type'] == 'trace', 'Command sequence did not return a trace.');
    require(
      (reply['values'] as List).join(',') == '10,20,30',
      'Mixed commands did not update one persistent AVL instance: ${reply['values']}',
    );
    final operations = (reply['steps'] as List)
        .whereType<Map>()
        .where((step) => step['kind'] == 'operationStart')
        .map((step) => step['operation'])
        .toList();
    require(
      operations.join('|') ==
          'insert(30)|insert(20)|insert(10)|contains(20)',
      'Trace did not preserve command order: $operations',
    );

    print('PASS: mixed command sequence executes in order in one trace.');
  } finally {
    process?.kill(ProcessSignal.sigkill);
    root.deleteSync(recursive: true);
  }
  // prepare() owns a persistent analyzer daemon; all assertions are complete.
  exit(0);
}
