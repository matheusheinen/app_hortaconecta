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

const { periodoDoHorario, cabeNaDisponibilidade, selecionarSugestoes } = carregar(
  'src/lib/regrasSugestoes.ts',
);

// Datas locais: 2026-10-12 é segunda-feira.
const segManha = new Date(2026, 9, 12, 9, 0).toISOString();
const segNoite = new Date(2026, 9, 12, 19, 0).toISOString();
const terTarde = new Date(2026, 9, 13, 14, 0).toISOString();
const agora = new Date(2026, 9, 5, 12, 0);
const atividade = (id, data, extra = {}) => ({
  id,
  data_hora_prevista: data,
  status: 'ABERTA',
  vagas_totais: 5,
  vagas_ocupadas: 0,
  ...extra,
});

test('Sugestões: período do horário e madrugada contada como noite', () => {
  assert.equal(periodoDoHorario(new Date(2026, 9, 12, 5, 0)), 'manha');
  assert.equal(periodoDoHorario(new Date(2026, 9, 12, 12, 0)), 'tarde');
  assert.equal(periodoDoHorario(new Date(2026, 9, 12, 18, 0)), 'noite');
  assert.equal(periodoDoHorario(new Date(2026, 9, 12, 3, 0)), 'noite');
  assert.equal(cabeNaDisponibilidade(segManha, [{ dia: 'seg', periodo: 'manha' }]), true);
  assert.equal(cabeNaDisponibilidade(segNoite, [{ dia: 'seg', periodo: 'manha' }]), false);
  assert.equal(cabeNaDisponibilidade(segManha, []), false, 'Sem disponibilidade não sugere nada');
});

test('Sugestões: área estreita, tarefa sem área passa só pela disponibilidade', () => {
  const disponibilidade = [
    { dia: 'seg', periodo: 'manha' },
    { dia: 'ter', periodo: 'tarde' },
  ];
  const areasPorAtividade = new Map([
    [1, ['Horta']],
    [2, ['Cozinha']],
  ]);
  const resultado = selecionarSugestoes({
    atividades: [atividade(1, segManha), atividade(2, terTarde), atividade(3, terTarde)],
    disponibilidade,
    areasDoVoluntario: ['Horta'],
    areasPorAtividade,
    jaPedidas: new Set(),
    agora,
  });
  assert.deepEqual(
    resultado.map(a => a.id),
    [1, 3],
  );
});

test('Sugestões: exclui pedidas, lotadas, passadas e não abertas; ordena e limita', () => {
  const disponibilidade = [{ dia: 'seg', periodo: 'manha' }];
  const passada = new Date(2026, 9, 5, 9, 0).toISOString();
  const outrasSegundas = [19, 26].map(d => new Date(2026, 9, d, 9, 0).toISOString());
  const resultado = selecionarSugestoes({
    atividades: [
      atividade(10, outrasSegundas[1]),
      atividade(11, segManha),
      atividade(12, outrasSegundas[0]),
      atividade(13, segManha, { vagas_ocupadas: 5 }),
      atividade(14, segManha, { status: 'ENCERRADA' }),
      atividade(15, passada),
      atividade(16, segManha),
    ],
    disponibilidade,
    areasDoVoluntario: [],
    areasPorAtividade: new Map(),
    jaPedidas: new Set([16]),
    agora,
    limite: 2,
  });
  assert.deepEqual(
    resultado.map(a => a.id),
    [11, 12],
  );
});

test('Áreas da atividade: grava só a diferença entre seleção anterior e nova', async () => {
  const chamadas = [];
  const supabase = {
    from: tabela => ({
      delete: () => {
        const filtro = { tabela, op: 'delete', filtros: [] };
        chamadas.push(filtro);
        const builder = {
          eq: (c, v) => {
            filtro.filtros.push([c, v]);
            return builder;
          },
          in: (c, v) => {
            filtro.filtros.push([c, v]);
            return Promise.resolve({ error: null });
          },
        };
        return builder;
      },
      insert: linhas => {
        chamadas.push({ tabela, op: 'insert', linhas });
        return Promise.resolve({ error: null });
      },
    }),
  };
  const { salvarAreasAtividade } = carregar('src/lib/areasAtividade.ts', {
    './supabase': { supabase },
    './voluntariado': {},
    './regrasVoluntariado': {},
    './regrasSugestoes': {},
    './resumoInicio': {},
  });
  await salvarAreasAtividade(7, [1, 2], [2, 3]);
  assert.deepEqual(chamadas, [
    {
      tabela: 'atividade_habilidades',
      op: 'delete',
      filtros: [
        ['atividade_id', 7],
        ['habilidade_id', [1]],
      ],
    },
    {
      tabela: 'atividade_habilidades',
      op: 'insert',
      linhas: [{ atividade_id: 7, habilidade_id: 3 }],
    },
  ]);
  chamadas.length = 0;
  await salvarAreasAtividade(7, [2], [2]);
  assert.deepEqual(chamadas, [], 'Sem mudança não toca no banco');
});
