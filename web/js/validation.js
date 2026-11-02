'use strict';
// The test runner dialog (Run tests) and its per-revision result cache.
const validationUI={
  button:$('validation-run'), summary:$('validation-summary'),
  dialog:$('validation-dialog'), close:$('validation-close'), rerun:$('validation-rerun'),
  status:$('validation-status'), progress:$('validation-progress'), results:$('validation-results'),
};
const validationCachePrefix='data-structure-sandbox.validation.v3';
let validationItems=[],validationResults=[],validationRevision=null;
let validationRunning=false,validationCompleted=false;
function validationCacheKey(){
  const suffix=typeof variant==='string'&&variant?`:${variant}`:'';
  return `${validationCachePrefix}:${selectedStudent}:${structure}${suffix}`;
}
function validationBadge(passed,total){
  validationUI.summary.hidden=false;
  validationUI.summary.textContent=`${passed} / ${total}`;
  validationUI.button.classList.toggle('validation-success',passed===total);
  validationUI.button.classList.toggle('validation-errors',passed!==total);
  validationUI.button.setAttribute('aria-label',`Test my implementation; ${passed} of ${total} groups passed`);
}
function resetValidation(message='Run tests on the selected implementation.'){
  validationRevision=null;validationRunning=false;validationCompleted=false;
  validationUI.button.disabled=true;
  validationUI.rerun.disabled=true;
  validationUI.button.classList.remove('validation-running-button','validation-success','validation-errors');
  validationUI.button.setAttribute('aria-label','Test my implementation');
  validationUI.summary.hidden=true;
  validationUI.status.textContent=message;
  validationUI.progress.hidden=true;
  validationUI.results.hidden=true;
  validationUI.results.replaceChildren();
  validationItems=[];validationResults=[];
}
function validationRows(){
  validationUI.results.replaceChildren();
  validationItems=validationResults.map(record=>{
    const item=document.createElement('li');
    item.className=record.state==='pass'?'validation-pass':record.state==='fail'?'validation-fail':
      record.state==='running'?'validation-running':'validation-pending';
    if(record.state==='pass'||record.state==='fail'){
      const symbol=document.createElement('span');symbol.className='validation-icon';
      symbol.innerHTML=record.state==='pass'
        ?'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="/vendor/tabler-icons.svg#ti-check"/></svg>'
        :'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="/vendor/tabler-icons.svg#ti-x"/></svg>';
      const detail=document.createElement('span');
      detail.className='validation-group-label';
      detail.textContent=`${record.state==='pass'?'Passed':'Failed'}: ${record.name}`+
        (record.message?` (${record.message})`:'');
      item.append(symbol,detail);
      // Recreate the test's exact situation in the sandbox. The calls become
      // the call history, so after every save the test runs there again.
      const {calls,blocked}=scenarioCalls(record);
      if(calls||blocked){
        const failed=record.state==='fail';
        const show=document.createElement('button');
        show.type='button';show.className=`validation-show${failed?' validation-recreate':''}`;
        show.textContent=failed?'Recreate this test':'Show in visualizer';
        show.disabled=!calls;
        show.title=!calls?`${blocked} is not in your file yet: insert the method stubs first`:
          failed?'Run exactly these calls from empty in the sandbox, up to the failing one. '+
            'They become your call history, so every save runs the test there again.':
          'Run these calls from empty in the sandbox';
        show.addEventListener('click',()=>{
          if(!calls)return;
          validationUI.dialog.close();
          rebuildSuspended=false;
          runCalls(calls,{reset:true,label:`${failed?'Recreating':'Showing'} “${record.name}” from empty…`,
            done:failed?'This is the test situation: it runs again after every save.':null});
        });
        item.append(show);
      }
      if(Array.isArray(record.steps)&&record.steps.length){
        const format=value=>value===undefined?'not available':JSON.stringify(value);
        const history=document.createElement('details');
        history.className='validation-history';
        // Keep the results scannable: students expand a group when needed.
        history.open=false;
        const summary=document.createElement('summary');
        summary.textContent=`Starts empty, ${record.steps.length} step${record.steps.length===1?'':'s'}: ${record.state==='fail'?'view the failure':'view the history'}`;
        const calls=document.createElement('ol');
        for(const step of record.steps){
          const entry=document.createElement('li');
          entry.className=step.passed?'validation-step-pass':'validation-step-fail';
          const stepIcon=document.createElement('span');
          stepIcon.className='validation-step-icon';
          stepIcon.setAttribute('aria-label',step.passed?'Passed step':'Failed step');
          stepIcon.innerHTML=step.passed
            ?'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="/vendor/tabler-icons.svg#ti-check"/></svg>'
            :'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="/vendor/tabler-icons.svg#ti-x"/></svg>';
          const call=document.createElement('strong');
          call.textContent=step.call??'Unknown operation';
          entry.append(stepIcon,call);
          if(step.notExecuted){
            const explanation=document.createElement('p');
            explanation.textContent=step.missingMethod
              ?'Not executed: this method is not in your file yet. Use “Insert method stubs” above the editor.'
              :'Not executed: the method declaration does not match the required signature.';
            entry.append(explanation);
          }
          if('expectedReturn' in step&&!step.notExecuted){
            const returned=document.createElement('p');
            returned.textContent=step.returnIsVoid&&step.actualReturn===null
              ? 'Completed (void method, no return value)'
              : `Returned ${format(step.actualReturn)}, expected ${format(step.expectedReturn)}`;
            entry.append(returned);
          }
          if('expectedContents' in step){
            const contents=document.createElement('p');
            contents.textContent=`${step.contentsComparedAsUnordered?'Values (sorted for comparison)':'Contents'} ${format(step.actualContents)}, expected ${format(step.expectedContents)}`;
            entry.append(contents);
          }
          if(Array.isArray(step.checks)&&step.checks.length){
            const differences=document.createElement('ul');
            for(const check of step.checks){
              const difference=document.createElement('li');
              difference.textContent=`${check.aspect}: expected ${format(check.expected)}, actual ${format(check.actual)}`;
              differences.append(difference);
            }
            entry.append(differences);
          }
          if(step.message){
            const problem=document.createElement('p');
            problem.textContent=step.message;
            entry.append(problem);
            const hint=/raised an error|threw/.test(step.message)?runtimeHint({message:step.message}):null;
            if(hint){
              const advice=document.createElement('p');advice.className='validation-hint';
              advice.textContent=`Hint: ${hint}`;entry.append(advice);
            }
          }
          calls.append(entry);
        }
        history.append(summary,calls);
        item.append(history);
      }
    }else item.textContent=record.state==='running'?`${record.name}: running…`:record.name;
    validationUI.results.append(item);
    return item;
  });
  validationUI.results.hidden=!validationItems.length;
  paintValidationBar();
}
/**
 * A group's calls as they ran (up to a failure): {calls}, or {blocked: name}
 * when a call needs a method the file does not have yet.
 */
function scenarioCalls(record){
  const labels=(record.steps??[]).map(step=>step.call).filter(call=>typeof call==='string');
  if(!labels.length||typeof parseCalls!=='function')return {calls:null,blocked:null};
  try{return {calls:parseCalls(labels.join('; ')),blocked:null};}
  catch(_){
    const missing=labels.map(label=>/^\s*([A-Za-z_]\w*)/.exec(label)?.[1])
      .find(name=>name&&!discovered.has(name));
    return {calls:null,blocked:missing??null};
  }
}
/**
 * One segment per test group, colored by its result as soon as it is known
 * (green passed, red failed, pulsing while it runs), so the bar never shows
 * success before the results do.
 */
function paintValidationBar(){
  const bar=validationUI.progress;
  bar.replaceChildren(...validationResults.map(record=>{
    const segment=document.createElement('span');
    segment.className=`validation-segment validation-segment-${record.state??'pending'}`;
    return segment;
  }));
  const passed=validationResults.filter(r=>r.state==='pass').length;
  const failed=validationResults.filter(r=>r.state==='fail').length;
  bar.setAttribute('aria-label',`${passed} passed, ${failed} failed, ${validationResults.length} test groups`);
}
function restoreValidation(revision){
  validationRevision=revision??null;
  if(!validationRevision)return;
  try{
    const cached=JSON.parse(localStorage.getItem(validationCacheKey())||'null');
    if(!cached||cached.revision!==validationRevision||!Array.isArray(cached.results)||
       !Number.isInteger(cached.passed)||!Number.isInteger(cached.total)||
       cached.results.length!==cached.total)return;
    validationResults=cached.results;
    validationCompleted=true;
    validationUI.progress.hidden=false;
    validationUI.status.textContent=`${cached.passed} / ${cached.total} test groups passed (cached)`;
    validationBadge(cached.passed,cached.total);
    validationRows();
  }catch(_){/* Results remain available during this session if storage is unavailable. */}
}
function startValidation(){
  if(validationRunning||validationUI.button.disabled||!socket||socket.readyState!==WebSocket.OPEN)return;
  validationRunning=true;validationCompleted=false;
  validationResults=[];validationRows();
  validationUI.rerun.disabled=true;
  validationUI.button.classList.remove('validation-success','validation-errors');
  validationUI.button.classList.add('validation-running-button');
  validationUI.summary.hidden=true;
  validationUI.progress.hidden=false;
  paintValidationBar();
  validationUI.status.textContent='Starting tests…';
  try{localStorage.removeItem(validationCacheKey());}catch(_){}
  socket.send(JSON.stringify({action:'validate'}));
}
function validationMessage(data){
  switch(data.type){
    case 'validationStart':
      validationRunning=true;validationCompleted=false;
      validationResults=(data.tests??[]).map(name=>({name,state:'pending'}));
      validationUI.rerun.disabled=true;
      validationUI.progress.hidden=false;
      validationUI.status.textContent=`Testing 0 / ${validationResults.length}…`;
      validationRows();return;
    case 'validationRunning':
      if(validationResults[data.index])validationResults[data.index].state='running';
      validationRows();return;
    case 'validationResult':
      if(validationResults[data.index])validationResults[data.index]={
        name:data.name,state:data.passed?'pass':'fail',message:data.message??null,
        steps:Array.isArray(data.steps)?data.steps:[],
      };
      validationUI.status.textContent=`${data.completed} / ${data.total} groups, ${data.passedCount} passed`;
      validationRows();return;
    case 'validationDone':
      validationRunning=false;validationCompleted=true;
      validationUI.rerun.disabled=false;
      validationUI.button.classList.remove('validation-running-button');
      validationUI.status.textContent=`${data.passed} / ${data.total} test groups passed`;
      validationBadge(data.passed,data.total);
      if(validationRevision&&validationResults.length===data.total){
        try{localStorage.setItem(validationCacheKey(),JSON.stringify({
          revision:validationRevision,passed:data.passed,total:data.total,results:validationResults,
        }));}catch(_){}
      }
      return;
    case 'validationError':
      validationRunning=false;
      validationUI.rerun.disabled=false;
      validationUI.button.classList.remove('validation-running-button');
      validationUI.progress.hidden=true;
      validationUI.status.textContent=data.message;return;
  }
}
validationUI.button.addEventListener('click',()=>{
  if(!validationUI.dialog.open)validationUI.dialog.showModal();
  if(!validationCompleted&&!validationRunning)startValidation();
});
validationUI.rerun.addEventListener('click',startValidation);
validationUI.close.addEventListener('click',()=>validationUI.dialog.close());
validationUI.dialog.addEventListener('click',event=>{
  if(event.target===validationUI.dialog)validationUI.dialog.close();
});
