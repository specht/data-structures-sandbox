'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('web/index.html','utf8');
const source=fs.readFileSync('web/app.js','utf8');
const host=fs.readFileSync('tool/host.dart','utf8');

assert.match(html,/id="progress-open"/);
assert.match(html,/id="progress-dialog"/);
assert.match(html,/started \/ not fully verified/);
assert.match(html,/tabler-icons\.svg#ti-loader-2/);
assert.match(html,/tabler-icons\.svg#ti-check/);
assert.match(host,/\.runtime\/progress\.json/);
assert.match(host,/progressCacheVersion=2/);
assert.match(host,/message\['action'\]=='progressOverview'/);
assert.match(host,/pendingProgressJobs\(\)/);
assert.match(host,/visibleStructures\(\)/);
assert.match(host,/recordProgress\(\s*selectedStudent,\s*selectedKind,\s*selectedStamp/);

const start=source.indexOf('const progressUI=');
const end=source.indexOf('const svg =',start);
assert.ok(start>=0&&end>start,'Progress controls must be registered.');

const controls=new Map();
class Element{
  constructor(){
    this.children=[];
    this.open=false;
    this.textContent='';
    this.className='';
    this.attrs={};
    this.title='';
    this.scope='';
  }
  replaceChildren(...children){this.children=children;}
  append(...children){this.children.push(...children);}
  addEventListener(name,callback){this['on'+name]=callback;}
  setAttribute(name,value){this.attrs[name]=value;}
  showModal(){this.open=true;}
  close(){this.open=false;}
}

const document={
  getElementById(id){
    if(!controls.has(id))controls.set(id,new Element());
    return controls.get(id);
  },
  createElement(){return new Element();},
};

const socket={
  readyState:1,
  sent:[],
  send(data){this.sent.push(JSON.parse(data));},
};

const context=vm.createContext({
  document,
  socket,
  WebSocket:{OPEN:1},
  $:document.getElementById.bind(document),
});

vm.runInContext(source.slice(start,end),context);

controls.get('progress-open').onclick();
assert.equal(controls.get('progress-dialog').open,true);
assert.deepEqual(socket.sent,[{action:'progressOverview'}]);

vm.runInContext(`progressMessage({
  type:'progressSnapshot',
  structures:[
    {id:'stack',label:'Stack (fixed array)'},
    {id:'tree',label:'Tree (binary search)'},
    {id:'avl',label:'Tree (AVL)'}
  ],
  students:[
    {
      id:'alice',
      cells:{
        stack:{state:'complete',tested:true,passed:43,total:43},
        tree:{state:'pending',tested:false,total:33},
        avl:{state:'missing'}
      }
    },
    {
      id:'bob',
      cells:{
        stack:{state:'pending',tested:true,passed:40,total:43},
        tree:{state:'complete',tested:true,passed:33,total:33},
        avl:{state:'missing'}
      }
    }
  ]
})`,context);

const head=controls.get('progress-head');
const body=controls.get('progress-body');
assert.equal(head.children.length,1);
assert.equal(head.children[0].children.length,4);
assert.equal(body.children.length,2);
const aliceStack=body.children[0].children[1].children[0];
const aliceTree=body.children[0].children[2].children[0];
assert.match(aliceStack.children[0].innerHTML,/#ti-check/);
assert.equal(aliceStack.children[1].textContent,'43/43');
assert.match(aliceTree.children[0].innerHTML,/#ti-loader-2/);
assert.equal(aliceTree.children[1].textContent,'…/33');
assert.equal(body.children[0].children[3].children[0].textContent,'—');
assert.match(
  body.children[1].children[1].children[0].attrs['aria-label'],
  /40 \/ 43/,
);

vm.runInContext(
  "progressMessage({type:'progressStatus',message:'Class progress is up to date.'})",
  context,
);
assert.equal(
  controls.get('progress-status').textContent,
  'Class progress is up to date.',
);

console.log(
  'PASS: shared class progress dialog, check ratios, real icons and refresh request.',
);
