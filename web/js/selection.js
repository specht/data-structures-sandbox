'use strict';
// Playback preferences and the implementation selection (student, structure
// and file variant, chosen together in one picker).
// These preferences are local to this browser, not to the student's repository.
const playbackPreferencesKey='data-structure-sandbox.v1.playback';
function loadPlaybackPreferences(){
  try{
    const saved=JSON.parse(localStorage.getItem(playbackPreferencesKey)||'null');
    return saved&&typeof saved==='object'?saved:{};
  }catch(_){return {};}
}
const playbackPreferences=loadPlaybackPreferences();
const storedSpeed=Number(playbackPreferences.speed);
if(playbackPreferences.speed!=null&&Number.isFinite(storedSpeed)&&
   storedSpeed>=Number(ui.speed.min)&&storedSpeed<=Number(ui.speed.max)){
  ui.speed.value=String(storedSpeed);
}
function rememberPlaybackPreferences(){
  try{localStorage.setItem(playbackPreferencesKey,
    JSON.stringify({speed:Number(ui.speed.value),mode:playbackMode}));}catch(_){}
}
ui.speed.addEventListener('input',()=>{
  ui.speedOutput.textContent=`${Number(ui.speed.value).toFixed(1).replace(/\.0$/,'')}×`;
  rememberPlaybackPreferences();
});
ui.speedOutput.textContent=`${Number(ui.speed.value).toFixed(1).replace(/\.0$/,'')}×`;
function isTree(){return structure==='tree'||structure==='avl'||structure==='node_heap';}
function isArrayList(){return structure==='unsorted_array_list'||structure==='sorted_array_list';}
const STRUCTURE_LABELS={unsorted_array_list:'List (unsorted, array)',unsorted_linked_list:'List (unsorted, singly linked)',sorted_array_list:'List (sorted, array)',hash:'Hash table (separate chaining)',array_heap:'Heap (array)',sorted_linked_list:'List (sorted, singly linked)',tree:'Tree (binary search)',avl:'Tree (AVL)',stack:'Stack (fixed array)',array_queue:'Queue (circular array)',linked_stack:'Stack (linked list)',linked_queue:'Queue (linked list)'};
let selectedStudent='',initializedCatalog=false,studentCatalog=[];
// A student may keep several implementations of one structure, e.g.
// my_bst.dart and my_bst_recursive.dart. `structure` stays the kind used by
// the renderers; `variant` is the file suffix ('' for the starter's file).
let variant='';
const implementationValue=(kind=structure,suffix=variant)=>suffix?`${kind}:${suffix}`:kind;
function parseImplementation(value){
  const [kind,...rest]=String(value??'').split(':');
  return {kind,variant:rest.join(':')};
}
// '' → 'Tree (AVL)', 'recursive.py' → 'Tree (AVL) · recursive' (the host sends
// this as `name`; older hosts only sent `label`).
function implementationName(kind,suffix){
  const name=typeof variantName==='function'?variantName(suffix):suffix;
  return [STRUCTURE_LABELS[kind]??kind,name].filter(Boolean).join(' · ');
}
function studentImplementations(entry){
  if(Array.isArray(entry?.implementations))return entry.implementations.map(item=>{
    const suffix=item.variant??'';
    const name=item.name??implementationName(item.structure,suffix);
    const language=item.language??(typeof languageOfVariant==='function'?languageOfVariant(suffix).label:'Dart');
    return {kind:item.structure,variant:suffix,name,language,label:item.label??`${name} · ${language}`};
  });
  return (entry?.structures??[]).map(kind=>({kind,variant:'',name:STRUCTURE_LABELS[kind]??kind,
    language:'Dart',label:STRUCTURE_LABELS[kind]??kind}));
}
// Every implementation in the class for the picker, in teaching order
// (lists, trees, stacks, queues, heap, hash) and then by student, as in the
// Sorting Sandbox: comparing one structure across the class is one scroll away.
const STRUCTURE_ORDER=Object.keys(PROGRESS_LABELS);
const LANGUAGE_ORDER=['Dart','Python','JavaScript','Java'];
function classImplementations(){
  const rank=(order,key)=>{const index=order.indexOf(key);return index<0?order.length:index;};
  const items=studentCatalog.flatMap(entry=>studentImplementations(entry).map(item=>({...item,student:entry.id})));
  return items.sort((a,b)=>rank(STRUCTURE_ORDER,a.kind)-rank(STRUCTURE_ORDER,b.kind)||
    a.name.localeCompare(b.name)||a.student.localeCompare(b.student)||
    rank(LANGUAGE_ORDER,a.language)-rank(LANGUAGE_ORDER,b.language));
}
const implementationPicker=new ImplementationPicker($('implementation-picker'),
  {onSelect:item=>chooseImplementation(item)});
function showSelection(){
  implementationPicker.setValue({student:selectedStudent,kind:structure,variant});
}
const preferenceKey='data-structure-sandbox.v1.selection';
function savedPreference(){try{return JSON.parse(localStorage.getItem(preferenceKey)||'null');}catch(_){return null;}}
function rememberChoice(){try{localStorage.setItem(preferenceKey,JSON.stringify({student:selectedStudent,structure,variant}));}catch(_){}}
function selectImplementation(){
  if(!socket||socket.readyState!==WebSocket.OPEN)return;
  resetValidation('Implementation changed; previous test results are outdated.');
  refreshProgressHighlights();
  rememberChoice();
  socket.send(JSON.stringify({action:'select',student:selectedStudent,structure,variant}));
  window.sandboxEditor?.ready();
  ui.cmdStatus.textContent=`Loading ${selectedStudent} / ${implementationValue()}…`;
}
function updateStructures(){
  const available=studentImplementations(studentCatalog.find(s=>s.id===selectedStudent));
  const before=implementationValue();
  if(!available.some(item=>item.kind===structure&&item.variant===variant)){
    // Keep the structure if another implementation of it exists.
    const fallback=available.find(item=>item.kind===structure)??available[0];
    structure=fallback?.kind??'';variant=fallback?.variant??'';
  }
  implementationPicker.setItems(classImplementations());
  showSelection();
  return before!==implementationValue();
}
function receiveCatalog(data){
  if(!Array.isArray(data.students))return;
  studentCatalog=data.students;
  const previous=selectedStudent;
  if(!initializedCatalog){
    const saved=savedPreference();
    selectedStudent=saved?.student??data.default?.student??'example';
    structure=saved?.structure??data.default?.structure??'unsorted_array_list';
    variant=saved?.variant??data.default?.variant??'';
  }
  if(!studentCatalog.some(s=>s.id===selectedStudent)) selectedStudent=studentCatalog[0]?.id??'';
  const kindChanged=updateStructures();
  if(!initializedCatalog || previous!==selectedStudent || kindChanged){
    initializedCatalog=true;
    if(selectedStudent && structure)selectImplementation();
    else {
      window.sandboxEditor?.clear();
      clearView();
      ui.status.textContent='Create a starter from the app terminal to begin.';
      ui.file.textContent='No student implementation yet';
      ui.code.textContent='Create a starter from the app terminal: ./new-structure YOUR_NAME stack array';
      ui.cmdStatus.textContent='No implementations yet. Clone the class repository, then create your array stack starter.';
      ui.callInput.value='';ui.callInput.placeholder='Create a starter to begin';
      ui.suggestions.replaceChildren();
      validationUI.button.disabled=true;
    }
  }
}
