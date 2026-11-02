// Standalone smoke test for the tree-lab UI (no Dart SDK needed).
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const listeners = {};
const elements = new Map();
class Element {
  constructor() { this.hidden=false;this.disabled=false;this.textContent=''; }
  addEventListener(type, listener) { listeners[type] = listener; }
}
const document = {getElementById(id) {
  if (!elements.has(id)) elements.set(id, new Element());
  return elements.get(id);
}};
let run=null;
const context=vm.createContext({document,structure:'tree',
  discovered: new Map([['insert', {params:[{name:'value',type:'int'}]}]]),
  runCalls: (calls, options) => {run={calls,options};},
  formatCall: call => `${call.method}(${call.arguments.join(', ')})`,
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js/tree-lab.js'),'utf8'), context);
const button=elements.get('build-example');
assert.equal(button.hidden, false);
assert.equal(button.disabled, false);
listeners.click();
assert.equal(run.options.reset,true,'Build example starts from empty');
assert.equal(run.calls.length,7);
assert.equal(run.calls[0].method,'insert');
vm.runInContext('recordTreeVisit(40); recordTreeVisit(20)',context);
assert.equal(elements.get('tree-visit-values').textContent,'40 → 20');
vm.runInContext('resetTreeVisitDisplay()',context);
assert.equal(elements.get('tree-visit-output').hidden,true);
// Every structure has an example built through its own methods.
vm.runInContext("structure='stack';discovered=new Map([['push',{params:[{name:'value',type:'int'}]}]]);updateTreeLab()",context);
assert.equal(button.hidden,false,'Stacks have an example too');
listeners.click();
assert.deepEqual(JSON.parse(JSON.stringify(run.calls.map(call=>call.method))),['push','push','push','push']);
vm.runInContext("structure='unsorted_linked_list';discovered=new Map([['insert',{params:[{type:'int'},{type:'int'}]}]]);updateTreeLab()",context);
listeners.click();
assert.deepEqual(JSON.parse(JSON.stringify(run.calls[1].arguments)),[1,3],'Positional lists insert at an index');
vm.runInContext("structure='array_queue';discovered=new Map();updateTreeLab()",context);
assert.equal(button.disabled,true,'Without its method the example is not available yet');
console.log('PASS: Build example for every structure, through the student\'s own methods; traversal visits');
