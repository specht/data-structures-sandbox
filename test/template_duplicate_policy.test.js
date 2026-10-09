'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const uniqueTemplates=new Set(['my_avl.dart','my_bst.dart','my_hash_table.dart']);

for(const kind of ['starter','example']){
  const directory=path.join(root,'templates',kind);
  const templates=fs.readdirSync(directory).filter(name=>name.endsWith('.dart'));
  assert.ok(templates.length>0,`${kind} templates exist`);
  for(const name of templates){
    const source=fs.readFileSync(path.join(directory,name),'utf8');
    const expected=uniqueTemplates.has(name)?'not allowed':'allowed';
    assert.match(
      source,
      new RegExp(`^\\s*(?:// )?Duplicate policy: ${expected};`, 'm'),
      `${kind}/${name} must state its duplicate policy`,
    );
  }
}

console.log('PASS: every starter and example states whether duplicates are allowed.');
