'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real modal / cache functions without a browser or Dart process.
const source=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
const start=source.indexOf('const validationUI=');
const end=source.indexOf('const svg =',start);
assert.ok(start>=0&&end>start,'Validation controls must be registered.');
const controls=new Map(),storage=new Map();
class Element {
  constructor(){
    this.children=[];this.disabled=false;this.hidden=false;this.open=false;
    this.textContent='';this.value=0;this.max=1;this.attrs={};
    const styles=new Set();
    this.classList={add:k=>styles.add(k),remove:(...keys)=>keys.forEach(k=>styles.delete(k)),
      toggle:(k,force)=>{if(force)styles.add(k);else styles.delete(k);},contains:k=>styles.has(k)};
  }
  replaceChildren(...children){this.children=children;}
  append(...children){this.children.push(...children);}
  addEventListener(name,callback){this[`on${name}`]=callback;}
  setAttribute(name,value){this.attrs[name]=value;}
  removeAttribute(name){if(name==='value')this.value=undefined;delete this.attrs[name];}
  showModal(){this.open=true;}
  close(){this.open=false;}
}
const document={
  getElementById(id){if(!controls.has(id))controls.set(id,new Element());return controls.get(id);},
  createElement(){return new Element();},
};
const socket={readyState:1,sent:[],send(data){this.sent.push(JSON.parse(data));}};
const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),
  removeItem:key=>storage.delete(key)};
const context=vm.createContext({document,socket,localStorage,selectedStudent:'alice',
  structure:'stack',WebSocket:{OPEN:1},$:document.getElementById.bind(document)});
vm.runInContext(source.slice(start,end),context);
const ui=id=>controls.get(id);

// First click opens the dialog AND starts validation; closing it does not stop tests.
ui('validation-run').disabled=false;
vm.runInContext("restoreValidation('worker-revision-A')",context);
ui('validation-run').onclick();
assert.equal(ui('validation-dialog').open,true);
assert.equal(socket.sent.length,1);
assert.equal(socket.sent[0].action,'validate');
assert.equal(ui('validation-run').classList.contains('validation-running-button'),true);
ui('validation-close').onclick();
assert.equal(ui('validation-dialog').open,false);
vm.runInContext("validationMessage({type:'validationStart',tests:['Empty','Capacity']})",context);
assert.equal(ui('validation-progress').hidden,false);
assert.equal(ui('validation-results').children.length,2);
vm.runInContext("validationMessage({type:'validationRunning',index:0,name:'Empty'})",context);
assert.match(ui('validation-results').children[0].textContent,/running/);
vm.runInContext("validationMessage({type:'validationResult',index:0,name:'Empty',passed:true,completed:1,total:2,passedCount:1})",context);
assert.equal(ui('validation-progress').value,1);
assert.match(ui('validation-results').children[0].children[0].innerHTML,/svg/);
vm.runInContext("validationMessage({type:'validationResult',index:1,name:'Capacity',passed:false,message:'push(9): return value, contents',completed:2,total:2,passedCount:1,steps:[{call:'push(1)',passed:true,actualReturn:true,expectedReturn:true,actualContents:[1],expectedContents:[1],checks:[]},{call:'push(9)',passed:false,actualReturn:false,expectedReturn:true,actualContents:[1],expectedContents:[1,9],checks:[{aspect:'Return value',actual:false,expected:true},{aspect:'Contents',actual:[1],expected:[1,9]}]}]})",context);
assert.match(ui('validation-results').children[1].children[1].textContent,/push\(9\)/);
const failureHistory=ui('validation-results').children[1].children[2];
assert.equal(failureHistory.open,false,'Failed test history stays collapsed for an overview.');
assert.match(failureHistory.children[0].textContent,/2 steps/);
assert.equal(failureHistory.children[1].children.length,2);
const successfulStep=failureHistory.children[1].children[0];
const failedStep=failureHistory.children[1].children[1];
assert.equal(successfulStep.children[0].attrs['aria-label'],'Passed step');
assert.match(successfulStep.children[0].innerHTML,/#ti-check/);
assert.equal(successfulStep.children[1].textContent,'push(1)');
assert.equal(failedStep.children[0].attrs['aria-label'],'Failed step');
assert.match(failedStep.children[0].innerHTML,/#ti-x/);
assert.match(failedStep.children[2].textContent,/Returned false.*expected true/);
assert.match(failedStep.children[3].textContent,/Contents \[1\].*expected \[1,9\]/);
assert.match(failedStep.children[4].children[0].textContent,/Return value: expected true, actual false/);
vm.runInContext("validationMessage({type:'validationDone',passed:1,total:2})",context);
assert.equal(ui('validation-summary').textContent,'1 / 2');
assert.equal(ui('validation-summary').hidden,false);
assert.equal(ui('validation-run').classList.contains('validation-errors'),true);
assert.match(ui('validation-status').textContent,/1 \/ 2/);

// Clicking a cached result opens the report without starting another run.
ui('validation-run').onclick();
assert.equal(ui('validation-dialog').open,true);
assert.equal(socket.sent.length,1);
ui('validation-dialog').onkeydown?.({key:'Escape'}); // Native dialog handles Escape.
ui('validation-dialog').close();
vm.runInContext("resetValidation('Implementation changed')",context);
assert.equal(ui('validation-summary').hidden,true);
assert.equal(ui('validation-run').disabled,true);
ui('validation-run').disabled=false;
vm.runInContext("restoreValidation('worker-revision-A')",context);
assert.equal(ui('validation-summary').textContent,'1 / 2');
assert.equal(ui('validation-results').children.length,2);
assert.match(ui('validation-status').textContent,/cached/);
vm.runInContext("resetValidation('Source changed')",context);
ui('validation-run').disabled=false;
vm.runInContext("restoreValidation('worker-revision-B')",context);
assert.equal(ui('validation-summary').hidden,true,'Results must not survive a source revision.');

// Rerun works from the dialog and clears the previous badge.
ui('validation-run').onclick();
assert.equal(socket.sent.length,2);
vm.runInContext("validationMessage({type:'validationDone',passed:2,total:2})",context);
ui('validation-rerun').onclick();
assert.equal(socket.sent.length,3);
assert.equal(ui('validation-summary').hidden,true);
console.log('PASS: compact modal, progress, icons, cached results, revision guard and rerun.');
