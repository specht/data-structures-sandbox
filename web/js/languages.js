'use strict';
// The languages students may write in: editor mode, indentation, line comment
// and completion words. A file's language is its extension, which the host
// keeps in the variant: '' and 'recursive' are Dart files, '.py' is my_bst.py
// and 'recursive.java' is my_bst_recursive.java (see tool/registry.dart).
const STORAGE_WORDS = ['FixedMemory', 'ListMemory', 'QueueMemory', 'HeapMemory', 'ListNode',
  'TreeNode', 'HashBuckets', 'memory', 'head', 'tail', 'root', 'next', 'left', 'right', 'height',
  'value', 'size', 'top', 'front', 'rear', 'buckets'];
const SANDBOX_LANGUAGES = {
  dart: {id: 'dart', label: 'Dart', extension: '', mode: 'dart', indent: 2, comment: '//',
    print: 'print(...)', words: ['abstract', 'as', 'assert', 'bool', 'break', 'case', 'class',
      'const', 'continue', 'double', 'dynamic', 'else', 'extends', 'false', 'final',
      'for', 'if', 'import', 'in', 'int', 'is', 'late', 'List', 'Map', 'new', 'null',
      'override', 'return', 'static', 'String', 'super', 'switch', 'this', 'throw',
      'true', 'var', 'void', 'while']},
  python: {id: 'python', label: 'Python', extension: '.py', mode: 'python', indent: 4, comment: '#',
    print: 'print(...)', words: ['and', 'break', 'class', 'continue', 'def', 'elif', 'else',
      'False', 'for', 'from', 'if', 'import', 'in', 'is', 'len', 'None', 'not', 'or', 'pass',
      'print', 'raise', 'range', 'return', 'self', 'True', 'while', 'index_for', 'is_empty',
      'append', 'pop', 'swap', ...STORAGE_WORDS]},
  javascript: {id: 'javascript', label: 'JavaScript', extension: '.js', mode: 'javascript', indent: 2,
    comment: '//', print: 'console.log(...)', words: ['break', 'class', 'console', 'const',
      'constructor', 'continue', 'else', 'export', 'default', 'false', 'for', 'if', 'import', 'length',
      'let', 'Math', 'new', 'null', 'return', 'this', 'throw', 'true', 'undefined', 'while',
      'indexFor', 'add', 'removeLast', 'swap', ...STORAGE_WORDS]},
  java: {id: 'java', label: 'Java', extension: '.java', mode: 'text/x-java', indent: 4, comment: '//',
    print: 'System.out.println(...)', words: ['boolean', 'break', 'class', 'continue', 'double',
      'else', 'false', 'for', 'if', 'import', 'int', 'Integer', 'length', 'Math', 'new', 'null',
      'private', 'public', 'return', 'System', 'this', 'throw', 'true', 'void', 'while', 'get',
      'set', 'indexFor', 'add', 'removeLast', 'swap', 'isEmpty', ...STORAGE_WORDS]},
};

/** The language of a variant ('' and plain names are Dart). */
function languageOfVariant(variant) {
  const text = String(variant ?? '');
  for (const language of Object.values(SANDBOX_LANGUAGES)) {
    if (language.extension && text.endsWith(language.extension)) return language;
  }
  return SANDBOX_LANGUAGES.dart;
}

/** 'recursive.py' → 'recursive' (the variant's name without the extension). */
function variantName(variant) {
  const text = String(variant ?? '');
  const {extension} = languageOfVariant(text);
  return extension ? text.slice(0, -extension.length) : text;
}

/** 'the main file', 'the “recursive” variant', 'the Python file', 'the “recursive” Java variant'. */
function describeVariant(variant) {
  const name = variantName(variant);
  const language = languageOfVariant(variant);
  const qualifier = language.id === 'dart' ? '' : `${language.label} `;
  if (!name) return language.id === 'dart' ? 'the main file' : `the ${qualifier}file`;
  return `the “${name}” ${qualifier}variant`;
}

/** The language of the selected implementation (selection.js owns `variant`). */
function selectedLanguage() {
  return languageOfVariant(typeof variant === 'string' ? variant : '');
}
