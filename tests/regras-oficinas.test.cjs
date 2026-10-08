const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  Module = require('node:module'),
  ts = require('typescript');
const m = new Module('oficinas');
m._compile(
  ts.transpileModule(fs.readFileSync('src/lib/regrasOficinas.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  'oficinas.cjs',
);
const campos = {
  titulo: 'Música',
  descricao: 'Relato',
  tema: 'Percussão',
  objetivo: 'Aprender',
  duracao: '60',
  conhecimentos: '',
  observacoes: '',
};
test('Oficinas: duração inteira em minutos e limites de texto do formulário', () => {
  assert.equal(m.exports.validarOficina(campos), 60);
  for (const duracao of ['0', '-1', '1,5', '1.5', 'Infinity', '1e2', '1441', ''])
    assert.throws(() => m.exports.validarOficina({ ...campos, duracao }));
  for (const chave of ['titulo', 'descricao', 'tema', 'objetivo'])
    assert.throws(() => m.exports.validarOficina({ ...campos, [chave]: ' ' }));
  assert.throws(() => m.exports.validarOficina({ ...campos, conhecimentos: 'a'.repeat(2001) }));
  assert.equal(m.exports.validarOficina({ ...campos, duracao: '1440' }), 1440);
});
