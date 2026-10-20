const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

const arquivo = 'src/compartilhado/componentes/memoTela.ts';
const modulo = new Module(arquivo);
modulo.require = nome => {
  if (nome === 'react') return { memo: (tela, comparar) => ({ tela, comparar }) };
  throw new Error('Import inesperado: ' + nome);
};
modulo._compile(
  ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  arquivo,
);
const { comparar } = modulo.exports.memoTela(() => null);

test('memoTela: ignora funções recriadas e renderiza quando um dado muda', () => {
  assert.equal(comparar({ id: 1, voltar: () => {} }, { id: 1, voltar: () => {} }), true);
  assert.equal(comparar({ id: 1, voltar: () => {} }, { id: 2, voltar: () => {} }), false);
  // Callback opcional que aparece ou some (ex.: recurso fora do MVP) também conta.
  assert.equal(comparar({ abrir: undefined }, { abrir: () => {} }), false);
  assert.equal(comparar({ a: 1 }, { a: 1, b: true }), false);
});
