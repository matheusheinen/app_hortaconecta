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

function api({ solicitada = null, erroRpc = null } = {}) {
  const eventos = [];
  const supabase = {
    from: tabela => ({
      select: colunas => ({
        eq: (campo, valor) => ({
          single: async () => {
            eventos.push(['select', tabela, colunas, campo, valor]);
            return { data: { exclusao_solicitada_em: solicitada }, error: null };
          },
        }),
      }),
    }),
    rpc: async nome => {
      eventos.push(['rpc', nome]);
      return { data: null, error: erroRpc };
    },
  };
  return {
    eventos,
    ...carregar('src/funcionalidades/perfil/apiExclusao.ts', {
      '@/servicos/supabase': { supabase },
    }),
  };
}

test('Exclusão de dados (RNF0004): lê só a data do pedido do próprio usuário', async () => {
  const { eventos, carregarSolicitacaoExclusao } = api({ solicitada: '2026-11-08T13:00:00Z' });
  assert.equal(await carregarSolicitacaoExclusao('u1'), '2026-11-08T13:00:00Z');
  assert.deepEqual(eventos, [['select', 'usuarios', 'exclusao_solicitada_em', 'id', 'u1']]);
  assert.equal(await api().carregarSolicitacaoExclusao('u1'), null);
});

test('Exclusão de dados (RNF0004): o pedido passa pela RPC e repassa o erro do banco', async () => {
  const ok = api();
  await ok.solicitarExclusaoConta();
  assert.deepEqual(ok.eventos, [['rpc', 'solicitar_exclusao_conta']]);
  const falha = api({ erroRpc: new Error('Convidado não pode solicitar exclusão.') });
  await assert.rejects(falha.solicitarExclusaoConta(), /Convidado/);
});
