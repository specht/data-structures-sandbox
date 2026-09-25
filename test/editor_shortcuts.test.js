// Run from the repository root: node test/editor_shortcuts.test.js
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
class El{
  constructor(){this.children=[];this.events={};this.hidden=false;this.disabled=false;this.textContent='';this.style={};this.clientWidth=640;this.clientHeight=500;
    const classes=new Set();this.classList={add:k=>classes.add(k),remove:k=>classes.delete(k),toggle:(k,b)=>b?classes.add(k):classes.delete(k)};}
  setAttribute(){} addEventListener(k,fn,capture){this.events[k]=fn;this.capture=capture;} append(...a){this.children.push(...a);} replaceChildren(...a){this.children=a;}
}
const elements=new Map(),document={getElementById(k){if(!elements.has(k))elements.set(k,new El());return elements.get(k);},createElement(){return new El();}};
let cm;function CodeMirror(_node,options){
  const offset=p=>cm.value.split('\n').slice(0,p.line).reduce((n,x)=>n+x.length+1,0)+p.ch;
  const pos=n=>{const a=cm.value.slice(0,n).split('\n');return {line:a.length-1,ch:a.at(-1).length};};
  cm={value:options.value,options,listeners:{},wrapper:new El(),cursor:{line:0,ch:0},selection:null,edits:[],
    setValue(x){this.value=x;this.selection=null;this.cursor={line:0,ch:0};this.listeners.change?.(this,{origin:'setValue'});},
    getValue(){return this.value;},getLine(i){return this.value.split('\n')[i];},lastLine(){return this.value.split('\n').length-1;},lineCount(){return this.value.split('\n').length;},
    getCursor(which){return this.selection&&which?this.selection[which]:this.cursor;},setCursor(p){this.cursor=p;this.selection=null;},
    setSelection(from,to){this.selection={from,to};this.cursor=to;},getSelection(){return this.selection?this.value.slice(offset(this.selection.from),offset(this.selection.to)):'';},
    somethingSelected(){return !!this.getSelection();},
    replaceRange(text,from,to=from,origin='+input'){const a=offset(from),b=offset(to);this.value=this.value.slice(0,a)+text+this.value.slice(b);this.cursor=pos(a+text.length);this.selection=null;
      this.edits.push({text,origin});this.listeners.change?.(this,{origin,text:[text]});},
    replaceSelection(text,mode,origin){this.replaceRange(text,this.getCursor('from'),this.getCursor('to'),origin);},
    getTokenAt(){return {type:null};},getOption(k){return this.options[k];},setOption(k,v){this.options[k]=v;},getWrapperElement(){return this.wrapper;},cursorCoords(){return {left:70,top:20,bottom:40};},
    operation(f){f();},on(k,f){this.listeners[k]=f;},clearHistory(){},refresh(){},scrollTo(){},scrollIntoView(){},addLineClass(){},removeLineClass(){},markText(){return {clear(){}};},focus(){},execCommand(cmd){this.lastCommand=cmd;},indentSelection(){},
  };return cm;
}
const sent=[],window={addEventListener(){},confirm:()=>true};
const context=vm.createContext({CodeMirror,document,window,selectedStudent:'alice',structure:'stack',ui:{cmdStatus:new El()},WebSocket:{OPEN:1},socket:{readyState:1,send:m=>sent.push(JSON.parse(m))}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/editor.js'),'utf8'),context);
const editor=window.sandboxEditor,button=id=>document.getElementById(id);
const key=k=>{assert.equal(typeof cm.options.extraKeys[k],'function',k);cm.options.extraKeys[k](cm);};
editor.ready();assert.equal(sent.at(-1).action,'readSource');
editor.receive({type:'sourceFile',student:'alice',structure:'stack',revision:'r1',content:'class A {\n  int value;\n  void work() {}\n}'});
assert.equal(button('source-format').disabled,false);
assert.equal(typeof cm.options.extraKeys['Ctrl-Shift-K'],'function');
assert.equal(cm.wrapper.capture,true,'Chrome shortcut must run before CodeMirror input handling');
let prevented=false,stopped=false;
cm.wrapper.events.keydown({ctrlKey:true,shiftKey:true,altKey:false,metaKey:false,
  code:'KeyK',key:'K',preventDefault(){prevented=true;},stopImmediatePropagation(){stopped=true;}});
assert.equal(cm.lastCommand,'deleteLine');assert.equal(prevented,true);assert.equal(stopped,true);
assert.equal(typeof cm.options.extraKeys['Alt-Shift-K'],'function','Fallback delete-line shortcut');
key('Alt-Shift-K');assert.equal(cm.lastCommand,'deleteLine');
assert.equal(cm.options.extraKeys['Shift-Alt-A'],undefined,'Block comment shortcut is removed');
const html=fs.readFileSync(path.join(__dirname,'../web/index.html'),'utf8');
assert.doesNotMatch(html,/source-suggest|Ctrl\+Space Suggestions|Block comment/);
cm.setSelection({line:1,ch:0},{line:2,ch:15});key('Ctrl-#');
assert.match(cm.getValue(),/  \/\/ int value;/);assert.match(cm.getValue(),/  \/\/ void work/);
cm.setSelection({line:1,ch:0},{line:2,ch:18});key('Ctrl-#');
assert.equal(cm.getValue(),'class A {\n  int value;\n  void work() {}\n}','Line comments must toggle without leaving spaces.');
cm.setValue('class A {\n  wh\n}');cm.setCursor({line:1,ch:4});
cm.listeners.change(cm,{origin:'+input',text:['h']});
const completions=cm.wrapper.children[0];assert.equal(completions.hidden,false);
assert.equal(completions.children[0].textContent,'while');
assert.equal(completions.children[0].textContent.includes('loop'),false);
cm.listeners.keydown(cm,{key:'Enter',preventDefault(){}});
assert.match(cm.getValue(),/\bwhile\b/);
assert.doesNotMatch(cm.getValue(),/while \(condition\)/,'Completion must not insert a snippet');
cm.setValue('class A {\n  int studentCounter;\n  stu\n}');cm.setCursor({line:2,ch:5});
cm.listeners.change(cm,{origin:'+input',text:['u']});
assert.equal(completions.hidden,false);
assert.equal(completions.children[0].textContent,'studentCounter');
cm.setValue('class A{int x=1;}');button('source-format').events.click();
const req=sent.at(-1);assert.equal(req.action,'formatSource');assert.equal(req.content,'class A{int x=1;}');assert.equal(sent.some(x=>x.action==='saveSource'),false);
editor.receiveFormat({type:'sourceFormatted',requestId:req.requestId,revision:'r1',student:'alice',structure:'stack',content:'class A {\n  int x = 1;\n}\n'});
assert.equal(cm.getValue(),'class A {\n  int x = 1;\n}\n');assert.equal(cm.edits.at(-1).origin,'+format');assert.equal(button('source-save').disabled,false);
cm.setValue('class A{int y=1;}');button('source-format').events.click();const stale=sent.at(-1);cm.setValue('class A{int y=2;}');
editor.receiveFormat({type:'sourceFormatted',requestId:stale.requestId,revision:'r1',student:'alice',structure:'stack',content:'class A {\n  int y = 1;\n}\n'});
assert.equal(cm.getValue(),'class A{int y=2;}','An earlier formatter reply must not overwrite newer edits.');
button('source-format').events.click();const invalid=sent.at(-1);
editor.receiveFormat({type:'sourceFormatError',requestId:invalid.requestId,revision:'r1',student:'alice',structure:'stack',message:'Expected a closing brace.'});
assert.match(button('source-edit-status').textContent,/closing brace/);
console.log('PASS: comments, completion, current-draft formatting, undo origin and stale-format guards.');
