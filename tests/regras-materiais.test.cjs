const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const modulo = new Module('materiais');
modulo._compile(ts.transpileModule(fs.readFileSync('src/lib/regrasMateriais.ts','utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, 'materiais.cjs');
test('quantidades físicas aceitam somente unidades inteiras positivas no limite definido',()=>{
 const { quantidadeMaterial }=modulo.exports;
 assert.equal(quantidadeMaterial('10'),10);
 assert.equal(quantidadeMaterial(' 1000000 '),1000000);
 for(const v of ['','0','-1','1.5','1,5','1e2','Infinity','NaN','1000001']) assert.throws(()=>quantidadeMaterial(v));
});
