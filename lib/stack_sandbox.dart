import 'trace_budget.dart';
// Observable fixed-capacity cells, not a stack implementation.
// The student owns the logical top index in MyArrayStack; FixedMemory only
// records physical reads/writes and does not know stack operations.
class FixedMemory {
  final List<int?> _slots;
  FixedMemory(int capacity) : _slots=List<int?>.filled(capacity,null);
  int get length=>_slots.length;
  int? operator [](int index)=>_slots[index];
  void operator []=(int index,int? value){final before=_slots[index];_slots[index]=value;StackRecorder.active?.cellWrite(index,before,value);}
  List<int?> copy()=>List<int?>.of(_slots);
}
class StackRecorder {
  static StackRecorder? active;
  final List<Map<String,Object?>> steps=EventLog();
  FixedMemory Function()? memory;
  int Function()? top;
  int sourceLine=0;
  StackRecorder(List<String> lines);
  void atLine(int line){sourceLine=line;steps.add({'kind':'line','line':line});}
  void begin(String name,List<Object?> args){steps.add({'kind':'operationStart','operation':'$name(${args.join(', ')})','line':0});}
  void cellWrite(int index,int? oldValue,int? value){steps.add({'kind':'cellWrite','index':index,'oldValue':oldValue,'value':value,'line':sourceLine});steps.add(snapshot());}
  // The instrumented copy of student code calls this after a top assignment.
  // Recording is a sandbox concern: the student only writes `top = ...`.
  void indexWrite(String name,int before,int after){
    steps.add({'kind':'indexWrite','name':name,'oldValue':before,'value':after,'line':sourceLine});
    steps.add(snapshot());
  }
  Map<String,Object?> snapshot()=>{'kind':'snapshot','cells':memory?.call().copy()??<int?>[],'top':top?.call()??-1};
  void end(Object? value,bool ok,{bool returnedVoid=false,String? message}){
    steps.add({'kind':'operationEnd','value':value,'returnedVoid':returnedVoid,'ok':ok,'result':message??'Result: $value','line':0});
  }
}
