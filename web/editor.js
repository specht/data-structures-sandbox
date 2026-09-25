'use strict';
// The editor stays writable while a student file is selected. The server
// remains authoritative for file paths and revision-checked writes.
(() => {
  const $ = id => document.getElementById(id);
  const save = $('source-save'), revert = $('source-discard');
  const container = $('source-editor'), oldView = $('code-scroll');
  const status = $('source-edit-status');
  const problems = $('source-problems'), problemCount = $('source-problem-count');
  const problemList = $('source-problem-list');
  let loading = false, saving = false, dirty = false;
  let revision = null, original = '', selection = null, highlighted = null;
  let suppressChange = false, pendingContent = null, sourceOutdated = false;
  let ignoreNextSourceChanged = false;
  let pendingDiagnostics = null, diagnosticMarks = [];
  const locationKey = () => `${selectedStudent}/${structure}`;
  const connected = () => socket && socket.readyState === WebSocket.OPEN;
  const editor = CodeMirror(container, {
    value: 'Create a starter from the app terminal: ./new-structure YOUR_NAME stack array',
    mode: 'dart', theme: 'sandbox', lineNumbers: true, lineWrapping: false,
    indentUnit: 2, tabSize: 2, indentWithTabs: false, smartIndent: true,
    matchBrackets: true, autoCloseBrackets: true, styleActiveLine: false,
    readOnly: 'nocursor', viewportMargin: 15,
    extraKeys: {
      'Ctrl-S': () => saveChanges(), 'Cmd-S': () => saveChanges(),
      'Ctrl-Shift-K': cm => cm.execCommand('deleteLine'),
      'Cmd-Shift-K': cm => cm.execCommand('deleteLine'),
      'Tab': cm => cm.somethingSelected() ? cm.indentSelection('add') : cm.execCommand('insertSoftTab'),
      'Shift-Tab': cm => cm.indentSelection('subtract'),
    },
  });
  container.hidden = false;
  oldView.hidden = true;
  container.classList.add('source-empty');
  // No editing mode: these buttons are present whenever a file is selected.
  save.hidden = false;
  revert.hidden = false;
  revert.title = 'Discard unsaved edits and restore the last saved source';
  revert.setAttribute('aria-label', 'Revert unsaved edits');

  function write(text) {
    suppressChange = true;
    editor.setValue(text);
    editor.clearHistory();
    suppressChange = false;
    editor.refresh();
  }
  function writable(on) {
    editor.setOption('readOnly', on ? false : 'nocursor');
    container.classList.toggle('is-editing', on);
  }
  function setStatus(text, error = false) {
    status.hidden = !text;
    status.textContent = text;
    status.classList.toggle('source-edit-error', error);
  }
  function clearDiagnostics() {
    for (const {line, marker} of diagnosticMarks) {
      editor.removeLineClass(line, 'background', 'source-error-line');
      marker?.clear();
    }
    diagnosticMarks = [];
    pendingDiagnostics = null;
    if (problemList.replaceChildren) problemList.replaceChildren();
    else problemList.textContent = ''; // Tolerate minimal editor test doubles.
    problems.hidden = true;
  }
  function receiveDiagnostics(message) {
    if (selection !== locationKey() || message.student !== selectedStudent ||
        message.structure !== structure || dirty) return;
    if (loading || revision === null) {
      pendingDiagnostics = message; // A failed select can precede readSource.
      return;
    }
    if (message.revision !== revision) return; // An older compile must not mark new code.
    clearDiagnostics();
    const entries = Array.isArray(message.diagnostics) ? message.diagnostics : [];
    for (const issue of entries) {
      if (!Number.isInteger(issue.line) || issue.line < 1 ||
          issue.line > editor.lineCount()) continue;
      const line = issue.line - 1;
      const sourceLine = editor.getLine(line);
      const column = Math.max(0, Math.min(sourceLine.length, (issue.column || 1) - 1));
      const end = Math.min(sourceLine.length, column + Math.max(1, issue.length || 1));
      const messageText = String(issue.message || 'Dart could not compile this line.');
      editor.addLineClass(line, 'background', 'source-error-line');
      const marker = end > column ? editor.markText(
        {line, ch: column}, {line, ch: end},
        {className: 'source-error-underline', title: messageText}) : null;
      diagnosticMarks.push({line, marker});
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'source-problem';
      button.textContent = `Line ${issue.line}, column ${issue.column || 1}: ${messageText}`;
      button.addEventListener('click', () => {
        editor.setCursor({line, ch: column});
        editor.scrollIntoView({line, ch: column}, 90);
        editor.focus();
      });
      item.append(button);
      problemList.append(item);
    }
    if (!diagnosticMarks.length) return;
    problemCount.textContent = diagnosticMarks.length === 1 ?
      '1 compilation error · select to jump to the source' :
      `${diagnosticMarks.length} compilation errors · select to jump to the source`;
    problems.hidden = false;
    const first = diagnosticMarks[0];
    editor.scrollIntoView({line: first.line, ch: 0}, 90);
    setStatus('Compilation failed · fix the marked lines, then save again', true);
  }
  function updateDirty() {
    dirty = revision !== null && editor.getValue() !== original;
    save.disabled = !dirty || saving || loading || !connected();
    revert.disabled = !dirty || saving;
    setStatus(dirty ? 'Unsaved changes · Ctrl+S to save · Ctrl+Shift+K deletes a line' : 'Saved');
  }
  editor.on('change', () => {
    if (suppressChange || revision === null) return;
    updateDirty();
    if (dirty) {
      highlight(null); // The recorded trace refers to the saved source.
      clearDiagnostics(); // Diagnostics also refer to the previously saved text.
    }
  });
  function requestSource() {
    if (loading || saving || !selectedStudent || !structure || !connected()) return;
    if (selection !== locationKey()) return;
    loading = true;
    setStatus('Loading source…');
    socket.send(JSON.stringify({action: 'readSource'}));
  }
  function resetSelection() {
    clearDiagnostics();
    selection = null; loading = false; saving = false; dirty = false;
    revision = null; original = ''; pendingContent = null; sourceOutdated = false;
    ignoreNextSourceChanged = false;
    writable(false);
    save.disabled = true;
    revert.disabled = true;
    setStatus('');
  }
  function receive(message) {
    if (message.type === 'sourceFile') {
      if (!loading || selection !== locationKey() ||
          message.student !== selectedStudent || message.structure !== structure) return;
      loading = false;
      if (dirty || saving) {
        sourceOutdated = true;
        setStatus('Source changed elsewhere. Your draft is preserved; saving will check for a conflict.', true);
        updateButtons();
        return;
      }
      const queued = pendingDiagnostics;
      clearDiagnostics();
      revision = message.revision;
      original = message.content;
      sourceOutdated = false;
      container.classList.remove('source-empty');
      highlight(null);
      write(original);
      writable(true);
      updateDirty();
      if (queued) receiveDiagnostics(queued);
    } else if (message.type === 'sourceSaved') {
      if (!saving || selection !== locationKey() ||
          message.student !== selectedStudent || message.structure !== structure) return;
      saving = false;
      clearDiagnostics();
      original = message.content;
      revision = message.revision;
      pendingContent = null;
      sourceOutdated = false;
      // The host broadcasts our own save as a source change. It is not a conflict.
      ignoreNextSourceChanged = true;
      // A user may continue typing while the save is in flight. Keep that text.
      updateDirty();
      ui.cmdStatus.textContent = 'Saved · updating the visualizer…';
    } else if (message.type === 'sourceError') {
      loading = false;
      saving = false;
      pendingContent = null;
      if (message.message?.includes('Source changed since editing began')) sourceOutdated = true;
      updateButtons();
      setStatus(message.message, true);
    }
  }
  function updateButtons() {
    save.disabled = !dirty || saving || loading || !connected();
    revert.disabled = !dirty || saving;
  }
  function saveChanges() {
    if (revision === null || !dirty || saving || loading ||
        selection !== locationKey() || !connected()) return;
    saving = true;
    pendingContent = editor.getValue();
    updateButtons();
    setStatus('Saving…');
    socket.send(JSON.stringify({action: 'saveSource', revision, content: pendingContent}));
  }
  function revertChanges() {
    if (!dirty || saving || revision === null) return;
    if (!window.confirm('Discard unsaved changes and restore the last saved source?')) return;
    highlight(null);
    clearDiagnostics();
    write(original);
    updateDirty();
    if (sourceOutdated) requestSource();
    else setStatus('Reverted to last saved source');
  }
  function highlight(line) {
    if (highlighted !== null) editor.removeLineClass(highlighted, 'background', 'source-execution-line');
    highlighted = null;
    if (dirty || !Number.isInteger(line) || line < 1 || line > editor.lineCount()) return;
    highlighted = line - 1;
    editor.addLineClass(highlighted, 'background', 'source-execution-line');
    editor.scrollIntoView({line: highlighted, ch: 0}, 90);
  }
  function renderSource(src) {
    // Rebuilding the worker must not replace an unsaved draft or reset the caret.
    // Read the actual file separately to establish an authoritative revision.
    if (selection === locationKey() && (revision !== null || loading)) return;
    container.classList.remove('source-empty');
    highlight(null);
    write(src.lines.join('\n'));
    editor.scrollTo(null, 0);
  }
  function ready() {
    if (!selectedStudent || !structure) return;
    const key = locationKey();
    if (selection !== key) {
      resetSelection();
      selection = key;
      write('Loading selected source…');
      container.classList.remove('source-empty');
    }
    if (revision === null) requestSource();
    else updateButtons();
  }
  function clear() {
    if (dirty) {
      setStatus('The selected file is unavailable. Your unsaved draft is preserved.', true);
      return;
    }
    resetSelection();
    highlighted = null;
    container.classList.add('source-empty');
    write('Create a starter from the app terminal:\n\n./new-structure YOUR_NAME stack array');
  }
  function canLeave() {
    return !saving && (!dirty || window.confirm('Discard unsaved changes to this source file?'));
  }
  save.addEventListener('click', saveChanges);
  revert.addEventListener('click', revertChanges);
  window.addEventListener('beforeunload', event => {
    if (!dirty) return;
    event.preventDefault(); event.returnValue = '';
  });
  window.sandboxEditor = {
    lastSource: null,
    receive, canLeave, highlight,
    renderSource(src) {this.lastSource = src; renderSource(src);},
    beforeSelection() {if (!canLeave()) return false; resetSelection(); return true;},
    receiveDiagnostics,
    compiled() {if (!dirty) clearDiagnostics();},
    sourceChanged() {
      if (selection !== locationKey()) return;
      if (!dirty) clearDiagnostics();
      if (ignoreNextSourceChanged) { ignoreNextSourceChanged = false; return; }
      if (dirty || saving) {
        sourceOutdated = true;
        setStatus('Source changed elsewhere. Your draft is preserved; saving will check for a conflict.', true);
      } else requestSource();
    },
    ready,
    clear() {this.lastSource = null; clear();},
    isEditing() {return revision !== null;},
  };
  resetSelection();
  clear();
})();
