'use strict';
// The browser's language table (web/js/languages.js):  node test/languages.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(`${fs.readFileSync('web/js/languages.js', 'utf8')}
  globalThis.api = {SANDBOX_LANGUAGES, languageOfVariant, variantName, describeVariant, selectedLanguage};`,
context);
const {SANDBOX_LANGUAGES, languageOfVariant, variantName, describeVariant} = context.api;

// The variants of tool/registry.dart: Dart without an extension, others with one.
assert.equal(languageOfVariant('').id, 'dart');
assert.equal(languageOfVariant('recursive').id, 'dart');
assert.equal(languageOfVariant('.py').id, 'python');
assert.equal(languageOfVariant('v2.js').id, 'javascript');
assert.equal(languageOfVariant('iterative.java').id, 'java');
assert.equal(variantName('iterative.java'), 'iterative');
assert.equal(variantName('.py'), '');
assert.equal(variantName('recursive'), 'recursive');

assert.equal(describeVariant(''), 'the main file');
assert.equal(describeVariant('recursive'), 'the “recursive” variant');
assert.equal(describeVariant('.py'), 'the Python file');
assert.equal(describeVariant('v2.java'), 'the “v2” Java variant');

// Every editor mode is in the bundled CodeMirror; Python comments with #.
const bundle = fs.readFileSync('web/vendor/codemirror.js', 'utf8');
for (const mode of ['dart', 'python', 'javascript', 'clike']) {
  assert.ok(bundle.includes(`defineMode("${mode}"`), mode);
}
assert.ok(bundle.includes('"text/x-java"'));
assert.equal(SANDBOX_LANGUAGES.python.comment, '#');
assert.equal(SANDBOX_LANGUAGES.java.indent, 4);
assert.ok(fs.readFileSync('web/index.html', 'utf8').includes('/js/languages.js'));
console.log('PASS: browser language table, variant descriptions and editor modes.');
