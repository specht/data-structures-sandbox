import 'trace_budget.dart';
// A fixed-capacity array, not a growable List. Slots never move; only values
// and the logical stack top change. All memory writes are observable.
class FixedMemory {
  final List<int?> _slots;
  int _top=-1;
  int get top=>_top;
  set top(int value){final previous=_top;_top=value;StackRecorder.active?.topWrite(previous,value);}
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
  void topWrite(int before,int after){steps.add({'kind':'indexWrite','name':'top','oldValue':before,'value':after,'line':sourceLine});steps.add(snapshot());}
  Map<String,Object?> snapshot()=>{'kind':'snapshot','cells':memory?.call().copy()??<int?>[],'top':top?.call()??-1};
  void end(Object? value,bool ok,{bool returnedVoid=false,String? message}){
    steps.add({'kind':'operationEnd','value':value,'returnedVoid':returnedVoid,'ok':ok,'result':message??'Result: $value','line':0});
  }
}
