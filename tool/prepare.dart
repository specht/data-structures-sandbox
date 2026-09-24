import 'dart:io';
import 'registry.dart';

// All filenames/IDs are validated before being interpolated into a path.
final _safeName = RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$');
int _generation = 0;

Future<String> prepare(String student, String kind, String repoPath) async {
  if (!_safeName.hasMatch(student)) throw FormatException('Invalid student directory');
  final selected = specFor(kind);
  final repo = Directory(repoPath).absolute;
  final source = File('${repo.path}/$student/${selected.filename}');
  if (!source.existsSync()) throw FormatException('Implementation not found: ${source.path}');
  final id = '${student}_${kind}_${DateTime.now().microsecondsSinceEpoch}_${++_generation}';
  // Private staging files are not part of either Git repository.
  final out = Directory('tool/generated/$id')..createSync(recursive:true);
  // Parse all three contracts in one analyzer invocation. Only the selected
  // file is student-owned; the others are trusted, bundled fallbacks that keep
  // the legacy adapter imports resolvable without blocking discovery.
  final instrumented=await Process.run(Platform.resolvedExecutable,
    ['run','tool/instrument.dart','all','--override-kind',kind,
     '--source',source.path,'--out',out.path]);
  if(instrumented.exitCode!=0){
    throw FormatException('Could not instrument ${source.path}:\n${instrumented.stdout}${instrumented.stderr}');
  }
  var worker=File('tool/worker_template.txt').readAsStringSync()
    .replaceAll('@@ID@@',id).replaceAll('@@KIND@@',kind);
  for (final spec in structures) {
    worker=worker.replaceAll('@@${switch(spec.id){'list'=>'LIST','tree'=>'TREE',_=>'STACK'}}_PATH@@',
      spec.id==kind?source.path:'templates/example/${spec.filename}');
  }
  final file=File('tool/generated_worker_$id.dart')..writeAsStringSync(worker);
  final checked=await Process.run(Platform.resolvedExecutable,['analyze',file.path]);
  if(checked.exitCode!=0) {
    throw FormatException('Dart compilation diagnostics for $student/$kind:\n${checked.stdout}${checked.stderr}');
  }
  return file.path;
}
