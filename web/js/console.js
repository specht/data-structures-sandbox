'use strict';
// Runtime console: student print() output, runtime errors and hints.
function showCompiling(compiling){ui.compileSpinner.hidden=!compiling;}
// A short explanation below the Dart message for errors students typically
// meet. The Dart message itself is always shown unchanged.
const LINKED_STRUCTURES=new Set(['unsorted_linked_list','sorted_linked_list','linked_stack','linked_queue','hash']);
const ARRAY_STRUCTURES=new Set(['unsorted_array_list','sorted_array_list','stack','array_queue','array_heap']);
function runtimeHint(error,kind=structure){
  const message=String(error?.message??'');
  const tree=kind==='tree'||kind==='avl'||kind==='node_heap';
  if(error?.kind==='timeout')return 'The method did not finish in time. Look for a loop whose condition never becomes '+
    'false (a missing i++ or current = current.next) or a recursion without a base case.';
  if(/Trace limit reached/.test(message))return 'Your method ran far too many steps, which usually means an '+
    'endless loop: does every loop move forward (for example current = current.next), and is the chain free of cycles?';
  if(/Stack Overflow/i.test(message))return 'The recursion never stops. Check that every recursive call has a '+
    'base case that is reached (for example node == null).';
  if(/Null check operator used on a null value|called on null|Null check/.test(message)){
    if(tree)return 'A node reference is null here (root, left or right). Handle the empty tree and missing '+
      'children before using ! or reading a child\'s fields.';
    if(LINKED_STRUCTURES.has(kind))return 'A node reference is null here (for example head, tail or current.next). '+
      'Handle the empty structure and the end of the chain before using ! or reading .value/.next.';
    return 'A value is null where your code expects one. Empty memory cells contain null.';
  }
  if(/type 'Null' is not a subtype of type 'int'/.test(message))return 'An int was expected but the value is null. '+
    (ARRAY_STRUCTURES.has(kind)?'Empty memory cells contain null; did you read a cell outside the occupied part?'
      :'Is a node missing, or was a value never assigned?');
  if(/hash\(.*\).*valid bucket index|must return a valid bucket index/.test(message))return 'Your hash function '+
    'returned an index outside 0 … buckets.length - 1. Use % buckets.length, and remember that keys can be negative.';
  if(/RangeError|Index out of range|not in inclusive range/.test(message)){
    if(kind==='array_heap')return 'An index is outside the heap. Children of index i are 2*i + 1 and 2*i + 2: '+
      'compare them with the current length before reading.';
    if(kind==='array_queue')return 'An index is outside the memory. After moving front or rear, wrap around with % memory.length.';
    if(ARRAY_STRUCTURES.has(kind))return 'An index is outside the memory (valid: 0 … memory.length - 1). Check the '+
      'index arithmetic, for example top + 1 on a full stack or a loop that runs one step too far.';
    return 'An index is outside the valid range. Check the loop bounds and the index arithmetic.';
  }
  if(/IntegerDivisionByZero|by zero/i.test(message))return 'Division or % by zero: is the capacity or the number of buckets 0?';
  return null;
}
function setConsoleExpanded(expanded){
  consoleExpanded=expanded;
  ui.runtimeConsole.classList.toggle('expanded',expanded);
  ui.consoleToggle.setAttribute('aria-expanded',String(expanded));
  ui.consoleOutput.hidden=!expanded;
}
function setRuntimeConsole(entries=[],error=null,{autoExpand=true,forceVisible=false,append=false}={}){
  const retained=append?runtimeConsoleEntries.map(entry=>({...entry,forceVisible:true})):[];
  const incoming=(Array.isArray(entries)?entries:[]).map(entry=>({
    kind:['warning','error','timeout'].includes(entry?.kind)?entry.kind:'stdout',
    text:String(entry?.text??''),
    line:Number.isInteger(entry?.line)?entry.line:null,
    traceIndex:Number.isInteger(entry?.traceIndex)?entry.traceIndex:null,
    stack:Array.isArray(entry?.stack)?entry.stack.map(String):[],
    forceVisible:entry?.forceVisible===true||forceVisible,
  }));
  runtimeConsoleEntries=[...retained,...incoming];
  if(error&&typeof error==='object'){
    const kind=error.kind==='timeout'?'timeout':'error';
    const where=Number.isInteger(error.line)?` at line ${error.line}`:'';
    runtimeConsoleEntries.push({kind,
      text:`${kind==='timeout'?'Timed out':'Runtime error'}${where}: ${error.message??'Student execution failed.'}`,
      hint:runtimeHint(error),
      line:Number.isInteger(error.line)?error.line:null,
      traceIndex:Number.isInteger(error.traceIndex)?error.traceIndex:null,
      stack:Array.isArray(error.stack)?error.stack.map(String):[],
      forceVisible:forceVisible,
    });
  }
  if(autoExpand&&runtimeConsoleEntries.length)setConsoleExpanded(true);
  renderRuntimeConsole();
}
function consoleTraceBoundary(){
  if(stepIndex<=0||!frames.length)return -1;
  return frames[Math.min(stepIndex,frames.length)-1]?.rawEnd??Number.MAX_SAFE_INTEGER;
}
function renderRuntimeConsole(){
  const boundary=consoleTraceBoundary();
  const visible=runtimeConsoleEntries.filter(entry=>entry.forceVisible||
    entry.traceIndex===null||entry.traceIndex<=boundary);
  ui.consoleOutput.replaceChildren();
  for(const entry of visible){
    const row=document.createElement('div');row.className=`console-entry ${entry.kind}`;
    const location=document.createElement('button');location.type='button';location.className='console-line';
    location.textContent=entry.line===null?'output':`line ${entry.line}`;
    location.disabled=entry.line===null;
    if(entry.line!==null){
      location.title=`Show source line ${entry.line}`;
      location.addEventListener('click',()=>window.sandboxEditor?.highlight(entry.line));
    }
    const message=document.createElement('p');message.className='console-message';message.textContent=entry.text;
    row.append(location,message);
    if(entry.hint){
      const hint=document.createElement('p');hint.className='console-hint';
      hint.textContent=`Hint: ${entry.hint}`;row.append(hint);
    }
    if(entry.stack.length){
      const stack=document.createElement('pre');stack.className='console-stack';
      stack.textContent=entry.stack.join('\n');row.append(stack);
    }
    ui.consoleOutput.append(row);
  }
  if(!visible.length&&consoleExpanded){
    const empty=document.createElement('div');empty.className='console-empty';
    empty.textContent=runtimeConsoleEntries.length?
      'No console output at this step. Step forward to reveal it.':
      `No output yet. Use ${(globalThis.selectedLanguage?.()??{label:'Dart',print:'print(...)'}).print} in your methods.`;
    ui.consoleOutput.append(empty);
  }
  ui.consoleCount.hidden=runtimeConsoleEntries.length===0;
  ui.consoleCount.textContent=visible.length===runtimeConsoleEntries.length?
    String(runtimeConsoleEntries.length):`${visible.length}/${runtimeConsoleEntries.length}`;
  ui.consoleContext.textContent=runtimeConsoleEntries.length?
    `${visible.length} of ${runtimeConsoleEntries.length} messages visible at step ${stepIndex}`:
    'Output from print() appears here.';
  ui.consoleClear.disabled=runtimeConsoleEntries.length===0;
}
ui.consoleToggle.addEventListener('click',()=>setConsoleExpanded(!consoleExpanded));
ui.consoleClear.addEventListener('click',()=>setRuntimeConsole([],null,{autoExpand:false}));
