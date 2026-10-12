'use strict';
// Class progress: where everyone in the class stands, shared with all students.
const progressUI={
  button:$('progress-open'),
  dialog:$('progress-dialog'),
  close:$('progress-close'),
  refresh:$('progress-refresh'),
  status:$('progress-status'),
  head:$('progress-head'),
  body:$('progress-body'),
  foot:$('progress-foot'),
};
let progressSnapshotData=null;
let progressChecking=null;

const PROGRESS_LABELS={
  unsorted_array_list:'Unsorted list · array',
  unsorted_linked_list:'Unsorted list · nodes',
  sorted_array_list:'Sorted list · array',
  sorted_linked_list:'Sorted list · nodes',
  tree:'BST',
  avl:'AVL',
  stack:'Stack · array',
  linked_stack:'Stack · nodes',
  array_queue:'Queue · array',
  linked_queue:'Queue · nodes',
  array_heap:'Heap · array',
  hash:'Hash table',
};

// A student may have one structure in several files: other languages or
// versions (my_avl.dart, my_avl.py, my_avl_recursive.dart). The cell shows the
// best; a small "2×" says there is more, and hovering it lists every file.
const PROGRESS_LANGUAGE_ORDER=['Dart','Python','JavaScript','Java'];
function progressImplementationName(entry){
  return entry.name?`${entry.language} (${entry.name})`:entry.language;
}
function progressImplementationDescription(entry){
  const name=progressImplementationName(entry);
  if(entry.state==='complete')return `${name}: all ${entry.total} checks pass`;
  if(entry.tested)return entry.error?`${name}: tests could not complete`:
    `${name}: ${entry.passed??0} / ${entry.total} checks pass`;
  return `${name}: awaiting checks`;
}
function progressImplementations(cell){
  const list=Array.isArray(cell?.implementationList)?[...cell.implementationList]:[];
  const rank=language=>{const index=PROGRESS_LANGUAGE_ORDER.indexOf(language);return index<0?9:index;};
  return list.sort((a,b)=>rank(a.language)-rank(b.language)||String(a.name).localeCompare(String(b.name)));
}

function progressDescription(cell){
  if(!cell||cell.state==='missing')return 'No implementation';
  const list=progressImplementations(cell);
  if(list.length>1){
    const working=list.filter(entry=>entry.state==='complete').length;
    return `${progressDescription({...cell,implementations:1,implementationList:null})} · `+
      `${list.length} implementations, ${working} passing all checks: `+
      list.map(progressImplementationDescription).join(' · ');
  }
  if(cell.implementations>1){
    const best=globalThis.describeVariant?describeVariant(cell.variant??''):cell.variant?`the “${cell.variant}” variant`:'the main file';
    return `${progressDescription({...cell,implementations:1})} · best of ${cell.implementations} implementations (${best})`;
  }
  if(cell.state==='complete'){
    return `Fully verified · ${cell.passed} / ${cell.total} checks passed`;
  }
  if(cell.tested){
    if(cell.error)return `Started · tests could not complete: ${cell.error}`;
    return `Started · ${cell.passed} / ${cell.total} checks passed`;
  }
  return 'Started · awaiting automated checks';
}

function renderProgress(data){
  progressSnapshotData=data;
  const structures=Array.isArray(data.structures)?data.structures:[];
  const students=Array.isArray(data.students)?data.students:[];
  const loadedStudent=selectedStudent;
  const loadedStructure=structure;

  const header=document.createElement('tr');
  const studentHeader=document.createElement('th');
  studentHeader.scope='col';
  studentHeader.textContent='Student';
  header.append(studentHeader);

  for(const structureInfo of structures){
    const th=document.createElement('th');
    th.scope='col';
    th.textContent=PROGRESS_LABELS[structureInfo.id]??structureInfo.label??structureInfo.id;
    th.title=structureInfo.label??structureInfo.id;
    if(structureInfo.id===loadedStructure){
      th.className='progress-loaded-column';
      th.setAttribute('aria-current','true');
      th.title=`${th.title} · currently loaded`;
    }
    header.append(th);
  }
  progressUI.head.replaceChildren(header);

  progressUI.body.replaceChildren();
  for(const student of students){
    const row=document.createElement('tr');
    const loadedRow=student.id===loadedStudent;
    if(loadedRow)row.className='progress-loaded-row';
    const name=document.createElement('th');
    name.scope='row';
    name.textContent=student.id;
    if(loadedRow){
      name.setAttribute('aria-current','true');
      name.title='Currently loaded student';
    }
    row.append(name);

    for(const structureInfo of structures){
      const cell=student.cells?.[structureInfo.id]??{state:'missing'};
      const loadedColumn=structureInfo.id===loadedStructure;
      const checking=progressChecking?.student===student.id&&
        progressChecking?.structure===structureInfo.id;
      const td=document.createElement('td');
      td.className=`progress-cell progress-${cell.state??'missing'}`;
      if(cell.state==='pending')td.className+=cell.tested?
        ' progress-incomplete':' progress-awaiting';
      if(loadedColumn)td.className+=' progress-loaded-column';
      if(loadedRow&&loadedColumn){
        td.className+=' progress-loaded-cell';
        td.setAttribute('aria-current','true');
      }
      if(checking)td.className+=' progress-checking';

      const marker=document.createElement('span');
      marker.className='progress-marker';
      if(cell.state==='missing'){
        marker.textContent='—';
      }else{
        const icon=document.createElement('span');
        icon.className='progress-state-icon';
        icon.innerHTML=checking
          ?'<svg class="ui-icon spinner-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="/vendor/tabler-icons.svg#ti-loader-2"/></svg>'
          :cell.state==='complete'
          ?'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="/vendor/tabler-icons.svg#ti-check"/></svg>'
          :'<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="/vendor/tabler-icons.svg#ti-loader-2"/></svg>';
        const ratio=document.createElement('span');
        ratio.className='progress-ratio';
        const total=Number.isInteger(cell.total)?cell.total:'?';
        ratio.textContent=cell.tested?`${cell.passed}/${total}`:`…/${total}`;
        marker.append(icon,ratio);
        const list=progressImplementations(cell);
        if(list.length>1){
          const working=list.filter(entry=>entry.state==='complete').length;
          const more=document.createElement('span');
          more.className=`progress-more${working>1?' progress-more-working':''}`;
          more.textContent=`${list.length}×`;
          more.title=list.map(progressImplementationDescription).join('\n');
          marker.append(more);
        }
      }

      const description=checking?
        `Checking now · ${progressDescription(cell)}`:progressDescription(cell);
      marker.setAttribute('aria-label',description);
      marker.title=description;
      td.append(marker);
      row.append(td);
    }

    progressUI.body.append(row);
  }
  renderProgressSummary(structures,students);
}

// The last row: how far the whole class is with each structure.
function renderProgressSummary(structures,students){
  const row=document.createElement('tr');
  const label=document.createElement('th');
  label.scope='row';
  label.textContent='Class';
  label.title=`${students.length} students`;
  row.append(label);
  for(const structureInfo of structures){
    const cells=students.map(student=>student.cells?.[structureInfo.id]??{state:'missing'});
    const complete=cells.filter(cell=>cell.state==='complete').length;
    const started=cells.filter(cell=>cell.state&&cell.state!=='missing').length;
    const td=document.createElement('td');
    td.className='progress-summary-cell';
    const summary=document.createElement('span');
    summary.className='progress-summary';
    summary.innerHTML='<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="/vendor/tabler-icons.svg#ti-check"/></svg>';
    const count=document.createElement('span');
    count.textContent=`${complete}/${students.length}`;
    summary.append(count);
    const startedNote=document.createElement('span');
    startedNote.className='progress-summary-started';
    startedNote.textContent=`· ${started} started`;
    const description=`${complete} of ${students.length} students pass all checks · ${started} started`;
    td.title=description;
    td.setAttribute('aria-label',description);
    td.append(summary,startedNote);
    row.append(td);
  }
  progressUI.foot.replaceChildren(...(students.length?[row]:[]));
}
function refreshProgressHighlights(){
  if(progressSnapshotData)renderProgress(progressSnapshotData);
}

function requestProgressOverview(){
  if(!socket||socket.readyState!==WebSocket.OPEN){
    progressUI.status.textContent='Connection unavailable; reconnect and refresh.';
    return;
  }
  progressUI.status.textContent='Checking class progress…';
  socket.send(JSON.stringify({action:'progressOverview'}));
}

function progressMessage(data){
  if(data.type==='progressSnapshot'){
    renderProgress(data);
    return;
  }
  if(data.type==='progressStatus'){
    progressChecking=data.student&&data.structure?
      {student:data.student,structure:data.structure}:null;
    progressUI.status.textContent=data.message??'Class progress updated.';
    if(progressSnapshotData)renderProgress(progressSnapshotData);
  }
}

progressUI.button.addEventListener('click',()=>{
  if(!progressUI.dialog.open)progressUI.dialog.showModal();
  requestProgressOverview();
});
progressUI.refresh.addEventListener('click',requestProgressOverview);
progressUI.close.addEventListener('click',()=>progressUI.dialog.close());
progressUI.dialog.addEventListener('click',event=>{
  if(event.target===progressUI.dialog)progressUI.dialog.close();
});
