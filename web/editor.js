'use strict';
// The same bundled CodeMirror editor is used for reading, stepping and editing.
// The server selects the writable file and rejects stale revisions.
(() => {
  const $ = id => document.getElementById(id);
  const edit = $('source-edit'), save = $('source-save'), discard = $('source-discard');
  const container = $('source-editor'), oldView = $('code-scroll');
  const status = $('source-edit-status');
  let mode = false, loading = false, saving = false, dirty = false;
  let revision = null, original = '', selection = null, highlighted = null;
  let suppressChange = false, available = false;
  const locationKey = () => `${selectedStudent}/${structure}`;
  const editor = CodeMirror(container, {
    value: 'Create a starter from the app terminal: ./new-structure YOUR_NAME stack array',
    mode: 'dart', theme: 'sandbox', lineNumbers: true, lineWrapping: false,
    indentUnit: 2, tabSize: 2, indentWithTabs: false, smartIndent: true,
    matchBrackets: true, autoCloseBrackets: true, styleActiveLine: false,
    readOnly: 'nocursor', viewportMargin: 15,
    extraKeys: {
      'Ctrl-S': () => saveChanges(), 'Cmd-S': () => saveChanges(),
      'Tab': cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.execCommand('insertSoftTab'),
      'Shift-Tab': cm => cm.indentSelection('subtract'),
    },
  });
  container.hidden = false;
  oldView.hidden = true;
  container.classList.add('source-empty');
  // Read-only playback remains selectable and copyable.
  function write(text) {
    suppressChange = true;
    editor.setValue(text);
    editor.clearHistory();
    suppressChange = false;
    editor.refresh();
  }
  function readOnly(value) {
    editor.setOption('readOnly', value ? 'nocursor' : false);
    container.classList.toggle('is-editing', !value);
    if (!value) editor.focus();
  }
  function setStatus(text, error = false) {
    status.hidden = !text;
    status.textContent = text;
    status.classList.toggle('source-edit-error', error);
  }
  function updateDirty() {
    dirty = editor.getValue() !== original;
    save.disabled = !dirty || loading || saving;
    setStatus(dirty ? 'Unsaved changes · Ctrl+S to save' : 'Saved');
  }
  editor.on('change', () => { if (!suppressChange && mode && !saving) updateDirty(); });
  function canLeave() {
    return !dirty || window.confirm('Discard unsaved changes to this source file?');
  }
  function leave() {
    mode = false; loading = false; saving = false; dirty = false;
    revision = null; selection = null; original = '';
    readOnly(true);
    edit.hidden = false; edit.disabled = !available;
    save.hidden = true; discard.hidden = true;
    setStatus('');
  }
  function begin() {
    if (mode || loading || !available || !selectedStudent || !structure ||
        !socket || socket.readyState !== WebSocket.OPEN) return;
    loading = true; edit.disabled = true;
    setStatus('Loading source…');
    socket.send(JSON.stringify({action: 'readSource'}));
  }
  function receive(message) {
    if (message.type === 'sourceFile') {
      if (!loading || message.student !== selectedStudent || message.structure !== structure) return;
      loading = false; mode = true; selection = locationKey();
      revision = message.revision; original = message.content;
      // Re-read the authoritative source before enabling edits. Any concurrent
      // change after this point is detected again by the server at save time.
      write(original); readOnly(false);
      edit.hidden = true; save.hidden = false; discard.hidden = false;
      updateDirty();
    } else if (message.type === 'sourceSaved') {
      if (!saving || selection !== locationKey()) return;
      original = message.content; revision = message.revision;
      leave();
      ui.cmdStatus.textContent = 'Saved · updating the visualizer…';
    } else if (message.type === 'sourceError') {
      loading = false; saving = false;
      if (mode) { readOnly(false); save.disabled = !dirty; }
      else edit.disabled = !available;
      setStatus(message.message, true);
    }
  }
  function saveChanges() {
    if (!mode || !dirty || saving || !revision || selection !== locationKey() ||
        !socket || socket.readyState !== WebSocket.OPEN) return;
    saving = true; save.disabled = true; readOnly(true);
    setStatus('Saving…');
    socket.send(JSON.stringify({action: 'saveSource', revision, content: editor.getValue()}));
  }
  function highlight(line) {
    if (highlighted !== null) editor.removeLineClass(highlighted, 'background', 'source-execution-line');
    highlighted = null;
    if (!Number.isInteger(line) || line < 1 || line > editor.lineCount()) return;
    highlighted = line - 1;
    editor.addLineClass(highlighted, 'background', 'source-execution-line');
    editor.scrollIntoView({line: highlighted, ch: 0}, 90);
  }
  function renderSource(src) {
    if (mode) return; // A new worker trace must never overwrite an unsaved draft.
    available = true;
    container.classList.remove('source-empty');
    highlight(null);
    write(src.lines.join('\n'));
    editor.scrollTo(null, 0);
    edit.disabled = false;
  }
  function clear() {
    if (mode) {setStatus('The selected file is unavailable. Your unsaved draft is preserved.', true);return;}
    available = false; leave();
    highlight(null);
    container.classList.add('source-empty');
    write('Create a starter from the app terminal:\n\n./new-structure YOUR_NAME stack array');
  }
  edit.addEventListener('click', begin);
  save.addEventListener('click', saveChanges);
  discard.addEventListener('click', () => {if (!canLeave()) return;leave();
    // Restore the latest source shown in playback; never keep a discarded draft.
    if (window.sandboxEditor.lastSource) renderSource(window.sandboxEditor.lastSource);
  });
  window.addEventListener('beforeunload', event => {
    if (!dirty) return;
    event.preventDefault();event.returnValue = '';
  });
  window.sandboxEditor = {
    lastSource: null,
    receive, canLeave, highlight,
    renderSource(src) {this.lastSource = src;renderSource(src);},
    beforeSelection() {if (!canLeave()) return false;leave();return true;},
    sourceChanged() {
      if (mode) setStatus(dirty ? 'Source changed elsewhere. Save will check for a conflict.' :
        'Source changed elsewhere. Cancel and reopen Edit to load it.', true);
      else if (loading) {loading = false;edit.disabled = !available;}
    },
    ready() {available = true; edit.disabled = false;},
    clear() {this.lastSource = null;clear();},
    isEditing() {return mode;},
  };
  leave();
  // A freshly cloned sandbox has no source, so keep the meaningful empty state.
  clear();
})();
