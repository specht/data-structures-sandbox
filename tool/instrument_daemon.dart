// Keep the analyzer loaded between edits. One JSON request and reply per line.
// This process never executes student methods; those still run in isolated workers.
import 'dart:convert';
import 'dart:io';

import 'instrument.dart' as instrument;

Future<void> main() async {
  stdout.writeln(jsonEncode({'type': 'ready', 'pid': pid}));
  await for (final line in stdin.transform(utf8.decoder).transform(const LineSplitter())) {
    int? id;
    try {
      final request = jsonDecode(line);
      if (request is! Map<String, dynamic> ||
          request['id'] is! int || request['kind'] is! String ||
          request['source'] is! String || request['out'] is! String) {
        throw const FormatException('Invalid instrumentation request.');
      }
      id = request['id'] as int;
      instrument.selectedSource = request['source'] as String;
      instrument.outputDirectory = request['out'] as String;
      // generate() resets exitCode for each request. A syntax error must not
      // terminate the daemon or contaminate the next student's build.
      instrument.generate(request['kind'] as String, announce: false);
      final status = exitCode;
      exitCode = 0;
      stdout.writeln(jsonEncode({
        'id': id, 'ok': status == 0,
        if (status != 0) 'error': instrument.lastError ?? 'Instrumentation failed.',
      }));
    } catch (error) {
      exitCode = 0;
      stdout.writeln(jsonEncode({'id': id, 'ok': false, 'error': '$error'}));
    }
  }
}
