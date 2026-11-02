'use strict';
// Tree exploration: run the STUDENT'S insert method, never plant a hidden tree.
const treeLabUI = {
  sample: document.getElementById('tree-sample'),
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
function updateTreeLab(){
  const tree=structure==='tree'||structure==='avl';
  treeLabUI.sample.hidden=!tree;
  treeLabUI.sample.disabled=!tree||!discovered.has('insert');
}
treeLabUI.sample.addEventListener('click',()=>{
  if(!['tree','avl'].includes(structure)||!discovered.has('insert'))return;
  const values=[40,20,60,10,30,50,70];
  send({action:'run',reset:true,sample:true,commands:values.map(value=>({method:'insert',arguments:[value]}))});
});
updateTreeLab();
