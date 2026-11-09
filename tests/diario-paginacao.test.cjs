const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const { base: esquemasBase, esquemasDe } = require('./apoio/esquemas.cjs');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const migration = fs.readFileSync(
  'supabase/reconciliacao/20261108130000_diario_paginacao.sql',
  'utf8',
);

test('Diário (RF0013): página por cursor, limite e RLS (dados sintéticos)', async t => {
  const db = new PGlite();
  const valor = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function role(id, r = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
  const pagina = (antes = null, limite = 3) =>
    valor('SELECT public.diario_listar_pagina($1,$2,$3) AS value', [
      antes?.data_publicacao ?? null,
      antes?.id ?? null,
      limite,
    ]);
  try {
    await db.exec(fs.readFileSync('tests/fixtures/reconciliacao-mvp-remoto.sql', 'utf8'));
    await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql', 'utf8'));
    await db.query(
      'INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,\'ana@example.invalid\',\'{"nome":"Ana Voluntária"}\'),($2,\'gestao@example.invalid\',\'{"nome":"Gestão"}\')',
      [v, g],
    );
    await db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1", [g]);
    await db.exec(
      "INSERT INTO public.configuracao_instituicao(nome_curto,nome_completo,cidade,uf) VALUES('Horta','Instituição da Horta','Guaporé','RS')",
    );
    await db.exec(
      fs.readFileSync('supabase/migrations/reconciliacao_01_base_perfis_endereco.sql', 'utf8'),
    );
    await db.exec(
      fs.readFileSync(
        'supabase/reconciliacao/20260930141047_reconciliacao_02_fluxos_mvp.sql',
        'utf8',
      ),
    );
    await db.exec(migration);

    // 7 publicações: a 4 fica oculta; a 5 e a 6 têm a mesma data (empate resolvido pelo id).
    await role(g);
    const ids = [];
    for (let i = 1; i <= 7; i++) {
      ids.push(
        await valor('SELECT public.diario_salvar_revisao(NULL,$1,$2,$3,NULL,NULL) AS value', [
          `Publicação ${i}`,
          `Relato ${i}`,
          i === 4 ? 'OCULTA' : 'PUBLICADA',
        ]),
      );
    }
    await role(null, 'owner');
    for (const [i, id] of ids.entries()) {
      const dia = i === 5 ? 5 : i + 1; // a 6ª publicação repete a data da 5ª
      await db.query(
        "UPDATE public.diario_transparencia SET data_publicacao = '2026-10-01'::timestamptz + make_interval(days => $2) WHERE id=$1",
        [id, dia],
      );
    }

    await t.test('não reaplica', async () => {
      await assert.rejects(db.exec(migration), /não reaplicar/);
      await db.exec('ROLLBACK');
    });

    await t.test('voluntário percorre as páginas sem repetir e sem ver a oculta', async () => {
      await role(v);
      const vistos = [];
      let antes = null;
      for (let volta = 0; volta < 5; volta++) {
        const lista = await pagina(antes);
        if (!lista.length) break;
        vistos.push(...lista.map(p => p.titulo));
        antes = lista.at(-1);
      }
      assert.deepEqual(vistos, [
        'Publicação 7',
        'Publicação 6',
        'Publicação 5',
        'Publicação 3',
        'Publicação 2',
        'Publicação 1',
      ]);
    });

    await t.test('gestão vê a oculta; o limite fica entre 1 e 50', async () => {
      await role(g);
      const todas = await pagina(null, 100);
      assert.equal(todas.length, 7);
      assert.ok(todas.some(p => p.status === 'OCULTA'));
      assert.equal((await pagina(null, 0)).length, 1);
      assert.equal((await pagina(null, null)).length, 7);
    });

    await t.test('anon não executa', async () => {
      await role(null, 'anon');
      await assert.rejects(pagina(), /permission denied/);
    });
  } finally {
    await db.close();
  }
});

function compilar(arquivo, dependencias) {
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

const regras = compilar('src/funcionalidades/diario/regras.ts', {});
const paginas = compilar('src/funcionalidades/diario/paginas.ts', {});
const publicacao = id => ({
  revisao: 1,
  id,
  titulo: `P${id}`,
  texto: 'Relato',
  descricao_curta: null,
  status: 'PUBLICADA',
  imagem_caminho: null,
  data_publicacao: `2026-10-${String(id).padStart(2, '0')}T12:00:00Z`,
  autor_id: g,
  atualizado_em: '2026-10-01T12:00:00Z',
});

function api(respostas) {
  const chamadas = [];
  const supabase = {
    rpc: async (nome, args) => {
      chamadas.push([nome, args]);
      return respostas[nome] ?? { data: null, error: null };
    },
  };
  return {
    chamadas,
    ...compilar('src/funcionalidades/diario/api.ts', {
      '@/servicos/supabase': { supabase },
      '@/compartilhado/esquemas': esquemasBase,
      './esquemas': esquemasDe('diario'),
      './regras': regras,
    }),
  };
}

test('Diário (RF0013): junta páginas sem repetir publicação', () => {
  const a = [publicacao(3), publicacao(2)];
  assert.deepEqual(
    paginas.juntarPaginas(a, [publicacao(2), publicacao(1)]).map(p => p.id),
    [3, 2, 1],
  );
});

test('Diário (RF0013): pede uma a mais para saber se há outra página', async () => {
  const TAMANHO = 20;
  const cheia = Array.from({ length: TAMANHO + 1 }, (_, i) => publicacao(30 - i));
  const comMais = api({ diario_listar_pagina: { data: cheia, error: null } });
  const primeira = await comMais.listarDiarioPagina(null);
  assert.equal(primeira.itens.length, TAMANHO);
  assert.equal(primeira.temMais, true);
  assert.deepEqual(comMais.chamadas[0], [
    'diario_listar_pagina',
    { p_antes_data: null, p_antes_id: null, p_limite: TAMANHO + 1 },
  ]);

  const ultima = api({ diario_listar_pagina: { data: [publicacao(1)], error: null } });
  const fim = await ultima.listarDiarioPagina({ data: '2026-10-02T12:00:00Z', id: 2 });
  assert.equal(fim.temMais, false);
  assert.deepEqual(ultima.chamadas[0][1], {
    p_antes_data: '2026-10-02T12:00:00Z',
    p_antes_id: 2,
    p_limite: TAMANHO + 1,
  });
});

test('Diário (RF0013): sem a RPC no banco, cai para a lista inteira', async () => {
  const semRpc = api({
    diario_listar_pagina: { data: null, error: { code: 'PGRST202', message: 'not found' } },
    diario_listar: { data: [publicacao(2), publicacao(1)], error: null },
  });
  const primeira = await semRpc.listarDiarioPagina(null);
  assert.deepEqual(
    primeira.itens.map(p => p.id),
    [2, 1],
  );
  assert.equal(primeira.temMais, false);
  assert.deepEqual(await semRpc.listarDiarioPagina({ data: 'x', id: 1 }), {
    itens: [],
    temMais: false,
  });
  const outroErro = api({
    diario_listar_pagina: { data: null, error: new Error('falha de rede') },
  });
  await assert.rejects(outroErro.listarDiarioPagina(null), /falha de rede/);
});
