'use strict';
// Build example (every structure) and the traversal visits of trees: run the
// STUDENT'S methods, never plant a hidden structure.
const treeLabUI = {
  sample: document.getElementById('build-example'),
  visits: document.getElementById('tree-visit-output'),
  values: document.getElementById('tree-visit-values'),
};
let treeVisitValues=[];
// Node id → its positions in the visit order (1-based), drawn as badges.
const treeVisitOrder=new Map();
function resetTreeVisitDisplay(){
  treeVisitValues=[];
  treeVisitOrder.clear();
  treeLabUI.visits.hidden=true;
  treeLabUI.values.textContent='';
}
function recordTreeVisit(value,id=null){
  treeVisitValues.push(value);
  if(id!=null){
    if(!treeVisitOrder.has(id))treeVisitOrder.set(id,[]);
    treeVisitOrder.get(id).push(treeVisitValues.length);
  }
  treeLabUI.visits.hidden=false;
  treeLabUI.values.textContent=treeVisitValues.join(' → ');
}
// Build example: reset, then build a typical example through the student's
// OWN methods (never a hidden structure). It becomes the call history, so it
// comes back after every save. [method, arguments of each call].
const EXAMPLES={
  tree:['insert',[40,20,60,10,30,50,70]],avl:['insert',[40,20,60,10,30,50,70]],
  node_heap:['insert',[9,2,7,1,5,3]],array_heap:['insert',[9,2,7,1,5,3]],
  stack:['push',[3,8,5,1]],linked_stack:['push',[3,8,5,1]],
  array_queue:['enqueue',[3,8,5,1]],linked_queue:['enqueue',[3,8,5,1]],
  sorted_array_list:['insert',[8,2,5,9,3]],sorted_linked_list:['insert',[8,2,5,9,3]],
  unsorted_array_list:['insert',[[0,7],[1,3],[1,5],[3,9]]],unsorted_linked_list:['insert',[[0,7],[1,3],[1,5],[3,9]]],
  hash:['insert',[1,10,27,3,19,12]],
};
/** The example's calls, or null while the file lacks a fitting method. */
function exampleCalls(){
  const example=EXAMPLES[structure];
  if(!example)return null;
  const [method,args]=example,descriptor=discovered.get(method);
  const calls=args.map(arg=>({method,arguments:Array.isArray(arg)?arg:[arg]}));
  return descriptor&&calls.every(call=>call.arguments.length===(descriptor.params??[]).length)?calls:null;
}
function updateTreeLab(){
  const calls=exampleCalls();
  treeLabUI.sample.hidden=!EXAMPLES[structure];
  treeLabUI.sample.disabled=!calls;
  treeLabUI.sample.title=calls?`Reset and build an example through your own ${calls[0].method}: `+
    calls.map(formatCall).join('; '):`Implement ${EXAMPLES[structure]?.[0]??'the methods'} to build an example`;
}
treeLabUI.sample.addEventListener('click',()=>{
  const calls=exampleCalls();
  if(calls)runCalls(calls,{reset:true,sample:true,label:'Building the example…'});
});
updateTreeLab();
