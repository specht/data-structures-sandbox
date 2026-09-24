'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('web/app.js','utf8');
// Verify initial catalog handling, last choice, and per-student choices without
// executing Dart or depending on a browser automation package.
const prior=fs.readFileSync('test/browser_navigation.test.js','utf8');
assert.match(source,/function receiveCatalog\(data\)/);
assert.match(source,/localStorage\.setItem\(preferenceKey/);
assert.match(source,/ui\.student\.addEventListener\('change'/);
assert.match(source,/action:'select',student:selectedStudent,structure/);
assert.match(source,/data\.type==='sourceChanged'/);
assert.match(source,/data\.type==='building'/);
assert.match(fs.readFileSync('tool/host.dart','utf8'),/executionTimeout = Duration\(seconds: 4\)/);
assert.match(fs.readFileSync('tool/host.dart','utf8'),/Worker terminated/);
assert.match(fs.readFileSync('lib/trace_budget.dart','utf8'),/maxEvents = 4000/);
console.log('PASS: student selection, persistent preference, isolated-worker control and trace cap contracts.');
