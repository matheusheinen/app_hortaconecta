const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

function carregar(arquivo, dependencias = {}) {
  const modulo = new Module(arquivo);
  modulo.require = nome => {
    if (nome in dependencias) return dependencias[nome];
    throw new Error('Import inesperado: ' + nome);
  };
  modulo._compile(
    ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    arquivo,
  );
  return modulo.exports;
}

const metas = carregar('src/funcionalidades/metas/regras.ts', {
  '@/compartilhado/utils/datas': carregar('src/compartilhado/utils/datas.ts'),
});
const diario = carregar('src/funcionalidades/diario/regras.ts');
const nbsp = texto => texto.replace(/ /g, ' ');

test('Compartilhar (B18): meta financeira com progresso, prazo e convite', () => {
  const texto = nbsp(
    metas.textoCompartilharMeta({
      titulo: 'Sementes de inverno',
      descricao: 'Compra de sementes para a próxima estação.',
      tipo: 'FINANCEIRA',
      unidade_medida: null,
      quantidade_meta: 400,
      quantidade_arrecadada: 100,
      data_limite: '2026-12-10',
    }),
  );
  assert.match(texto, /^🌱 Ajude a Horta Conecta: Sementes de inverno/);
  assert.match(texto, /Compra de sementes/);
  assert.match(texto, /R\$ 100,00 de R\$ 400,00 \(25%\)/);
  assert.match(texto, /Prazo: 10\/12\/2026\./);
  assert.match(texto, /app Horta Conecta\.$/);
});

test('Compartilhar (B18): meta material sem prazo e descrição longa resumida', () => {
  const texto = nbsp(
    metas.textoCompartilharMeta({
      titulo: 'Adubo',
      descricao: 'a'.repeat(500),
      tipo: 'MATERIAL',
      unidade_medida: 'kg',
      quantidade_meta: 10,
      quantidade_arrecadada: 3,
      data_limite: null,
    }),
  );
  assert.match(texto, /3 de 10 kg \(30%\)/);
  assert.doesNotMatch(texto, /Prazo/);
  assert.ok(texto.includes('a'.repeat(199) + '…'));
  assert.ok(!texto.includes('a'.repeat(200)));
});

test('Compartilhar (B18): publicação leva só título e relato resumido, sem imagem', () => {
  const curta = diario.textoCompartilharPublicacao({
    titulo: 'Mutirão de plantio',
    texto: 'Plantamos 40 mudas.',
    descricao_curta: null,
  });
  assert.equal(
    curta,
    '🌱 Diário da Horta Conecta: Mutirão de plantio\n\nPlantamos 40 mudas.\n\nAcompanhe pelo app Horta Conecta.',
  );
  const longa = diario.textoCompartilharPublicacao({
    titulo: 'Relato',
    texto: 'b'.repeat(1000),
    descricao_curta: null,
  });
  assert.ok(longa.includes('b'.repeat(279) + '…'));
  const vazia = diario.textoCompartilharPublicacao({
    titulo: 'Só título',
    texto: null,
    descricao_curta: null,
  });
  assert.equal(vazia, '🌱 Diário da Horta Conecta: Só título\n\nAcompanhe pelo app Horta Conecta.');
});
