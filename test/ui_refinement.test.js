'use strict';
const {appSource, loadApp} = require('./helpers/browser');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('web/index.html'),js=appSource(),css=read('web/style.css');
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
// The camera: the logical viewport changes at once, the drawn viewBox glides.
const source=['let paintedViewport=null;','function glideTo(','let cameraAnimationId=0;']
  .map(marker=>js.slice(js.indexOf(marker)))
  .map(rest=>rest.match(/^[\s\S]*?\n\}\n/)?.[0]??rest.split('\n')[0]+'\n');
assert.ok(source.every(Boolean)&&js.includes('function animateCamera(action)'),'Missing camera easing implementation');
const camera=js.slice(js.indexOf('let paintedViewport=null;'),js.indexOf('function autoViewport('))+
  js.slice(js.indexOf('let cameraAnimationId=0;'),js.indexOf('\n}\n',js.indexOf('function animateCamera('))+3);
const queued=[],painted=[];
const context={
  viewport:{x:0,y:0,w:1000,h:500},
  ui:{scene:{setAttribute:(name,value)=>painted.push(value.split(' ').map(Number))}},
  document:{visibilityState:'visible'},
  performance:{now:()=>0},requestAnimationFrame(fn){queued.push(fn)},
};
vm.createContext(context);
vm.runInContext(camera,context);
const drawn=()=>painted.at(-1);
vm.runInContext('paintViewport()',context);
vm.runInContext('animateCamera(()=>{viewport={x:100,y:50,w:500,h:250};paintViewport();})',context);
assert.equal(context.viewport.x,100,'The logical camera is at its target at once');
assert.equal(drawn()[0],0,'The drawn camera begins at the previous view');
assert.equal(queued.length,1);
queued.shift()(110);
assert.ok(drawn()[0]>0&&drawn()[0]<100,'The drawn camera moves between frames');
queued.shift()(260);
assert.deepEqual(drawn(),[100,50,500,250]);
// A later camera action invalidates callbacks from an earlier one.
vm.runInContext('animateCamera(()=>{viewport={x:200,y:100,w:300,h:150};paintViewport();})',context);
const stale=queued.shift();
vm.runInContext('animateCamera(()=>{viewport={x:150,y:75,w:350,h:175};paintViewport();})',context);
const before=painted.length;
stale(110);
assert.equal(painted.length,before,'A stale animation must not move the new camera');
queued.shift()(260);
assert.deepEqual(drawn(),[150,75,350,175]);
console.log('PASS: UI labels, bundled controls, compact layout, and interruptible camera easing.');
