// Optional Node regression test: no dependency in the classroom application.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const callbacks = new Map();
class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.style={};this.textContent='';this.value='1';this.focused=false;
    this.classList={add:x=>this.setClass(x,true),remove:x=>this.setClass(x,false),toggle:(x,v)=>this.setClass(x,v),contains:x=>(this.attrs.class||'').split(' ').includes(x)};}
  setClass(x,on){const s=new Set((this.attrs.class||'').split(' ').filter(Boolean));if(on)s.add(x);else s.delete(x);this.attrs.class=[...s].join(' ');}
  setAttribute(k,v){this.attrs[k]=String(v)}
  getAttribute(k){return this.attrs[k]??null}
  getBoundingClientRect(){return {top:50,bottom:70,height:20}}
  append(...n){this.children.push(...n)}
  replaceChildren(...n){this.children=n}
  remove(){}
  focus(){this.focused=true}
  addEventListener(k,fn){this[`on${k}`]=fn}
  querySelectorAll(q){const out=[];const match=e=>q==='input'?e.tagName==='input':q.startsWith('.')?e.classList?.contains(q.slice(1)):/^\[data-line="\d+"\]$/.test(q)?e.dataset?.line===q.match(/\d+/)[0]:false;
    const visit=e=>{for(const child of e.children||[]){if(match(child))out.push(child);visit(child)}};visit(this);return out;}
  querySelector(q){return this.querySelectorAll(q)[0]||null}
}
const els=new Map();
const document={getElementById(id){if(!els.has(id))els.set(id,new Element(id));return els.get(id)},
  createElementNS:(_,tag)=>new Element(tag),createElement:tag=>new Element(tag),createTextNode:t=>({textContent:t}),
  addEventListener(k,fn){callbacks.set(k,fn)},querySelectorAll:()=>[]};
class FakeInput {} class FakeSelect {} class FakeButton {}
class Socket { static OPEN=1;constructor(){this.readyState=1;this.handlers={};this.sent=[];Socket.current=this}
  addEventListener(k,fn){this.handlers[k]=fn} send(message){this.sent.push(JSON.parse(message))}}
const context=vm.createContext({document,console,location:{protocol:'http:',host:'localhost:8081'},
  window:{addEventListener(){}},clearInterval(){},setInterval(){return 0},clearTimeout(){},setTimeout(){return 0},
  WebSocket:Socket,performance:{now:()=>0},requestAnimationFrame:()=>{},
  HTMLInputElement:FakeInput,HTMLTextAreaElement:class {},HTMLSelectElement:FakeSelect,HTMLButtonElement:FakeButton});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8'),context);
const run=src=>vm.runInContext(src,context);
const a={kind:'snapshot',head:1,nodes:[{id:1,value:10,next:2},{id:2,value:20,next:null}]};
const b={kind:'snapshot',head:1,nodes:[{id:1,value:10,next:3},{id:2,value:20,next:null},{id:3,value:15,next:null}]};
const trace={type:'trace',source:{file:'student.dart',lines:['class List {}','void insert(int x) {','final n = Node(x);','current = head;','fresh = n;','current.next = fresh;','return;','}']},
  steps:[a,{kind:'operationStart',operation:'insert(15)',description:'Insert 15',line:2},
    {kind:'variableWrite',name:'current',to:1,line:4},{kind:'createNode',node:{id:3,value:15,next:null},line:3},
    {kind:'variableWrite',name:'fresh',to:3,line:5},
    {kind:'pointerWrite',from:'node:1.next',oldTo:2,to:3,line:6},b,
    {kind:'operationEnd',ok:true,result:'Inserted 15',line:7}], values:[10,15]};
(async()=>{
  run(`tween=async (ms,update)=>{ globalThis.durations.push(ms); update(1); };`);
  context.durations=[];
  run(`acceptTrace(${JSON.stringify(trace)});`);
  assert.equal(run('frames.length'),6);
  assert.equal(run('stepIndex'),0);
  // Both buttons and keyboard must advance; input fields retain arrow keys.
  callbacks.get('keydown')({key:'ArrowRight',target:new FakeButton(),preventDefault(){}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(run('stepIndex'),1,'ArrowRight should work when a button has focus');
  callbacks.get('keydown')({key:'ArrowRight',target:new FakeInput(),preventDefault(){throw Error('input arrow intercepted')}});
  assert.equal(run('stepIndex'),1,'Text input must retain its own arrow keys');
  // Home/End navigate with button focus, and Ctrl+Home/End work even while
  // a text input is active. The native cursor shortcuts remain available.
  callbacks.get('keydown')({key:'End',target:new FakeButton(),preventDefault(){}});
  assert.equal(run('stepIndex'),run('frames.length'));
  callbacks.get('keydown')({key:'Home',target:new FakeButton(),preventDefault(){}});
  assert.equal(run('stepIndex'),0);
  callbacks.get('keydown')({key:'End',ctrlKey:true,target:new FakeInput(),preventDefault(){}});
  assert.equal(run('stepIndex'),run('frames.length'));
  callbacks.get('keydown')({key:'Home',ctrlKey:true,target:new FakeInput(),preventDefault(){}});
  assert.equal(run('stepIndex'),0);
  run('jumpTo(frames.length)');
  assert.equal(run('activeLine'),null,'Last method line must be unhighlighted after return');
  assert.equal(run('head'),1);
  // Backward from the final result and then undo a structural change.
  await run('backward()');
  assert.equal(run('stepIndex'),5);
  assert.equal(run('nodes.get(1).next'),3);
  context.durations=[];
  await run('backward()');
  assert.equal(run('stepIndex'),4);
  assert.equal(run('nodes.get(1).next'),2);
  assert.equal(run('nodes.get(2).x'),(run('SCENE_WIDTH-WIDTH-GAP')/2)+run('GAP'),'Old centred layout restored');
  assert.deepEqual(context.durations,[650,700], 'Reverse moves nodes before rewinding pointer');
  // Never change the viewBox on any individual step; it would scale the scene.
  const viewBox=els.get('scene').getAttribute('viewBox');
  run('jumpTo(frames.length)');run('jumpTo(0)');
  assert.equal(els.get('scene').getAttribute('viewBox'),viewBox);
  assert.ok(Number(viewBox.split(' ')[2])>=1100,
    'Auto-framing may add space for references but must not shrink the readable scene');
  run(`send({action:'run',method:'insert',values:[25]})`);
  assert.equal(run('focusAfterCommand'),true);
  run(`acceptTrace(${JSON.stringify(trace)})`);
  assert.equal(els.get('next').focused,true,'After Run, focus must move to playback controls');
  assert.equal(run('focusAfterCommand'),false);
  // Reconnect hello with the same saved list must preserve trace position.
  run('jumpTo(3)');
  Socket.current.handlers.message({data:JSON.stringify({type:'hello',trace:{...trace,steps:[a]}})});
  assert.equal(run('stepIndex'),3,'Reconnect must preserve active playback');
  Socket.current.handlers.message({data:JSON.stringify({type:'trace',...trace,steps:[a],values:[]})});
  assert.equal(run('frames.length'),0,'An actual reset response must not be mistaken for a reconnect hello');
  // A node allocated but not yet linked should float above the list, not jump
  // to the discarded-node lane before `fresh` points to it.
  run(`clearView();applySnapshot({head:null,nodes:[]});newNode({id:9,value:99,next:null});
    applySnapshot({head:null,nodes:[{id:9,value:99,next:null}]});`);
  assert.equal(run('nodes.get(9).y'),156,'New detached object remains in staging area');
  run(`applySnapshot({head:9,nodes:[{id:9,value:99,next:null}]});
    applySnapshot({head:null,nodes:[{id:9,value:99,next:null}]});`);
  assert.equal(run('nodes.get(9).y'),431,'Only previously reachable objects drift into detached lane');
  const catalog=[{name:'insert',params:[{name:'value',type:'int',named:false}],returns:'void'},
    {name:'append',params:[{name:'value',type:'int',named:false}],returns:'void'},
    {name:'insertAt',params:[{name:'index',type:'int',named:false},{name:'value',type:'int',named:false}],returns:'void'},
    {name:'clear',params:[],returns:'void'}];
  run(`updateMethodCatalog(${JSON.stringify(catalog)});`);
  assert.equal(els.get('method').children.length,4, 'Dynamic selector lists every discovered method');
  run(`ui.method.value='append';renderArguments();ui.values.value='42';ui.form.onsubmit({preventDefault(){}});`);
  assert.equal(Socket.current.sent.at(-1).method,'append');
  assert.equal(Socket.current.sent.at(-1).values[0],42);
  run(`ui.method.value='insertAt';renderArguments();`);
  assert.equal(els.get('multi-arguments').querySelectorAll('input').length,2);
  run(`ui.multiArgs.querySelectorAll('input')[0].value='1';ui.multiArgs.querySelectorAll('input')[1].value='12';ui.form.onsubmit({preventDefault(){}});`);
  assert.equal(Socket.current.sent.at(-1).method,'insertAt');
  assert.deepEqual(Array.from(Socket.current.sent.at(-1).arguments),[1,12]);
  // One row per method; each suggested button is a literal method call.
  run(`savedValues=[];renderSuggestions();`);
  let suggestionRows=els.get('method-suggestions').children;
  assert.equal(suggestionRows.length,4,'Each discovered method gets its own suggestion row');
  const suggestionsFor=name=>{
    const row=els.get('method-suggestions').children.find(row=>row.children[0]?.children[0]?.textContent===name);
    assert.ok(row,`Suggestion row for ${name}`);
    return row.children[1].children;
  };
  assert.ok(suggestionsFor('append').some(button=>button.textContent==='append(5)'));
  assert.ok(suggestionsFor('append').some(button=>button.textContent==='append(7)'));
  assert.ok(suggestionsFor('insertAt').some(button=>button.textContent==='insertAt(0, 5)'));
  assert.ok(suggestionsFor('clear').some(button=>button.textContent==='clear()'));
  suggestionsFor('append').find(button=>button.textContent==='append(5)').onclick();
  assert.deepEqual(Socket.current.sent.at(-1),{action:'run',method:'append',arguments:[5]},
    'Suggestion executes exactly one real Dart method call');
  const withContains=[...catalog,{name:'contains',params:[{name:'value',type:'int',named:false}],returns:'bool'},
    {name:'remove',params:[{name:'value',type:'int',named:false}],returns:'bool'}];
  run(`updateMethodCatalog(${JSON.stringify(withContains)});savedValues=[5,13];renderSuggestions();`);
  assert.ok(suggestionsFor('contains').some(button=>button.textContent==='contains(5)' && button.dataset.scenario==='Exists in list'));
  assert.ok(suggestionsFor('contains').some(button=>button.textContent==='contains(7)' && button.dataset.scenario==='Not in list'));
  assert.ok(suggestionsFor('remove').some(button=>button.textContent==='remove(13)' && button.dataset.scenario==='Exists in list'));
  assert.ok(suggestionsFor('remove').some(button=>button.textContent==='remove(7)' && button.dataset.scenario==='Not in list'));
  // A 12-call *request* limit must never disable the 13th insertion into an
  // existing data structure. The same worker remains alive across requests.
  run(`structure='tree';savedValues=Array.from({length:12},(_,i)=>i+1);renderSuggestions();`);
  const another=suggestionsFor('insert').find(button=>button.textContent==='insert(13)');
  assert.ok(another && !another.disabled,'13th insertion must remain available');
  another.onclick();
  assert.equal(Socket.current.sent.at(-1).method,'insert');
  assert.deepEqual(Array.from(Socket.current.sent.at(-1).arguments),[13]);
  // A detached node still appears during remove, but once no root/local
  // reference keeps it alive it must fade/retire and never reappear next call.
  const without13={kind:'snapshot',head:1,nodes:[{id:1,value:7,next:null}]};
  const with13={kind:'snapshot',head:1,nodes:[{id:1,value:7,next:2},{id:2,value:13,next:null}]};
  const removedButRetained={kind:'snapshot',head:1,nodes:[{id:1,value:7,next:null},{id:2,value:13,next:null}]};
  const collectionTrace={type:'trace',structure:'sorted_linked_list',source:trace.source,steps:[with13,
    {kind:'operationStart',operation:'remove(13)',line:2},
    {kind:'pointerWrite',from:'node:1.next',oldTo:2,to:null,line:6},removedButRetained,
    {kind:'retire',ids:[2],line:0},without13,
    {kind:'operationEnd',value:true,returnedVoid:false,result:'removed',line:0}],values:[7]};
  run(`acceptTrace(${JSON.stringify(collectionTrace)});jumpTo(frames.length);`);
  assert.ok(!run('nodes.has(2)'), 'removed node must disappear once no longer reachable');
  assert.equal(run('ui.returnValue.children[1].textContent'),'true');
  const following={...collectionTrace,steps:[without13,{kind:'operationStart',operation:'insert(20)',line:2},
    {kind:'createNode',node:{id:3,value:20,next:null},line:3},
    {kind:'pointerWrite',from:'node:1.next',oldTo:null,to:3,line:6},
    {kind:'snapshot',head:1,nodes:[{id:1,value:7,next:3},{id:3,value:20,next:null}]},
    {kind:'operationEnd',value:null,returnedVoid:true,result:'inserted',line:0}],values:[7,20]};
  run(`acceptTrace(${JSON.stringify(following)});jumpTo(frames.length);`);
  assert.ok(!run('nodes.has(2)'), 'the next operation must not resurrect retired objects');
  assert.deepEqual(Array.from(run('[...nodes.keys()]')),[1,3]);
  assert.equal(els.get('return-value').children[0].tagName,'svg',
    'A void return renders a vector checkmark icon rather than a text glyph');
  run(`ui.callInput.value='remove(13)';ui.callForm.onsubmit({preventDefault(){}});`);
  assert.equal(Socket.current.sent.at(-1).method,'remove');
  assert.deepEqual(Array.from(Socket.current.sent.at(-1).arguments),[13]);
  const treeTrace={type:'trace',structure:'tree',source:trace.source,
    steps:[{kind:'snapshot',root:null,nodes:[]},
      {kind:'operationStart',operation:'insert(20)',line:2},
      {kind:'createNode',node:{id:1,value:20,left:null,right:null},line:3},
      {kind:'pointerWrite',from:'root:root',oldTo:null,to:1,line:6},
      {kind:'snapshot',root:1,nodes:[{id:1,value:20,left:null,right:null}]},
      {kind:'operationEnd',value:null,returnedVoid:true,result:'inserted',line:0}],values:[20]};
  run(`acceptTrace(${JSON.stringify(treeTrace)});jumpTo(frames.length);`);
  assert.equal(run('rootId'),1,'tree renderer must support root pointer');
  assert.equal(run('nodes.get(1).value'),20);
  const stackTrace={type:'trace',structure:'stack',source:trace.source,capacity:8,
    steps:[{kind:'snapshot',cells:Array(8).fill(null),top:-1},
      {kind:'operationStart',operation:'push(5)',line:2},
      {kind:'indexWrite',name:'top',oldValue:-1,value:0,line:3},
      {kind:'snapshot',cells:Array(8).fill(null),top:0},
      {kind:'cellWrite',index:0,oldValue:null,value:5,line:4},
      {kind:'snapshot',cells:[5,...Array(7).fill(null)],top:0},
      {kind:'operationEnd',value:true,returnedVoid:false,result:'pushed',line:0}],values:[5]};
  run(`acceptTrace(${JSON.stringify(stackTrace)});jumpTo(frames.length);`);
  assert.equal(run('stackState.cells[0]'),5,'stack renderer shows fixed-memory writes');
  assert.equal(run('stackState.top'),0);
  assert.equal(run('ui.stackView.children.length')>8,true,'all fixed stack cells visible');
  // v1.2: dynamically discovered class directories are selectable without a
  // browser rebuild; switching students sends the chosen class + kind to Dart.
  Socket.current.handlers.message({data:JSON.stringify({type:'catalog',students:[
    {id:'example',structures:['sorted_linked_list','tree','stack']},
    {id:'alice',structures:['tree','stack']}
  ],default:{student:'example',structure:'sorted_linked_list'}})});
  assert.equal(Socket.current.sent.at(-1).student,'example');
  assert.equal(Socket.current.sent.at(-1).structure,'sorted_linked_list');
  run("ui.student.value='alice';ui.student.onchange();");
  assert.equal(Socket.current.sent.at(-1).student,'alice');
  assert.equal(Socket.current.sent.at(-1).structure,'tree');
  run("ui.structure.value='stack';ui.structure.onchange();");
  assert.equal(Socket.current.sent.at(-1).structure,'stack');
  run("ui.retry.onclick();");
  assert.equal(Socket.current.sent.at(-1).student,'alice');
  assert.equal(Socket.current.sent.at(-1).structure,'stack');
  // A structure switch may invalidate the displayed Dart method call.
  const pushOnly=[{name:'push',params:[{name:'value',type:'int',named:false}],returns:'bool'}];
  run(`ui.callInput.value='insert(25)';updateMethodCatalog(${JSON.stringify(pushOnly)});`);
  assert.equal(els.get('call-input').value,'push(25)');
  run(`ui.callInput.value='push(7)';updateMethodCatalog(${JSON.stringify(pushOnly)});`);
  assert.equal(els.get('call-input').value,'push(7)','Keep a valid student-written call');
  Socket.current.handlers.message({data:JSON.stringify({type:'building',recompiling:true,message:'Compiling test…'})});
  assert.equal(els.get('compile-spinner').hidden,false,'Show recompilation spinner');
  Socket.current.handlers.message({data:JSON.stringify({type:'error',message:'Build failed'})});
  assert.equal(els.get('compile-spinner').hidden,true,'Stop spinner after a build error');
  console.log('PASS: runtime student discovery, selection, remembered choices and Retry controls.');
  console.log('PASS: orphan retirement persists across commands; tree root and stack fixed cells rendered.');
  console.log('PASS: dynamic one-click method rows, present/missing suggestions and real dispatch.');
  console.log('PASS: dynamic method discovery UI, one and multiple argument dispatch.');
  console.log('PASS: keyboard focus, reverse animation, highlight, viewport and node stability, reconnect/reset.');
})().catch(e=>{console.error(e);process.exitCode=1});
