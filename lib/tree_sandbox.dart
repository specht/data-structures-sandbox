import 'trace_budget.dart';
// Observable nodes for a binary search tree. The student uses ordinary
// left/right assignments; tracing is supplied by this framework file.
class TreeNode {
  final int id = TreeRecorder.allocateId();
  int _value;
  int _height = 1; // Leaf height 1; an empty subtree has height 0.
  TreeNode? _left, _right;
  TreeNode(int value) : _value = value { TreeRecorder.active?.createNode(this); }
  int get value { TreeRecorder.active?.visit(this); return _value; }
  set value(int value) { _value = value; TreeRecorder.active?.valueWrite(this); }
  int get height => _height;
  set height(int value) {
    final before = _height;
    _height = value;
    TreeRecorder.active?.heightWrite(this, before, value);
  }
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
  bool avl = false;
  int sourceLine=0;
  TreeRecorder(List<String> lines);
  void atLine(int line){sourceLine=line;steps.add({'kind':'line','line':line});}
  void begin(String name,List<Object?> args){steps.add({'kind':'operationStart','operation':'$name(${args.join(', ')})','line':0});}
  void reference(String name,TreeNode? node){steps.add({'kind':'variableWrite','name':name,'to':node?.id,'line':sourceLine});}
  void visit(TreeNode node){steps.add({'kind':'visit','id':node.id,'line':sourceLine});}
  void createNode(TreeNode node){registry[node.id]=node;steps.add({'kind':'createNode','node':{'id':node.id,'value':node._value,'height':node._height},'line':sourceLine});}
  void valueWrite(TreeNode node){steps.add(snapshot());}
  void heightWrite(TreeNode node,int before,int after){
    steps.add({'kind':'heightWrite','id':node.id,'before':before,'to':after,'line':sourceLine});
    steps.add(snapshot());
  }
  void pointerWrite(String from,TreeNode? before,TreeNode? after){steps.add({'kind':'pointerWrite','from':from,'oldTo':before?.id,'to':after?.id,'line':sourceLine});steps.add(snapshot());}
  Map<String,Object?> snapshot()=>{'kind':'snapshot','root':root?.call()?.id,
    'nodes':[for(final n in registry.values){'id':n.id,'value':n._value,
      'left':n._left?.id,'right':n._right?.id,'height':n._height}],
    if(avl) 'avl': auditAvl(root?.call()),
  };
  void end(Object? value,bool ok,{bool returnedVoid=false,String? message}){
    final alive=<int>{};
    // Student trees may be unbalanced and thousands of nodes deep. Keep the
    // reachability check iterative and cycle-safe as well.
    final pending=<TreeNode?>[root?.call()];
    while(pending.isNotEmpty){
      final node=pending.removeLast();
      if(node==null || !alive.add(node.id))continue;
      pending.add(node._left);
      pending.add(node._right);
    }
    final retired=registry.keys.where((id)=>!alive.contains(id)).toList();
    if(retired.isNotEmpty){ steps.add({'kind':'retire','ids':retired,'line':0});for(final id in retired)registry.remove(id);steps.add(snapshot()); }
    steps.add({'kind':'operationEnd','value':value,'returnedVoid':returnedVoid,'ok':ok,'result':message??'Result: $value','line':0});
  }
}

// Derive true heights from the pointer graph, independently of the student's
// stored heights. Audit all reachable subtrees, not just the root. An invalid
// graph (cycle/shared child) cannot make the visualizer loop indefinitely.
Map<String,Object?> auditAvl(TreeNode? root) {
  final calculated = <int,int>{};
  final details = <String,Map<String,Object?>>{};
  final seen = <int>{};
  var acyclic = true, ordered = true, heights = true, balanced = true;
  final pending = <({TreeNode node,bool done,int? low,int? high})>[
    if(root!=null)(node:root,done:false,low:null,high:null),
  ];
  while(pending.isNotEmpty){
    final frame=pending.removeLast(), node=frame.node;
    if(!frame.done){
      if(!seen.add(node.id)){acyclic=false;continue;}
      if((frame.low!=null && node._value<=frame.low!) ||
         (frame.high!=null && node._value>=frame.high!)) ordered=false;
      pending.add((node:node,done:true,low:frame.low,high:frame.high));
      if(node._right!=null)pending.add((node:node._right!,done:false,low:node._value,high:frame.high));
      if(node._left!=null)pending.add((node:node._left!,done:false,low:frame.low,high:node._value));
      continue;
    }
    // A child that is still on the DFS stack means a cycle/shared node.
    final left=node._left, right=node._right;
    if((left!=null && !calculated.containsKey(left.id)) ||
       (right!=null && !calculated.containsKey(right.id))){acyclic=false;}
    final lh=left==null?0:calculated[left.id]??0;
    final rh=right==null?0:calculated[right.id]??0;
    final expected=1+(lh>rh?lh:rh), balance=lh-rh;
    final heightOk=node._height==expected, balanceOk=balance.abs()<=1;
    if(!heightOk)heights=false;
    if(!balanceOk)balanced=false;
    calculated[node.id]=expected;
    details['${node.id}']={
      'height':node._height,'expectedHeight':expected,'balance':balance,
      'heightOk':heightOk,'balanceOk':balanceOk,
    };
  }
  return {
    'acyclic':acyclic,'ordered':ordered,'heights':heights,'balanced':balanced,
    'nodes':details,
  };
}
