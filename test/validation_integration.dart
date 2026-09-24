// Run from the repository root; example sources are copied to a temporary repo:
//   dart test/validation_integration.dart
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../tool/prepare.dart';
import '../tool/registry.dart';
import '../tool/student_validation.dart';

Future<void> main() async {
  const kinds = ['stack', 'linked_stack', 'array_queue', 'linked_queue',
    'list', 'tree', 'avl', 'array_heap', 'node_heap', 'hash'];
  final temporary = await Directory.systemTemp.createTemp('ds-specialized-workers-');
  try {
    final example = Directory('${temporary.path}/example');
    await example.create(recursive: true);
    for (final spec in structures) {
      await File('templates/example/${spec.filename}')
          .copy('${example.path}/${spec.filename}');
    }
    for (final kind in kinds) {
      final workerPath = await prepare('example',kind,temporary.path);
      final process = await Process.start(Platform.resolvedExecutable,[workerPath]);
      final lines = StreamIterator(process.stdout.transform(utf8.decoder)
          .transform(const LineSplitter()));
      Future<Map<String,dynamic>> next({int seconds=6}) async {
        if(!await lines.moveNext().timeout(Duration(seconds:seconds))) {
          throw StateError('$kind: worker exited before replying');
        }
        final data=jsonDecode(lines.current);
        if(data is! Map<String,dynamic>)throw StateError('$kind: invalid response');
        return data;
      }
      Future<Map<String,dynamic>> request(Map<String,Object?> command) async {
        process.stdin.writeln(jsonEncode(command));
        await process.stdin.flush();
        return next();
      }
      try {
        final hello=await next(seconds:45);
        if(hello['type']!='hello')throw StateError('$kind: worker did not initialize');
        for(final scenario in validationCases(kind)) {
          final reset=await request({'action':'reset'});
          if(reset['type']!='trace')throw StateError('$kind: reset failed');
          for(final call in scenario.calls) {
            final result=await request({...call.toRequest(),'action':'validateCall'});
            if(result['type']!='validationCall' || result['ok']!=true) {
              throw StateError('$kind / ${scenario.name} / ${call.label}: $result');
            }
          }
        }
        print('PASS: $kind — ${validationCases(kind).length} scenarios');
      } finally {
        process.kill(ProcessSignal.sigkill);
        await lines.cancel();
      }
    }
  } finally {
    await temporary.delete(recursive: true);
  }
}
