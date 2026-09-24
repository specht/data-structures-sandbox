'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the real validation UI functions without launching a browser.
const source = fs.readFileSync(path.join(__dirname, '../web/app.js'), 'utf8');
const start = source.indexOf('const validationUI=');
const end = source.indexOf('const svg =', start);
assert.ok(start >= 0 && end > start, 'Validation controls must be registered.');
const controls = new Map();
class Element {
  constructor() { this.children=[];this.disabled=false;this.hidden=false;this.textContent='';this.value=0;this.max=1; }
  replaceChildren(...children) { this.children=children; }
  append(...children) { this.children.push(...children); }
  addEventListener(name, callback) { this[`on${name}`]=callback; }
}
const document = {
  getElementById(id) { if (!controls.has(id)) controls.set(id,new Element());return controls.get(id); },
  createElement() { return new Element(); },
};
const socket = {readyState:1,sent:[],send(data){this.sent.push(JSON.parse(data));}};
const context = vm.createContext({document, socket, WebSocket:{OPEN:1}, $:document.getElementById.bind(document)});
vm.runInContext(source.slice(start,end),context);
const ui=id=>controls.get(id);

ui('validation-run').onclick();
assert.equal(socket.sent[0].action,'validate');
assert.equal(ui('validation-run').disabled,true);
vm.runInContext("validationMessage({type:'validationStart',tests:['Empty','Capacity']})",context);
assert.equal(ui('validation-progress').hidden,false);
assert.equal(ui('validation-results').children.length,2);
vm.runInContext("validationMessage({type:'validationRunning',index:0,name:'Empty'})",context);
assert.match(ui('validation-results').children[0].textContent,/running/);
vm.runInContext("validationMessage({type:'validationResult',index:0,name:'Empty',passed:true,completed:1,total:2,passedCount:1})",context);
assert.equal(ui('validation-progress').value,1);
assert.match(ui('validation-results').children[0].children[0].innerHTML,/svg/);
vm.runInContext("validationMessage({type:'validationResult',index:1,name:'Capacity',passed:false,message:'push(9): CHECK FAILED',completed:2,total:2,passedCount:1})",context);
assert.match(ui('validation-results').children[1].children[1].textContent,/push\(9\)/);
vm.runInContext("validationMessage({type:'validationDone',passed:1,total:2})",context);
assert.equal(ui('validation-run').disabled,false);
assert.match(ui('validation-status').textContent,/1 \/ 2/);
vm.runInContext("resetValidation('Source changed')",context);
assert.equal(ui('validation-results').hidden,true);
assert.equal(ui('validation-run').disabled,true);
console.log('PASS: test progress, icons, failure details, rerun and stale-state reset.');
