'use strict';
// Suggested calls generated from method signatures and the current contents.
// Suggestions are generated from each method signature and the live Dart list.
// They invoke the SAME generic dispatcher as the custom argument form.
const PREFERRED_NUMBERS=[5,7,13,20,25,30,42,99,0,-3];
function missingNumbers(present,count=3){
  const out=[];
  for(const value of PREFERRED_NUMBERS){
    if(!present.includes(value)&&!out.includes(value))out.push(value);
    if(out.length===count)break;
  }
  for(let value=1;out.length<count&&value<=999;value++){
    if(!present.includes(value)&&!out.includes(value))out.push(value);
  }
  return out;
}
function dedupeCalls(calls){
  const seen=new Set();
  return calls.filter(call=>{
    const key=JSON.stringify(call.args);
    if(seen.has(key))return false;
    seen.add(key);return true;
  });
}
function suggestedCalls(method, values){
  const params=method.params??[];
  const present=[...new Set(values.filter(value=>Number.isSafeInteger(value)&&Math.abs(value)<=999))];
  const absent=missingNumbers(present);
  const call=(args,hint)=>({args,hint});
  // All public, callable methods appear as rows. Only offer safe, typed
  // suggestions; never guess complex user-defined object constructors.
  if(!params.length)return [call([], 'No arguments')];
  if(params.length===1){
    const type=params[0].type;
    if(type==='int'){
      // Index-based list calls need index suggestions, not stored VALUES.
      if(/(index|position|offset)/i.test(params[0].name)){
        const candidates=[call([0], 'First index')];
        if(values.length>1)candidates.push(call([values.length-1], 'Last index'));
        candidates.push(call([values.length], 'Past last element (invalid for reads)'));
        candidates.push(call([-1], 'Invalid index'));
        return dedupeCalls(candidates).slice(0,4);
      }
      const candidates=[];
      if((structure==='linked_stack' && method.name==='push') ||
          ((structure==='linked_queue'||structure==='array_queue') && method.name==='enqueue')){
        for(const value of absent.slice(0,4))candidates.push(call([value],structure==='linked_stack'?'Push onto top':'Enqueue at rear'));
        return candidates;
      }
      if(['remove','contains','find','search','delete','has','get','indexOf'].some(s=>method.name.toLowerCase().includes(s.toLowerCase()))){
        for(const value of present.slice(0,3))candidates.push(call([value],'Exists in list'));
        for(const value of absent.slice(0,3))candidates.push(call([value],'Not in list'));
      } else {
        for(const value of absent.slice(0,3))candidates.push(call([value],'Not in list'));
        for(const value of present.slice(0,2))candidates.push(call([value],'Already in list'));
      }
      return dedupeCalls(candidates).slice(0,5);
    }
    if(type==='bool')return [call([true],'true'),call([false],'false')];
    if(type==='String')return [call(['hello'],'Example'),call([''],'Empty string')];
    if(type==='double')return [call([1.5],'Example'),call([0],'Zero')];
  }
  // Multi-argument methods get executable examples when all arguments are
  // supported scalar values. Index parameters use the current list length.
  const defaults=params.map(p=>p.type==='int' ? (/(index|position|offset)/i.test(p.name)?0:absent[0]) :
    p.type==='double'?1.5:p.type==='bool'?true:p.type==='String'?'hello':null);
  if(defaults.includes(null))return [];
  const calls=[call(defaults,'Example')];
  const intIndex=params.findIndex(p=>p.type==='int'&& !/(index|position|offset)/i.test(p.name));
  const slotIndex=params.findIndex(p=>p.type==='int'&& /(index|position|offset)/i.test(p.name));
  if(slotIndex>=0){
    const end=[...defaults];end[slotIndex]=values.length;
    calls.push(call(end,'At end'));
  }
  if(intIndex>=0){
    const existing=[...defaults];existing[intIndex]=present[0]??absent[1];
    calls.push(call(existing,present.length?'Value already present':'Another value'));
  }
  return dedupeCalls(calls).slice(0,4);
}
function callLabel(method,args){
  const formatted=args.map((value,i)=>{
    if(method.params?.[i]?.type==='String')return JSON.stringify(value);
    return String(value);
  });
  return `${method.name}(${formatted.join(', ')})`;
}
function renderSuggestions(){
  if(!ui.suggestions)return;
  ui.suggestions.replaceChildren();
  const values=Array.isArray(savedValues)?savedValues:[];
  if(!discovered.size){
    const p=document.createElement('p');p.className='suggestions-empty';p.textContent='Waiting for Dart method discovery…';ui.suggestions.append(p);return;
  }
  let methodIndex=0;
  for(const method of discovered.values()){
    const colorIndex=methodIndex++%6;
    const row=document.createElement('div');row.className='suggestion-row';
    const title=document.createElement('div');title.className='suggestion-method';
    const name=document.createElement('strong');name.textContent=method.name;
    const signature=document.createElement('small');signature.textContent=`(${(method.params??[]).map(p=>`${p.type} ${p.name}`).join(', ')})`;
    title.append(name,signature);
    const group=document.createElement('div');group.className='suggestion-buttons';
    for(const suggestion of suggestedCalls(method,values)){
      const button=document.createElement('button');button.type='button';button.className='call-suggestion';
      button.textContent=callLabel(method,suggestion.args);
      button.dataset.methodColor=String(colorIndex);
      const formatArg=(arg,i)=>{
        const text=method.params?.[i]?.type==='String'?JSON.stringify(arg):String(arg);
        const safe=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const existing=typeof arg==='number'&&values.includes(arg);
        return `<span class="argument ${existing?'present':''}">${safe}</span>`;
      };
      button.innerHTML=`<span class="call-name">${method.name}</span>(${suggestion.args.map(formatArg).join(', ')})`;
      if(suggestion.args.some(arg=>typeof arg==='number'&&values.includes(arg)))
        button.classList.add('has-present-argument');
      button.title=suggestion.hint;
      button.setAttribute('aria-label',`${button.textContent} — ${suggestion.hint}`);
      button.dataset.scenario=suggestion.hint;
      // Batch size is not the data-structure capacity. Keep suggestions usable
      // after 12 (or more) successful insertions into a persistent worker.
      button.addEventListener('click',()=>{
        if(sequenceMode){appendSequenceCall(callLabel(method,suggestion.args));return;}
        send({action:'run',method:method.name,arguments:suggestion.args});
      });
      group.append(button);
    }
    if(!group.children.length){const empty=document.createElement('span');empty.className='suggestions-empty';empty.textContent='Use the custom argument form for this signature.';group.append(empty);}
    row.append(title,group);ui.suggestions.append(row);
  }
}

ui.reset.addEventListener('click',()=>{
  setRuntimeConsole([],null,{autoExpand:false});
  send({action:'reset'});
});
