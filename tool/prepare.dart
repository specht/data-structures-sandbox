import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

import 'registry.dart';

// All names are validated before becoming parts of generated paths.
final _safeName = RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$');

// Multiple browser sessions may select the same implementation at once. They
// share one preparation, but each still gets its own live worker and state.
final _building = <String, Future<String>>{};

Future<String> prepare(String student, String kind, String repoPath) async {
  if (!_safeName.hasMatch(student)) {
    throw const FormatException('Invalid student directory');
  }
  final selected = specFor(kind);
  final repo = Directory(repoPath).absolute;
  final source = File('${repo.path}/$student/${selected.filename}');
  if (!source.existsSync()) {
    throw FormatException('Implementation not found: ${source.path}');
  }

  // Never key on timestamps: saving unchanged contents should reuse the same
  // validated worker, even across ./run restarts and browser sessions.
  final key = _fingerprint(source, student, kind);
  final id = '${student}_${kind}_${key.substring(0, 24)}';
  final existing = _building[id];
  if (existing != null) return existing;
  final future = _build(student, kind, source, id, key);
  _building[id] = future;
  try {
    return await future;
  } finally {
    if (identical(_building[id], future)) _building.remove(id);
  }
}

String _fingerprint(File source, String student, String kind) {
  final files = <File>[
    ..._studentDependencies(source),
    File('pubspec.yaml'),
    File('pubspec.lock'),
    File('tool/worker_template.txt'),
    File('tool/instrument.dart'),
    File('tool/registry.dart'),
    ...Directory('lib').listSync(recursive: true).whereType<File>()
        .where((file) => file.path.endsWith('.dart')),
    ...Directory('templates/example').listSync().whereType<File>()
        .where((file) => file.path.endsWith('.dart')),
  ]..sort((a, b) => a.path.compareTo(b.path));
  final bytes = BytesBuilder(copy: false);
  void add(String part) {
    bytes.add(utf8.encode(part));
    bytes.addByte(0);
  }
  add('worker-cache-v1');
  add(Platform.version);
  add(source.absolute.path); // Also identifies distinct repositories.
  add(student);
  add(kind);
  for (final file in files) {
    add(file.path);
    if (file.existsSync()) {
      final content = file.readAsBytesSync();
      add('${content.length}');
      bytes.add(content);
    } else {
      add('missing');
    }
    bytes.addByte(0);
  }
  return sha256.convert(bytes.takeBytes()).toString();
}

// Include relative imports, exports and part files used by this implementation.
// An unrelated student's edits must not invalidate this student's cache.
List<File> _studentDependencies(File entry) {
  final result = <String, File>{};
  void visit(File file) {
    final absolute = file.absolute;
    if (result.containsKey(absolute.path)) return;
    result[absolute.path] = absolute;
    if (!absolute.existsSync()) return;
    final source = absolute.readAsStringSync();
    final directive = RegExp(r'''\b(?:import|export|part)\s+['\"]([^'\"]+)['\"]''');
    for (final match in directive.allMatches(source)) {
      final uri = match.group(1)!;
      if (uri.startsWith('dart:') || uri.startsWith('package:')) continue;
      final resolved = absolute.uri.resolve(uri);
      if (resolved.scheme == 'file') visit(File.fromUri(resolved));
    }
  }
  visit(entry);
  return result.values.toList();
}

// Used by the file watcher: saving the same bytes should not restart a live
// student worker (and changing a relative helper file should refresh it).
String studentStamp(File source) {
  final bytes = BytesBuilder(copy: false);
  final dependencies = _studentDependencies(source)
    ..sort((a, b) => a.path.compareTo(b.path));
  for (final file in dependencies) {
    bytes.add(utf8.encode(file.path));
    bytes.addByte(0);
    if (file.existsSync()) bytes.add(file.readAsBytesSync());
    bytes.addByte(0);
  }
  return sha256.convert(bytes.takeBytes()).toString();
}

Future<String> _build(
  String student,
  String kind,
  File source,
  String id,
  String key,
) async {
  final generated = Directory('tool/generated/$id');
  final dartWorker = File('tool/generated_worker_$id.dart');
  final kernel = File('tool/generated_worker_$id.dill');
  final ready = File('${generated.path}/ready.json');

  if (ready.existsSync() && dartWorker.existsSync()) {
    try {
      final record = jsonDecode(ready.readAsStringSync());
      if (record is Map && record['key'] == key) {
        if (record['kernel'] == true && kernel.existsSync()) {
          stdout.writeln('[cache] $student/$kind: using precompiled worker');
          return kernel.path;
        }
        if (record['kernel'] == false) {
          stdout.writeln('[cache] $student/$kind: using validated Dart worker');
          return dartWorker.path;
        }
      }
    } catch (_) {
      // A truncated or obsolete cache entry is rebuilt below.
    }
  }

  // Each content revision has its own path: running workers never see their
  // source overwritten, and an in-flight older build cannot replace a newer
  // revision's files.
  stdout.writeln('[build] $student/$kind: preparing changed sources');
  ready.deleteSyncIfExists();
  if (generated.existsSync()) generated.deleteSync(recursive: true);
  generated.createSync(recursive: true);
  dartWorker.deleteSyncIfExists();
  kernel.deleteSyncIfExists();

  final instrumented = await Process.run(
    Platform.resolvedExecutable,
    ['run', 'tool/instrument.dart', 'all', '--override-kind', kind,
      '--source', source.path, '--out', generated.path],
  );
  if (instrumented.exitCode != 0) {
    throw FormatException('Could not instrument ${source.path}:\n'
        '${instrumented.stdout}${instrumented.stderr}');
  }
  var text = File('tool/worker_template.txt').readAsStringSync()
      .replaceAll('@@ID@@', id).replaceAll('@@KIND@@', kind);
  for (final spec in structures) {
    final token = switch (spec.id) {
      'list' => 'LIST',
      'tree' => 'TREE',
      'stack' => 'STACK',
      'linked_stack' => 'LINKED_STACK',
      'linked_queue' => 'LINKED_QUEUE',
      _ => throw StateError('Unknown structure for worker path: ${spec.id}'),
    };
    text = text.replaceAll('@@${token}_PATH@@',
      spec.id == kind ? source.path : 'templates/example/${spec.filename}');
  }
  dartWorker.writeAsStringSync(text);

  // Compile once, and run the .dill on future selections/startups. This is a
  // kernel snapshot, not a shared process: every client gets a fresh isolated
  // worker. Kernel caching is skipped only on SDKs without this compiler mode.
  final compiled = await Process.run(Platform.resolvedExecutable,
    ['compile', 'kernel', dartWorker.path, '-o', kernel.path]);
  if (compiled.exitCode == 0 && kernel.existsSync()) {
    ready.writeAsStringSync(jsonEncode({'key': key, 'kernel': true}));
    stdout.writeln('[cache] $student/$kind: compiled and cached kernel');
    return kernel.path;
  }

  final output = '${compiled.stdout}\n${compiled.stderr}';
  final missingCompiler = output.contains('Could not find a command named') ||
      output.contains('Unknown subcommand') ||
      output.contains('Unrecognized command') ||
      output.contains('not a valid subcommand');
  if (!missingCompiler) {
    throw FormatException('Dart compilation diagnostics for $student/$kind:\n$output');
  }
  stderr.writeln('[cache] Kernel compiler unavailable; using checked Dart source.');
  final checked = await Process.run(Platform.resolvedExecutable,
      ['analyze', dartWorker.path]);
  if (checked.exitCode != 0) {
    throw FormatException('Dart compilation diagnostics for $student/$kind:\n'
        '${checked.stdout}${checked.stderr}');
  }
  ready.writeAsStringSync(jsonEncode({'key': key, 'kernel': false}));
  return dartWorker.path;
}

extension on File {
  void deleteSyncIfExists() { if (existsSync()) deleteSync(); }
}
