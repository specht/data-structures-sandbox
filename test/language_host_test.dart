// The host's path for Python, JavaScript and Java files: catalog names,
// builds through the language daemons, worker commands, formatting and
// student diagnostics.  dart test/language_host_test.dart
//
// Languages whose toolchain is not installed are skipped with a note.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../tool/instrument_client.dart';
import '../tool/languages.dart';
import '../tool/prepare.dart';
import '../tool/registry.dart';
import '../tool/source_editor.dart';

void require(bool condition, String message) {
  if (!condition) throw StateError(message);
}

Future<Map<String, dynamic>> nextMessage(StreamIterator<String> output) async {
  require(
    await output.moveNext().timeout(const Duration(seconds: 90)),
    'Worker exited before sending a response.',
  );
  return Map<String, dynamic>.from(jsonDecode(output.current) as Map);
}

Future<void> main() async {
  final root = Directory.systemTemp.createTempSync('sandbox-language-host-');
  final processes = <Process>[];
  var tested = 0;
  try {
    final student = Directory('${root.path}/alice')..createSync(recursive: true);
    for (final (extension, check) in <(String, Future<Object?> Function())>[
      ('.py', pythonToolchain.command),
      ('.js', nodeToolchain.command),
      ('.java', javaToolchain.tools),
    ]) {
      final label = languageNameOf(extension);
      try {
        await check();
      } on ToolchainMissing {
        print('SKIP: $label is not installed.');
        continue;
      }
      final name = 'my_linked_stack$extension';
      File('${student.path}/$name')
          .writeAsStringSync(File('templates/example/$name').readAsStringSync());
      final found = implementationForFile(name);
      require(found?.kind == 'linked_stack' && found?.variant == extension, '$label file name');

      final command = await prepareWorker('alice', 'linked_stack', root.path, variant: extension);
      require(!workerNeedsBuild('alice', 'linked_stack', root.path, variant: extension),
          '$label build is cached');
      final process = await Process.start(command.first, command.sublist(1),
          workingDirectory: Directory.current.path);
      processes.add(process);
      final output = StreamIterator(
          process.stdout.transform(utf8.decoder).transform(const LineSplitter()));
      final hello = await nextMessage(output);
      require(hello['type'] == 'hello', '$label worker did not initialize: $hello');
      process.stdin.writeln(jsonEncode({
        'action': 'run',
        'commands': [
          {'method': 'push', 'arguments': [4]},
          {'method': 'push', 'arguments': [9]},
          {'method': 'pop', 'arguments': []},
        ],
      }));
      await process.stdin.flush();
      final reply = await nextMessage(output);
      require(reply['type'] == 'trace' && (reply['values'] as List).join(',') == '4',
          '$label trace: $reply');

      final formatted = await formatEditableDraft(
          '${student.path}/$name', File('${student.path}/$name').readAsStringSync());
      require(formatted.contains('class MyLinkedStack'), '$label formatter');

      // A student error comes back as editor diagnostics with a line.
      File('${student.path}/my_linked_stack_broken$extension').writeAsStringSync(
          File('templates/example/$name').readAsStringSync()
              .replaceFirstMapped(RegExp(r'return ([Tt])rue'), (match) => 'return ${match[1]}ure'));
      try {
        await prepareWorker('alice', 'linked_stack', root.path, variant: 'broken$extension');
        throw StateError('$label accepted a broken file');
      } on StudentDiagnosticsException catch (error) {
        require(error.diagnostics.isNotEmpty && error.diagnostics.first['line'] is int,
            '$label diagnostics: ${error.diagnostics}');
      }
      tested++;
    }
    print('PASS: $tested language(s) build, run, format and report errors through the host.');
  } finally {
    for (final process in processes) {
      process.kill(ProcessSignal.sigkill);
    }
    await shutdownInstrumenter();
    root.deleteSync(recursive: true);
  }
  exit(0);
}
