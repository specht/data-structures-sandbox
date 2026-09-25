import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

import 'registry.dart';
import 'specialize_worker.dart';
import 'instrument_client.dart';

// All names are validated before becoming parts of generated paths.
final _safeName = RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$');

// Multiple browser sessions may select the same implementation at once. They
// share one preparation, but each still gets its own live worker and state.
final _building = <String, Future<String>>{};
final _instrumenter = InstrumentClient();

// Start the analyzer while the browser loads, not on the student's first edit.
// The normal one-shot command remains the fallback if the daemon cannot start.
void warmInstrumenter() {
  final timer = Stopwatch()..start();
  unawaited(_instrumenter.warm().then((_) {
    buildProfile('instrumenter', 'warm startup', timer.elapsed);
  }, onError: (Object error, StackTrace stack) {
    stderr.writeln('[instrumenter] Prewarm failed: $error; one-shot fallback available.');
  }));
}

// Enable with SANDBOX_PROFILE=1 ./run. Wall-clock times include subprocess
// startup and I/O; no student code or source contents are written to this log.
bool get buildProfiling => Platform.environment['SANDBOX_PROFILE'] == '1';
void buildProfile(String selection, String stage, Duration duration) {
  if (!buildProfiling) return;
  final millis = (duration.inMicroseconds / 1000).toStringAsFixed(1);
  stdout.writeln('[profile] $selection | $stage: $millis ms');
}

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
  final total = Stopwatch()..start();
  final fingerprint = Stopwatch()..start();
  final key = _fingerprint(source, student, kind);
  buildProfile('$student/$kind', 'fingerprint', fingerprint.elapsed);
  final id = '${student}_${kind}_${key.substring(0, 24)}';
  final existing = _building[id];
  if (existing != null) {
    try {
      return await existing;
    } finally {
      buildProfile('$student/$kind', 'prepare (shared build)', total.elapsed);
    }
  }
  final future = _build(student, kind, source, id, key);
  _building[id] = future;
  try {
    return await future;
  } finally {
    buildProfile('$student/$kind', 'prepare total', total.elapsed);
    if (identical(_building[id], future)) _building.remove(id);
  }
}

// The host can distinguish a real re-instrumentation/compilation from merely
// starting a new worker using an unchanged, cached kernel. This must use the
// same fingerprint/ready marker as prepare(), not file modification times.
bool workerNeedsBuild(String student, String kind, String repoPath) {
  if (!_safeName.hasMatch(student)) return false;
  final spec = specFor(kind);
  final source = File('${Directory(repoPath).absolute.path}/$student/${spec.filename}');
  if (!source.existsSync()) return false;
  final key = _fingerprint(source, student, kind);
  final id = '${student}_${kind}_${key.substring(0, 24)}';
  final generated = Directory('tool/generated/$id');
  final worker = File('tool/generated_worker_$id.dart');
  final kernel = File('tool/generated_worker_$id.dill');
  final ready = File('${generated.path}/ready.json');
  if (!ready.existsSync() || !worker.existsSync()) return true;
  try {
    final record = jsonDecode(ready.readAsStringSync());
    if (record is! Map || record['key'] != key) return true;
    return !(record['kernel'] == false ||
      (record['kernel'] == true && kernel.existsSync()));
  } catch (_) {
    return true;
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
    File('tool/specialize_worker.dart'),
    ...Directory('lib').listSync(recursive: true).whereType<File>()
        .where((file) => file.path.endsWith('.dart')),
  ]..sort((a, b) => a.path.compareTo(b.path));
  final bytes = BytesBuilder(copy: false);
  void add(String part) {
    bytes.add(utf8.encode(part));
    bytes.addByte(0);
  }
  add('worker-cache-v2-single-kind');
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
  final total = Stopwatch()..start();
  final cache = Stopwatch()..start();
  final subject = '$student/$kind';

  if (ready.existsSync() && dartWorker.existsSync()) {
    try {
      final record = jsonDecode(ready.readAsStringSync());
      if (record is Map && record['key'] == key) {
        if (record['kernel'] == true && kernel.existsSync()) {
          stdout.writeln('[cache] $student/$kind: using precompiled worker');
          buildProfile(subject, 'cache hit', cache.elapsed);
          return kernel.path;
        }
        if (record['kernel'] == false) {
          stdout.writeln('[cache] $student/$kind: using validated Dart worker');
          buildProfile(subject, 'cache hit', cache.elapsed);
          return dartWorker.path;
        }
      }
    } catch (_) {
      // A truncated or obsolete cache entry is rebuilt below.
    }
  }

  buildProfile(subject, 'cache miss', cache.elapsed);

  // Each content revision has its own path: running workers never see their
  // source overwritten, and an in-flight older build cannot replace a newer
  // revision's files.
  stdout.writeln('[build] $student/$kind: preparing changed sources');
  final setup = Stopwatch()..start();
  ready.deleteSyncIfExists();
  if (generated.existsSync()) generated.deleteSync(recursive: true);
  generated.createSync(recursive: true);
  dartWorker.deleteSyncIfExists();
  kernel.deleteSyncIfExists();
  buildProfile(subject, 'staging', setup.elapsed);

  final instrumentation = Stopwatch()..start();
  try {
    await _instrumenter.instrument(kind, source.path, generated.path);
    buildProfile(subject, 'instrument (persistent)', instrumentation.elapsed);
  } on InstrumenterUnavailable catch (error) {
    // Keep editing functional if the analyzer daemon cannot be launched or
    // restarted. A student syntax error is a FormatException, not a fallback.
    stderr.writeln('[instrumenter] $error; using one-shot fallback.');
    final instrumented = await Process.run(
      Platform.resolvedExecutable,
      ['run', 'tool/instrument.dart', kind,
        '--source', source.path, '--out', generated.path],
    );
    buildProfile(subject, 'instrument (one-shot fallback)', instrumentation.elapsed);
    if (instrumented.exitCode != 0) {
      final diagnostics = await _originalSourceDiagnostics(source);
      if (diagnostics.isNotEmpty) {
        throw StudentDiagnosticsException(
            'Fix the errors in your Dart source and save again.', diagnostics);
      }
      throw FormatException('Could not instrument ${source.path}:\n'
          '${instrumented.stdout}${instrumented.stderr}');
    }
  }
  // The browser has one structure selected at a time. Keep the shared trace
  // engine, but import and compile only this student's selected implementation.
  final generation = Stopwatch()..start();
  final text = specializeWorkerTemplate(
    File('tool/worker_template.txt').readAsStringSync(),
    selected: specFor(kind),
    id: id,
    sourcePath: source.path,
  );
  dartWorker.writeAsStringSync(text);
  buildProfile(subject, 'worker generation', generation.elapsed);

  // Compile once, and run the .dill on future selections/startups. This is a
  // kernel snapshot, not a shared process: every client gets a fresh isolated
  // worker. Kernel caching is skipped only on SDKs without this compiler mode.
  final compilation = Stopwatch()..start();
  final compiled = await Process.run(Platform.resolvedExecutable,
    ['compile', 'kernel', dartWorker.path, '-o', kernel.path]);
  buildProfile(subject, 'compile kernel', compilation.elapsed);
  if (compiled.exitCode == 0 && kernel.existsSync()) {
    ready.writeAsStringSync(jsonEncode({'key': key, 'kernel': true}));
    stdout.writeln('[cache] $student/$kind: compiled and cached kernel');
    buildProfile(subject, 'build total', total.elapsed);
    return kernel.path;
  }

  final output = '${compiled.stdout}\n${compiled.stderr}';
  final missingCompiler = output.contains('Could not find a command named') ||
      output.contains('Unknown subcommand') ||
      output.contains('Unrecognized command') ||
      output.contains('not a valid subcommand');
  if (!missingCompiler) {
    final diagnostics = await _originalSourceDiagnostics(source);
    if (diagnostics.isNotEmpty) {
      throw StudentDiagnosticsException(
          'Fix the errors in your Dart source and save again.', diagnostics);
    }
    // Never present generated-worker positions as student source positions.
    stderr.writeln('[sandbox] Generated compiler output for $student/$kind:\n$output');
    throw FormatException('Dart compilation failed for $student/$kind. '
        'The error may be in generated code or an imported file; see the app '
        'terminal for technical details.');
  }
  stderr.writeln('[cache] Kernel compiler unavailable; using checked Dart source.');
  final analysis = Stopwatch()..start();
  final checked = await Process.run(Platform.resolvedExecutable,
      ['analyze', dartWorker.path]);
  buildProfile(subject, 'fallback analyze', analysis.elapsed);
  if (checked.exitCode != 0) {
    final diagnostics = await _originalSourceDiagnostics(source);
    if (diagnostics.isNotEmpty) {
      throw StudentDiagnosticsException(
          'Fix the errors in your Dart source and save again.', diagnostics);
    }
    stderr.writeln('[sandbox] Generated analyzer output for $student/$kind:\n'
        '${checked.stdout}${checked.stderr}');
    throw FormatException('Dart compilation failed for $student/$kind; '
        'see the app terminal for technical details.');
  }
  ready.writeAsStringSync(jsonEncode({'key': key, 'kernel': false}));
  buildProfile(subject, 'build total', total.elapsed);
  return dartWorker.path;
}

// Check the original, uninstrumented student file only when a build fails.
// The compiler sees generated files and cannot provide editor line numbers.
Future<List<Map<String, dynamic>>> _originalSourceDiagnostics(File source) async {
  try {
    final result = await Process.run(Platform.resolvedExecutable,
        ['analyze', '--format=machine', source.absolute.path]);
    final expected = source.absolute.path;
    final diagnostics = <Map<String, dynamic>>[];
    for (final line in '${result.stdout}\n${result.stderr}'.split('\n')) {
      // Dart's machine output is SEVERITY|TYPE|CODE|FILE|LINE|COLUMN|LENGTH|MESSAGE.
      // The pipe in a path or message can be escaped as \|.
      final fields = line.split(RegExp(r'(?<!\\)\|'));
      if (fields.length < 8 || fields[0] != 'ERROR') continue;
      final filename = fields[3].replaceAll(r'\|', '|');
      if (File(filename).absolute.path != expected) continue;
      final row = int.tryParse(fields[4]);
      final column = int.tryParse(fields[5]);
      final length = int.tryParse(fields[6]);
      if (row == null || row < 1 || column == null || column < 1) continue;
      diagnostics.add({
        'line': row, 'column': column, 'length': length ?? 1,
        'message': fields.sublist(7).join('|').replaceAll(r'\|', '|'),
        'severity': 'error',
      });
      if (diagnostics.length >= 30) break;
    }
    return diagnostics;
  } catch (error) {
    stderr.writeln('[sandbox] Could not analyze original source: $error');
    return [];
  }
}

extension on File {
  void deleteSyncIfExists() { if (existsSync()) deleteSync(); }
}
