import 'trace_budget.dart';
// Observable nodes for a binary search tree. The student uses ordinary
// left/right assignments; tracing is supplied by this framework file.
class TreeNode {
  final int id = TreeRecorder.allocateId();
  int _value;
  TreeNode? _left, _right;
  TreeNode(int value) : _value = value { TreeRecorder.active?.createNode(this); }
  int get value { TreeRecorder.active?.visit(this); return _value; }
  set value(int value) { _value = value; TreeRecorder.active?.valueWrite(this); }
  TreeNode? get left => _left;
  TreeNode? get right => _right;
  set left(TreeNode? value) { final before = _left; _left=value; TreeRecorder.active?.pointerWrite('node:$id.left',before,value); }
  set right(TreeNode? value) { final before = _right; _right=value; TreeRecorder.active?.pointerWrite('node:$id.right',before,value); }
}

class TreeRecorder {
  static TreeRecorder? active;
  static int _id=0;
  static final Map<int,TreeNode> registry={};
  static int allocateId()=>++_id;
  static void resetIds(){_id=0;registry.clear();active=null;}
  final List<Map<String,Object?>> steps=EventLog();
  TreeNode? Function()? root;
  int sourceLine=0;
  TreeRecorder(List<String> lines);
  void atLine(int line){sourceLine=line;steps.add({'kind':'line','line':line});}
  void begin(String name,List<Object?> args){steps.add({'kind':'operationStart','operation':'$name(${args.join(', ')})','line':0});}
  void reference(String name,TreeNode? node){steps.add({'kind':'variableWrite','name':name,'to':node?.id,'line':sourceLine});}
  void visit(TreeNode node){steps.add({'kind':'visit','id':node.id,'line':sourceLine});}
  void createNode(TreeNode node){registry[node.id]=node;steps.add({'kind':'createNode','node':{'id':node.id,'value':node._value},'line':sourceLine});}
  void valueWrite(TreeNode node){steps.add(snapshot());}
  void pointerWrite(String from,TreeNode? before,TreeNode? after){steps.add({'kind':'pointerWrite','from':from,'oldTo':before?.id,'to':after?.id,'line':sourceLine});steps.add(snapshot());}
  Map<String,Object?> snapshot()=>{'kind':'snapshot','root':root?.call()?.id,
    'nodes':[for(final n in registry.values){'id':n.id,'value':n._value,'left':n._left?.id,'right':n._right?.id}]};
  void end(Object? value,bool ok,{bool returnedVoid=false,String? message}){
    final alive=<int>{};
    void visitReachable(TreeNode? node){ if(node==null || !alive.add(node.id))return; visitReachable(node._left); visitReachable(node._right); }
    visitReachable(root?.call());
    final retired=registry.keys.where((id)=>!alive.contains(id)).toList();
    if(retired.isNotEmpty){ steps.add({'kind':'retire','ids':retired,'line':0});for(final id in retired)registry.remove(id);steps.add(snapshot()); }
    steps.add({'kind':'operationEnd','value':value,'returnedVoid':returnedVoid,'ok':ok,'result':message??'Result: $value','line':0});
  }
}
