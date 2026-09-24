'use strict';
// Browser renders a trace sent by a persistent Dart server. No browser-side
// simulation of list operations: node IDs and reference writes come from Dart.
const NS = 'http://www.w3.org/2000/svg';
// Keep a single camera for each trace: frame new tree growth at the command
// boundary, never halfway through a pointer or rotation animation.
const SCENE_WIDTH = 1100, WIDTH = 112, HEIGHT = 68, ROW = 276, START_X = 112, GAP = 184;
// Manual zoom/pan takes precedence until Fit is pressed. Auto framing uses
// the final reachable tree, not transient unlinked nodes or the whole registry.
let viewport={x:0,y:0,w:1100,h:510},viewportKind=null,cameraMode='auto';
function paintViewport(){
  ui.scene.setAttribute('viewBox',`${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`);
}
function ensureViewport(kind){
  if(viewportKind!==kind){
    viewportKind=kind;
    cameraMode='auto';
    viewport={x:0,y:0,w:1100,h:kind==='array_heap'?810:kind==='hash'?720:(kind==='tree'||kind==='avl'||kind==='node_heap')?620:510};
  }
  paintViewport();
}
// Zoom around the cursor's world-space point. SVG's default "meet" alignment
// may add gutters: account for them before converting screen to world units.
function zoomScene(factor,clientX=null,clientY=null){
  cameraMode='manual';
  let u=.5,v=.5;
  const bounds=ui.scene.getBoundingClientRect?.();
  if(Number.isFinite(clientX)&&Number.isFinite(clientY)&&bounds?.width>0&&bounds?.height>0){
    const scale=Math.min(bounds.width/viewport.w,bounds.height/viewport.h);
    const gutterX=(bounds.width-viewport.w*scale)/2;
    const gutterY=(bounds.height-viewport.h*scale)/2;
    u=Math.max(0,Math.min(1,(clientX-(bounds.left??0)-gutterX)/(viewport.w*scale)));
    v=Math.max(0,Math.min(1,(clientY-(bounds.top??0)-gutterY)/(viewport.h*scale)));
  }
  const w=Math.max(230,Math.min(200000,viewport.w*factor));
  const h=viewport.h*w/viewport.w;
  viewport={x:viewport.x+u*(viewport.w-w),y:viewport.y+v*(viewport.h-h),w,h};
  paintViewport();
}
function treeSceneRatio(){
  const bounds=ui.scene.getBoundingClientRect?.();
  return bounds?.width>0 && bounds?.height>0
    ?bounds.width/bounds.height:SCENE_WIDTH/620;
}
function fitScene(){
  cameraMode='auto';
  if(structure==='array_heap'){autoFrameHeap([{kind:'snapshot',cells:heapState.cells}],true);return;}
  if(structure==='hash'){autoFrameHash([{kind:'snapshot',...hashState}],true);return;}
  const visible=[...nodes.values()].filter(n=>n.opacity>.01);
  if(!visible.length){viewportKind=null;ensureViewport(structure);return;}
  const marker=pointerBounds(),right=isTree()?72:WIDTH;
  const x0=Math.min(Math.min(...visible.map(n=>n.x))-85,marker.minX-28);
  const x1=Math.max(Math.max(...visible.map(n=>n.x+right))+85,marker.maxX+28);
  const y0=Math.min(Math.min(...visible.map(n=>n.y))-48,marker.minY-26);
  const y1=Math.max(Math.max(...visible.map(n=>n.y+HEIGHT))+70,marker.maxY+28);
  const ratio=treeSceneRatio();
  const w=Math.max(isTree()?880:460,x1-x0,(y1-y0)*ratio);
  const h=w/ratio;
  viewport={x:(x0+x1-w)/2,y:(y0+y1-h)/2,w,h};
  paintViewport();
}
let cameraAnimationId=0;
function animateCamera(action){
  const before={...viewport};
  const token=++cameraAnimationId;
  action();
  const after={...viewport};
  if(typeof requestAnimationFrame!=='function'||
     (typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;
  viewport=before;paintViewport();
  const start=performance.now();
  function frame(now){
    if(token!==cameraAnimationId)return;
    const t=Math.max(0,Math.min(1,(now-start)/220));
    const eased=1-Math.pow(1-t,3);
    viewport={
      x:before.x+(after.x-before.x)*eased,
      y:before.y+(after.y-before.y)*eased,
      w:before.w+(after.w-before.w)*eased,
      h:before.h+(after.h-before.h)*eased,
    };
    paintViewport();
    if(t<1)requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Compute the eventual reachable tree's world-space bounds BEFORE playback.
// A single camera update here avoids per-step jumps and keeps pointer-first
// rotations smooth. Preserve the previous scale when the tree gets smaller;
// Reset (empty tree) and Fit can zoom in again.
function autoFrameTree(steps){
  if(!isTree()||cameraMode!=='auto')return;
  const snapshots=steps.filter(step=>step.kind==='snapshot'&&Array.isArray(step.nodes));
  const final=snapshots.at(-1);
  if(!final)return;
  const targets=treeLayout(final).targets;
  const byId=new Map(final.nodes.map(node=>[node.id,node]));
  const pending=[final.root],reachable=new Set(),positions=[];
  while(pending.length){
    const id=pending.pop();
    if(id==null||reachable.has(id)||!byId.has(id))continue;
    reachable.add(id);
    positions.push(targets.get(id));
    const node=byId.get(id);
    pending.push(node.left,node.right);
  }
  if(!positions.length){
    viewport={x:0,y:0,w:SCENE_WIDTH,h:620};
    paintViewport();
    return;
  }
  // Include the node outline, root label/arrow and breathing room at every
  // side. Extents are independent of SVG's clipping and of the browser width.
  const refNames=new Map();
  if(final.root!=null)refNames.set(final.root,new Set(['root']));
  for(const event of steps){
    if(event.kind!=='variableWrite'||event.to==null)continue;
    if(!refNames.has(event.to))refNames.set(event.to,new Set());
    refNames.get(event.to).add(event.name);
  }
  // Each additional reference to one node occupies its own labelled slot.
  const widest=Math.max(0,...[...refNames.values()].flatMap(names=>[...names].map(name=>referenceLabel(name).length*9)));
  const stacked=Math.max(1,...[...refNames.values()].map(names=>names.size));
  const side=Math.max(74,widest/2+36);
  const x0=Math.min(...positions.map(p=>p.x))-side;
  const x1=Math.max(...positions.map(p=>p.x+TREE_RADIUS*2))+side;
  const y0=Math.min(...positions.map(p=>p.y))-(110+(stacked-1)*30);
  const y1=Math.max(...positions.map(p=>p.y+TREE_RADIUS*2))+78;
  const ratio=treeSceneRatio();
  const requiredW=Math.max(SCENE_WIDTH,x1-x0,(y1-y0)*ratio);
  const w=Math.max(viewport.w,requiredW),h=w/ratio;
  // Keep the scale while centering the final reachable structure on EVERY
  // command; zoom out only when the new bounds genuinely need more room.
  viewport={x:(x0+x1-w)/2,y:(y0+y1-h)/2,w,h};
  paintViewport();
}

const $ = id => document.getElementById(id);
const ui = {
  code:$('code'), codeScroll:$('code-scroll'), file:$('filename'),
  operation:$('operation'), description:$('description'), phase:$('phase'),
  connection:$('connection'), status:$('scene-status'), result:$('result'),
  stepLabel:$('step-label'), seek:$('seek'), next:$('next'), back:$('back'),
  first:$('first'), last:$('last'), traceMode:$('trace-mode'),
  speed:$('speed'),speedOutput:$('speed-output'),compileSpinner:$('compile-spinner'),
  scene:$('scene'), edges:$('edges'), references:$('references'),
  nullRail:$('null-rail'), nodes:$('nodes'), form:$('invoke'), method:$('method'), values:$('values'),
  reset:$('reset'), suggestions:$('method-suggestions'), cmdStatus:$('command-status'), invoke:$('invoke-button'),
  singleArg:$('single-argument'), argLabel:$('arg-label'), multiArgs:$('multi-arguments'),
  zoomIn:$('zoom-in'),zoomOut:$('zoom-out'),fitScene:$('fit-scene'),
  student:$('student'),structure:$('structure'),retry:$('retry'), callForm:$('call-form'),callInput:$('call-input'),returnValue:$('return-value'),stackView:$('stack-view'),
  playbackModes:[...document.querySelectorAll('[data-playback-mode]')],
};
const validationUI={
  button:$('validation-run'), summary:$('validation-summary'),
  dialog:$('validation-dialog'), close:$('validation-close'), rerun:$('validation-rerun'),
  status:$('validation-status'), progress:$('validation-progress'), results:$('validation-results'),
};
const validationCachePrefix='data-structure-sandbox.validation.v2';
let validationItems=[],validationResults=[],validationRevision=null;
let validationRunning=false,validationCompleted=false;
function validationCacheKey(){return `${validationCachePrefix}:${selectedStudent}:${structure}`;}
function validationBadge(passed,total){
  validationUI.summary.hidden=false;
  validationUI.summary.textContent=`${passed} / ${total}`;
  validationUI.button.classList.toggle('validation-success',passed===total);
  validationUI.button.classList.toggle('validation-errors',passed!==total);
  validationUI.button.setAttribute('aria-label',`Test my implementation; ${passed} of ${total} groups passed`);
}
function resetValidation(message='Run tests on the selected implementation.'){
  validationRevision=null;validationRunning=false;validationCompleted=false;
  validationUI.button.disabled=true;
  validationUI.rerun.disabled=true;
  validationUI.button.classList.remove('validation-running-button','validation-success','validation-errors');
  validationUI.button.setAttribute('aria-label','Test my implementation');
  validationUI.summary.hidden=true;
  validationUI.status.textContent=message;
  validationUI.progress.hidden=true;
  validationUI.results.hidden=true;
  validationUI.results.replaceChildren();
  validationItems=[];validationResults=[];
}
function validationRows(){
  validationUI.results.replaceChildren();
  validationItems=validationResults.map(record=>{
    const item=document.createElement('li');
    item.className=record.state==='pass'?'validation-pass':record.state==='fail'?'validation-fail':
      record.state==='running'?'validation-running':'validation-pending';
    if(record.state==='pass'||record.state==='fail'){
      const symbol=document.createElement('span');symbol.className='validation-icon';
      symbol.innerHTML=record.state==='pass'
        ?'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="/vendor/tabler-icons.svg#ti-check"/></svg>'
        :'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="/vendor/tabler-icons.svg#ti-x"/></svg>';
      const detail=document.createElement('span');
      detail.textContent=`${record.state==='pass'?'Passed':'Failed'}: ${record.name}`+
        (record.message?` — ${record.message}`:'');
      item.append(symbol,detail);
    }else item.textContent=record.state==='running'?`${record.name} — running…`:record.name;
    validationUI.results.append(item);
    return item;
  });
  validationUI.results.hidden=!validationItems.length;
}
function restoreValidation(revision){
  validationRevision=revision??null;
  if(!validationRevision)return;
  try{
    const cached=JSON.parse(localStorage.getItem(validationCacheKey())||'null');
    if(!cached||cached.revision!==validationRevision||!Array.isArray(cached.results)||
       !Number.isInteger(cached.passed)||!Number.isInteger(cached.total)||
       cached.results.length!==cached.total)return;
    validationResults=cached.results;
    validationCompleted=true;
    validationUI.progress.hidden=false;
    validationUI.progress.max=Math.max(1,cached.total);
    validationUI.progress.value=cached.total;
    validationUI.status.textContent=`${cached.passed} / ${cached.total} test groups passed (cached)`;
    validationBadge(cached.passed,cached.total);
    validationRows();
  }catch(_){/* Results remain available during this session if storage is unavailable. */}
}
function startValidation(){
  if(validationRunning||validationUI.button.disabled||!socket||socket.readyState!==WebSocket.OPEN)return;
  validationRunning=true;validationCompleted=false;
  validationResults=[];validationRows();
  validationUI.rerun.disabled=true;
  validationUI.button.classList.remove('validation-success','validation-errors');
  validationUI.button.classList.add('validation-running-button');
  validationUI.summary.hidden=true;
  validationUI.progress.hidden=false;
  validationUI.progress.removeAttribute('value');
  validationUI.status.textContent='Starting tests…';
  try{localStorage.removeItem(validationCacheKey());}catch(_){}
  socket.send(JSON.stringify({action:'validate'}));
}
function validationMessage(data){
  switch(data.type){
    case 'validationStart':
      validationRunning=true;validationCompleted=false;
      validationResults=(data.tests??[]).map(name=>({name,state:'pending'}));
      validationUI.rerun.disabled=true;
      validationUI.progress.hidden=false;
      validationUI.progress.max=Math.max(1,validationResults.length);
      validationUI.progress.value=0;
      validationUI.status.textContent=`Testing 0 / ${validationResults.length}…`;
      validationRows();return;
    case 'validationRunning':
      if(validationResults[data.index])validationResults[data.index].state='running';
      validationRows();return;
    case 'validationResult':
      if(validationResults[data.index])validationResults[data.index]={
        name:data.name,state:data.passed?'pass':'fail',message:data.message??null,
      };
      validationUI.progress.value=data.completed;
      validationUI.status.textContent=`${data.completed} / ${data.total} groups · ${data.passedCount} passed`;
      validationRows();return;
    case 'validationDone':
      validationRunning=false;validationCompleted=true;
      validationUI.rerun.disabled=false;
      validationUI.button.classList.remove('validation-running-button');
      validationUI.status.textContent=`${data.passed} / ${data.total} test groups passed`;
      validationBadge(data.passed,data.total);
      if(validationRevision&&validationResults.length===data.total){
        try{localStorage.setItem(validationCacheKey(),JSON.stringify({
          revision:validationRevision,passed:data.passed,total:data.total,results:validationResults,
        }));}catch(_){}
      }
      return;
    case 'validationError':
      validationRunning=false;
      validationUI.rerun.disabled=false;
      validationUI.button.classList.remove('validation-running-button');
      validationUI.progress.hidden=true;
      validationUI.status.textContent=data.message;return;
  }
}
validationUI.button.addEventListener('click',()=>{
  if(!validationUI.dialog.open)validationUI.dialog.showModal();
  if(!validationCompleted&&!validationRunning)startValidation();
});
validationUI.rerun.addEventListener('click',startValidation);
validationUI.close.addEventListener('click',()=>validationUI.dialog.close());
validationUI.dialog.addEventListener('click',event=>{
  if(event.target===validationUI.dialog)validationUI.dialog.close();
});
const svg = (name, attrs={}) => {
  const element = document.createElementNS(NS,name);
  for(const [key,value] of Object.entries(attrs)) element.setAttribute(key,value);
  return element;
};
function showReturnValue(frame){
  if(!frame.returnedVoid){
    const arrow=svg('svg',{viewBox:'0 0 24 24',width:16,height:16,
      class:'ui-icon return-arrow','aria-hidden':'true'});
    arrow.append(svg('use',{href:'/vendor/tabler-icons.svg#ti-arrow-right'}));
    ui.returnValue.replaceChildren(arrow,document.createTextNode(String(frame.value)));
    return;
  }
  if(frame.ok===false){ui.returnValue.textContent='Check failed';return;}
  const check=svg('svg',{viewBox:'0 0 24 24',width:16,height:16,
    class:'ui-icon completion-icon','aria-hidden':'true'});
  check.append(svg('use',{href:'/vendor/tabler-icons.svg#ti-check'}));
  ui.returnValue.replaceChildren(check,document.createTextNode('Completed'));
}
let socket = null, frames = [], rawSteps = [], source = null, stepIndex = 0;
let savedValues = null, savedSessionId = null, reconnectTimer = null, reconnectAttempt = 0, heartbeat = null;
let focusAfterCommand = false, stopped = false;
function showCompiling(compiling){ui.compileSpinner.hidden=!compiling;}
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
const STRUCTURE_LABELS={hash:'Hash table (separate chaining)',node_heap:'Heap (node-based)',array_heap:'Heap (array)',list:'List (sorted, singly linked)',tree:'Tree (binary search)',avl:'Tree (AVL)',stack:'Stack (fixed array)',array_queue:'Queue (circular array)',linked_stack:'Stack (linked list)',linked_queue:'Queue (linked list)'};
let selectedStudent='',initializedCatalog=false,studentCatalog=[];
const preferenceKey='data-structure-sandbox.v1.selection';
function savedPreference(){try{return JSON.parse(localStorage.getItem(preferenceKey)||'null');}catch(_){return null;}}
function rememberChoice(){try{localStorage.setItem(preferenceKey,JSON.stringify({student:selectedStudent,structure}));}catch(_){}}
function selectImplementation(){
  if(!socket||socket.readyState!==WebSocket.OPEN)return;
  resetValidation('Implementation changed; previous test results are outdated.');
  rememberChoice();
  socket.send(JSON.stringify({action:'select',student:selectedStudent,structure}));
  window.sandboxEditor?.ready();
  ui.cmdStatus.textContent=`Loading ${selectedStudent} / ${structure}…`;
}
function updateStructures(){
  const available=studentCatalog.find(s=>s.id===selectedStudent)?.structures??[];
  const before=structure;
  ui.structure.replaceChildren();
  for(const kind of available){const option=document.createElement('option');option.value=kind;option.textContent=STRUCTURE_LABELS[kind]??kind;ui.structure.append(option);}
  if(!available.includes(structure))structure=available[0]??'';
  ui.structure.value=structure;return before!==structure;
}
function receiveCatalog(data){
  if(!Array.isArray(data.students))return;
  studentCatalog=data.students;
  const previous=selectedStudent;
  if(!initializedCatalog){
    const saved=savedPreference();
    selectedStudent=saved?.student??data.default?.student??'example';
    structure=saved?.structure??data.default?.structure??'list';
  }
  if(!studentCatalog.some(s=>s.id===selectedStudent)) selectedStudent=studentCatalog[0]?.id??'';
  ui.student.replaceChildren();
  for(const entry of studentCatalog){
    const option=document.createElement('option');option.value=entry.id;option.textContent=entry.id;ui.student.append(option);
  }
  ui.student.value=selectedStudent;
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

let animationGeneration = 0, animating = false;
let playbackMode=['step','play','result'].includes(playbackPreferences.mode)?playbackPreferences.mode:'play', playbackToken=0;
const CANCELLED = Symbol('animation interrupted');
let lastResult = 'Ready', currentOperation = 'Ready', activeLine = null;
let hotNode = null, hotLink = null, hotReference = null;
let head = null, tailId = null, rootId = null, structure='list', stackState={cells:Array(8).fill(null),top:-1}, queueState={cells:Array(8).fill(null),front:0,rear:0,size:0}, heapState={cells:[],heapOrder:true},heapHot=[],hashState={buckets:Array(8).fill(null),nodes:[],size:0,capacity:8},hashHotBucket=null,hashHotNode=null, savedCapacity=8, references = {}, override = null, viewWidth = 1100;
const nodes = new Map(), nodeViews = new Map(), links = new Map();

function syntaxColor(line, destination) {
  const tokens = /(\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:class|int|bool|void|final|return|while|if|else|true|false|null|set|get|this)\b|\b(?:ListNode|TreeNode|FixedMemory|QueueMemory|MyBST|MyArrayStack|MyArrayQueue|MyLinkedList|Recorder|QueueRecorder)\b|\b-?\d+\b)/g;
  let offset=0;
  for (const m of line.matchAll(tokens)) {
    if(m.index>offset) destination.append(document.createTextNode(line.slice(offset,m.index)));
    const token=m[0], span=document.createElement('span');
    span.className=token.startsWith('//')?'syntax-comment':token.startsWith('"')||token.startsWith("'")?'syntax-string':/^-?\d+$/.test(token)?'syntax-number':/^(ListNode|TreeNode|FixedMemory|QueueMemory|MyBST|MyArrayStack|MyArrayQueue|MyLinkedList|Recorder|QueueRecorder)$/.test(token)?'syntax-type':'syntax-keyword';
    span.textContent=token;destination.append(span);offset=m.index+token.length;
  }
  destination.append(document.createTextNode(line.slice(offset)||'\u00a0'));
}
function renderSource(src) {
  // Source paths may be absolute, and --students may point anywhere on disk.
  // The class folder is the student's repository root: show only the student's
  // relative filename, never a local /home/... or /workspace/... path.
  const fileName=String(src.file??'').replaceAll('\\','/').split('/').pop();
  ui.file.textContent=selectedStudent?`${selectedStudent}/${fileName}`:fileName;
  if(window.sandboxEditor?.renderSource){
    window.sandboxEditor.renderSource(src);activeLine=null;return;
  }
  ui.code.replaceChildren();
  src.lines.forEach((line,i)=>{
    const row=document.createElement('div');row.className='code-line';row.dataset.line=String(i+1);
    const no=document.createElement('span');no.className='line-number';no.textContent=String(i+1).padStart(2);
    const contents=document.createElement('span');contents.className='line-text';syntaxColor(line,contents);
    row.append(no,contents);ui.code.append(row);
  });ui.codeScroll.scrollTop=0;activeLine=null;
}
function showLine(line) {
  if(line===activeLine)return;
  if(window.sandboxEditor?.highlight){
    activeLine=Number.isInteger(line)?line:null;
    window.sandboxEditor.highlight(activeLine);return;
  }
  if(activeLine!==null)ui.code.querySelector(`[data-line="${activeLine}"]`)?.classList.remove('active');
  activeLine=Number.isInteger(line)?line:null;
  if(activeLine===null)return;
  const row=ui.code.querySelector(`[data-line="${line}"]`);if(!row)return;
  row.classList.add('active');const rr=row.getBoundingClientRect(),pr=ui.codeScroll.getBoundingClientRect();
  if(rr.top<pr.top+20||rr.bottom>pr.bottom-20)ui.codeScroll.scrollTop+=rr.top-pr.top-pr.height*.32;
}
function newNode(data, initial=false) {
  if(nodes.has(data.id))return nodes.get(data.id);
  const marker=references.current??references.previous;
  const around=nodes.get(marker)??[...nodes.values()].at(-1);
  const node={id:data.id,value:data.value,next:data.next??null,left:data.left??null,right:data.right??null,
    height:data.height??1,balance:null,avlInvalid:false,heapIndex:null,heapInvalid:false,
    x:initial?(isTree()?SCENE_WIDTH/2-36:SCENE_WIDTH/2-WIDTH/2):
      (around?.x??(isTree()?SCENE_WIDTH/2-36:SCENE_WIDTH/2-WIDTH/2))+55,
    y:initial?ROW:135,
    opacity:initial?1:0,detached:false,wasReachable:false};nodes.set(node.id,node);
  const group=svg('g',{class:'node'});
  group.append(svg('rect',{class:'card',x:0,y:0,width:WIDTH,height:HEIGHT,rx:10}),
    svg('line',{class:'divider',x1:77,y1:0,x2:77,y2:HEIGHT}),
    svg('rect',{class:'port',x:80,y:19,width:24,height:29,rx:5}));
  const value=svg('text',{class:'value',x:38,y:33});value.textContent=String(data.value);
  const id=svg('text',{class:'node-id',x:38,y:53});id.textContent='#'+data.id;
  const pointer=svg('text',{class:'pointer-label',x:92,y:37});
  const avlInfo=svg('text',{class:'avl-info',x:36,y:61});
  group.append(value,id,pointer,avlInfo);
  if(isTree()){
    if(structure==='avl'||structure==='node_heap'){value.setAttribute('y',27);id.setAttribute('y',44);}
    group.querySelector('.card').setAttribute('width',72);
    group.querySelector('.card').setAttribute('height',72);
    group.querySelector('.card').setAttribute('rx',36);
    group.querySelector('.divider').setAttribute('display','none');
    group.querySelector('.port').setAttribute('display','none');
    pointer.setAttribute('display','none');
  }
  ui.nodes.append(group);nodeViews.set(node.id,group);
  renderNode(node);return node;
}
function renderNode(node){
  const view=nodeViews.get(node.id);if(!view)return;
  view.querySelector('.value').textContent=String(node.value);
  view.setAttribute('transform',`translate(${node.x.toFixed(2)} ${node.y.toFixed(2)})`);
  view.setAttribute('opacity',node.opacity.toFixed(3));
  view.classList.toggle('hot',hotNode===node.id);view.classList.toggle('detached',node.detached);
  view.classList.toggle('avl-invalid',(structure==='avl'&&node.avlInvalid)||(structure==='node_heap'&&node.heapInvalid));
  view.querySelector('.avl-info').textContent=structure==='avl'
    ?`h${node.height} · b${node.balance==null?'?':node.balance>0?'+'+node.balance:node.balance}`
    :structure==='node_heap'&&node.heapIndex!=null?`slot ${node.heapIndex}`:'';
  const nil=!isTree()&&node.next==null && override?.from!==`node:${node.id}.next`;
  const pointer=view.querySelector('.pointer-label');
  pointer.textContent=isTree()?'':(nil?'null':'→');
  pointer.classList.toggle('is-null',nil);
}
function pointFor(id, fallback) {
  const node=nodes.get(id);
  return node?{x:node.x-1,y:node.y+HEIGHT/2}:fallback;
}
// A shaft plus an explicit closed triangle avoids browser-specific SVG marker
// offsets/scaling. The triangle TIP is the endpoint supplied by the layout:
// the outside boundary of the target, never its centre or an arbitrary gap.
const fmt=n=>Number(n.toFixed(2));
function makeArrow(className){
  const group=svg('g',{class:className});
  group.append(svg('path',{class:'arrow-shaft'}),svg('polygon',{class:'arrow-tip'}));
  return group;
}
function drawArrow(group,start,tip,kind='edge',backward=false){
  let c1,c2;
  if(kind==='reference'){
    c1={x:start.x,y:start.y+Math.max(26,(tip.y-start.y)*.55)};
    c2={x:tip.x,y:tip.y-Math.max(23,(tip.y-start.y)*.42)};
  }else if(backward){
    const bottom=Math.max(start.y,tip.y)+84;
    c1={x:start.x+48,y:bottom};c2={x:tip.x-50,y:bottom};
  }else{
    const bend=Math.max(28,Math.abs(tip.x-start.x)*.45);
    c1={x:start.x+bend,y:start.y};c2={x:tip.x-bend,y:tip.y};
  }
  // For a STRAIGHT arrow the endpoint tangent is the line itself, not the
  // unused Bezier control point. Otherwise vertical top/root arrows can have
  // a sideways or collapsed triangle, disconnected from their shaft.
  let dx=kind==='straight'?tip.x-start.x:tip.x-c2.x;
  let dy=kind==='straight'?tip.y-start.y:tip.y-c2.y;
  let length=Math.hypot(dx,dy);
  if(length<.001){dx=tip.x-start.x;dy=tip.y-start.y;length=Math.hypot(dx,dy);}
  const ux=length>.001?dx/length:0,uy=length>.001?dy/length:1;
  const base={x:tip.x-ux*12,y:tip.y-uy*12};
  const left={x:base.x-uy*5.4,y:base.y+ux*5.4};
  const right={x:base.x+uy*5.4,y:base.y-ux*5.4};
  group.querySelector('.arrow-shaft').setAttribute('d',kind==='straight'
    ? `M ${fmt(start.x)} ${fmt(start.y)} L ${fmt(base.x)} ${fmt(base.y)}`
    : `M ${fmt(start.x)} ${fmt(start.y)} C ${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(base.x)} ${fmt(base.y)}`);
  group.querySelector('.arrow-tip').setAttribute('points',
    `${fmt(tip.x)},${fmt(tip.y)} ${fmt(left.x)},${fmt(left.y)} ${fmt(right.x)},${fmt(right.y)}`);
}
function renderEdges(){
  if(isTree()){renderTreeEdges();return;}
  if(structure==='stack'||structure==='array_queue')return;
  const active=new Set();
  for(const node of nodes.values()){
    const from=`node:${node.id}.next`;
    const event=override?.from===from?override:null;
    const fallback={x:node.x+WIDTH+26,y:node.y+HEIGHT/2};
    const target=event?{x:event.x,y:event.y}:pointFor(node.next,fallback);
    if(!event&&node.next===null)continue;
    active.add(node.id);
    let edge=links.get(node.id);
    if(!edge){edge=makeArrow('edge');ui.edges.append(edge);links.set(node.id,edge);}
    const src={x:node.x+WIDTH+1,y:node.y+HEIGHT/2};
    drawArrow(edge,src,target,'edge',target.x<src.x+12);
    edge.setAttribute('opacity',Math.min(1,node.opacity*(nodes.get(node.next)?.opacity??1)).toFixed(3));
    edge.classList.toggle('hot',hotLink===from);
  }
  for(const [id,edge] of links)if(!active.has(id)){edge.remove();links.delete(id);}
}
const DOCKS={root:{x:56,y:62},head:{x:56,y:62},tail:{x:1010,y:62},current:{x:245,y:62},previous:{x:451,y:62},fresh:{x:643,y:62}};
const TARGET_OFFSETS={head:.18,current:.45,previous:.78,fresh:.62};
function dockFor(name){
  if(!DOCKS[name]){
    const count=Object.keys(DOCKS).length-5;
    DOCKS[name]={x:785+count*135,y:62};
    TARGET_OFFSETS[name]=.28+(count%4)*.15;
  }
  return DOCKS[name];
}
const NULL_RAIL_TOP=123;
// References to real objects live beside those objects. Only a null reference
// uses a fixed dock and the shared null rail. This is also used by Fit.
function referenceValues(){
  const actual={ [isTree()?'root':'head']:isTree()?rootId:head,
    ...(structure==='linked_queue'?{tail:tailId}:{}),...references};
  if(override?.from.startsWith('var:')){
    const pending=override.from.slice(4);
    if(!(pending in actual))actual[pending]=null;
  }
  return actual;
}
function referenceLabel(name){
  return name==='head'&&structure==='linked_stack'?'head (top)':
    name==='root'&&structure==='node_heap'?'root (min)':name;
}
function referenceAnchors(actual){
  const groups=new Map(),anchors=new Map();
  for(const [name,id] of Object.entries(actual)){
    if(id==null||!nodes.has(id))continue;
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(name);
  }
  for(const [id,names] of groups){
    const n=nodes.get(id),centre=n.x+(isTree()?TREE_RADIUS:WIDTH/2);
    // Put two labels on each row, on opposite sides of the target. Stacking
    // labels directly above one another makes an upper pointer pass through
    // the lower label (e.g. head/current). Keep the labels close to their node
    // but leave a small gap for the arrows and neighboring node references.
    const firstY=n.y-(isTree()?65:50);
    for(let i=0;i<names.length;i+=2){
      const first=names[i],second=names[i+1],y=firstY-(i/2)*42;
      if(second==null){anchors.set(first,{x:centre,y});continue;}
      const firstWidth=Math.max(40,referenceLabel(first).length*9);
      const secondWidth=Math.max(40,referenceLabel(second).length*9);
      const offset=(firstWidth+secondWidth)/4+10;
      anchors.set(first,{x:centre-offset,y});
      anchors.set(second,{x:centre+offset,y});
    }
  }
  return anchors;
}
function referencePoint(name,id){
  const n=nodes.get(id),dock=dockFor(name);
  if(!n)return {x:dock.x,y:NULL_RAIL_TOP};
  const centre=n.x+(isTree()?TREE_RADIUS:WIDTH/2);
  const anchor=referenceAnchors(referenceValues()).get(name);
  // Separate arrowheads when two labels point to the same object. A single
  // pointer retains its centered target, including the tree root arrow.
  const limit=(isTree()?TREE_RADIUS:WIDTH/2)-14;
  const offset=anchor?Math.max(-limit,Math.min(limit,(anchor.x-centre)*.45)):0;
  return {x:centre+offset,y:n.y-1};
}
function pointerBounds(actual=referenceValues()){
  const anchors=referenceAnchors(actual),bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
  function include(x0,y0,x1,y1){
    bounds.minX=Math.min(bounds.minX,x0);bounds.minY=Math.min(bounds.minY,y0);
    bounds.maxX=Math.max(bounds.maxX,x1);bounds.maxY=Math.max(bounds.maxY,y1);
  }
  const nullNames=Object.keys(actual).filter(name=>actual[name]==null);
  if(override?.nullTarget){
    const name=override.from.replace(/^(root|var):/,'');
    if(!nullNames.includes(name)){dockFor(name);nullNames.push(name);}
  }
  for(const [name,id] of Object.entries(actual)){
    const moving=(override?.from===`root:${name}`||override?.from===`var:${name}`) &&
      Number.isFinite(override.x)&&Number.isFinite(override.y);
    const anchor=moving?{x:override.x,y:override.y-70}:anchors.get(name)??dockFor(name);
    const textWidth=Math.max(40,referenceLabel(name).length*9);
    include(anchor.x-textWidth/2,anchor.y-17,anchor.x+textWidth/2,anchor.y+13);
    const tip=moving?{x:override.x,y:override.y}:referencePoint(name,id);
    include(Math.min(anchor.x,tip.x)-12,Math.min(anchor.y,tip.y)-8,
      Math.max(anchor.x,tip.x)+12,Math.max(anchor.y,tip.y)+12);
  }
  if(nullNames.length){
    const railWidth=Math.max(690,...nullNames.map(name=>dockFor(name).x+35));
    include(28,NULL_RAIL_TOP,railWidth+55,NULL_RAIL_TOP+27);
  }
  return bounds;
}
function renderReferences(){
  if(structure==='stack'||structure==='array_queue')return;
  ui.references.replaceChildren();ui.nullRail.replaceChildren();
  const actual=referenceValues(),anchors=referenceAnchors(actual);
  Object.keys(actual).forEach(dockFor);
  // Null remains an absence of a target; all null references share one rail.
  const nullNames=Object.keys(actual).filter(name=>actual[name]==null);
  if(override?.nullTarget){
    const name=override.from.replace(/^(root|var):/,'');
    if(!nullNames.includes(name)){dockFor(name);nullNames.push(name);}
  }
  if(nullNames.length){
    const railWidth=Math.max(690,...nullNames.map(name=>dockFor(name).x+35));
    ui.nullRail.append(svg('rect',{x:28,y:NULL_RAIL_TOP,width:railWidth-28,height:25,rx:9,class:'null-rail'}));
    const caption=svg('text',{x:railWidth+14,y:NULL_RAIL_TOP+17,class:'null-rail-label'});
    caption.textContent='null';ui.nullRail.append(caption);
    for(const name of nullNames){
      const x=DOCKS[name].x;
      ui.nullRail.append(svg('line',{x1:x,y1:NULL_RAIL_TOP+4,x2:x,y2:NULL_RAIL_TOP+18,class:'null-slot'}));
    }
  }
  const labels=[];
  for(const [name,id] of Object.entries(actual)){
    const moving=(override?.from===`root:${name}`||override?.from===`var:${name}`) &&
      Number.isFinite(override.x)&&Number.isFinite(override.y);
    const anchor=moving?{x:override.x,y:override.y-70}:anchors.get(name)??dockFor(name);
    const active=hotReference===name, label=svg('text',{x:anchor.x,y:anchor.y,class:`ref-label ${(name==='head'||name==='root'||name==='tail')?'':'local'} ${active?'active':''}`});
    label.textContent=referenceLabel(name);labels.push(label);
    const target=override?.from===`root:${name}`||override?.from===`var:${name}`
      ?{x:override.x,y:override.y}:referencePoint(name,id);
    const arrow=makeArrow(`ref-arrow ${(name==='head'||name==='root'||name==='tail')?'':'local'} ${active?'hot':''}`);
    const stationary=id!=null&&nodes.has(id)&&override?.from!==`root:${name}`&&override?.from!==`var:${name}`;
    drawArrow(arrow,{x:anchor.x,y:anchor.y+10},target,stationary?'straight':'reference');
    ui.references.append(arrow);
  }
  ui.references.append(...labels); // Text stays above intersecting pointer paths.
}
function renderAll(){if(structure==='stack'){renderStack();return;}if(structure==='array_queue'){renderQueue();return;}if(structure==='array_heap'){renderHeap();return;}if(structure==='hash'){renderHash();return;}for(const node of nodes.values())renderNode(node);renderEdges();renderReferences();}
function layoutFor(snapshot){
  if(isTree())return treeLayout(snapshot);
  const byId=new Map(snapshot.nodes.map(node=>[node.id,node]));
  const targets=new Map(),seen=new Set(),ordered=[];let cursor=snapshot.head,index=0;
  while(cursor!==null&&byId.has(cursor)&&!seen.has(cursor)){
    seen.add(cursor);ordered.push(cursor);
    cursor=byId.get(cursor).next;index++;
  }
  // Position the whole reachable chain as one centred group. Recompute these
  // slots only when settling, never while an individual pointer is changing.
  const gap=ordered.length>1
    ?Math.min(GAP,Math.max(144,(SCENE_WIDTH-140-WIDTH)/(ordered.length-1))):GAP;
  const firstX=(SCENE_WIDTH-WIDTH-(ordered.length-1)*gap)/2;
  ordered.forEach((id,i)=>targets.set(id,{x:firstX+i*gap,y:ROW,opacity:1,detached:false}));
  let detachedIndex=0;
  for(const item of snapshot.nodes){if(seen.has(item.id))continue;
    const former=nodes.get(item.id);
    // A newly allocated object must remain above the row until it has ever
    // belonged to the list, even before the local `fresh` is assigned.
    const pending=!former?.wasReachable;
    targets.set(item.id,{x:former?.x??SCENE_WIDTH/2-WIDTH/2+detachedIndex*140,
      y:pending?156:431,opacity:pending?1:.37,detached:!pending});detachedIndex++;
  }
  // Never change the viewBox halfway through an operation: that would scale
  // every node and arrow at once and look like an unexplained position jump.
  return {targets,count:index,cycle:cursor!==null&&seen.has(cursor)};
}
function applySnapshot(snapshot,animate=false){
  if(structure==='stack'){stackState={cells:[...snapshot.cells],top:snapshot.top};renderStack();return {targets:new Map(),count:snapshot.top+1,cycle:false};}
  if(structure==='array_queue'){queueState=queueSnapshot(snapshot);renderQueue();return {targets:new Map(),count:queueState.size,cycle:false};}
  if(structure==='array_heap'){heapState=heapSnapshot(snapshot);renderHeap();return {targets:new Map(),count:heapState.cells.length,cycle:false};}
  if(structure==='hash'){hashState=hashSnapshot(snapshot);renderHash();return {targets:new Map(),count:hashState.size,cycle:false};}
  if(isTree())rootId=snapshot.root;else head=snapshot.head;
  if(structure==='linked_queue')tailId=snapshot.tail??null;
  for(const data of snapshot.nodes){
    const node=newNode(data,true);node.value=data.value;node.next=data.next??null;
    node.left=data.left??null;node.right=data.right??null;
    node.height=data.height??1;
    const audit=snapshot.avl?.nodes?.[String(data.id)];
    node.balance=audit?.balance??null;
    node.avlInvalid=!!audit && (audit.heightOk===false||audit.balanceOk===false);
     const heapAudit=snapshot.nodeHeap?.nodes?.[String(data.id)];
    node.heapIndex=heapAudit?.index??null;
    node.heapInvalid=heapAudit?.orderOk===false;
  }
  const {targets,count,cycle}=layoutFor(snapshot);
  // Reachability is historical: a newly created detached node floats above
  // the row; a node removed from the row may drift below it.
  for(const data of snapshot.nodes){
    if(targets.get(data.id)?.y===ROW)nodes.get(data.id).wasReachable=true;
  }
  if(!animate){for(const [id,t] of targets)Object.assign(nodes.get(id),t);renderAll();}
  return {targets,count,cycle};
}
const easing=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const lerp=(a,b,t)=>a+(b-a)*t;
function tween(milliseconds,update){
  const generation=animationGeneration;
  return new Promise((resolve,reject)=>{
    const start=performance.now();
    function frame(now){
      if(generation!==animationGeneration){reject(CANCELLED);return;}
      const speed=Number(ui.speed.value);
      const progress=Math.min(1,(now-start)*(Number.isFinite(speed)?speed:1000)/milliseconds);
      update(easing(progress));
      if(progress>=1)resolve();else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
async function animateCreate(data){const node=newNode(data);const startY=node.y;ui.phase.textContent='NEW OBJECT';
  ui.status.textContent=`Node #${node.id} created. It is not yet linked into the list.`;
  await tween(430,t=>{node.y=lerp(startY,156,t);node.opacity=t;renderAll();});
}
async function animateReference(name,to){
  const old=name==='head'?head:name==='tail'?tailId:name==='root'?rootId:references[name];
  const dock=dockFor(name);
  const start=referencePoint(name,old);
  const end=referencePoint(name,to);
  hotReference=name;override={from:['head','tail','root'].includes(name)?`root:${name}`:`var:${name}`,...start,nullTarget:to==null};
  ui.phase.textContent=(name==='head'||name==='tail'||name==='root')?'ROOT POINTER':'LOCAL POINTER';
  ui.status.textContent=`${name}: ${old==null?'null':'#'+old} → ${to==null?'null':'#'+to}. Nodes remain stationary.`;
  await tween(570,t=>{override={from:override.from,x:lerp(start.x,end.x,t),y:lerp(start.y,end.y,t),nullTarget:to==null};renderReferences();});
  if(name==='head')head=to;else if(name==='tail')tailId=to;else if(name==='root')rootId=to;else references[name]=to;
  override=null;hotReference=null;renderAll();
}
async function animateWrite(step){
  if(step.from==='root:head'||step.from==='root:root'||step.from==='root:tail'){await animateReference(step.from.slice(5),step.to);return;}
  const parsed=/^node:(\d+)\.(next|left|right)$/.exec(step.from);
  if(!parsed)throw Error(`Unrecognized pointer origin ${step.from}`);
  const node=nodes.get(Number(parsed[1]));if(!node)throw Error('Missing pointer source.');
  const field=parsed[2];
  if(node[field]!==step.oldTo)throw Error(`Pointer mismatch: ${step.from} was ${node[field]}, trace expected ${step.oldTo}`);
  const nullPoint={x:node.x+WIDTH+26,y:node.y+HEIGHT/2};
  const start=isTree()?treeTargetPoint(step.oldTo,field,treeCentre(node)):pointFor(step.oldTo,nullPoint);
  const end=isTree()?treeTargetPoint(step.to,field,treeCentre(node)):pointFor(step.to,nullPoint);
  override={from:step.from,...start};hotLink=step.from;hotNode=node.id;
  ui.phase.textContent='POINTER CHANGE';ui.phase.classList.add('hot');
  ui.status.textContent=`${step.from}: ${step.oldTo==null?'null':'#'+step.oldTo} → ${step.to==null?'null':'#'+step.to}. The layout is unchanged.`;
  await tween(700,t=>{override={from:step.from,x:lerp(start.x,end.x,t),y:lerp(start.y,end.y,t)};
    if(isTree())treeEdgeMotion=Math.sin(Math.PI*t);
    renderEdges();});
  node[field]=step.to;override=null;treeEdgeMotion=0;renderAll();
}
async function animateSettle(snapshot){
  // The pointer has already moved. ONLY NOW calculate new node slots.
  const {targets,count,cycle}=applySnapshot(snapshot,true);
  const starts=new Map([...nodes].map(([id,n])=>[id,{x:n.x,y:n.y,opacity:n.opacity}]));
  ui.phase.textContent='SETTLING';ui.phase.classList.remove('hot');
  ui.status.textContent='Pointer change complete. The reachable list now rearranges smoothly.';
  await tween(850,t=>{
    for(const [id,target] of targets){const node=nodes.get(id),start=starts.get(id);
      node.x=lerp(start.x,target.x,t);node.y=lerp(start.y,target.y,t);
      node.opacity=lerp(start.opacity,target.opacity,t);node.detached=target.detached;}
    if(isTree())treeEdgeMotion=Math.sin(Math.PI*t);
    renderAll();
  });
  treeEdgeMotion=0;hotNode=null;hotLink=null;renderAll();
  ui.status.textContent=cycle?'Cycle detected. Traversal stopped.':`${count} node(s) reachable from head.`;
}
function clearView(){treeEdgeMotion=0;nodes.clear();nodeViews.clear();links.clear();ui.nodes.replaceChildren();ui.edges.replaceChildren();ui.references.replaceChildren();ui.nullRail.replaceChildren();
  head=null;tailId=null;rootId=null;references={};override=null;ui.stackView.replaceChildren();stackState={cells:Array(savedCapacity).fill(null),top:-1};queueState={cells:Array(savedCapacity).fill(null),front:0,rear:0,size:0};heapState={cells:[],heapOrder:true};heapHot=[];hashState={buckets:Array(8).fill(null),nodes:[],size:0,capacity:8};hashHotBucket=null;hashHotNode=null;ui.returnValue.textContent='';hotNode=null;hotLink=null;hotReference=null;activeLine=null;
  currentOperation='Ready';lastResult='Ready';ui.operation.textContent='Ready';ui.description.textContent='Step through the recorded Dart execution.';
  ui.phase.textContent='READY';ui.phase.classList.remove('hot');ui.result.textContent='Ready';
  ui.code.querySelector('.code-line.active')?.classList.remove('active');
}
function makeFrames(raw, mode='conceptual'){
  const result=[];
  let pendingLine=null;
  for(let i=1;i<raw.length;i++){
    const s=raw[i];
    if(s.kind==='line'){
      pendingLine=s.line;
      if(mode==='detailed')result.push({...s});
      continue;
    }
    if(s.kind==='retire'&&raw[i+1]?.kind==='snapshot'){result.push({...s,kind:'retireAndSettle',snapshot:raw[++i],line:s.line??pendingLine});pendingLine=null;continue;}
    if(s.kind==='snapshot'){
      result.push({kind:'snapshot',snapshot:s,line:pendingLine});
      pendingLine=null;
      continue;
    }
    if(s.kind==='localsClear')continue;
    if((s.kind==='pointerWrite'||s.kind==='bucketWrite'||s.kind==='cellWrite'||s.kind==='indexWrite'||s.kind==='heightWrite'||['heapWrite','heapAppend','heapRemove','heapSwap'].includes(s.kind))&&raw[i+1]?.kind==='snapshot'){
      result.push({...s,kind:s.kind==='pointerWrite'?'writeAndSettle':s.kind==='heightWrite'?'heightAndSettle':'memoryWriteAndSettle',snapshot:raw[++i],line:s.line??pendingLine});
    } else result.push({...s,line:s.line??pendingLine});
    pendingLine=null;
  }
  return result;
}
function instant(frame){
  if(frame.line!=null)showLine(frame.line);
  if(structure==='stack'){instantStack(frame);return;}
  if(structure==='array_queue'){instantQueue(frame);return;}
  if(structure==='array_heap'){instantHeap(frame);return;}
  if(structure==='hash'){instantHash(frame);return;}
  switch(frame.kind){
    case 'line':break;
    case 'operationStart':currentOperation=frame.operation;ui.operation.textContent=currentOperation;ui.returnValue.textContent='';ui.description.textContent=frame.description;break;
    case 'createNode':{const n=newNode(frame.node);n.opacity=1;n.y=156;break;}
    case 'variableWrite':references[frame.name]=frame.to;break;
    case 'visit':hotNode=frame.id;break;
    case 'compare':hotNode=frame.id;break;
    case 'writeAndSettle':{
      if(frame.from==='root:head')head=frame.to;
      else if(frame.from==='root:tail')tailId=frame.to;
      else if(frame.from==='root:root')rootId=frame.to;
      else{const match=/^node:(\d+)\.(next|left|right)$/.exec(frame.from);if(match&&nodes.has(Number(match[1])))nodes.get(Number(match[1]))[match[2]]=frame.to;}
      applySnapshot(frame.snapshot);break;
    }
    case 'heightAndSettle':hotNode=frame.id;applySnapshot(frame.snapshot);break;
    case 'snapshot':applySnapshot(frame.snapshot);break;
    case 'retireAndSettle':retireNodes(frame.ids);applySnapshot(frame.snapshot);break;
    case 'operationEnd':references={};hotNode=null;lastResult=frame.result;ui.result.textContent=lastResult;showReturnValue(frame);showLine(null);break;
  }
  renderAll();
}
function restore(index){clearView();applySnapshot(traceInitial);
  for(let i=0;i<index;i++)instant(frames[i]);stepIndex=index;
  ui.phase.textContent=index?'REVISIT':'READY';ui.phase.classList.remove('hot');
  ui.status.textContent=index?'Previous recorded state restored.':frames.length?'At the start of the trace. Step forward to inspect the operation.':'Choose a method above to begin.';
  sync();
}
let traceInitial=null;
async function animate(frame){
  if(frame.line!=null)showLine(frame.line);
  if(structure==='stack'){await animateStack(frame);return;}
  if(structure==='array_queue'){await animateQueue(frame);return;}
  if(structure==='array_heap'){await animateHeap(frame);return;}
  if(structure==='hash'){await animateHash(frame);return;}
  switch(frame.kind){
    case 'line':ui.phase.textContent='SOURCE LINE';break;
    case 'operationStart':currentOperation=frame.operation;ui.operation.textContent=frame.operation;ui.returnValue.textContent='';
      ui.description.textContent=frame.description;lastResult='Running…';ui.result.textContent=lastResult;
      hotNode=null;ui.phase.textContent='METHOD CALL';ui.phase.classList.remove('hot');renderAll();break;
    case 'visit':hotNode=frame.id;ui.phase.textContent='VISIT';
      ui.status.textContent=`Visiting node #${frame.id} (value ${nodes.get(frame.id)?.value??'?'})`;
      renderAll();await tween(190,()=>{});break;
    case 'compare':hotNode=frame.id;ui.phase.textContent='COMPARE';
      ui.status.textContent=`${nodes.get(frame.id)?.value??'?'} ${frame.equal?'=':'≠'} ${frame.target}`;
      renderAll();break;
    case 'variableWrite':await animateReference(frame.name,frame.to);break;
    case 'createNode':await animateCreate(frame.node);break;
    case 'writeAndSettle':await animateWrite(frame);await animateSettle(frame.snapshot);break;
    case 'heightAndSettle':
      hotNode=frame.id;ui.phase.textContent='HEIGHT WRITE';
      ui.status.textContent=`Node #${frame.id}: height ${frame.before} → ${frame.to}.`;
      applySnapshot(frame.snapshot);renderAll();await tween(230,()=>{});break;
    case 'snapshot':await animateSettle(frame.snapshot);break;
    case 'retireAndSettle':await animateRetire(frame.ids,frame.snapshot);break;
    case 'operationEnd':references={};hotNode=null;showReturnValue(frame);ui.phase.textContent=frame.ok?'DONE':'CHECK FAILED';
      lastResult=frame.result;ui.result.textContent=lastResult;ui.status.textContent=frame.result;showLine(null);renderAll();break;
    default:throw Error('Unknown event '+frame.kind);
  }
}
function sync(){
  ui.next.disabled=!frames.length||stepIndex>=frames.length;
  ui.back.disabled=stepIndex===0;
  ui.first.disabled=stepIndex===0;
  ui.last.disabled=!frames.length||stepIndex===frames.length;
  ui.stepLabel.textContent=`Step ${stepIndex} / ${frames.length}`;
  ui.seek.max=String(frames.length);
  ui.seek.value=String(stepIndex);
}
// The logical trace position is updated immediately. A second navigation input
// invalidates the old requestAnimationFrame tween and restores the requested
// snapshot without waiting for the original movement to finish.
function jumpTo(index){
  animationGeneration++;
  animating=false;
  restore(Math.max(0,Math.min(frames.length,index)));
}
function updatePlaybackButtons(){
  for(const button of ui.playbackModes){
    const selected=button.dataset.playbackMode===playbackMode;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  }
}
function stopPlayback(){
  playbackToken++;
  playbackMode='step';
  updatePlaybackButtons();
}
async function playTrace(token){
  while(playbackMode==='play'&&token===playbackToken&&stepIndex<frames.length){
    const oldIndex=stepIndex;
    await forward();
    if(playbackMode!=='play'||token!==playbackToken||stepIndex<=oldIndex)return;
    // Give users time to understand each mutation; source-only events are quicker.
    const delay=frames[oldIndex]?.kind==='line'?140:260;
    await new Promise(resolve=>setTimeout(resolve,delay/Math.max(.1,Number(ui.speed.value)||1)));
  }
}
function choosePlaybackMode(mode){
  if(!['step','play','result'].includes(mode))return;
  playbackToken++;
  playbackMode=mode;
  updatePlaybackButtons();
  rememberPlaybackPreferences();
  if(mode==='step'){
    if(animating)jumpTo(stepIndex);
  }else if(mode==='result'){
    jumpTo(frames.length);
  }else if(frames.length){
    if(animating)jumpTo(stepIndex);
    if(stepIndex===frames.length)jumpTo(0);
    void playTrace(playbackToken);
  }
}
ui.playbackModes.forEach(button=>button.addEventListener('click',()=>choosePlaybackMode(button.dataset.playbackMode)));
function navigate(action){stopPlayback();return action();}

async function forward(){
  if(!frames.length||stepIndex>=frames.length)return;
  const target=stepIndex+1;
  if(animating||ui.speed.value==='instant'){
    jumpTo(target);
    return;
  }
  animationGeneration++;
  const generation=animationGeneration;
  stepIndex=target;
  animating=true;
  sync();
  try{
    await animate(frames[target-1]);
  }catch(error){
    if(error!==CANCELLED){
      ui.cmdStatus.textContent=`Trace error: ${error.message}`;
      ui.cmdStatus.classList.add('error');console.error(error);
      if(generation===animationGeneration)jumpTo(target);
    }
  }finally{
    if(generation===animationGeneration){animating=false;sync();}
  }
}
// A normal backward step plays the inverse visual change. For a structural
// write, restore the old geometry FIRST, then retarget the pointer back.
// Repeated navigation cancels the tween and jumps immediately, so rapid
// stepping never waits for an unfinished animation.
async function backward(){
  if(stepIndex<=0)return;
  const target=stepIndex-1;
  if(animating||ui.speed.value==='instant'){jumpTo(target);return;}
  animationGeneration++;
  const generation=animationGeneration;
  animating=true;
  const frame=frames[target];
  const currentIndex=stepIndex;
  // Sample the exact preceding state without presenting intermediate frames.
  // Both restores happen in one JS task, before the browser has painted.
  restore(target);
  const previous=new Map([...nodes].map(([id,n])=>[id,{...n}]));
  const oldReference=frame.kind==='variableWrite'?references[frame.name]:null;
  restore(currentIndex);
  if(frame.kind==='retireAndSettle'){
    for(const id of frame.ids){
      const old=previous.get(id);
      if(!old||nodes.has(id))continue;
      const n=newNode(old,true);
      Object.assign(n,old,{y:old.y+45,opacity:0,detached:true});
    }
    renderAll();
  }
  stepIndex=target;sync();
  try{
    if(frame.kind==='writeAndSettle'||frame.kind==='snapshot'||frame.kind==='retireAndSettle'||frame.kind==='memoryWriteAndSettle'){
      ui.phase.textContent='REWIND · SETTLING';
      const starts=new Map([...nodes].map(([id,n])=>[id,{x:n.x,y:n.y,opacity:n.opacity}]));
      await tween(650,t=>{
        for(const [id,n] of nodes){const a=starts.get(id),b=previous.get(id);
          if(!b)continue;
          n.x=lerp(a.x,b.x,t);n.y=lerp(a.y,b.y,t);
          n.opacity=lerp(a.opacity,b.opacity,t);
        }
        if(isTree())treeEdgeMotion=Math.sin(Math.PI*t);
        renderAll();
      });
      treeEdgeMotion=0;renderAll();
      if(frame.kind==='retireAndSettle'){
        ui.phase.textContent='REWIND · RESTORING OBJECT';
        ui.status.textContent='Restoring an earlier, still-referenced object.';
      }
      if(frame.kind==='writeAndSettle'){
        ui.phase.textContent='REWIND · POINTER';
        await animateWrite({from:frame.from,oldTo:frame.to,to:frame.oldTo});
      }
    } else if(frame.kind==='variableWrite'){
      await animateReference(frame.name,oldReference??null);
    } else if(frame.kind==='createNode'){
      const node=nodes.get(frame.node.id);
      if(node){const startY=node.y,startOpacity=node.opacity;
        ui.phase.textContent='REWIND · OBJECT';
        await tween(380,t=>{node.y=lerp(startY,startY-42,t);node.opacity=lerp(startOpacity,0,t);renderAll();});
      }
    }
    if(generation===animationGeneration)restore(target);
  }catch(error){
    if(error!==CANCELLED){console.error(error);ui.cmdStatus.textContent=`Reverse trace error: ${error.message}`;
      ui.cmdStatus.classList.add('error');if(generation===animationGeneration)restore(target);}
  }finally{if(generation===animationGeneration){animating=false;sync();}}
}
function nextOperation(){
  const next=frames.findIndex((f,i)=>i>=stepIndex&&f.kind==='operationStart');
  jumpTo(next>=0?next+1:frames.length);
}
function previousOperation(){
  let previous=0;
  for(let i=0;i<Math.max(0,stepIndex-1);i++){
    if(frames[i].kind==='operationStart')previous=i+1;
  }
  jumpTo(previous);
}
ui.next.addEventListener('click',()=>navigate(forward));
ui.back.addEventListener('click',()=>navigate(backward));
ui.first.addEventListener('click',()=>navigate(()=>jumpTo(0)));
ui.last.addEventListener('click',()=>navigate(()=>jumpTo(frames.length)));
ui.seek.addEventListener('input',()=>navigate(()=>jumpTo(Number(ui.seek.value))));
ui.traceMode.addEventListener('change',()=>{
  animationGeneration++;animating=false;
  frames=makeFrames(rawSteps,ui.traceMode.value);
  restore(0);
  if(playbackMode==='result')jumpTo(frames.length);
  else if(playbackMode==='play')void playTrace(++playbackToken);
  ui.cmdStatus.textContent=`${ui.traceMode.value==='detailed'?'Detailed':'Key-event'} trace selected. Use ← / → or drag the timeline.`;
});
document.addEventListener('keydown',event=>{
  if(validationUI.dialog.open)return; // Let the native test dialog handle its own keys.
  // A focused editor must retain its own cursor, Home/End and Space keys.
  if(event.target?.closest?.('#source-editor'))return;
  if(event.altKey)return;
  // Ctrl/Cmd+Home/End works even while the method field has focus. Plain
  // Home/End still belongs to a text editor or native select when editing.
  if((event.ctrlKey||event.metaKey)&&(event.key==='Home'||event.key==='End')){
    event.preventDefault();navigate(()=>jumpTo(event.key==='Home'?0:frames.length));return;
  }
  if(event.ctrlKey||event.metaKey)return;
  // Buttons (especially Run and suggestion buttons) must not swallow arrows.
  // Native text inputs/selectors retain their editing keys. The speed slider
  // is not a text editor: Home/End continue to navigate the trace there too.
  if((event.target instanceof HTMLInputElement && (event.target.type??'text')!=='range')||
     event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement||event.target?.isContentEditable)return;
  // Arrow keys on a focused slider adjust that slider. Home/End still jump
  // to the start/end of the recorded trace as requested.
  if(event.target instanceof HTMLInputElement && event.target.type==='range' &&
     ['ArrowLeft','ArrowRight'].includes(event.key))return;
  if(event.key==='ArrowRight'){event.preventDefault();navigate(()=>event.shiftKey?nextOperation():forward());}
  else if(event.key==='ArrowLeft'){event.preventDefault();navigate(()=>event.shiftKey?previousOperation():backward());}
  else if(event.key==='Home'){event.preventDefault();navigate(()=>jumpTo(0));}
  else if(event.key==='End'){event.preventDefault();navigate(()=>jumpTo(frames.length));}
  else if(event.key===' '){event.preventDefault();choosePlaybackMode(playbackMode==='play'?'step':'play');}
});
// Method signatures are supplied by the Dart AST-based generator; no method
// names or argument counts are hardcoded in the browser.
let discovered = new Map();
function selectedDescriptor(){return discovered.get(ui.method.value)??null;}
function renderArguments(){
  const descriptor=selectedDescriptor();if(!descriptor)return;
  const params=descriptor.params??[];
  ui.singleArg.style.display=params.length===1?'flex':'none';
  ui.multiArgs.replaceChildren();
  if(params.length===1){
    const p=params[0];ui.argLabel.textContent=`${p.name} · ${p.type}`;
    ui.values.value=p.type==='int'?'25':p.type==='double'?'2.5':p.type==='bool'?'true':'example';
    ui.values.placeholder=p.type==='int'?'25 or 10, 20, 30':p.name;
  } else {
    params.forEach((p,i)=>{
      const wrapper=document.createElement('span');wrapper.className='argument-field';
      const label=document.createElement('label');label.textContent=`${p.name} · ${p.type}`;
      const input=document.createElement('input');input.dataset.argument=String(i);
      input.setAttribute('aria-label',`${p.name} (${p.type})`);
      input.value=p.type==='int'?'0':p.type==='double'?'0.0':p.type==='bool'?'false':'';
      wrapper.append(label,input);ui.multiArgs.append(wrapper);
    });
  }
}
function updateMethodCatalog(catalog){
  if(!Array.isArray(catalog))return;
  const typedName=/^\s*([A-Za-z_]\w*)\s*\(/.exec(ui.callInput.value)?.[1]??null;
  const selected=ui.method.value;
  discovered=new Map(catalog.map(m=>[m.name,m]));
  ui.method.replaceChildren();
  for(const method of catalog){
    const option=document.createElement('option');option.value=method.name;
    option.textContent=`${method.name}(${(method.params??[]).map(p=>`${p.type} ${p.name}`).join(', ')})`;
    ui.method.append(option);
  }
  ui.method.value=discovered.has(selected)?selected:(catalog[0]?.name??'');
  // New structure/student may not have the previously displayed method.
  // Preserve a custom call only if the chosen implementation exposes it.
  if(!typedName||!discovered.has(typedName)){
    const preferred=catalog.find(m=>['push','enqueue','insert','addVertex','contains'].includes(m.name))??catalog[0];
    const example=preferred?.params?.map(p=>p.type==='String'?'"hello"':
      p.type==='bool'?'true':p.type==='double'?'1.5':'25')??[];
    ui.callInput.value=preferred?`${preferred.name}(${example.join(', ')})`:'';
    ui.callInput.placeholder=preferred?'Enter a Dart method call':'No callable methods available';
  }
  ui.invoke.disabled=!catalog.length;renderArguments();
  renderSuggestions();
}
function parseArgument(value,type){
  const text=value.trim();
  if(type==='String')return value;
  if(type==='bool'){if(text==='true')return true;if(text==='false')return false;throw Error('Enter true or false.');}
  if(type==='int'){if(!/^-?\d+$/.test(text))throw Error('Enter a whole number.');
    const n=Number(text);if(!Number.isSafeInteger(n)||Math.abs(n)>999)throw Error('Use an integer between -999 and 999.');return n;}
  if(type==='double'){const n=Number(text);if(!text||!Number.isFinite(n))throw Error('Enter a decimal number.');return n;}
  throw Error(`Unsupported argument type: ${type}`);
}
ui.method.addEventListener('change',renderArguments);
// Long linked chains need a wider view rather than squeezing node cards and
// clipping head/tail/local pointers. Like trees, frame once per whole trace.
function autoFrameLinked(steps){
  if(!['list','linked_stack','linked_queue'].includes(structure)||cameraMode!=='auto')return;
  const snapshots=steps.filter(step=>step.kind==='snapshot'&&Array.isArray(step.nodes));
  if(!snapshots.length)return;
  let left=Infinity,right=-Infinity,maxRefs=1;
  const targets=new Map();
  for(const event of steps){
    if(event.kind!=='variableWrite'||event.to==null)continue;
    if(!targets.has(event.to))targets.set(event.to,new Set());
    targets.get(event.to).add(event.name);
  }
  maxRefs=Math.max(1,...[...targets.values()].map(names=>names.size+1));
  for(const snap of snapshots){
    const byId=new Map(snap.nodes.map(node=>[node.id,node]));
    let cursor=snap.head,count=0;
    const seen=new Set();
    while(cursor!=null&&byId.has(cursor)&&!seen.has(cursor)){
      seen.add(cursor);cursor=byId.get(cursor).next;count++;
    }
    if(!count)continue;
    const gap=count>1?Math.min(GAP,Math.max(144,(SCENE_WIDTH-140-WIDTH)/(count-1))):GAP;
    const firstX=(SCENE_WIDTH-WIDTH-(count-1)*gap)/2;
    left=Math.min(left,firstX-100);
    right=Math.max(right,firstX+(count-1)*gap+WIDTH+100);
  }
  if(!Number.isFinite(left)){left=0;right=SCENE_WIDTH;}
  const top=Math.min(0,156-70-(maxRefs-1)*30-42),bottom=510;
  const ratio=treeSceneRatio();
  const required=Math.max(SCENE_WIDTH,right-left,(bottom-top)*ratio);
  const w=Math.max(viewport.w,required),h=w/ratio;
  viewport={x:(left+right-w)/2,y:(top+bottom-h)/2,w,h};
  paintViewport();
}
function acceptTrace(data){
  if(!data.source?.lines||!Array.isArray(data.steps)||data.steps[0]?.kind!=='snapshot')throw Error('Invalid Dart trace.');
  cameraAnimationId++; // A new trace owns the viewport, not an old Fit animation.
  animationGeneration++;animating=false;
  if(data.structure&&data.structure!==structure){structure=data.structure;ui.structure.value=structure;}
  if(data.methods)updateMethodCatalog(data.methods);
  source=data.source;rawSteps=data.steps;traceInitial=data.steps[0];
  frames=makeFrames(rawSteps,ui.traceMode.value);
  // Reframe once at the command boundary, using the final reachable state.
  // The SVG viewBox then stays unchanged throughout the entire recorded trace.
  ensureViewport(structure);
  autoFrameTree(rawSteps);
  autoFrameLinked(rawSteps);
  autoFrameHeap(rawSteps);
  autoFrameHash(rawSteps);
  playbackToken++;
  renderSource(source);restore(0);
  if(playbackMode==='result')jumpTo(frames.length);
  else if(playbackMode==='play'&&focusAfterCommand)void playTrace(playbackToken);
  savedValues=[...data.values];savedCapacity=data.capacity??8;savedSessionId=data.sessionId??null;renderSuggestions();
  if(focusAfterCommand){focusAfterCommand=false;ui.next.focus({preventScroll:true});}
  ui.connection.textContent='Connected';ui.cmdStatus.classList.remove('error');
  showCompiling(false);
  ui.cmdStatus.textContent=frames.length?`${frames.length} steps ready · ${structure} · [${data.values.join(', ')}]. Use ← / →.`:
    'Ready. Choose an operation above.';
}
function send(payload){
  if(!socket||socket.readyState!==WebSocket.OPEN){ui.cmdStatus.textContent='Dart server is not connected.';return;}
  // Even if the user is halfway through an animation, allow another command.
  animationGeneration++;animating=false;playbackToken++;
  if(frames.length)restore(stepIndex);
  focusAfterCommand=true;
  socket.send(JSON.stringify(payload));ui.cmdStatus.textContent='Dart is executing…';
}
ui.form.addEventListener('submit',event=>{
  event.preventDefault();
  const method=selectedDescriptor();
  if(!method){ui.cmdStatus.textContent='Waiting for Dart method discovery…';return;}
  const params=method.params??[];
  try{
    if(params.length===1 && params[0].type==='int'){
      const raw=ui.values.value.trim();
      const values=raw.split(',').map(part=>parseArgument(part,'int'));
      if(!values.length||values.length>12)throw Error('Use 1–12 values.');
      send({action:'run',method:method.name,values});
    }else{
      const raw=params.length===1?[ui.values.value]:
        [...ui.multiArgs.querySelectorAll('input')].map(input=>input.value);
      if(raw.length!==params.length)throw Error('Missing argument.');
      send({action:'run',method:method.name,arguments:raw.map((v,i)=>parseArgument(v,params[i].type))});
    }
  }catch(error){ui.cmdStatus.textContent=error.message;ui.cmdStatus.classList.add('error');}
});
// Suggestions are generated from each method signature and the live Dart list.
// They invoke the SAME generic dispatcher as the custom argument form.
const PREFERRED_NUMBERS=[5,7,13,20,25,30,42,99,0,-3];
function missingNumbers(present,count=3){
  const out=[];
  for(const value of PREFERRED_NUMBERS){
    if(!present.includes(value)&&!out.includes(value))out.push(value);
    if(out.length===count)break;
  }
  for(let value=1;out.length<count&&value<=999;value++){
    if(!present.includes(value)&&!out.includes(value))out.push(value);
  }
  return out;
}
function dedupeCalls(calls){
  const seen=new Set();
  return calls.filter(call=>{
    const key=JSON.stringify(call.args);
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
function suggestedCalls(method, values){
  const params=method.params??[];
  const present=[...new Set(values.filter(value=>Number.isSafeInteger(value)&&Math.abs(value)<=999))];
  const absent=missingNumbers(present);
  const call=(args,hint)=>({args,hint});
  // All public, callable methods appear as rows. Only offer safe, typed
  // suggestions; never guess complex user-defined object constructors.
  if(!params.length)return [call([], 'No arguments')];
  if(params.length===1){
    const type=params[0].type;
    if(type==='int'){
      const candidates=[];
      if((structure==='linked_stack' && method.name==='push') ||
          ((structure==='linked_queue'||structure==='array_queue') && method.name==='enqueue')){
        for(const value of absent.slice(0,4))candidates.push(call([value],structure==='linked_stack'?'Push onto top':'Enqueue at rear'));
        return candidates;
      }
      if(['remove','contains','find','search','delete','has','get','indexOf'].some(s=>method.name.toLowerCase().includes(s.toLowerCase()))){
        for(const value of present.slice(0,3))candidates.push(call([value],'Exists in list'));
        for(const value of absent.slice(0,3))candidates.push(call([value],'Not in list'));
      } else {
        for(const value of absent.slice(0,3))candidates.push(call([value],'Not in list'));
        for(const value of present.slice(0,2))candidates.push(call([value],'Already in list'));
      }
      return dedupeCalls(candidates).slice(0,5);
    }
    if(type==='bool')return [call([true],'true'),call([false],'false')];
    if(type==='String')return [call(['hello'],'Example'),call([''],'Empty string')];
    if(type==='double')return [call([1.5],'Example'),call([0],'Zero')];
  }
  // Multi-argument methods get executable examples when all arguments are
  // supported scalar values. Index parameters use the current list length.
  const defaults=params.map(p=>p.type==='int' ? (/(index|position|offset)/i.test(p.name)?0:absent[0]) :
    p.type==='double'?1.5:p.type==='bool'?true:p.type==='String'?'hello':null);
  if(defaults.includes(null))return [];
  const calls=[call(defaults,'Example')];
  const intIndex=params.findIndex(p=>p.type==='int'&& !/(index|position|offset)/i.test(p.name));
  const slotIndex=params.findIndex(p=>p.type==='int'&& /(index|position|offset)/i.test(p.name));
  if(slotIndex>=0){
    const end=[...defaults];end[slotIndex]=values.length;
    calls.push(call(end,'At end'));
  }
  if(intIndex>=0){
    const existing=[...defaults];existing[intIndex]=present[0]??absent[1];
    calls.push(call(existing,present.length?'Value already present':'Another value'));
  }
  return dedupeCalls(calls).slice(0,4);
}
function callLabel(method,args){
  const formatted=args.map((value,i)=>{
    if(method.params?.[i]?.type==='String')return JSON.stringify(value);
    return String(value);
  });
  return `${method.name}(${formatted.join(', ')})`;
}
function renderSuggestions(){
  if(!ui.suggestions)return;
  ui.suggestions.replaceChildren();
  const values=Array.isArray(savedValues)?savedValues:[];
  if(!discovered.size){
    const p=document.createElement('p');p.className='suggestions-empty';p.textContent='Waiting for Dart method discovery…';ui.suggestions.append(p);return;
  }
  let methodIndex=0;
  for(const method of discovered.values()){
    const colorIndex=methodIndex++%6;
    const row=document.createElement('div');row.className='suggestion-row';
    const title=document.createElement('div');title.className='suggestion-method';
    const name=document.createElement('strong');name.textContent=method.name;
    const signature=document.createElement('small');signature.textContent=`(${(method.params??[]).map(p=>`${p.type} ${p.name}`).join(', ')})`;
    title.append(name,signature);
    const group=document.createElement('div');group.className='suggestion-buttons';
    for(const suggestion of suggestedCalls(method,values)){
      const button=document.createElement('button');button.type='button';button.className='call-suggestion';
      button.textContent=callLabel(method,suggestion.args);
      button.dataset.methodColor=String(colorIndex);
      const formatArg=(arg,i)=>{
        const text=method.params?.[i]?.type==='String'?JSON.stringify(arg):String(arg);
        const safe=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const existing=typeof arg==='number'&&values.includes(arg);
        return `<span class="argument ${existing?'present':''}">${safe}</span>`;
      };
      button.innerHTML=`<span class="call-name">${method.name}</span>(${suggestion.args.map(formatArg).join(', ')})`;
      if(suggestion.args.some(arg=>typeof arg==='number'&&values.includes(arg)))
        button.classList.add('has-present-argument');
      button.title=suggestion.hint;
      button.setAttribute('aria-label',`${button.textContent} — ${suggestion.hint}`);
      button.dataset.scenario=suggestion.hint;
      // Batch size is not the data-structure capacity. Keep suggestions usable
      // after 12 (or more) successful insertions into a persistent worker.
      button.addEventListener('click',()=>send({action:'run',method:method.name,arguments:suggestion.args}));
      group.append(button);
    }
    if(!group.children.length){const empty=document.createElement('span');empty.className='suggestions-empty';empty.textContent='Use the custom argument form for this signature.';group.append(empty);}
    row.append(title,group);ui.suggestions.append(row);
  }
}

ui.reset.addEventListener('click',()=>send({action:'reset'}));
// The browser connection is not the Dart process. Workspace proxies may close
// idle WebSockets even while Dart keeps listening. Reconnect without discarding
// the student's saved list, trace, or current playback position.
function connect(){
  if(stopped)return;
  const protocol=location.protocol==='https:'?'wss:':'ws:';
  ui.connection.textContent=reconnectAttempt?'Reconnecting…':'Connecting…';
  const ws=new WebSocket(`${protocol}//${location.host}/ws`);
  socket=ws;
  ws.addEventListener('open',()=>{
    reconnectAttempt=0;initializedCatalog=false;
    ui.connection.textContent='Connected';
    clearInterval(heartbeat);
    // Application-level heartbeats survive proxies that drop idle WS traffic.
    heartbeat=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({action:'ping'}));},15000);
  });
  ws.addEventListener('message',msg=>{
    try{
      const data=JSON.parse(msg.data);
      if(data.type==='pong')return;
      if(data.type==='sourceFile'||data.type==='sourceSaved'||data.type==='sourceError'){
        window.sandboxEditor?.receive(data);return;
      }
      if(data.type.startsWith('validation')){validationMessage(data);return;}
      if(data.type==='catalog'){receiveCatalog(data);return;}
      if(data.type==='building'||data.type==='sourceChanged'){
        if(data.type==='sourceChanged')window.sandboxEditor?.sourceChanged();
        resetValidation('Implementation changed; previous test results are outdated.');
        showCompiling(data.type==='building'&&data.recompiling===true);
        ui.cmdStatus.textContent=data.message+' Previous trace may be out of date.';
        ui.connection.textContent=data.type==='building'&&data.recompiling===true?
          'Recompiling…':'Starting…';return;
      }
      if(data.type==='error'){
        showCompiling(false);
        focusAfterCommand=false;ui.cmdStatus.textContent=data.message;ui.cmdStatus.classList.add('error');return;
      }
      if(data.type==='hello'){
        window.sandboxEditor?.ready();
        validationUI.button.disabled=false;
        validationUI.rerun.disabled=false;
        showCompiling(false);
        const initial=data.trace;
        if(data.student)selectedStudent=data.student;rememberChoice();
        restoreValidation(data.validationRevision);
        if(savedValues===null){acceptTrace(initial);return;}
        if(savedSessionId===(initial.sessionId??null) && JSON.stringify(savedValues)===JSON.stringify(initial.values)){
          ui.connection.textContent='Connected';return;
        }
        acceptTrace(initial);
        ui.cmdStatus.textContent='Dart session restarted; current list has been reset.';
        return;
      }
      if(data.type==='trace')acceptTrace(data);
    }catch(error){ui.cmdStatus.textContent=`Invalid response: ${error.message}`;
      ui.cmdStatus.classList.add('error');console.error(error);}
  });
  ws.addEventListener('close',event=>{
    if(socket!==ws)return;
    clearInterval(heartbeat);heartbeat=null;
    socket=null;
    if(stopped)return;
    showCompiling(false);
    resetValidation('Connection lost; run the tests again after reconnecting.');
    ui.connection.textContent='Connection lost · reconnecting…';
    console.warn('Dart WebSocket closed',event.code,event.reason||'');
    const delay=Math.min(5000,400*Math.pow(1.8,reconnectAttempt++));
    clearTimeout(reconnectTimer);reconnectTimer=setTimeout(connect,delay);
  });
  ws.addEventListener('error',()=>{
    showCompiling(false);
    if(socket===ws)ui.connection.textContent='Connection interrupted…';
    // The `close` handler performs the actual reconnection.
  });
}
window.addEventListener('beforeunload',()=>{stopped=true;clearTimeout(reconnectTimer);clearInterval(heartbeat);});
connect();
sync();
updatePlaybackButtons();

// v1.0: structure-specific renderers consume the same operation/source timeline.
// A tree changes left/right pointers; a fixed array changes indexed cells.
function treeLayout(snapshot){
  const byId=new Map(snapshot.nodes.map(n=>[n.id,n]));
  const targets=new Map(),seen=new Set();
  // A fixed halving offset eventually places cousins on top of each other:
  // 220, 110, 55, 40, 40 ... is not enough for broad/deep AVL subtrees.
  // Measure each subtree's left/right contour at every depth (in logical SVG
  // units), then move siblings apart ONLY as much as required. This is a tidy
  // tree layout: circles at the same depth never collide, even beyond the
  // fixed scene width. Keep the root centred and retain stable node IDs.
  const MIN_SIBLING_GAP=94; // 72px circle + 22px breathing room.
  const BASE_CHILD_OFFSET=72;
  const profiles=new Map();
  const pending=[{id:snapshot.root,finished:false}];
  const discovered=new Set();
  while(pending.length){
    const {id,finished}=pending.pop();
    if(id==null||!byId.has(id))continue;
    if(!finished){
      if(discovered.has(id))continue; // malformed cyclic/shared trees
      discovered.add(id);
      pending.push({id,finished:true});
      const node=byId.get(id);
      pending.push({id:node.right,finished:false});
      pending.push({id:node.left,finished:false});
      continue;
    }
    const node=byId.get(id),left=profiles.get(node.left),right=profiles.get(node.right);
    let dxLeft=left?-BASE_CHILD_OFFSET:0;
    let dxRight=right?BASE_CHILD_OFFSET:0;
    if(left&&right){
      // Each contour entry is a horizontal EXTENT, not an inorder index.
      // Checking all common levels prevents descendants of different parent
      // nodes from overlapping, even if their direct children have room.
      let required=MIN_SIBLING_GAP;
      const sharedDepth=Math.min(left.max.length,right.min.length);
      for(let d=0;d<sharedDepth;d++){
        required=Math.max(required,left.max[d]-right.min[d]+MIN_SIBLING_GAP);
      }
      const extra=Math.max(0,(required-(dxRight-dxLeft))/2);
      dxLeft-=extra;dxRight+=extra;
    }
    const min=[0],max=[0];
    for(const [child,dx] of [[left,dxLeft],[right,dxRight]]){
      if(!child)continue;
      for(let d=0;d<child.min.length;d++){
        const level=d+1,lo=child.min[d]+dx,hi=child.max[d]+dx;
        min[level]=min[level]===undefined?lo:Math.min(min[level],lo);
        max[level]=max[level]===undefined?hi:Math.max(max[level],hi);
      }
    }
    profiles.set(id,{min,max,dxLeft,dxRight});
  }
  const centre=SCENE_WIDTH/2;
  const positions=[{id:snapshot.root,depth:0,cx:centre}];
  while(positions.length){
    const {id,depth,cx}=positions.pop();
    if(id==null||seen.has(id)||!byId.has(id))continue;
    seen.add(id);
    targets.set(id,{x:cx-TREE_RADIUS,y:155+depth*90,opacity:1,detached:false});
    const node=byId.get(id),profile=profiles.get(id);
    if(profile){
      positions.push({id:node.right,depth:depth+1,cx:cx+profile.dxRight});
      positions.push({id:node.left,depth:depth+1,cx:cx+profile.dxLeft});
    }
  }
  let orphan=0;
  for(const item of snapshot.nodes){
    if(targets.has(item.id))continue;
    const previous=nodes.get(item.id),pending=!previous?.wasReachable;
    targets.set(item.id,{x:previous?.x??centre-TREE_RADIUS+orphan*90,
      y:pending?90:530,opacity:pending?1:.32,detached:!pending});orphan++;
  }
  // Intentionally no automatic viewBox changes: zooming every recorded
  // pointer write makes an otherwise smooth rotation appear to jump. Students
  // can use Fit and then zoom/pan to examine a large tree at readable size.
  return {targets,count:seen.size,cycle:false};
}
// Tree edges connect the node centres, clipped to their circular outlines.
// A relaxed tree always has straight edges; a modest Bezier bend is used ONLY
// during pointer changes and node settling, then fades back to a line.
const TREE_RADIUS=36;
let treeEdgeMotion=0;
function treeCentre(node){return {x:node.x+TREE_RADIUS,y:node.y+TREE_RADIUS};}
function drawTreeEdge(group,fromCentre,toCentre,targetRadius=TREE_RADIUS,side='left'){
  const dx=toCentre.x-fromCentre.x,dy=toCentre.y-fromCentre.y;
  const length=Math.hypot(dx,dy);
  if(length<.001){group.setAttribute('visibility','hidden');return;}
  const ux=dx/length,uy=dy/length;
  const start={x:fromCentre.x+ux*(TREE_RADIUS+1),y:fromCentre.y+uy*(TREE_RADIUS+1)};
  const tip={x:toCentre.x-ux*(targetRadius+1),y:toCentre.y-uy*(targetRadius+1)};
  const span=Math.hypot(tip.x-start.x,tip.y-start.y);
  if(span<14){group.setAttribute('visibility','hidden');return;}
  group.setAttribute('visibility','visible');
  const headLength=Math.min(11,span*.4);
  const base={x:tip.x-ux*headLength,y:tip.y-uy*headLength};
  const left={x:base.x-uy*5.2,y:base.y+ux*5.2};
  const right={x:base.x+uy*5.2,y:base.y-ux*5.2};
  const bend=Math.min(28,span*.17)*treeEdgeMotion*(side==='left'?-1:1);
  const c1={x:start.x+(base.x-start.x)*.36-uy*bend,
            y:start.y+(base.y-start.y)*.36+ux*bend};
  // Keep the endpoint tangent collinear with the centre-to-centre vector so
  // the filled triangular tip lands precisely on the target's circular rim.
  const c2={x:base.x-ux*Math.min(20,span*.2),y:base.y-uy*Math.min(20,span*.2)};
  const shaft=treeEdgeMotion<.001
    ?`M ${fmt(start.x)} ${fmt(start.y)} L ${fmt(base.x)} ${fmt(base.y)}`
    :`M ${fmt(start.x)} ${fmt(start.y)} C ${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(base.x)} ${fmt(base.y)}`;
  group.querySelector('.arrow-shaft').setAttribute('d',shaft);
  group.querySelector('.arrow-tip').setAttribute('points',
    `${fmt(tip.x)},${fmt(tip.y)} ${fmt(left.x)},${fmt(left.y)} ${fmt(right.x)},${fmt(right.y)}`);
}
function treeTargetPoint(id,field,source){
  if(id!=null && nodes.has(id)){
    const c=treeCentre(nodes.get(id));
    const dx=c.x-source.x,dy=c.y-source.y,d=Math.hypot(dx,dy)||1;
    return {x:c.x-dx/d*(TREE_RADIUS+1),y:c.y-dy/d*(TREE_RADIUS+1)};
  }
  return {x:source.x+(field==='left'?-95:95),y:source.y+95};
}
function renderTreeEdges(){
  const active=new Set();
  for(const node of nodes.values()){
    for(const field of ['left','right']){
      const key=`${node.id}:${field}`,name=`node:${node.id}.${field}`;
      const event=override?.from===name?override:null;
      const source=treeCentre(node);
      const to=event?.x!=null?{x:event.x,y:event.y}:
        (node[field]!=null&&nodes.has(node[field])?treeCentre(nodes.get(node[field])):null);
      if(!to)continue;
      active.add(key);
      let edge=links.get(key);if(!edge){edge=makeArrow('edge');ui.edges.append(edge);links.set(key,edge);}
      drawTreeEdge(edge,source,to,event?0:TREE_RADIUS,field);
      edge.setAttribute('opacity',Math.min(1,node.opacity*(nodes.get(node[field])?.opacity??1)).toFixed(3));
      edge.classList.toggle('hot',hotLink===name);
    }
  }
  for(const [key,edge] of links)if(!active.has(key)){edge.remove();links.delete(key);}
}
function retireNodes(ids){
  for(const id of ids){nodes.delete(id);nodeViews.get(id)?.remove();nodeViews.delete(id);}
  renderAll();
}
async function animateRetire(ids,snapshot){
  references={}; // The method has returned: local variables are out of scope.
  ui.phase.textContent='UNREACHABLE';ui.status.textContent='No remaining references: detached objects fade from the diagram.';
  const beginning=ids.map(id=>({id,node:nodes.get(id),y:nodes.get(id)?.y??0,opacity:nodes.get(id)?.opacity??0}));
  await tween(520,t=>{
    for(const {node,y,opacity} of beginning){if(!node)continue;node.y=lerp(y,y+45,t);node.opacity=lerp(opacity,0,t);node.detached=true;}
    renderAll();
  });
  retireNodes(ids);applySnapshot(snapshot);
}
// The array row and tree use exactly the same indexed Dart storage snapshot.
// No independent browser heap model, no synthetic pointer/reference edges.
// Fixed bucket row, observed ListNode chains and actual pointer relationships.
// This view has no browser-side hash table: only the Dart snapshot is rendered.
function hashSnapshot(snapshot){
  return {buckets:[...(snapshot.buckets??[])],nodes:[...(snapshot.nodes??[])],
    size:snapshot.size??0,capacity:snapshot.capacity??snapshot.buckets?.length??8};
}
function hashChains(snapshot){
  const byId=new Map(snapshot.nodes.map(n=>[n.id,n]));
  const chains=[],seen=new Set();
  for(let index=0;index<snapshot.buckets.length;index++){
    const chain=[];let id=snapshot.buckets[index];
    while(id!=null&&byId.has(id)&&!seen.has(id)){
      seen.add(id);const node=byId.get(id);chain.push(node);id=node.next;
    }
    chains.push(chain);
  }
  return {chains,orphans:snapshot.nodes.filter(n=>!seen.has(n.id))};
}
function autoFrameHash(steps,force=false){
  if(structure!=='hash'||(!force&&cameraMode!=='auto'))return;
  const snapshots=steps.filter(s=>s.kind==='snapshot'&&Array.isArray(s.buckets));
  const depth=Math.max(0,...snapshots.map(s=>Math.max(0,...hashChains(hashSnapshot(s)).chains.map(c=>c.length))));
  const bottom=220+Math.max(0,depth-1)*112+150;
  // Every physical bucket needs its own space; fit BOTH the table width and
  // the longest collision chain, even when students choose >8 buckets.
  const capacity=Math.max(1,...snapshots.map(s=>s.buckets.length));
  const width=(capacity-1)*126+98+160;
  const ratio=treeSceneRatio(),required=Math.max(1100,width,(bottom+100)*ratio);
  const w=force?required:Math.max(viewport.w,required);
  viewport={x:(1100-w)/2,y:(bottom+20-w/ratio)/2,w,h:w/ratio};
  paintViewport();
}
function renderHash(){
  ui.stackView.replaceChildren();
  const state=hashState,capacity=state.buckets.length;
  const {chains,orphans}=hashChains(state);
  const occupied=chains.filter(c=>c.length>0).length;
  const center=SCENE_WIDTH/2,spacing=126; // Fixed cell width; camera fits chosen count.
  const first=center-(capacity-1)*spacing/2;
  const heading=svg('text',{x:center,y:51,class:'heap-title','text-anchor':'middle'});
  heading.textContent=`HASH TABLE · ${state.size} key${state.size===1?'':'s'} · ${occupied}/${capacity} buckets · α = ${(state.size/Math.max(1,capacity)).toFixed(2)}`;
  ui.stackView.append(heading);
  const note=svg('text',{x:center,y:80,class:'heap-section','text-anchor':'middle'});
  note.textContent='index = student hash(key, capacity) · collision chains';ui.stackView.append(note);
  for(let i=0;i<capacity;i++){
    const x=first+i*spacing,head=chains[i][0];
    ui.stackView.append(svg('rect',{x:x-49,y:106,width:98,height:61,rx:11,
      class:`hash-bucket${hashHotBucket===i?' selected':''}`}));
    const index=svg('text',{x,y:131,class:'hash-index','text-anchor':'middle'});
    index.textContent=`[${i}]`;ui.stackView.append(index);
    const key=svg('text',{x,y:153,class:'hash-key','text-anchor':'middle'});
    key.textContent=head?`#${head.id}`:'null';ui.stackView.append(key);
    if(head)ui.stackView.append(svg('line',{x1:x,y1:167,x2:x,y2:190,class:'hash-edge'}));
    for(let j=0;j<chains[i].length;j++){
      const node=chains[i][j],y=220+j*112;
      const cls=`hash-node${hashHotNode===node.id?' selected':''}`;
      ui.stackView.append(svg('rect',{x:x-43,y:y-27,width:86,height:57,rx:12,class:cls}));
      const value=svg('text',{x,y:y-1,class:'hash-value','text-anchor':'middle'});
      value.textContent=String(node.value);ui.stackView.append(value);
      const id=svg('text',{x,y:y+19,class:'hash-id','text-anchor':'middle'});
      id.textContent=`#${node.id}`;ui.stackView.append(id);
      if(j+1<chains[i].length)ui.stackView.append(svg('line',{x1:x,y1:y+30,x2:x,y2:y+85,class:'hash-edge'}));
    }
  }
  if(orphans.length){
    const y=300+Math.max(0,...chains.map(c=>c.length))*112;
    const caption=svg('text',{x:center,y:y-20,class:'heap-section','text-anchor':'middle'});
    caption.textContent='DETACHED / NEW NODES';ui.stackView.append(caption);
    orphans.forEach((node,i)=>{
      const x=center+(i-(orphans.length-1)/2)*105;
      ui.stackView.append(svg('rect',{x:x-40,y,width:80,height:45,rx:9,class:'hash-node detached'}));
      const label=svg('text',{x,y:y+27,class:'hash-value','text-anchor':'middle'});
      label.textContent=String(node.value);ui.stackView.append(label);
    });
  }
  ui.status.textContent=`${state.size} keys in ${capacity} buckets; load factor ${(state.size/Math.max(1,capacity)).toFixed(2)}.`;
}
function instantHash(frame){
  if(frame.line!=null)showLine(frame.line);
  switch(frame.kind){
    case 'operationStart':currentOperation=frame.operation;ui.operation.textContent=frame.operation;
      ui.description.textContent=frame.description??'Executing the student Dart method.';
      ui.returnValue.textContent='';hashHotBucket=null;hashHotNode=null;break;
    case 'bucketRead':hashHotBucket=frame.index;hashHotNode=frame.to;break;
    case 'visit':case 'compare':hashHotNode=frame.id;break;
    case 'createNode':hashState.nodes.push({...frame.node});hashHotNode=frame.node.id;break;
    case 'writeAndSettle':case 'memoryWriteAndSettle':
      hashState=hashSnapshot(frame.snapshot);
      hashHotBucket=frame.index??null;
      hashHotNode=frame.to??(Number(/^node:(\d+)/.exec(frame.from??'')?.[1])||null);
      break;
    case 'snapshot':hashState=hashSnapshot(frame.snapshot);hashHotBucket=null;hashHotNode=null;break;
    case 'retireAndSettle':hashState=hashSnapshot(frame.snapshot);hashHotBucket=null;hashHotNode=null;break;
    case 'operationEnd':hashHotBucket=null;hashHotNode=null;
      showReturnValue(frame);
      ui.phase.textContent=frame.ok?'DONE':'CHECK FAILED';ui.result.textContent=frame.result;showLine(null);break;
  }
  renderHash();
}
async function animateHash(frame){
  instantHash(frame);
  if(frame.kind==='bucketRead'){
    ui.phase.textContent='BUCKET READ';ui.status.textContent=`Inspect bucket [${frame.index}]`;
    await tween(180,()=>{});
  }else if(frame.kind==='visit'||frame.kind==='compare'){
    ui.phase.textContent='CHAIN TRAVERSAL';await tween(190,()=>{});
  }else if(frame.kind==='writeAndSettle'||frame.kind==='memoryWriteAndSettle'){
    ui.phase.textContent='REFERENCE WRITE';await tween(420,()=>{});
  }else if(frame.kind==='createNode'){
    ui.phase.textContent='NEW NODE';await tween(220,()=>{});
  }
}

function heapSnapshot(snapshot){
  return {cells:[...(snapshot.cells??[])],heapOrder:snapshot.heapOrder!==false};
}
function heapArrayRows(n){return Math.ceil(Math.max(1,n)/10);}
function heapTreeTop(n){return 350+(heapArrayRows(n)-1)*78;}
function heapTreeWidth(n){
  if(!n)return 880;
  const deepest=Math.floor(Math.log2(n));
  return Math.max(880,Math.pow(2,deepest)*78);
}
function heapTreePosition(i,n){
  const level=Math.floor(Math.log2(i+1));
  const offset=i-(Math.pow(2,level)-1);
  return {x:SCENE_WIDTH/2+((offset+.5)/Math.pow(2,level)-.5)*heapTreeWidth(n),
    y:heapTreeTop(n)+level*100};
}
function autoFrameHeap(steps,force=false){
  if(structure!=='array_heap'||(!force&&cameraMode!=='auto'))return;
  const sizes=steps.filter(frame=>frame.kind==='snapshot'&&Array.isArray(frame.cells))
    .map(frame=>frame.cells.length);
  const n=force?(sizes.at(-1)??0):Math.max(0,...sizes);
  const ratio=treeSceneRatio(),width=heapTreeWidth(n);
  const depth=n?Math.floor(Math.log2(n)):0;
  const bottom=heapTreeTop(n)+depth*100+105;
  const required=Math.max(SCENE_WIDTH,width+160,bottom*ratio);
  const w=force?required:Math.max(viewport.w,required),h=w/ratio;
  viewport={x:(SCENE_WIDTH-w)/2,y:(bottom-h)/2-30,w,h};
  paintViewport();
}
function renderHeap(){
  ui.stackView.replaceChildren();
  const cells=heapState.cells,n=cells.length,highlight=new Set(heapHot);
  const heading=svg('text',{x:SCENE_WIDTH/2,y:70,class:'heap-title','text-anchor':'middle'});
  heading.textContent=`MIN-HEAP · ${n} element${n===1?'':'s'}${heapState.heapOrder?'':' · HEAP ORDER VIOLATED'}`;
  ui.stackView.append(heading);
  const arrayHeading=svg('text',{x:SCENE_WIDTH/2,y:105,class:'heap-section','text-anchor':'middle'});
  arrayHeading.textContent='ARRAY STORAGE · index i';ui.stackView.append(arrayHeading);
  const count=n;
  for(let i=0;i<count;i++){
    const row=Math.floor(i/10),col=i%10,cols=Math.min(10,count-row*10);
    const x=SCENE_WIDTH/2-(cols*86-10)/2+col*86,y=122+row*78;
    const cls=`memory-cell heap-cell${highlight.has(i)?' selected':''}`;
    ui.stackView.append(svg('rect',{x,y,width:76,height:52,rx:7,class:cls}));
    const value=svg('text',{x:x+38,y:y+32,class:'heap-cell-value','text-anchor':'middle'});
    value.textContent=String(cells[i]);ui.stackView.append(value);
    const index=svg('text',{x:x+38,y:y+68,class:'memory-index','text-anchor':'middle'});
    index.textContent=`[${i}]`;ui.stackView.append(index);
  }
  const top=heapTreeTop(n);
  const label=svg('text',{x:SCENE_WIDTH/2,y:top-55,class:'heap-section','text-anchor':'middle'});
  label.textContent='SAME ARRAY · binary-tree projection';ui.stackView.append(label);
  // Edges are index relationships, never references. Both projections show
  // exactly cells[i], including duplicate values at different indices.
  for(let i=1;i<n;i++){
    const parent=heapTreePosition((i-1)>>1,n),child=heapTreePosition(i,n);
    ui.stackView.append(svg('line',{x1:parent.x,y1:parent.y+22,x2:child.x,y2:child.y-22,class:'heap-index-edge'}));
  }
  for(let i=0;i<n;i++){
    const {x,y}=heapTreePosition(i,n);
    const cls=`heap-node${highlight.has(i)?' heap-hot':''}`;
    ui.stackView.append(svg('circle',{cx:x,cy:y,r:27,class:cls}));
    const value=svg('text',{x,y:y+2,class:'heap-node-value','text-anchor':'middle'});
    value.textContent=String(cells[i]);ui.stackView.append(value);
    const index=svg('text',{x,y:y+17,class:'heap-node-index','text-anchor':'middle'});
    index.textContent=`[${i}]`;ui.stackView.append(index);
  }
  ui.status.textContent=n?`The same ${n} indexed values appear in the array and tree.`:
    'The heap is empty. Insert a value to begin.';
}
function instantHeap(frame){
  if(frame.line!=null)showLine(frame.line);
  switch(frame.kind){
    case 'operationStart':currentOperation=frame.operation;ui.operation.textContent=currentOperation;
      ui.returnValue.textContent='';ui.result.textContent='Running…';heapHot=[];break;
    case 'heapRead':heapHot=[frame.index];break;
    case 'memoryWriteAndSettle':heapState=heapSnapshot(frame.snapshot);
      heapHot=frame.a!=null?[frame.a,frame.b]:[frame.index];break;
    case 'snapshot':heapState=heapSnapshot(frame.snapshot);heapHot=[];break;
    case 'operationEnd':heapHot=[];showReturnValue(frame);
      ui.phase.textContent=frame.ok?'DONE':'CHECK FAILED';ui.result.textContent=frame.result;showLine(null);break;
  }
  renderHeap();
}
async function animateHeap(frame){
  instantHeap(frame);
  if(frame.kind==='heapRead'){
    ui.phase.textContent='ARRAY READ';ui.status.textContent=`Read cells[${frame.index}] = ${frame.value}`;
    await tween(180,()=>{});
  }else if(frame.kind==='memoryWriteAndSettle'){
    ui.phase.textContent=frame.a!=null?'SWAP TWO INDICES':frame.kind==='heapRemove'?'REMOVE LAST CELL':'ARRAY WRITE';
    ui.status.textContent=frame.a!=null?`Swap cells[${frame.a}] ↔ cells[${frame.b}]`:
      `Array index ${frame.index} changed. Both projections show the same cell.`;
    await tween(440,()=>{});
  }
}
function renderStack(){
  ui.stackView.replaceChildren();
  const cells=stackState.cells??[];
  // Centre the entire memory strip. The top label and arrow share its x.
  const w=94,start=(SCENE_WIDTH-((cells.length-1)*w+80))/2,y=235;
  // The label and arrow are one index indicator, centred over the active cell.
  // For an empty stack there is no arrow to an element.
  const topX=start+Math.max(stackState.top,0)*w+40;
  const index=svg('text',{x:topX,y:169,class:'stack-label','text-anchor':'middle'});
  index.textContent=stackState.top<0?'top = -1 (empty)':`top = ${stackState.top}`;
  ui.stackView.append(index);
  for(let i=0;i<cells.length;i++){
    const x=start+i*w;
    const rect=svg('rect',{x,y,width:80,height:65,rx:8,class:i===stackState.top?'memory-cell selected':'memory-cell'});
    const text=svg('text',{x:x+40,y:y+38,class:'memory-value'});
    text.textContent=cells[i]===null?'·':String(cells[i]);
    const label=svg('text',{x:x+40,y:y+82,class:'memory-index'});label.textContent=`[${i}]`;
    ui.stackView.append(rect,text,label);
    if(i===stackState.top){
      const arrow=makeArrow('ref-arrow');drawArrow(arrow,{x:topX,y:178},{x:topX,y:y-3},'straight');
      ui.stackView.append(arrow);
    }
  }
}
// Circular queue: memory cells NEVER move. The front marker points at the
// next element to remove; rear points at the next cell to write. Their labels
// and arrows occupy different sides even when both indices are equal.
function queueSnapshot(snapshot){
  return {cells:[...(snapshot.cells??[])],front:snapshot.front??0,
    rear:snapshot.rear??0,size:snapshot.size??0};
}
function renderQueue(){
  ui.stackView.replaceChildren();
  const {cells,front,rear,size}=queueState;
  if(!cells.length)return;
  const w=94, y=235, start=(SCENE_WIDTH-((cells.length-1)*w+80))/2;
  const valid=size>=0 && size<=cells.length && front>=0 && front<cells.length &&
    rear>=0 && rear<cells.length;
  const status=svg('text',{x:SCENE_WIDTH/2,y:100,class:'queue-size','text-anchor':'middle'});
  status.textContent=`size = ${size} / ${cells.length}${!valid?' · INVALID':size===0?' · EMPTY':size===cells.length?' · FULL':''}`;
  ui.stackView.append(status);
  for(let i=0;i<cells.length;i++){
    const x=start+i*w;
    // A wrapped queue uses physical indices, not a sliding logical row.
    const distance=valid?(i-front+cells.length)%cells.length:-1;
    const occupied=distance>=0 && distance<size;
    const classes=['memory-cell'];
    if(occupied)classes.push('queue-occupied');
    if(occupied&&i===front)classes.push('queue-front');
    if(i===rear)classes.push('queue-rear');
    const rect=svg('rect',{x,y,width:80,height:65,rx:8,class:classes.join(' ')});
    const value=svg('text',{x:x+40,y:y+38,class:'memory-value'});
    value.textContent=cells[i]===null?'·':String(cells[i]);
    const index=svg('text',{x:x+40,y:y+82,class:'memory-index'});
    index.textContent=`[${i}]`;
    ui.stackView.append(rect,value,index);
    if(occupied){
      const ordinal=svg('text',{x:x+40,y:220,class:'queue-order','text-anchor':'middle'});
      ordinal.textContent=String(distance+1);
      ui.stackView.append(ordinal);
    }
  }
  function indicator(name,position,above){
    if(!Number.isInteger(position)||position<0||position>=cells.length)return;
    const x=start+position*w+40;
    const label=svg('text',{x,y:above?164:385,
      class:`queue-indicator ${name}`,'text-anchor':'middle'});
    label.textContent=`${name} = ${position}`;
    const arrow=makeArrow(`ref-arrow queue-${name}`);
    drawArrow(arrow,above?{x,y:174}:{x,y:365},
      above?{x,y:y-3}:{x,y:y+65+3},'straight');
    ui.stackView.append(label,arrow);
  }
  indicator('front',front,true);
  indicator('rear',rear,false);
}
function instantQueue(frame){
  if(frame.line!=null)showLine(frame.line);
  switch(frame.kind){
    case 'operationStart':currentOperation=frame.operation;ui.operation.textContent=currentOperation;
      ui.returnValue.textContent='';ui.result.textContent='Running…';break;
    case 'memoryWriteAndSettle':case 'snapshot':queueState=queueSnapshot(frame.snapshot);break;
    case 'operationEnd':showReturnValue(frame);
      ui.phase.textContent=frame.ok?'DONE':'CHECK FAILED';ui.result.textContent=frame.result;showLine(null);break;
  }
  renderQueue();
}
async function animateQueue(frame){
  if(frame.kind==='memoryWriteAndSettle'){
    ui.phase.textContent='CIRCULAR QUEUE WRITE';
    ui.status.textContent=frame.index!=null?
      `memory[${frame.index}]: ${String(frame.oldValue)} → ${String(frame.value)}`:
      `${frame.name}: ${frame.oldValue} → ${frame.value}`;
    // Render the exact recorded intermediate marker and cell state. No moving
    // array cells, no relayout, including during wraparound or backward seek.
    queueState=queueSnapshot(frame.snapshot);renderQueue();
    await tween(420,()=>{});return;
  }
  instantQueue(frame);
}
function instantStack(frame){
  if(frame.line!=null)showLine(frame.line);
  switch(frame.kind){
    case 'operationStart':currentOperation=frame.operation;ui.operation.textContent=currentOperation;ui.returnValue.textContent='';ui.result.textContent='Running…';break;
    case 'memoryWriteAndSettle':case 'snapshot':
      stackState={cells:[...frame.snapshot.cells],top:frame.snapshot.top};break;
    case 'operationEnd':showReturnValue(frame);
      ui.result.textContent=frame.result;showLine(null);break;
  }
  renderStack();
}
async function animateStack(frame){
  if(frame.kind==='memoryWriteAndSettle'){
    ui.phase.textContent=frame.from?'MEMORY':'ARRAY WRITE';
    ui.status.textContent=frame.index!=null?`memory[${frame.index}]: ${String(frame.oldValue)} → ${String(frame.value)}`:
      `top: ${frame.oldValue} → ${frame.value}`;
    // Fixed memory cells never move: only cell contents and top index change.
    stackState={cells:[...frame.snapshot.cells],top:frame.snapshot.top};renderStack();
    await tween(420,()=>{});return;
  }
  instantStack(frame);
  if(frame.kind==='operationEnd')ui.phase.textContent='DONE';
}

// The four trace-navigation buttons form one semantic and visual group.
// Moving their existing DOM nodes preserves their listeners and shortcuts.
if(ui.first.parentNode){
  const navigation=document.createElement('div');
  navigation.className='step-controls';
  navigation.setAttribute('role','group');
  navigation.setAttribute('aria-label','Trace navigation');
  ui.first.parentNode.insertBefore(navigation,ui.first);
  navigation.append(ui.first,ui.back,ui.next,ui.last);
}
// Animate button-driven camera moves; wheel and pointer dragging stay direct.
ui.zoomIn.addEventListener('click',()=>animateCamera(()=>zoomScene(1/1.35)));
ui.zoomOut.addEventListener('click',()=>animateCamera(()=>zoomScene(1.35)));
ui.fitScene.addEventListener('click',()=>animateCamera(fitScene));
ui.scene.addEventListener('wheel',event=>{
  event.preventDefault();
  cameraAnimationId++;
  zoomScene(event.deltaY>0?1.12:1/1.12,event.clientX,event.clientY);
},{passive:false});
let dragging=null;
ui.scene.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  cameraAnimationId++;
  dragging={id:event.pointerId,x:event.clientX,y:event.clientY};
  ui.scene.setPointerCapture?.(event.pointerId);
});
ui.scene.addEventListener('pointermove',event=>{
  if(!dragging||event.pointerId!==dragging.id)return;
  const rect=ui.scene.getBoundingClientRect();
  if(rect.width>0&&rect.height>0){
    cameraMode='manual';
    viewport.x-=(event.clientX-dragging.x)*viewport.w/rect.width;
    viewport.y-=(event.clientY-dragging.y)*viewport.h/rect.height;
    paintViewport();
  }
  dragging.x=event.clientX;dragging.y=event.clientY;
});
function finishPan(event){
  if(dragging?.id===event.pointerId){dragging=null;ui.scene.releasePointerCapture?.(event.pointerId);}
}
ui.scene.addEventListener('pointerup',finishPan);
ui.scene.addEventListener('pointercancel',finishPan);
ui.retry.addEventListener('click',()=>{
  // Restarting the same implementation must not discard an unsaved draft.
  savedValues=null;selectImplementation();
});
ui.student.addEventListener('change',()=>{
  if(window.sandboxEditor && !window.sandboxEditor.beforeSelection()){
    ui.student.value=selectedStudent;return;
  }
  selectedStudent=ui.student.value;
  updateStructures();
  animationGeneration++;animating=false;playbackToken++;frames=[];rawSteps=[];savedValues=null;
  clearView();sync();selectImplementation();
});
ui.structure.addEventListener('change',()=>{
  if(window.sandboxEditor && !window.sandboxEditor.beforeSelection()){
    ui.structure.value=structure;return;
  }
  structure=ui.structure.value;
  animationGeneration++;animating=false;playbackToken++;frames=[];rawSteps=[];savedValues=null;
  clearView();sync();ui.cmdStatus.textContent='Switching structure…';
  selectImplementation();
});
function commandParts(text){
  const match=/^\s*([A-Za-z_]\w*)\s*\((.*)\)\s*;?\s*$/.exec(text);
  if(!match)throw Error('Enter a method call, e.g. contains(7) or push(5).');
  const descriptor=discovered.get(match[1]);
  if(!descriptor)throw Error(`Method ${match[1]} is not available for this structure.`);
  const raw=match[2].trim();
  const values=raw?JSON.parse(`[${raw}]`):[];
  const params=descriptor.params??[];
  if(values.length!==params.length)throw Error(`Expected ${params.length} arguments.`);
  const arguments_=values.map((value,i)=>{
    if(params[i].type==='int'&&(!Number.isSafeInteger(value)||Math.abs(value)>999))throw Error('Use integers from -999 to 999.');
    if(params[i].type==='bool'&&typeof value!=='boolean')throw Error('Use true or false.');
    if(params[i].type==='String'&&typeof value!=='string')throw Error('Use a quoted string.');
    if(params[i].type==='double'&&(typeof value!=='number'||!Number.isFinite(value)))throw Error('Use a finite number.');
    return value;
  });
  return {action:'run',method:match[1],arguments:arguments_};
}
ui.callForm.addEventListener('submit',event=>{
  event.preventDefault();
  try{send(commandParts(ui.callInput.value));}catch(error){ui.cmdStatus.textContent=error.message;ui.cmdStatus.classList.add('error');}
});
