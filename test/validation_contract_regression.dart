// Run from repository root: dart test/validation_contract_regression.dart
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../tool/prepare.dart';
import '../tool/registry.dart';

void require(bool value,String message){if(!value)throw StateError(message);}

Future<void> main() async {
  final temp=await Directory.systemTemp.createTemp('contract-regression-');
  try {
    final student=Directory('${temp.path}/student')..createSync();
    for(final spec in structures){
      File('templates/example/${spec.filename}')
        .copySync('${student.path}/${spec.filename}');
    }
    Future<Map<String,dynamic>> probe(String kind,String method,List<Object?> args) async {
      final worker=await prepare('student',kind,temp.path);
      final process=await Process.start(Platform.resolvedExecutable,[worker]);
      final output=StreamIterator(process.stdout.transform(utf8.decoder)
          .transform(const LineSplitter()));
      try {
        require(await output.moveNext().timeout(const Duration(seconds:45)),'Missing hello');
        process.stdin.writeln(jsonEncode({'action':'validateCall',
          'method':method,'arguments':args}));
        await process.stdin.flush();
        require(await output.moveNext().timeout(const Duration(seconds:8)),'Missing validation reply');
        return Map<String,dynamic>.from(jsonDecode(output.current) as Map);
      } finally {
        process.kill(ProcessSignal.sigkill);
        await process.stdin.close();
        await output.cancel();
      }
    }
    final list=File('${student.path}/my_unsorted_array_list.dart');
    final validList=list.readAsStringSync();
    require(validList.contains('    return true;'),'List example changed');
    list.writeAsStringSync(validList.replaceFirst('    return true;','    return false;'));
    final wrongReturn=await probe('unsorted_array_list','insert',[0,7]);
    require(wrongReturn['ok']==false,'Wrong insertion return incorrectly passed');
    require(wrongReturn['expectedReturn']==true&&wrongReturn['actualReturn']==false,
      'Expected and actual return values missing');
    require((wrongReturn['expectedContents'] as List).join(',')=='7' &&
      (wrongReturn['actualContents'] as List).join(',')=='7',
      'Return-only error should preserve valid inserted contents');
    require((wrongReturn['checks'] as List).any((v)=>v['aspect']=='Return value'),
      'Return-only error must identify the return value');
    list.writeAsStringSync(validList.replaceFirst(
      'bool insert(int index, int value)', 'dynamic insert(int index, int value)'));
    final wrongSignature=await probe('unsorted_array_list','insert',[0,7]);
    require(wrongSignature['ok']==false && wrongSignature['notExecuted']==true,
      'Wrong method signature should fail before student code runs');
    require((wrongSignature['checks'] as List).any((v)=>v['aspect']=='Method signature'),
      'Signature failure must show expected and actual declarations');
    list.writeAsStringSync(validList);
    final stack=File('${student.path}/my_array_stack.dart');
    final validStack=stack.readAsStringSync();
    require(validStack.contains('memory[top] = value;'),'Stack example changed');
    stack.writeAsStringSync(validStack.replaceFirst('memory[top] = value;',
      'memory[top] = -999;'));
    final wrongContents=await probe('stack','push',[7]);
    require(wrongContents['ok']==false,'Wrong stored element incorrectly passed');
    require(wrongContents['expectedReturn']==true&&wrongContents['actualReturn']==true,
      'State-only error must preserve correct return');
    require((wrongContents['checks'] as List).any((v)=>v['aspect']=='Contents'),
      'State-only error must report wrong contents');
    print('PASS: signature, return-only and state-only contract regressions are detected separately.');
  } finally {
    temp.deleteSync(recursive:true);
  }
}
