// Run from the repository root: dart test/traversal_upgrade_test.dart
// A student BST written before the traversal extension keeps working, reports
// the new methods as missing, accepts inserted stubs and must use its own
// queue for breadth-first traversal.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../tool/method_stubs.dart';
import '../tool/prepare.dart';

void require(bool value, String message) {
  if (!value) throw StateError(message);
}

Future<void> main() async {
  final temp = await Directory.systemTemp.createTemp('traversal-upgrade-');
  try {
    final student = Directory('${temp.path}/student')..createSync();
    for (final queue in ['my_linked_queue.dart', 'my_array_queue.dart']) {
      File('templates/example/$queue').copySync('${student.path}/$queue');
    }
    final example = File('templates/example/my_bst.dart').readAsStringSync();
    final traversals = example.indexOf('\n  // Depth-first traversals');
    require(traversals > 0, 'Example BST layout changed');
    // The shape of an existing student file: no traversals, no queue import.
    final old = '${example.substring(0, traversals)}\n}\n'
        .replaceFirst("import 'my_linked_queue.dart';\n", '');
    final bst = File('${student.path}/my_bst.dart');

    Future<T> withWorker<T>(String source,
        Future<T> Function(Map<String, dynamic> hello,
            Future<Map<String, dynamic>> Function(String, [List<Object?>]) call) body) async {
      bst.writeAsStringSync(source);
      final worker = await prepare('student', 'tree', temp.path);
      final process = await Process.start(Platform.resolvedExecutable, [worker]);
      final output = StreamIterator(
          process.stdout.transform(utf8.decoder).transform(const LineSplitter()));
      Future<Map<String, dynamic>> next(int seconds) async {
        require(await output.moveNext().timeout(Duration(seconds: seconds)), 'Worker exited');
        return Map<String, dynamic>.from(jsonDecode(output.current) as Map);
      }
      try {
        final hello = await next(45);
        require(hello['type'] == 'hello', 'Missing hello: $hello');
        return await body(hello, (method, [args = const []]) async {
          process.stdin.writeln(jsonEncode(
              {'action': 'validateCall', 'method': method, 'arguments': args}));
          await process.stdin.flush();
          return next(8);
        });
      } finally {
        process.kill(ProcessSignal.sigkill);
        await output.cancel();
      }
    }

    await withWorker(old, (hello, call) async {
      require(jsonEncode(hello['missingMethods']) ==
              '["preorder","inorder","postorder","breadthFirst"]',
          'Old file should miss all traversals: ${hello['missingMethods']}');
      final missing = await call('inorder');
      require(missing['type'] == 'validationCall' && missing['ok'] == false &&
              missing['missingMethod'] == true,
          'A missing method is a failed check, not an error: $missing');
      final insert = await call('insert', [5]);
      require(insert['ok'] == true, 'The worker keeps running after a missing method');
    });

    // The browser's Insert method stubs goes through the persistent analyzer.
    final reply = await insertDartStubs('tree', old);
    require(reply['ok'] == true && (reply['inserted'] as List).length == 4,
        'Daemon stub reply: $reply');
    final stubbed = reply['content'] as String;
    require(stubbed == insertMethodStubs('tree', old).content, 'Daemon and library agree');
    final broken = await insertDartStubs('tree', 'class MyBST {');
    require(broken['ok'] == false && '${broken['error']}'.contains('compilation errors'),
        'A broken draft is refused: $broken');
    require(bst.readAsStringSync() == old, 'Stub insertion never writes the student file');
    await withWorker(stubbed, (hello, call) async {
      require((hello['missingMethods'] as List).isEmpty,
          'Inserted stubs compile and are recognized: ${hello['missingMethods']}');
      require((await call('inorder'))['ok'] == true, 'A stub is correct for the empty tree');
      await call('insert', [5]);
      final unfinished = await call('inorder');
      require(unfinished['ok'] == false && unfinished['actualReturn'] is List &&
              (unfinished['actualReturn'] as List).isEmpty,
          'An unimplemented stub fails once the tree has nodes: $unfinished');
    });

    String withBreadthFirst(String body, {String import = ''}) {
      final complete = example.replaceFirst(RegExp(
          r'  // Breadth-first:[\s\S]*?\n  }\n'), body);
      return complete.replaceFirst("import 'my_linked_queue.dart';\n", import);
    }
    const listQueue = '''
  void breadthFirst(void Function(int value) visit) {
    final pending = <TreeNode>[if (root != null) root!];
    while (pending.isNotEmpty) {
      final current = pending.removeAt(0);
      visit(current.value);
      if (current.left != null) pending.add(current.left!);
      if (current.right != null) pending.add(current.right!);
    }
  }
''';
    await withWorker(withBreadthFirst(listQueue), (hello, call) async {
      for (final value in [2, 1, 3]) await call('insert', [value]);
      final result = await call('breadthFirst');
      final checks = (result['checks'] as List).map((c) => (c as Map)['aspect']).toList();
      require(result['ok'] == false && checks.contains('Uses your own queue'),
          'A Dart List is not the student queue: $result');
      require(jsonEncode(result['actualReturn']) == '[2,1,3]', 'Order itself was right');
    });

    const arrayQueue = '''
  void breadthFirst(void Function(int value) visit) {
    final queue = TreeNodeQueue(MyArrayQueue());
    if (root != null) queue.enqueue(root!);
    while (!queue.isEmpty) {
      final current = queue.dequeue()!;
      visit(current.value);
      if (current.left != null) queue.enqueue(current.left!);
      if (current.right != null) queue.enqueue(current.right!);
    }
  }
''';
    await withWorker(
        withBreadthFirst(arrayQueue, import: "import 'my_array_queue.dart';\n"),
        (hello, call) async {
      for (final value in [40, 20, 60, 10, 30, 50, 70]) await call('insert', [value]);
      final result = await call('breadthFirst');
      require(result['ok'] == true, 'The own circular queue is accepted: $result');
    });
    print('PASS: old BST files report missing traversals, accept stubs and use the own queue');
  } finally {
    await temp.delete(recursive: true);
    await shutdownInstrumenter();
  }
}
