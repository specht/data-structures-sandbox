'use strict';
const {appSource, loadApp} = require('./helpers/browser');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('web/index.html','utf8');
const host=fs.readFileSync('tool/host.dart','utf8');
const worker=fs.readFileSync('lib/worker/session.dart','utf8');
const diagnostics=fs.readFileSync('lib/trace_budget.dart','utf8');

for(const id of ['runtime-console','console-toggle','console-output','console-clear'])
  assert.match(html,new RegExp(`id="${id}"`),`Missing ${id}`);
assert.match(worker,/ZoneSpecification\(print:/,'Student print() must be captured safely.');
assert.match(worker,/'type': ?'studentOutput'/);
assert.match(worker,/'type': ?'executionProgress'/);
assert.match(worker,/'type': ?'executionError'/);
assert.match(host,/class StudentExecutionTimeout/);
assert.match(host,/Last active source line/);
assert.match(diagnostics,/ExecutionDiagnostics\.atLine\(line,\s*_events\.length\)/);

class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};
    this.style={};this.value='1';this.textContent='';this.hidden=false;this.disabled=false;
    this.className='';this.classList={add:n=>this._class(n,true),remove:n=>this._class(n,false),
      toggle:(n,on)=>this._class(n,on),contains:n=>(this.attrs.class||'').split(' ').includes(n)};}
  _class(name,on){const set=new Set((this.attrs.class||'').split(' ').filter(Boolean));
    if(on)set.add(name);else set.delete(name);this.attrs.class=[...set].join(' ');}
  setAttribute(k,v){this.attrs[k]=String(v)} getAttribute(k){return this.attrs[k]??null}
  append(...children){this.children.push(...children)} replaceChildren(...children){this.children=children}
  addEventListener(name,fn){this[`on${name}`]=fn} focus(){} remove(){}
  querySelectorAll(selector){const found=[];const visit=node=>{for(const child of node.children||[]){
    if(selector.startsWith('.')&&child.classList?.contains(selector.slice(1)))found.push(child);visit(child);}};
    visit(this);return found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null}
}
const elements=new Map();
const document={
  getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);},
  createElementNS:(_,tag)=>new Element(tag),createElement:tag=>new Element(tag),
  createTextNode:text=>({textContent:text}),addEventListener(){},querySelectorAll(){return [];},
};
const context=vm.createContext({document,console,location:{protocol:'http:',host:'localhost'},
  window:{addEventListener(){}},WebSocket:class{static OPEN=1;addEventListener(){}send(){}},
  setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},
  performance:{now:()=>0},requestAnimationFrame(){},HTMLInputElement:class{},
  HTMLTextAreaElement:class{},HTMLSelectElement:class{},HTMLButtonElement:class{}});
loadApp(context);
const run=source=>vm.runInContext(source,context);

const initial={kind:'snapshot',cells:[null,null,null,null],top:-1};
const filled={kind:'snapshot',cells:[7,null,null,null],top:0};
run(`structure='stack';acceptTrace(${JSON.stringify({
  type:'trace',structure:'stack',source:{file:'my_array_stack.dart',lines:Array(20).fill('// source')},
  steps:[initial,
    {kind:'operationStart',operation:'push(7)',line:8},
    {kind:'line',line:10},
    {kind:'cellWrite',index:0,oldValue:null,value:7,line:10},filled,
    {kind:'line',line:12},
    {kind:'operationEnd',ok:true,value:true,result:'done',line:12}],
  values:[7],capacity:4,
  console:[
    {kind:'stdout',text:'before write',line:10,traceIndex:2},
    {kind:'stdout',text:'returning',line:12,traceIndex:5},
  ],
})})`);
assert.equal(elements.get('console-output').children[0].textContent,
  'No console output at this step. Step forward to reveal it.');
run('jumpTo(1)');
assert.equal(run('runtimeConsoleEntries.filter(entry=>entry.traceIndex<=consoleTraceBoundary()).length'),0);
run('jumpTo(2)');
assert.equal(run('runtimeConsoleEntries.filter(entry=>entry.traceIndex<=consoleTraceBoundary()).length'),1);
assert.equal(elements.get('console-count').textContent,'1/2');
run('jumpTo(frames.length)');
assert.equal(elements.get('console-count').textContent,'2');
assert.match(elements.get('console-output').children[1].children[1].textContent,/returning/);
run('jumpTo(1)');
assert.equal(run('runtimeConsoleEntries.filter(entry=>entry.traceIndex<=consoleTraceBoundary()).length'),0,
  'Rewinding must hide console output from later trace steps.');
assert.equal(elements.get('console-count').textContent,'0/2');

run(`setRuntimeConsole([],{kind:'timeout',message:'Student code timed out after 4 seconds.',line:17},
  {autoExpand:true,forceVisible:true})`);
assert.equal(elements.get('console-count').textContent,'1');
assert.match(elements.get('console-output').children[0].children[1].textContent,/Timed out at line 17/);

run(`acceptExecutionError(${JSON.stringify({
  type:'executionError',structure:'stack',
  source:{file:'my_array_stack.dart',lines:Array(20).fill('// source')},
  steps:[initial,{kind:'operationStart',operation:'push(7)',line:8},
    {kind:'line',line:14},{kind:'executionError',message:'RangeError',line:14}],
  values:[],capacity:4,
  error:{kind:'runtime',message:'RangeError',line:14,traceIndex:3},
})})`);
assert.equal(run('stepIndex'),run('frames.length'),
  'A failed run should open at its synchronized error step.');
assert.equal(elements.get('console-count').textContent,'2');
assert.match(elements.get('console-output').children[0].children[1].textContent,/Timed out at line 17/,
  'Earlier console entries must remain visible across commands.');
assert.match(elements.get('console-output').children[1].children[1].textContent,/Runtime error at line 14/);
assert.equal(elements.get('command-status').classList.contains('error'),false,
  'The command bar must not duplicate the detailed runtime error in red.');
assert.equal(elements.get('command-status').textContent,'Execution stopped. The details are in the Console.');

run(`discovered=new Map([
  ['push',{name:'push',params:[{name:'value',type:'int'}]}],
  ['pop',{name:'pop',params:[]}],
  ['contains',{name:'contains',params:[{name:'value',type:'int'}]}],
]);`);
assert.deepEqual(
  JSON.parse(run(`JSON.stringify(commandRequest(${JSON.stringify(
    'push(30); push(20)\npush(10); contains(20); pop()',
  )}))`)),
  {action:'run',commands:[
    {method:'push',arguments:[30]},
    {method:'push',arguments:[20]},
    {method:'push',arguments:[10]},
    {method:'contains',arguments:[20]},
    {method:'pop',arguments:[]},
  ]},
);
run(`ui.callInput.value='push(30)';appendSequenceCall('push(20)')`);
assert.equal(elements.get('call-input').value,'push(30); push(20)','Shift+click adds a call to the field');
assert.equal(elements.get('call-input').rows,1,'A semicolon sequence should keep the toolbar compact.');
assert.equal(elements.get('call-run-label').textContent,'Run 2');
assert.deepEqual(JSON.parse(run(`JSON.stringify(callsRequest([{method:'push',arguments:[1]}],{reset:true}))`)),
  {action:'run',method:'push',arguments:[1],reset:true});

// The call history records what ran and rebuilds it after a fresh start.
const storage=new Map();
context.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),
  removeItem:key=>storage.delete(key)};
context.sent=[];
const history=()=>JSON.parse(run('JSON.stringify(callHistory.map(formatCall))'));
run(`socket.readyState=WebSocket.OPEN;socket.send=message=>globalThis.sent.push(JSON.parse(message));
  frames=[];selectedStudent='alice';structure='linked_stack';variant='';callsKind='linked_stack';
  setRebuildAfterSave(true);useHistory();
  ui.callInput.value='push(1); push(2)';ui.callInput.oninput();ui.callForm.onsubmit({preventDefault(){}});`);
assert.equal(context.sent.at(-1).commands.length,2);
assert.equal(context.sent.at(-1).reset,undefined,'Run builds on the current structure');
run(`settleRun({type:'trace',calls:{planned:2,completed:2},steps:[]})`);
assert.deepEqual(history(),['push(1)','push(2)']);
assert.deepEqual(JSON.parse(storage.get('data-structure-sandbox.v2.history'))['alice/linked_stack:'].length,2,
  'The history survives a page reload');
run(`send({action:'run',method:'push',arguments:[3]});settleRun({type:'trace',steps:[{kind:'operationEnd',ok:true}]})`);
run(`send({action:'run',commands:[{method:'push',arguments:[4]},{method:'pop',arguments:[]}]});
  settleRun({type:'trace',calls:{planned:2,completed:1,stoppedEarly:true},steps:[]})`);
assert.deepEqual(history(),['push(1)','push(2)','push(3)','push(4)'],
  'A call whose check failed still changed the structure; the calls after it did not run');
run(`send({action:'run',method:'push',arguments:[9]});
  settleRun({type:'executionError',calls:{planned:1,completed:0,stoppedEarly:true}})`);
assert.equal(history().length,4,'A call that threw is not part of the history');
assert.equal(run('historyUI.title.textContent'),
  '4 calls since empty');

run(`commandTakesFocus=true;rebuildAfterFreshStart()`);
assert.deepEqual(JSON.parse(JSON.stringify(context.sent.at(-1).commands.map(c=>c.arguments[0]))),[1,2,3,4],
  'A fresh structure (save, restart, reload) is rebuilt from the history');
assert.equal(context.sent.at(-1).reset,undefined,'A fresh worker needs no reset');
assert.equal(run('commandTakesFocus'),false,'Rebuilding after a save keeps the focus in the editor');
assert.equal(run('showsResultOnly()'),true,'A rebuild shows its final state');
run(`settleRun({type:'trace',calls:{planned:4,completed:4},steps:[]})`);
assert.equal(history().length,4,'Rebuilding does not record the calls twice');
assert.match(elements.get('command-status').textContent,/Rebuilt from your history: 4 calls/);

// More calls than one request carries are sent in parts.
run(`setHistory(Array.from({length:25},(_,i)=>({method:'push',arguments:[i]})));rebuildAfterFreshStart()`);
assert.equal(context.sent.at(-1).commands.length,20);
run(`settleRun({type:'trace',calls:{planned:20,completed:20},steps:[]})`);
assert.equal(context.sent.at(-1).commands.length,5,'The second part follows the first');
run(`settleRun({type:'trace',calls:{planned:5,completed:5},steps:[]})`);

// A rebuild that fails waits for the next code change instead of looping.
const before=context.sent.length;
run(`rebuildAfterFreshStart();settleRun({type:'trace',calls:{planned:20,completed:3,stoppedEarly:true},steps:[]})`);
assert.equal(elements.get('command-status').classList.contains('error'),true);
assert.match(elements.get('command-status').textContent,/^push\(2\) failed its check\./,
  'A failed rebuild names the failing call');
assert.equal(run('rebuildAfterFreshStart()'),false,'No new rebuild before the code changes');
assert.equal(context.sent.length,before+1);
run('codeChanged()');
assert.equal(run('rebuildAfterFreshStart()'),true,'A saved change may fix it');
run(`abandonRun();setRebuildAfterSave(false)`);
assert.equal(run('rebuildAfterFreshStart()'),false,'Rebuild after save can be turned off');
assert.equal(storage.get('data-structure-sandbox.v2.rebuild'),'0');
run(`setRebuildAfterSave(true)`);

// Rebuild up to an earlier call; Edit as text; Reset; another implementation.
run(`setHistory([{method:'push',arguments:[1]},{method:'push',arguments:[2]},{method:'push',arguments:[3]}]);rebuildTo(2)`);
assert.deepEqual(history(),['push(1)','push(2)']);
assert.equal(context.sent.at(-1).reset,true,'Rebuilding up to a call starts from empty');
run(`settleRun({type:'trace',calls:{planned:2,completed:2},steps:[]});historyUI.copy.onclick()`);
assert.equal(elements.get('call-input').value,'push(1); push(2)');
run(`variant='recursive';useHistory()`);
assert.deepEqual(history(),[],'Each implementation has its own history');
run(`variant='';useHistory()`);
assert.deepEqual(history(),['push(1)','push(2)']);
let submitted=0;
run(`socket.readyState=WebSocket.OPEN;
  setRuntimeConsole([{kind:'stdout',text:'session output'}]);
  ui.reset.onclick()`);
assert.equal(run('runtimeConsoleEntries.length'),0,'Reset must clear the Console session history.');

// The speed slider snaps to named stops.
run(`ui.speed.value='0';showSpeed()`);
assert.equal(elements.get('speed-output').textContent,'¼×');
assert.equal(run('playbackSpeed()'),.25);
run(`ui.speed.value='5';showSpeed()`);
assert.equal(run('playbackSpeed()'),4);
assert.match(elements.get('speed').getAttribute('aria-valuetext'),/4×/);
// A failed check explains itself next to the operation.
run(`showReturnValue({ok:false,returnedVoid:true,result:'insert(5) completed, CHECK FAILED: contents [], expected [5]'})`);
assert.equal(elements.get('description').hidden,false);
assert.equal(elements.get('description').textContent,'contents [], expected [5]');
run(`showReturnValue({ok:true,returnedVoid:false,value:[1,2],result:'inorder() ⇒ [1, 2], checked'})`);
assert.equal(elements.get('description').hidden,true);
// Traversal visits are numbered per node (a node visited twice keeps both).
run(`resetTreeVisitDisplay();recordTreeVisit(40,1);recordTreeVisit(20,2);recordTreeVisit(40,1)`);
assert.equal(run(`treeVisitOrder.get(1).join(',')`),'1,3');
assert.equal(elements.get('tree-visit-values').textContent,'40 → 20 → 40');
// A test group runs again in the visualizer with exactly its calls.
assert.equal(run(`JSON.stringify(scenarioCalls({steps:[{call:'push(1)'},{call:'pop()'}]}).calls)`),
  JSON.stringify([{method:'push',arguments:[1]},{method:'pop',arguments:[]}]));
assert.equal(run(`scenarioCalls({steps:[{call:'push(1)'},{call:'missing()'}]}).blocked`),'missing',
  'A test needing a method the file lacks cannot be recreated yet, and says which');

console.log('PASS: step-synced persistent console, runtime diagnostics and command-sequence composer.');
