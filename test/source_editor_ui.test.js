'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../web/editor.js'),'utf8');
const els=new Map(),handlers=new Map(),requests=[];
class Element {
 constructor(){this.hidden=false;this.disabled=false;this.textContent='';this.attrs={};const styles=new Set();this.classList={add:k=>styles.add(k),remove:k=>styles.delete(k),toggle:(k,on)=>on?styles.add(k):styles.delete(k),contains:k=>styles.has(k)};}
 addEventListener(n,fn){this[`on${n}`]=fn;}
}
const document={getElementById(id){if(!els.has(id))els.set(id,new Element());return els.get(id);}};
function CodeMirror(container,options){
 const cm={value:options.value,readOnly:options.readOnly,lines:new Set(),listeners:{},
 setValue(s){this.value=s;this.listeners.change?.();},getValue(){return this.value;},clearHistory(){},refresh(){},scrollTo(){},focus(){},
 setOption(k,v){this[k]=v;},on(k,v){this.listeners[k]=v;},
 lineCount(){return this.value.split('\n').length;},
 addLineClass(n,_,clazz){this.lines.add(`${n}:${clazz}`);},
 removeLineClass(n,_,clazz){this.lines.delete(`${n}:${clazz}`);},
 scrollIntoView(){},
 };return cm;
}
let cm;
const factory=(container,options)=>(cm=CodeMirror(container,options));
const window={addEventListener(n,fn){handlers.set(n,fn);},confirm(){return false;}};
const ctx=vm.createContext({document,window,CodeMirror:factory,selectedStudent:'alice',structure:'stack',
 ui:{cmdStatus:new Element()},socket:{readyState:1,send:x=>requests.push(JSON.parse(x))},WebSocket:{OPEN:1}});
vm.runInContext(source,ctx);
const e=id=>document.getElementById(id);
assert.equal(cm.readOnly,'nocursor');
window.sandboxEditor.renderSource({lines:['class A {','  int? pop() => null;','}']});
assert.equal(cm.getValue().split('\n')[1],'  int? pop() => null;');
window.sandboxEditor.highlight(2);
assert(cm.lines.has('1:source-execution-line'));
window.sandboxEditor.ready();e('source-edit').onclick();
assert.equal(requests[0].action,'readSource');
window.sandboxEditor.receive({type:'sourceFile',student:'alice',structure:'stack',revision:'rev1',content:'class A {}'});
assert.equal(cm.readOnly,false);
cm.setValue('class A { int x=1; }');
window.sandboxEditor.renderSource({lines:['STALE TRACE']});
assert.equal(cm.getValue(),'class A { int x=1; }','Trace must not overwrite a draft.');
e('source-save').onclick();
assert.equal(requests[1].action,'saveSource');
assert.equal(requests[1].revision,'rev1');
assert.equal(cm.readOnly,'nocursor','Saving locks draft until server responds.');
window.sandboxEditor.receive({type:'sourceError',message:'Revision conflict'});
assert.equal(cm.readOnly,false);
assert.equal(cm.getValue(),'class A { int x=1; }');
window.sandboxEditor.receive({type:'sourceSaved',revision:'rev2',content:cm.getValue()});
// A successful save is accepted only when a request is in flight.
assert.equal(cm.readOnly,false);
e('source-save').onclick();
window.sandboxEditor.receive({type:'sourceSaved',revision:'rev2',content:cm.getValue()});
assert.equal(cm.readOnly,'nocursor');
assert.equal(e('source-edit').hidden,false);
window.sandboxEditor.clear();
assert.equal(e('source-editor').classList.contains('source-empty'),true);
console.log('PASS: read-only CodeMirror, highlighted playback, editable draft, conflicts, save and empty hint.');
