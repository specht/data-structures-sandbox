// Run from repository root: dart test/editor_format_integration.dart
import 'dart:io';
import '../tool/source_editor.dart';

Future<void> main() async {
  final directory=await Directory.systemTemp.createTemp('sandbox-format-');
  try {
    final file=File('${directory.path}/student.dart');
    await file.writeAsString('class Original {}\n');
    final original=await file.readAsString();
    final formatted=await formatEditableDraft(file.path,'class A{int x=1;}');
    if (!formatted.contains('class A {') || !formatted.contains('int x = 1;')) {
      throw StateError('Unexpected formatter output: $formatted');
    }
    if(await file.readAsString()!=original)throw StateError('Formatting modified the saved source.');
    try {
      await formatEditableDraft(file.path,'class {');
      throw StateError('Formatter accepted invalid Dart source.');
    } on FormatException {
      // An unfinished draft must not be saved.
    }
    if(await file.readAsString()!=original)throw StateError('A failed format modified the saved source.');
    print('PASS: formatting is non-destructive and invalid drafts return an error.');
  } finally {await directory.delete(recursive:true);}
}
