'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.style={};this.value='';this.textContent='';
    this.classList={add(){},remove(){},toggle(){},contains(){return false;}};}
  setAttribute(k,v){this.attrs[k]=String(v)}
  getAttribute(k){return this.attrs[k]??null}
  append(...parts){this.children.push(...parts)}
  replaceChildren(...parts){this.children=parts}
  addEventListener(){} focus(){} remove(){}
  querySelectorAll(selector){const out=[];const walk=e=>{for(const child of e.children??[]){
    if(selector.startsWith('.') && child.attrs?.class?.split(' ').includes(selector.slice(1)))out.push(child);
    walk(child);
  }};walk(this);return out;}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null}
}
const elements=new Map(),document={getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)},
  createElementNS:(_,tag)=>new Element(tag),createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text}),
  addEventListener(){},querySelectorAll(){return []}};
const context=vm.createContext({document,console,window:{addEventListener(){}},location:{protocol:'http:',host:'localhost:8081'},
  WebSocket:class{static OPEN=1;addEventListener(){}send(){}},setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},
  performance:{now:()=>0},requestAnimationFrame(){},HTMLInputElement:class{},HTMLTextAreaElement:class{},HTMLSelectElement:class{},HTMLButtonElement:class{}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8'),context);
const run=s=>vm.runInContext(s,context);
const empty={kind:'snapshot',buckets:Array(8).fill(null),nodes:[],size:0,capacity:8};
const full={kind:'snapshot',buckets:[null,null,null,null,null,null,null,3],nodes:[
  {id:1,value:7,next:null},{id:2,value:15,next:1},{id:3,value:23,next:2}],size:3,capacity:8};
run(`structure='hash';ensureViewport(structure);hashState=hashSnapshot(${JSON.stringify(full)});renderHash()`);
const pane=elements.get('stack-view');
assert.equal(pane.querySelectorAll('.hash-bucket').length,8);
assert.equal(pane.querySelectorAll('.hash-node').length,3);
assert.equal(pane.querySelectorAll('.hash-edge').length,3);
assert.equal(run('hashChains(hashState).chains[7].length'),3);
run(`instantHash({kind:'bucketRead',index:7,to:3});`);
assert.equal(run('hashHotBucket'),7);
run(`instantHash({kind:'memoryWriteAndSettle',index:7,to:2,snapshot:${JSON.stringify({...full,buckets:[null,null,null,null,null,null,null,2],size:2})}});`);
assert.equal(run('hashHotBucket'),7);
run(`instantHash({kind:'snapshot',snapshot:${JSON.stringify(empty)}});`);
assert.equal(run('hashChains(hashState).chains[7].length'),0);
console.log('PASS: hash table · stationary buckets, linked collision chains, read/write and history');
