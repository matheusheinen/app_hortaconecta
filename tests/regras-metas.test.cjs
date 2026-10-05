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
  modulo._compile(ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, arquivo);
  return modulo.exports;
}

const regras = carregar('src/lib/regrasMetas.ts');
const nbsp = texto => texto.replace(/ /g, ' ');

test('Metas: valores aceitam vírgula/ponto com até 2 casas e recusam milhar, zero e lixo', () => {
  assert.equal(regras.interpretarQuantidade('25,50'), 25.5);
  assert.equal(regras.interpretarQuantidade('R$ 10.5'), 10.5);
  assert.equal(regras.interpretarQuantidade('3'), 3);
  for (const invalido of ['', '0', '-5', '1.000,00', '1,234', 'abc', '12345678901', 'Infinity']) {
    assert.equal(regras.interpretarQuantidade(invalido), null, invalido);
  }
});

test('Metas: progresso em reais ou unidades, percentual limitado e prazo', () => {
  const financeira = { tipo: 'FINANCEIRA', unidade_medida: null, quantidade_meta: 100, quantidade_arrecadada: 30 };
  const material = { tipo: 'MATERIAL', unidade_medida: 'kg', quantidade_meta: 10, quantidade_arrecadada: 12 };
  assert.equal(nbsp(regras.descreverProgresso(financeira)), 'R$ 30,00 de R$ 100,00');
  assert.equal(regras.descreverProgresso(material), '12 de 10 kg');
  assert.equal(nbsp(regras.descreverQuantidade(2.5, financeira)), 'R$ 2,50');
  assert.equal(regras.descreverQuantidade(3, { tipo: 'MATERIAL', unidade_medida: null }), '3 un.');
  assert.equal(regras.percentualMeta(financeira), 30);
  assert.equal(regras.percentualMeta(material), 100);
  assert.equal(regras.prazoVencido({ data_limite: '2026-10-04' }, '2026-10-05'), true);
  assert.equal(regras.prazoVencido({ data_limite: '2026-10-05' }, '2026-10-05'), false);
  assert.equal(regras.recebendoContribuicoes({ status: 'ABERTA', data_limite: null }, '2026-10-05'), true);
  assert.equal(regras.recebendoContribuicoes({ status: 'ENCERRADA', data_limite: null }, '2026-10-05'), false);
});

test('Metas: escritas enviam o contrato esperado pela RLS', async () => {
  const chamadas = [];
  const builder = (registro, resposta = { data: [{ id: 1 }], error: null }) => {
    const b = {
      eq: (c, v) => { registro.filtros.push([c, v]); return b; },
      select: async () => resposta,
      then: (ok, falha) => Promise.resolve({ error: null }).then(ok, falha),
    };
    return b;
  };
  let respostaUpdate = { data: [{ id: 1 }], error: null };
  const supabase = {
    from: tabela => ({
      insert: valores => { const r = { tabela, op: 'insert', valores, filtros: [] }; chamadas.push(r); return builder(r); },
      update: valores => { const r = { tabela, op: 'update', valores, filtros: [] }; chamadas.push(r); return builder(r, respostaUpdate); },
    }),
  };
  const metas = carregar('src/lib/metas.ts', { './supabase': { supabase } });
  await metas.declararContribuicao(7, 'v', 25.5);
  assert.deepEqual(chamadas.at(-1).valores, { meta_id: 7, usuario_id: 'v', quantidade_oferecida: 25.5 });
  await metas.registrarRecebimento({ metaId: 7, doadorId: 'v', gestaoId: 'g', quantidade: 3, observacao: null });
  const lancamento = chamadas.at(-1).valores;
  assert.equal(lancamento.status_validacao, 'APROVADA');
  assert.equal(lancamento.validado_por, 'g');
  assert.ok(lancamento.validado_em);
  await metas.validarContribuicao(9, 'g', false, null);
  assert.deepEqual(chamadas.at(-1).filtros, [['id', 9], ['status_validacao', 'PENDENTE']]);
  assert.equal(chamadas.at(-1).valores.status_validacao, 'RECUSADA');
  respostaUpdate = { data: [], error: null };
  await assert.rejects(metas.validarContribuicao(9, 'g', true, null), /já foi conferida/);
  await assert.rejects(metas.alterarStatusMeta(7, 'ENCERRADA'), /não foi atualizada/);
});

test('Metas: só ABERTA fica na aba de abertas', () => {
  assert.equal(regras.metaFinalizada({ status: 'ABERTA' }), false);
  assert.equal(regras.metaFinalizada({ status: 'ENCERRADA' }), true);
  assert.equal(regras.metaFinalizada({ status: 'CANCELADA' }), true);
});
