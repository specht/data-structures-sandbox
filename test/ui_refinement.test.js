'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('web/index.html'),js=read('web/app.js'),css=read('web/style.css');
assert.doesNotMatch(html,/>SOURCE<|CURRENT OPERATION|Step through the recorded Dart execution/);
assert.match(html,/id="validation-run"[\s\S]*?Run tests <span id="validation-summary"/);
assert.match(html,/id="description" hidden/);
assert.match(html,/id="phase" class="phase" hidden/);
assert.match(js,/navigation\.append\(ui\.first,ui\.back,ui\.next,ui\.last\)/);
assert.match(js,/ui\.fitScene\.addEventListener\('click',\(\)=>animateCamera\(fitScene\)\)/);
assert.match(js,/button\.classList\.add\('has-present-argument'\)/);
assert.match(css,/\.source-actions\{display:inline-flex!important;flex-direction:row!important/);
assert.match(css,/\.CodeMirror-scrollbar-filler/);
assert.match(css,/\.call-suggestion\.has-present-argument/);
const source=js.match(/let cameraAnimationId=0;\nfunction animateCamera\(action\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(source,'Missing camera easing implementation');
const queued=[];
const context={
  viewport:{x:0,y:0,w:1000,h:500},paintViewport(){},
  performance:{now:()=>0},requestAnimationFrame(fn){queued.push(fn)},
};
vm.createContext(context);
vm.runInContext(source,context);
vm.runInContext('animateCamera(()=>{viewport={x:100,y:50,w:500,h:250};paintViewport();})',context);
assert.equal(context.viewport.x,0,'Button click must begin at the previous camera');
assert.equal(queued.length,1);
queued.shift()(110);
assert.ok(context.viewport.x>0&&context.viewport.x<100,'The camera must move between frames');
queued.shift()(220);
assert.equal(context.viewport.x,100);
assert.equal(context.viewport.w,500);
// A later camera action invalidates callbacks from an earlier one.
vm.runInContext('animateCamera(()=>{viewport={x:200,y:100,w:300,h:150};paintViewport();})',context);
const stale=queued.shift();
vm.runInContext('animateCamera(()=>{viewport={x:150,y:75,w:350,h:175};paintViewport();})',context);
stale(110);
assert.equal(context.viewport.x,100,'A stale animation must not move the new camera');
queued.shift()(220);
assert.equal(context.viewport.x,150);
console.log('PASS: UI labels, bundled controls, compact layout, and interruptible camera easing.');
