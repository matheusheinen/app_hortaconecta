const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  Module = require('node:module'),
  ts = require('typescript');
const m = new Module('certificado');
m._compile(
  ts.transpileModule(fs.readFileSync('src/funcionalidades/certificados/texto.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  'certificado.cjs',
);
test('Certificado: conteúdo mínimo e limitação explícita de horas previstas', () => {
  const texto = m.exports.textoCertificado({
    id: 'identificador-unico',
    nome_voluntario: 'Ana',
    instituicao: 'ONG Teste',
    atividade: 'Plantio',
    data_atividade: '2026-09-24T13:00:00Z',
    emitido_em: '2026-09-24T15:00:00Z',
    carga_horaria_prevista: 2.5,
  });
  for (const trecho of [
    'HORTA CONECTA',
    'Ana',
    'ONG Teste',
    'Plantio',
    '24/09/2026',
    '2.5',
    'HC-identificador-unico',
    'Emitido em',
    'não comprova a quantidade de horas efetivamente realizadas',
  ])
    assert.ok(texto.includes(trecho), trecho);
});
