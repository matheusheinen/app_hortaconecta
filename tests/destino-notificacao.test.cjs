const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

function carregar(arquivo) {
  const m = new Module(arquivo);
  m._compile(
    ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    arquivo + '.cjs',
  );
  return m.exports;
}
const { destinoNotificacao } = carregar('src/funcionalidades/notificacoes/destino.ts');
const { lerDadosDoToque, dadosDoToque } = carregar('src/funcionalidades/notificacoes/toque.ts');

const n = (tipo, atividade_id = 7, meta_id = null) => ({ tipo, atividade_id, meta_id });

test('gestão: candidatura e presença levam à lista de candidatos da atividade', () => {
  for (const tipo of ['CANDIDATURA_NOVA', 'CANDIDATURA_CANCELADA', 'PRESENCA_CONFIRMADA'])
    assert.deepEqual(destinoNotificacao(n(tipo), true), { tela: 'candidatos', atividadeId: 7 });
});

test('gestão em modo voluntário não tem lista de candidatos: cai no detalhe da atividade', () => {
  assert.deepEqual(destinoNotificacao(n('CANDIDATURA_NOVA'), false), {
    tela: 'atividade',
    atividadeId: 7,
  });
});

test('voluntário: decisão e cancelamento levam à atividade', () => {
  for (const tipo of ['CANDIDATURA_APROVADA', 'CANDIDATURA_RECUSADA', 'ATIVIDADE_CANCELADA'])
    assert.deepEqual(destinoNotificacao(n(tipo), false), { tela: 'atividade', atividadeId: 7 });
});

test('contribuições: gestão vai à fila e voluntário às próprias contribuições', () => {
  assert.deepEqual(destinoNotificacao(n('CONTRIBUICAO_NOVA', null, 3), true), { tela: 'fila' });
  assert.deepEqual(destinoNotificacao(n('CONTRIBUICAO_APROVADA', null, 3), false), {
    tela: 'minhasContribuicoes',
  });
  assert.deepEqual(destinoNotificacao(n('CONTRIBUICAO_RECUSADA', null, 3), false), {
    tela: 'minhasContribuicoes',
  });
});

test('quem mudou de modo ainda chega a algum lugar que existe', () => {
  assert.deepEqual(destinoNotificacao(n('CONTRIBUICAO_NOVA', null, 3), false), {
    tela: 'meta',
    metaId: 3,
  });
  assert.deepEqual(destinoNotificacao(n('CONTRIBUICAO_APROVADA', null, 3), true), {
    tela: 'meta',
    metaId: 3,
  });
});

test('alvo apagado ou tipo desconhecido leva à lista de notificações', () => {
  for (const tipo of ['CANDIDATURA_NOVA', 'CANDIDATURA_APROVADA', 'ATIVIDADE_CANCELADA'])
    assert.deepEqual(destinoNotificacao(n(tipo, null), true), { tela: 'notificacoes' });
  assert.deepEqual(destinoNotificacao(n('CONTRIBUICAO_NOVA', null, null), false), {
    tela: 'notificacoes',
  });
  assert.deepEqual(destinoNotificacao(n('OUTRO'), true), { tela: 'notificacoes' });
});

test('dados do toque: ida e volta e rejeição de conteúdo inválido', () => {
  const nova = { id: 9, tipo: 'CANDIDATURA_NOVA', atividade_id: 7, meta_id: null };
  assert.deepEqual(lerDadosDoToque({ notificacaoId: 9, ...dadosDoToque(nova) }), {
    notificacaoId: 9,
    tipo: 'CANDIDATURA_NOVA',
    atividade_id: 7,
    meta_id: null,
  });
  for (const ruim of [
    null,
    undefined,
    'x',
    {},
    { notificacaoId: '9', tipo: 'CANDIDATURA_NOVA' },
    { notificacaoId: 9, tipo: 'INVENTADO' },
    { notificacaoId: 1.5, tipo: 'CANDIDATURA_NOVA' },
  ])
    assert.equal(lerDadosDoToque(ruim), null, JSON.stringify(ruim));
  assert.equal(
    lerDadosDoToque({ notificacaoId: 9, tipo: 'CANDIDATURA_NOVA', atividade_id: 'x' }).atividade_id,
    null,
    'id inválido vira nulo',
  );
});
