'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('web/index.html','utf8');
const host=fs.readFileSync('tool/host.dart','utf8');
const worker=fs.readFileSync('tool/worker_template.txt','utf8');
const diagnostics=fs.readFileSync('lib/trace_budget.dart','utf8');

for(const id of ['runtime-console','console-toggle','console-output','console-clear'])
  assert.match(html,new RegExp(`id="${id}"`),`Missing ${id}`);
assert.match(worker,/ZoneSpecification\(print:/,'Student print() must be captured safely.');
assert.match(worker,/'type':'studentOutput'/);
assert.match(worker,/'type':'executionProgress'/);
assert.match(worker,/'type':'executionError'/);
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
vm.runInContext(fs.readFileSync('web/app.js','utf8'),context);
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
assert.equal(elements.get('command-status').textContent,'Execution stopped · details are in the Console.');

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
run(`ui.callInput.value='push(30)';setSequenceMode(true);appendSequenceCall('push(20)')`);
assert.equal(elements.get('call-input').value,'push(30); push(20)');
assert.equal(elements.get('call-input').rows,1,'A semicolon sequence should keep the toolbar compact.');
assert.equal(elements.get('sequence-count').textContent,'2');
assert.equal(elements.get('call-run-label').textContent,'Run 2');
run(`socket.readyState=WebSocket.OPEN;
  setRuntimeConsole([{kind:'stdout',text:'session output'}]);
  ui.reset.onclick()`);
assert.equal(run('runtimeConsoleEntries.length'),0,'Reset must clear the Console session history.');

console.log('PASS: step-synced persistent console, runtime diagnostics and command-sequence composer.');
