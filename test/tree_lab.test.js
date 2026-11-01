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
let payload=null;
const context=vm.createContext({document,structure:'tree',
  discovered: new Map([['insert', {}]]),
  send: data => {payload=data;},
});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/js/tree-lab.js'),'utf8'), context);
assert.equal(elements.get('tree-sample').hidden, false);
listeners.click();
assert.equal(payload.reset,true);
assert.equal(payload.commands.length,7);
assert.equal(payload.commands[0].method,'insert');
vm.runInContext('recordTreeVisit(40); recordTreeVisit(20)',context);
assert.equal(elements.get('tree-visit-values').textContent,'40 → 20');
vm.runInContext('resetTreeVisitDisplay()',context);
assert.equal(elements.get('tree-visit-output').hidden,true);
vm.runInContext("structure='stack';updateTreeLab()",context);
assert.equal(elements.get('tree-sample').hidden,true);
console.log('PASS: sample BST commands and callback visit display');
