// Optional developer test. Runs with Node.js only; the classroom app requires
// no Node.js, npm or browser build step.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {fakeBrowser, loadApp} = require('./helpers/browser');
const {context, ids, document, Element} = fakeBrowser();
loadApp(context);
const run = source => vm.runInContext(source, context);

run(`structure='unsorted_array_list';ensureViewport(structure);arrayListState={cells:[5,8,3,null,null,null,null,null],size:3};renderArrayList();`);
const pane=document.getElementById('stack-view');
assert.equal(pane.querySelectorAll('.memory-cell').length,8);
assert.deepEqual(pane.querySelectorAll('.memory-value').map(el=>el.textContent),['5','8','3','·','·','·','·','·']);
run(`instantArrayList({kind:'memoryWriteAndSettle',index:2,oldValue:3,value:8,snapshot:{cells:[5,8,8,3,null,null,null,null],size:3}});`);
assert.equal(pane.querySelectorAll('.memory-cell').filter(el=>el.classList.contains('selected')).length,1);
run(`structure='sorted_array_list';arrayListState={cells:[-3,2,2,8,null,null,null,null],size:4};renderArrayList();`);
assert.equal(pane.querySelectorAll('.queue-occupied').length,4);
run(`structure='unsorted_linked_list';`);
assert.doesNotThrow(()=>run(`autoFrameLinked([{kind:'snapshot',head:1,nodes:[{id:1,value:3,next:2},{id:2,value:5,next:null}]}]);`));
console.log('PASS: unsorted/sorted list rendering and array write highlighting');
