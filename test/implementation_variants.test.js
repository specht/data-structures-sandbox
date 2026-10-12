'use strict';
const {appSource, loadApp} = require('./helpers/browser');
// Several implementations of one structure: node test/implementation_variants.test.js
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

run(`var sent=[];socket={readyState:1,send(data){sent.push(JSON.parse(data));}}`);
run(`receiveCatalog(${JSON.stringify({type:'catalog',default:{student:'liu.kashiwabara',structure:'tree',variant:'recursive'},
  students:[{id:'liu.kashiwabara',structures:['tree','stack'],implementations:[
    {structure:'tree',variant:'',label:'Tree (binary search) · Dart',name:'Tree (binary search)',language:'Dart'},
    {structure:'tree',variant:'recursive',label:'Tree (binary search) · recursive · Dart',name:'Tree (binary search) · recursive',language:'Dart'},
    {structure:'stack',variant:'',label:'Stack (fixed array) · Dart',name:'Stack (fixed array)',language:'Dart'}]}]})})`);
const picker=run('implementationPicker');
const json=value=>JSON.parse(JSON.stringify(value));
assert.deepEqual(json(picker.items.map(item=>`${item.kind}:${item.variant}`)),['tree:','tree:recursive','stack:']);
assert.equal(picker.items[1].name,'Tree (binary search) · recursive');
assert.equal(run('structure'),'tree');
assert.equal(run('variant'),'recursive');
const select=run('sent').at(-1);
assert.deepEqual({action:select.action,student:select.student,structure:select.structure,variant:select.variant},
  {action:'select',student:'liu.kashiwabara',structure:'tree',variant:'recursive'});
// The button shows the selection; one language in the class needs no tags.
const text=node=>(node.children??[]).map(child=>child.textContent||text(child)).join('|');
assert.match(text(picker.button),/Tree \(binary search\) · recursive\|liu\.kashiwabara/);
assert.doesNotMatch(text(picker.button),/Dart/);

// Switching to the starter's file of the same structure.
picker.choose(picker.items[0]);
assert.equal(run('variant'),'');
assert.equal(run('sent').at(-1).variant,'');
assert.match(run('validationCacheKey()'),/liu\.kashiwabara:tree$/);

// A class that mixes languages: every entry names its language, Dart, too.
run(`receiveCatalog(${JSON.stringify({type:'catalog',students:[
  {id:'ada',structures:['avl'],implementations:[{structure:'avl',variant:'.py'}]},
  {id:'liu.kashiwabara',structures:['tree','avl'],implementations:[
    {structure:'tree',variant:''},{structure:'avl',variant:''},{structure:'avl',variant:'.java'}]}]})})`);
assert.deepEqual(json(picker.items.map(item=>`${item.student}/${item.name}/${item.language}`)),[
  'liu.kashiwabara/Tree (binary search)/Dart',
  'ada/Tree (AVL)/Python','liu.kashiwabara/Tree (AVL)/Dart','liu.kashiwabara/Tree (AVL)/Java']);
picker.toggle(true);
const optionTags=picker.options.children.map(option=>option.children.find(child=>child.className==='picker-language')?.textContent);
assert.deepEqual(json(optionTags),['Dart','Python','Dart','Java']);
assert.match(text(picker.button),/\|Dart\|?/,'The selected Dart file is labeled, too.');

// The filter matches structure, student and language; all words must match.
picker.filter.value='avl java';
picker.filter.oninput();
assert.equal(picker.filtered.length,1);
assert.equal(picker.filtered[0].variant,'.java');
picker.filter.value='ada';
picker.filter.oninput();
assert.deepEqual(json(picker.filtered.map(item=>item.student)),['ada']);
picker.filter.onkeydown({key:'Enter',preventDefault(){}});
assert.equal(run('selectedStudent'),'ada');
assert.equal(run('structure'),'avl');
assert.equal(run('variant'),'.py');
assert.equal(run('sent').at(-1).variant,'.py');
console.log('PASS: one searchable picker for every implementation, with language tags in mixed classes.');
