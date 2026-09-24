'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const els=new Map();
class Element {
  constructor(){this.disabled=false;this.hidden=false;this.value='';this.textContent='';this.dataset={};this.scrollTop=0;this.selectionStart=0;this.selectionEnd=0;
    const classes=new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)};}
  addEventListener(name,callback){this[`on${name}`]=callback;}
  focus(){this.focused=true;}
  dispatchEvent(event){this[`on${event.type}`]?.(event);}
  setRangeText(text,start,end){this.value=this.value.slice(0,start)+text+this.value.slice(end);this.selectionStart=this.selectionEnd=start+text.length;}
}
const doc={getElementById(id){if(!els.has(id))els.set(id,new Element());return els.get(id);},addEventListener(){}};
const requests=[];
const win={addEventListener(){},confirm(){return false;}};
const ctx=vm.createContext({document:doc,window:win,Event:class {constructor(type){this.type=type;}},
  selectedStudent:'alice',structure:'stack',ui:{cmdStatus:new Element()},
  socket:{readyState:1,send:raw=>requests.push(JSON.parse(raw))},WebSocket:{OPEN:1}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/editor.js'),'utf8'),ctx);
const el=id=>doc.getElementById(id);
win.sandboxEditor.ready();
el('source-edit').onclick();
assert.deepEqual(requests[0],{action:'readSource'});
win.sandboxEditor.receive({type:'sourceFile',student:'alice',structure:'stack',revision:'rev-1',content:'class A {\n}\n'});
assert.equal(el('source-editor').hidden,false);
assert.equal(el('code-scroll').hidden,true);
el('source-textarea').value+='// work\n';el('source-textarea').oninput();
assert.equal(win.sandboxEditor.beforeSelection(),false,'Discard must require consent.');
el('source-save').onclick();
assert.equal(requests[1].action,'saveSource');
assert.equal(requests[1].revision,'rev-1');
assert.match(requests[1].content,/work/);
win.sandboxEditor.receive({type:'sourceError',message:'Revision conflict'});
assert.match(el('source-textarea').value,/work/,'Conflicting save must preserve the draft.');
el('source-save').onclick();
win.sandboxEditor.receive({type:'sourceSaved',content:el('source-textarea').value,revision:'rev-2'});
assert.equal(el('source-editor').hidden,true);
assert.equal(el('source-edit').hidden,false);
console.log('PASS: inline edit, explicit save, conflict preservation and safe return to the visualizer.');
