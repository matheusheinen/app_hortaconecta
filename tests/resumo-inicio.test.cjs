const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

function compilar(arquivo, dependencias = {}) {
  const modulo = new Module(arquivo);
  modulo.require = nome => {
    if (!(nome in dependencias)) throw new Error(`Import inesperado: ${nome}`);
    return dependencias[nome];
  };
  modulo._compile(
    ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    arquivo,
  );
  return modulo.exports;
}

const regras = compilar('src/funcionalidades/inicio/regras.ts');

function carregar(respostas = {}) {
  const consulta = {
    limite: null,
    select() {
      return this;
    },
    eq() {
      return this;
    },
    gte() {
      return this;
    },
    order() {
      return this;
    },
    limit(valor) {
      this.limite = valor;
      return this;
    },
    then(resolver, rejeitar) {
      const resposta = respostas.atividades ?? { data: [], error: null };
      return Promise.resolve({
        ...resposta,
        data:
          Array.isArray(resposta.data) && this.limite !== null
            ? resposta.data.slice(0, this.limite)
            : resposta.data,
      }).then(resolver, rejeitar);
    },
  };
  const dependencias = {
    '@/servicos/supabase': {
      supabase: {
        async rpc() {
          return respostas.elegibilidade ?? { data: true, error: null };
        },
        from(tabela) {
          return tabela === 'contribuicoes'
            ? { select: async () => ({ data: [], error: null }) }
            : consulta;
        },
      },
    },
    '@/funcionalidades/voluntariado/api': { carregarMinhasInscricoes: async () => [] },
    '@/funcionalidades/metas/api': { listarMetas: async () => [] },
    '@/funcionalidades/diario/api': { listarDiario: async () => [] },
    './regras': regras,
  };
  return compilar('src/funcionalidades/inicio/api.ts', dependencias);
}
const { montarResumoInicio, formatarHorasInicio, progressoMetaInicio } = regras;
const agora = new Date('2026-09-30T12:00:00Z');
function dados(alteracoes = {}) {
  return {
    perfilCompleto: true,
    inscricoes: [],
    contribuicoes: [],
    atividades: [],
    metas: [],
    diario: [],
    ...alteracoes,
  };
}
function presenca(carga, confirmada = true, checkin = '2026-09-29T12:00:00Z') {
  return {
    atividade: { carga_horaria: 99 },
    inscricao: {
      presenca_confirmada: confirmada,
      carga_horaria_registrada: carga,
      checkin_em: checkin,
    },
  };
}

test('Início: horas usam snapshots do check-in e contribuições contam apenas as aprovadas', () => {
  const resumo = montarResumoInicio(
    dados({
      inscricoes: [
        presenca(2.5),
        presenca(1),
        presenca(null),
        presenca(5, false),
        presenca(7, true, null),
        presenca(8, true, '2026-10-01T12:00:00Z'),
      ],
      contribuicoes: ['APROVADA', 'PENDENTE', 'RECUSADA', 'APROVADA'].map(status_validacao => ({
        status_validacao,
      })),
    }),
    agora,
  );
  assert.equal(resumo.horasRegistradas, 3.5);
  assert.equal(resumo.atividadesParticipadas, 5);
  assert.equal(resumo.contribuicoesConfirmadas, 2);
  assert.equal(formatarHorasInicio(resumo.horasRegistradas), '3,5h');
});

test('Início: destaca as duas próximas atividades abertas com vagas reais', () => {
  const atividade = (id, dia, status = 'ABERTA', ocupadas = 2) => ({
    id,
    data_hora_prevista: `2026-${dia}T13:00:00Z`,
    status,
    vagas_totais: 5,
    vagas_ocupadas: ocupadas,
  });
  const atividades = [
    atividade(1, '10-05'),
    atividade(2, '09-29'),
    atividade(3, '10-01', 'CANCELADA'),
    atividade(4, '10-02'),
    atividade(5, '10-01', 'ABERTA', 5),
    atividade(6, '10-03'),
  ];
  const resumo = montarResumoInicio(dados({ atividades }), agora);
  assert.deepEqual(
    resumo.destaques.map(destaque => [destaque.atividade.id, destaque.vagasDisponiveis]),
    [
      [4, 3],
      [6, 3],
    ],
  );
  assert.deepEqual(
    atividades.map(item => item.id),
    [1, 2, 3, 4, 5, 6],
  );
});

test('Início: metas encerradas, atingidas ou vencidas e publicações ocultas não substituem conteúdo ativo', () => {
  const meta = (id, extra) => ({
    id,
    status: 'ABERTA',
    criado_em: '2026-09-28',
    data_limite: null,
    quantidade_meta: 5,
    quantidade_arrecadada: 0,
    ...extra,
  });
  const metas = [
    meta(1, { status: 'ENCERRADA', criado_em: '2026-09-30' }),
    meta(2, { criado_em: '2026-09-29T10:00:00Z', quantidade_arrecadada: 2 }),
    meta(4, { criado_em: '2026-09-30', quantidade_arrecadada: 5 }),
    meta(5, { criado_em: '2026-09-30', data_limite: '2026-09-29' }),
  ];
  const diario = [
    { id: 1, status: 'OCULTA', data_publicacao: '2026-09-30' },
    { id: 2, status: 'PUBLICADA', data_publicacao: '2026-09-29' },
  ];
  const resumo = montarResumoInicio(dados({ metas, diario }), agora);
  assert.equal(resumo.meta.id, 2);
  assert.equal(progressoMetaInicio(resumo.meta), 40);
  assert.equal(resumo.publicacao.id, 2);
  const vazio = montarResumoInicio(dados(), agora);
  assert.equal(vazio.meta, null);
  assert.equal(vazio.publicacao, null);
  assert.equal(vazio.horasRegistradas, 0);
});

test('Início: falhas e respostas inválidas não se transformam em indicadores zerados', async () => {
  const falha = new Error('Servidor indisponível');
  await assert.rejects(
    carregar({ atividades: { data: null, error: falha } }).carregarResumoInicio(),
    falha,
  );
  await assert.rejects(
    carregar({ atividades: { data: null, error: null } }).carregarResumoInicio(),
    /próximas atividades/,
  );
  await assert.rejects(
    carregar({ elegibilidade: { data: null, error: null } }).carregarResumoInicio(),
    /verificar seu cadastro/,
  );
  const resumo = await carregar().carregarResumoInicio();
  assert.equal(resumo.perfilCompleto, true);
  assert.equal(resumo.atividadesParticipadas, 0);
  assert.deepEqual(resumo.destaques, []);
});

test('Início: atividades lotadas não escondem a próxima oportunidade com vagas', async () => {
  const atividades = Array.from({ length: 14 }, (_, indice) => ({
    id: indice + 1,
    status: 'ABERTA',
    data_hora_prevista: new Date(Date.now() + (indice + 1) * 86400000).toISOString(),
    vagas_totais: 5,
    vagas_ocupadas: indice === 13 ? 3 : 5,
  }));
  const resumo = await carregar({
    atividades: { data: atividades, error: null },
  }).carregarResumoInicio();
  assert.deepEqual(
    resumo.destaques.map(({ atividade, vagasDisponiveis }) => [atividade.id, vagasDisponiveis]),
    [[14, 2]],
  );
});
