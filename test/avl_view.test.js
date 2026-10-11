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
// Preserve the same IDs across rotation, and surface distinct height/balance failures.
run(`structure='avl';clearView();applySnapshot({root:1,nodes:[
  {id:1,value:30,left:2,right:null,height:3},
  {id:2,value:20,left:3,right:null,height:2},
  {id:3,value:10,left:null,right:null,height:1}],
  avl:{nodes:{'1':{balance:2,heightOk:true,balanceOk:false},
    '2':{balance:1,heightOk:true,balanceOk:true},
    '3':{balance:0,heightOk:true,balanceOk:true}}}});`);
assert.equal(run('rootId'),1);
assert.equal(run('nodes.size'),3);
assert.ok(run('nodeViews.get(1).classList.contains("avl-invalid")'));
assert.match(run('nodeViews.get(1).querySelector(".avl-info").textContent'),/h3.*b\+2/);
const before=run('nodes.get(3).id');
run(`applySnapshot({root:2,nodes:[
  {id:1,value:30,left:null,right:null,height:1},
  {id:2,value:20,left:3,right:1,height:2},
  {id:3,value:10,left:null,right:null,height:1}],
  avl:{nodes:{'1':{balance:0,heightOk:true,balanceOk:true},
    '2':{balance:0,heightOk:true,balanceOk:true},
    '3':{balance:0,heightOk:true,balanceOk:true}}}});`);
assert.equal(run('rootId'),2);
assert.equal(run('nodes.get(3).id'),before);
assert.equal(run('nodes.get(2).x + TREE_RADIUS'),run('SCENE_WIDTH/2'));
assert.equal(run('nodeViews.get(1).classList.contains("avl-invalid")'),false);
assert.equal(run('document.getElementById("references").querySelectorAll(".ref-arrow").length')>0,true);
const frames=run(`makeFrames([
  {kind:'snapshot',root:2,nodes:[],avl:{nodes:{}}},
  {kind:'heightWrite',id:2,before:1,to:2,line:3},
  {kind:'snapshot',root:2,nodes:[],avl:{nodes:{}}}
])`);
assert.equal(frames[0].kind,'heightAndSettle');
console.log('PASS: AVL tree drawing, stable IDs, height writes and balance highlighting.');
