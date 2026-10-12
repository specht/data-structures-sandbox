import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

import 'languages.dart';
import 'registry.dart';
import 'specialize_worker.dart';
import 'instrument_client.dart';

// All names are validated before becoming parts of generated paths.
final _safeName = studentFolder;

// Multiple browser sessions may select the same implementation at once. They
// share one preparation, but each still gets its own live worker and state.
final _building = <String, Future<String>>{};
final _instrumenter = InstrumentClient();

// Start the analyzer while the browser loads, not on the student's first edit.
// The normal one-shot command remains the fallback if the daemon cannot start.
void warmInstrumenter() {
  final timer = Stopwatch()..start();
  unawaited(() async {
    if (!await dartToolchain.available()) {
      stdout.writeln('[dart] No Dart SDK found: .dart files cannot be built; '
          'Python, JavaScript and Java files work as usual.');
      return;
    }
    try {
      await _instrumenter.warm();
      buildProfile('instrumenter', 'warm startup', timer.elapsed);
    } catch (error) {
      stderr.writeln('[instrumenter] Prewarm failed: $error; one-shot fallback available.');
    }
  }());
}

/// Stops the persistent instrumenter (and the daemons of other languages).
/// Tests call this at the end; otherwise its open pipes keep the test process
/// alive after the last PASS line.
Future<void> shutdownInstrumenter() async {
  await _instrumenter.dispose();
  for (final daemon in _daemons.values) {
    await daemon.dispose();
  }
}

// The daemons of the other languages (languages/*/sandbox_daemon.*): they
// check, build and format student files. Started on first use, so a missing
// Python or JDK only affects the files of that language.
final _daemons = <String, InstrumentClient>{};

/// The daemon for files with [extension] ('.py', '.js' or '.java').
InstrumentClient daemonFor(String extension) => _daemons.putIfAbsent(extension, () => switch (extension) {
      '.py' => InstrumentClient(
          command: () => pythonToolchain.script('sandbox_daemon.py'), label: 'python'),
      '.js' => InstrumentClient(
          command: () => nodeToolchain.script('sandbox_daemon.mjs'), label: 'javascript'),
      '.java' => InstrumentClient(command: javaToolchain.daemon, label: 'java'),
      _ => throw ArgumentError.value(extension, 'extension'),
    });

/// The command that starts a worker for the selected implementation: the
/// compiled Dart worker, or the worker of the file's language with the
/// directory its daemon built.
Future<List<String>> prepareWorker(String student, String kind, String repoPath,
    {String variant = ''}) async {
  final extension = splitVariant(variant).extension;
  if (extension == '.dart') {
    return [await dartToolchain.executable(), await prepare(student, kind, repoPath, variant: variant)];
  }
  final directory = await prepare(student, kind, repoPath, variant: variant);
  return switch (extension) {
    '.py' => pythonToolchain.script('sandbox_worker.py', [directory]),
    '.js' => nodeToolchain.script('sandbox_worker.mjs', [directory]),
    _ => javaToolchain.worker(directory),
  };
}

// Enable with SANDBOX_PROFILE=1 ./run. Wall-clock times include subprocess
// startup and I/O; no student code or source contents are written to this log.
bool get buildProfiling => Platform.environment['SANDBOX_PROFILE'] == '1';
void buildProfile(String selection, String stage, Duration duration) {
  if (!buildProfiling) return;
  final millis = (duration.inMicroseconds / 1000).toStringAsFixed(1);
  stdout.writeln('[profile] $selection | $stage: $millis ms');
}

/// Dart: the compiled worker (.dill, or the checked .dart source). Other
/// languages: the directory their daemon built (see [prepareWorker]).
Future<String> prepare(String student, String kind, String repoPath,
    {String variant = ''}) async {
  if (!_safeName.hasMatch(student)) {
    throw const FormatException('Invalid student directory');
  }
  final selected = specFor(kind);
  final repo = Directory(repoPath).absolute;
  final source = File('${repo.path}/$student/${implementationFile(selected, variant)}');
  if (!source.existsSync()) {
    throw FormatException('Implementation not found: ${source.path}');
  }

  // Never key on timestamps: saving unchanged contents should reuse the same
  // validated worker, even across ./run restarts and browser sessions.
  final total = Stopwatch()..start();
  final fingerprint = Stopwatch()..start();
  final key = _fingerprint(source, student, kind, splitVariant(variant).extension);
  buildProfile('$student/$kind', 'fingerprint', fingerprint.elapsed);
  final id = _workerId(student, kind, variant, key);
  final existing = _building[id];
  if (existing != null) {
    try {
      return await existing;
    } finally {
      buildProfile('$student/$kind', 'prepare (shared build)', total.elapsed);
    }
  }
  final extension = splitVariant(variant).extension;
  final future = extension == '.dart'
      ? _build(student, kind, source, id, key)
      : _buildWithDaemon(student, kind, source, id, key, extension);
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
bool workerNeedsBuild(String student, String kind, String repoPath,
    {String variant = ''}) {
  if (!_safeName.hasMatch(student)) return false;
  final spec = specFor(kind);
  final source = File('${Directory(repoPath).absolute.path}/$student/'
      '${implementationFile(spec, variant)}');
  if (!source.existsSync()) return false;
  final extension = splitVariant(variant).extension;
  final key = _fingerprint(source, student, kind, extension);
  final id = _workerId(student, kind, variant, key);
  final generated = Directory('tool/generated/$id');
  if (extension != '.dart') return !_daemonBuildReady(generated, key, extension);
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

// Variants keep separate cache groups (see cache_cleanup.dart).
String _workerId(String student, String kind, String variant, String key) =>
    '${student}_$kind${variant.isEmpty ? '' : '_$variant'}_${key.substring(0, 24)}';

String _fingerprint(File source, String student, String kind, [String extension = '.dart']) {
  final files = <File>[
    ..._studentDependencies(source),
    // The runtimes of the other languages (Dart fingerprints stay unchanged).
    if (extension != '.dart' && Directory('languages').existsSync())
      ...Directory('languages').listSync(recursive: true).whereType<File>(),
    File('pubspec.yaml'),
    File('pubspec.lock'),
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
  add('worker-cache-v3-adapters');
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
  } on ToolchainMissing {
    rethrow; // No Dart SDK (precompiled host): nothing to fall back to.
  } on InstrumenterUnavailable catch (error) {
    // Keep editing functional if the analyzer daemon cannot be launched or
    // restarted. A student syntax error is a FormatException, not a fallback.
    stderr.writeln('[instrumenter] $error; using one-shot fallback.');
    final instrumented = await Process.run(
      await dartToolchain.executable(),
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
  // The worker entry point only connects the shared session and the
  // structure's adapter (both in lib/) to this student's instrumented class.
  final generation = Stopwatch()..start();
  final text = generateWorker(
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
  final compiled = await Process.run(await dartToolchain.executable(),
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
  final checked = await Process.run(await dartToolchain.executable(),
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

bool _daemonBuildReady(Directory generated, String key, String extension) {
  final ready = File('${generated.path}/ready.json');
  if (!ready.existsSync()) return false;
  try {
    final record = jsonDecode(ready.readAsStringSync());
    return record is Map && record['key'] == key && record['language'] == extension;
  } catch (_) {
    return false;
  }
}

/// The other languages are built by their daemon: the class contract, the
/// language's own checks (pyflakes, undefined names, javac) and whatever the
/// worker needs (an instrumented copy or compiled classes). Student errors
/// come back as editor diagnostics; a missing toolchain as a message that
/// says what to install.
Future<String> _buildWithDaemon(
  String student,
  String kind,
  File source,
  String id,
  String key,
  String extension,
) async {
  final generated = Directory('tool/generated/$id');
  final subject = '$student/$kind';
  if (_daemonBuildReady(generated, key, extension)) {
    stdout.writeln('[cache] $subject: using built ${languageNameOf(extension)} worker');
    return generated.absolute.path;
  }
  stdout.writeln('[build] $subject: preparing changed sources');
  final clock = Stopwatch()..start();
  if (generated.existsSync()) generated.deleteSync(recursive: true);
  generated.createSync(recursive: true);
  await daemonFor(extension)
      .build(kind, specFor(kind).className, source.absolute.path, generated.absolute.path);
  File('${generated.path}/ready.json')
      .writeAsStringSync(jsonEncode({'key': key, 'language': extension}));
  buildProfile(subject, '${languageNameOf(extension)} build', clock.elapsed);
  return generated.absolute.path;
}

// Check the original, uninstrumented student file only when a build fails.
// The compiler sees generated files and cannot provide editor line numbers.
Future<List<Map<String, dynamic>>> _originalSourceDiagnostics(File source) async {
  try {
    final result = await Process.run(await dartToolchain.executable(),
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
