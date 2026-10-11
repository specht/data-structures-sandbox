'use strict';
const {appSource, loadApp} = require('./helpers/browser');
// Friendly hints below runtime errors: node test/runtime_hints.test.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};
    this.style={};this.value='1';this.textContent='';this.hidden=false;this.disabled=false;
    this.className='';this.classList={add:n=>this._class(n,true),remove:n=>this._class(n,false),
      toggle:(n,on)=>this._class(n,on),contains:n=>(this.attrs.class||'').split(' ').includes(n)};}
  _class(name,on){const set=new Set((this.attrs.class||'').split(' ').filter(Boolean));
    if(on)set.add(name);else set.delete(name);this.attrs.class=[...set].join(' ');}
  setAttribute(k,v){this.attrs[k]=String(v)} getAttribute(k){return this.attrs[k]??null}
  append(...children){this.children.push(...children)} replaceChildren(...children){this.children=children}
  addEventListener(name,fn){this[`on${name}`]=fn} focus(){} remove(){}
  querySelectorAll(selector){const found=[];const visit=node=>{for(const child of node.children||[]){
    if(selector.startsWith('.')&&child.classList?.contains(selector.slice(1)))found.push(child);visit(child);}};
    visit(this);return found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null}
}
const elements=new Map();
const document={
  getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);},
  createElementNS:(_,tag)=>new Element(tag),createElement:tag=>new Element(tag),
  createTextNode:text=>({textContent:text}),addEventListener(){},querySelectorAll(){return [];},
};
const context=vm.createContext({document,console,location:{protocol:'http:',host:'localhost'},
  window:{addEventListener(){}},WebSocket:class{static OPEN=1;addEventListener(){}send(){}},
  setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){},
  performance:{now:()=>0},requestAnimationFrame(){},HTMLInputElement:class{},
  HTMLTextAreaElement:class{},HTMLSelectElement:class{},HTMLButtonElement:class{}});
loadApp(context);
const run=source=>vm.runInContext(source,context);

const hint=(message,kind,extra={})=>run(`runtimeHint(${JSON.stringify({message,...extra})},${JSON.stringify(kind)})`);
assert.match(hint('Null check operator used on a null value','unsorted_linked_list'),/head, tail or current\.next/);
assert.match(hint('Null check operator used on a null value','avl'),/root, left or right/);
assert.match(hint('RangeError (index): Invalid value: Not in inclusive range 0..7: 8','stack'),/memory\.length - 1/);
assert.match(hint('RangeError (index): Invalid value: Not in inclusive range 0..7: 8','array_queue'),/% memory\.length/);
assert.match(hint('RangeError (index): Index out of range','array_heap'),/2\*i \+ 1/);
assert.match(hint('Bad state: Trace limit reached (4000 events).','tree'),/endless loop/);
assert.match(hint('Student code timed out after 4 seconds.','stack',{kind:'timeout'}),/did not finish in time/);
assert.match(hint('Stack Overflow','tree'),/base case/);
assert.match(hint("RangeError (hash(7)): Student hash function must return a valid bucket index",'hash'),/% buckets\.length/);
assert.equal(hint('Exception: something specific','stack'),null);

// A runtime error in the console carries its hint.
run(`structure='linked_stack';setRuntimeConsole([],{kind:'runtime',message:'Null check operator used on a null value',line:12})`);
assert.match(run('runtimeConsoleEntries.at(-1).hint'),/current\.next/);
console.log('PASS: runtime error hints.');
