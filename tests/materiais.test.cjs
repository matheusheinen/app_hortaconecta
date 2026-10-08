const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
test('materiais: migrations e regras no PostgreSQL isolado, sem acesso remoto', async t => {
  const db = new PGlite();
  const v1 = '11111111-1111-4111-8111-111111111111',
    v2 = '22222222-2222-4222-8222-222222222222',
    ong = '33333333-3333-4333-8333-333333333333';
  async function papel(uid, role = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid ?? '']);
    if (role !== 'owner') await db.exec('SET ROLE ' + role);
  }
  async function valor(sql, args = []) {
    return (await db.query(sql, args)).rows[0]?.valor;
  }
  const criar = async (q = 10) => {
    await papel(ong);
    return valor(
      "SELECT public.materiais_salvar(NULL,'Bolsa esportiva','Entregar na instituição',$1) AS valor",
      [q],
    );
  };
  const contribuir = async (s, q, uid = v1) => {
    await papel(uid);
    return valor('SELECT public.materiais_contribuir($1,$2) AS valor', [s, q]);
  };
  const decidir = async (c, status = 'CONFIRMADA', uid = ong) => {
    await papel(uid);
    return valor('SELECT public.materiais_decidir($1,$2) AS valor', [c, status]);
  };
  const detalhe = async s => valor('SELECT public.materiais_detalhe($1) AS valor', [s]);
  try {
    await db.exec(fs.readFileSync('tests/fixtures/base-voluntariado.sql', 'utf8'));
    await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql', 'utf8'));
    for (const f of fs
      .readdirSync('supabase/migrations')
      .filter(f => /^\d{14}_.*\.sql$/.test(f))
      .sort())
      await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8'));
    await db.exec('GRANT SELECT ON public.usuarios TO authenticated');
    await db.query(
      "INSERT INTO public.usuarios(id,nome,tipo_perfil) VALUES($1,'Ana','VOLUNTARIO'),($2,'Bruno','VOLUNTARIO'),($3,'Gestão','ONG')",
      [v1, v2, ong],
    );
    await t.test(
      'somente gestão cria; campos obrigatórios, quantidades e autor são controlados',
      async () => {
        await papel(v1);
        await assert.rejects(
          valor("SELECT public.materiais_salvar(NULL,'Teste','Descrição',10) AS valor"),
          /Somente a gestão/,
        );
        const s = await criar();
        const d = await detalhe(s);
        assert.equal(d.solicitacao.criado_por, ong);
        assert.equal(d.solicitacao.quantidade_recebida, 0);
        assert.equal(d.solicitacao.status, 'ABERTA');
        for (const q of [0, -1, 1000001, null]) await assert.rejects(criar(q), /constraint|null/);
        await assert.rejects(
          valor("SELECT public.materiais_salvar(NULL,'','Descrição',10) AS valor"),
          /constraint/,
        );
        await assert.rejects(
          valor("SELECT public.materiais_salvar(999999,'Teste','Descrição',10) AS valor"),
          /não encontrada/,
        );
      },
    );
    await t.test(
      'intenção pendente, duplicidade, titularidade, privacidade e auto confirmação',
      async () => {
        const s = await criar();
        const c = await contribuir(s, 6);
        assert.equal((await detalhe(s)).solicitacao.quantidade_recebida, 0);
        await assert.rejects(contribuir(s, 1), /já possui/);
        await assert.rejects(decidir(c, 'CONFIRMADA', v1), /Somente a gestão/);
        await assert.rejects(decidir(c, 'CANCELADA', v2), /não encontrada/);
        assert.equal((await detalhe(s)).contribuicoes.length, 0);
        assert.equal(
          await valor(
            'SELECT count(*)::int AS valor FROM public.contribuicoes_materiais WHERE id=$1',
            [c],
          ),
          0,
        );
        await papel(ong);
        const d = await detalhe(s);
        assert.equal(d.contribuicoes[0].nome_usuario, 'Ana');
        assert.equal('cpf' in d.contribuicoes[0], false);
        assert.equal(d.contribuicoes[0].status, 'PENDENTE');
      },
    );
    await t.test(
      'confirmação transacional não excede restante; conclusão cancela pendências',
      async () => {
        const s = await criar();
        const a = await contribuir(s, 8),
          b = await contribuir(s, 5, v2);
        await decidir(a);
        let d = await detalhe(s);
        assert.equal(d.solicitacao.quantidade_recebida, 8);
        assert.equal(d.solicitacao.status, 'EM_ANDAMENTO');
        await assert.rejects(decidir(b), /maior que o restante/);
        d = await detalhe(s);
        assert.equal(d.solicitacao.quantidade_recebida, 8);
        assert.equal(d.contribuicoes.find(x => x.id === b).status, 'PENDENTE');
        await assert.rejects(contribuir(s, 5), /restante/);
        const c = await contribuir(s, 2);
        await decidir(c);
        d = await detalhe(s);
        assert.equal(d.solicitacao.quantidade_recebida, 10);
        assert.equal(d.solicitacao.status, 'CONCLUIDA');
        assert.equal(d.contribuicoes.find(x => x.id === b).status, 'CANCELADA');
        await assert.rejects(decidir(c), /já foi finalizada/);
        await assert.rejects(contribuir(s, 1), /não recebe/);
        await papel(v1);
        const minhas = await valor('SELECT public.materiais_minhas() AS valor');
        assert.ok(minhas.every(x => x.contribuicao.usuario_id === v1));
        assert.ok(
          minhas.some(x => x.contribuicao.id === c && x.contribuicao.status === 'CONFIRMADA'),
        );
        assert.equal(
          d.solicitacao.quantidade_recebida,
          d.contribuicoes
            .filter(x => x.status === 'CONFIRMADA')
            .reduce((a, c) => a + c.quantidade, 0),
        );
      },
    );
    await t.test(
      'cancelamento próprio permite nova intenção; solicitação preserva recebimentos',
      async () => {
        const s = await criar();
        const c = await contribuir(s, 3);
        await decidir(c, 'CANCELADA', v1);
        assert.equal((await detalhe(s)).solicitacao.quantidade_recebida, 0);
        const novo = await contribuir(s, 3);
        await decidir(novo);
        await assert.rejects(decidir(novo, 'CANCELADA', v1), /finalizada/);
        const b = await contribuir(s, 2, v2);
        await papel(ong);
        await valor("SELECT public.materiais_status($1,'CANCELADA') AS valor", [s]);
        const d = await detalhe(s);
        assert.equal(d.solicitacao.quantidade_recebida, 3);
        assert.equal(d.contribuicoes.find(x => x.id === b).status, 'CANCELADA');
        await assert.rejects(
          valor("SELECT public.materiais_salvar($1,'Teste','Descrição',20) AS valor", [s]),
          /finalizada/,
        );
        await assert.rejects(
          valor("SELECT public.materiais_status($1,'EM_ANDAMENTO') AS valor", [s]),
          /Transição/,
        );
        const sem = await criar();
        await valor("SELECT public.materiais_status($1,'CANCELADA') AS valor", [sem]);
        await papel(v1);
        await assert.rejects(detalhe(sem), /indisponível/);
        assert.equal(
          await valor(
            'SELECT count(*)::int AS valor FROM public.solicitacoes_materiais WHERE id=$1',
            [sem],
          ),
          0,
        );
      },
    );
    await t.test('edição e status respeitam recebimento e autorização', async () => {
      const s = await criar();
      await valor("SELECT public.materiais_status($1,'EM_ANDAMENTO') AS valor", [s]);
      const c = await contribuir(s, 4);
      await decidir(c);
      await assert.rejects(
        valor("SELECT public.materiais_salvar($1,'Teste','Descrição',3) AS valor", [s]),
        /maior que a recebida/,
      );
      await assert.rejects(
        valor("SELECT public.materiais_status($1,'CONCLUIDA') AS valor", [s]),
        /Transição/,
      );
      await valor(
        "SELECT public.materiais_salvar($1,'Novas bolsas','Entregar embaladas',20) AS valor",
        [s],
      );
      assert.equal((await detalhe(s)).solicitacao.quantidade_necessaria, 20);
      await papel(v1);
      await assert.rejects(
        valor("SELECT public.materiais_status($1,'CANCELADA') AS valor", [s]),
        /Somente a gestão/,
      );
    });
    await t.test('catálogo, inteiros nas RPCs e estados finais', async () => {
      const s = await criar();
      for (const q of [1.5, '1,5', '1.0', 'NaN', 'Infinity']) {
        await assert.rejects(criar(q), /integer/);
        await assert.rejects(contribuir(s, q), /integer/);
      }
      const c = await contribuir(s, 2);
      await decidir(c, 'CANCELADA', v1);
      await assert.rejects(decidir(c), /finalizada/);
      await papel(ong);
      await valor("SELECT public.materiais_status($1,'CANCELADA') AS valor", [s]);
      await assert.rejects(contribuir(s, 1), /não recebe/);
      await papel(null, 'owner');
      const cols = (
        await db.query(
          "SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('solicitacoes_materiais','contribuicoes_materiais') AND column_name LIKE 'quantidade%'",
        )
      ).rows;
      assert.equal(cols.length, 3);
      assert.ok(cols.every(c => c.data_type === 'integer'));
      assert.equal(
        await valor(
          "SELECT count(*)::int AS valor FROM pg_constraint WHERE conrelid IN ('public.solicitacoes_materiais'::regclass,'public.contribuicoes_materiais'::regclass) AND contype='f'",
        ),
        4,
      );
      assert.equal(
        await valor(
          "SELECT count(*)::int AS valor FROM pg_indexes WHERE schemaname='public' AND tablename IN ('solicitacoes_materiais','contribuicoes_materiais')",
        ),
        6,
      );
      for (const tabela of ['solicitacoes_materiais', 'contribuicoes_materiais']) {
        assert.equal(
          await valor('SELECT relrowsecurity AS valor FROM pg_class WHERE oid=$1::regclass', [
            'public.' + tabela,
          ]),
          true,
        );
        assert.equal(
          await valor("SELECT has_table_privilege('authenticated',$1,'TRUNCATE') AS valor", [
            'public.' + tabela,
          ]),
          false,
        );
      }
    });
    await t.test(
      'requisições sobrepostas em conexão única não duplicam nem excedem recebido (não simula locks entre conexões)',
      async () => {
        const s = await criar();
        const a = await contribuir(s, 6),
          b = await contribuir(s, 6, v2);
        await papel(ong);
        const resultados = await Promise.allSettled(
          [a, b].map(c => valor("SELECT public.materiais_decidir($1,'CONFIRMADA') AS valor", [c])),
        );
        assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal(resultados.filter(r => r.status === 'rejected').length, 1);
        let d = await detalhe(s);
        assert.equal(d.solicitacao.quantidade_recebida, 6);
        const pendente = d.contribuicoes.find(c => c.status === 'PENDENTE');
        await decidir(pendente.id, 'CANCELADA');
        const fim = await contribuir(s, 4);
        await papel(ong);
        const repetidos = await Promise.allSettled(
          [1, 2].map(() =>
            valor("SELECT public.materiais_decidir($1,'CONFIRMADA') AS valor", [fim]),
          ),
        );
        assert.equal(repetidos.filter(r => r.status === 'fulfilled').length, 1);
        d = await detalhe(s);
        assert.equal(d.solicitacao.quantidade_recebida, 10);
        assert.equal(d.solicitacao.status, 'CONCLUIDA');
      },
    );
    await t.test(
      'políticas funcionam com acesso somente ao próprio usuário; gestão não lê dados pessoais extras',
      async () => {
        await papel(null, 'owner');
        await db.exec(
          'ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY; CREATE POLICY teste_usuario_proprio ON public.usuarios FOR SELECT TO authenticated USING(id=auth.uid())',
        );
        const s = await criar();
        const c = await contribuir(s, 1);
        await papel(v2);
        assert.equal((await detalhe(s)).contribuicoes.length, 0);
        assert.equal(
          (await valor('SELECT public.materiais_minhas() AS valor')).some(
            x => x.contribuicao.id === c,
          ),
          false,
        );
        await papel(ong);
        assert.equal((await detalhe(s)).contribuicoes[0].nome_usuario, 'Ana');
        await decidir(c);
        await papel(null, 'owner');
        await db.exec(
          'DROP POLICY teste_usuario_proprio ON public.usuarios; ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY',
        );
      },
    );
    await t.test(
      'RLS e grants bloqueiam escrita direta, exclusão, identidade e confirmação forjada',
      async () => {
        const s = await criar();
        const c = await contribuir(s, 2);
        for (const uid of [v1, ong]) {
          await papel(uid);
          await assert.rejects(
            db.query('UPDATE public.solicitacoes_materiais SET quantidade_recebida=9 WHERE id=$1', [
              s,
            ]),
            /permission denied/,
          );
          await assert.rejects(
            db.query("UPDATE public.contribuicoes_materiais SET status='CONFIRMADA' WHERE id=$1", [
              c,
            ]),
            /permission denied/,
          );
          await assert.rejects(
            db.query('DELETE FROM public.contribuicoes_materiais WHERE id=$1', [c]),
            /permission denied/,
          );
        }
        await papel(null, 'owner');
        await db.exec(
          'GRANT INSERT,UPDATE,DELETE ON public.solicitacoes_materiais,public.contribuicoes_materiais TO authenticated; GRANT USAGE ON SEQUENCE public.solicitacoes_materiais_id_seq,public.contribuicoes_materiais_id_seq TO authenticated;',
        );
        await db.exec(
          'CREATE POLICY teste_write ON public.contribuicoes_materiais FOR ALL TO authenticated USING(true) WITH CHECK(true)',
        );
        await papel(v1);
        await assert.rejects(
          db.query(
            'INSERT INTO public.contribuicoes_materiais(solicitacao_id,usuario_id,quantidade) VALUES($1,$2,1)',
            [s, v2],
          ),
          /row-level security/,
        );
        await assert.rejects(
          db.query('UPDATE public.contribuicoes_materiais SET usuario_id=$1 WHERE id=$2', [v2, c]),
          /row-level security/,
        );
        assert.equal(
          (
            await db.query('DELETE FROM public.contribuicoes_materiais WHERE id=$1 RETURNING id', [
              c,
            ])
          ).rows.length,
          0,
        );
        await papel(null, 'owner');
        await db.exec('DROP POLICY teste_write ON public.contribuicoes_materiais');
        await papel(null, 'anon');
        await assert.rejects(
          valor('SELECT public.materiais_listar() AS valor'),
          /permission denied/,
        );
        await assert.rejects(
          db.query('SELECT * FROM public.contribuicoes_materiais'),
          /permission denied/,
        );
        await papel(null, 'owner');
        const funcs = (
          await db.query("SELECT oid,proconfig FROM pg_proc WHERE proname LIKE 'materiais_%'")
        ).rows;
        assert.equal(funcs.length, 7);
        for (const f of funcs) {
          assert.ok(f.proconfig.includes('search_path=""'));
          assert.equal(
            await valor("SELECT has_function_privilege('anon',$1::oid,'EXECUTE') AS valor", [
              f.oid,
            ]),
            false,
          );
        }
      },
    );
  } finally {
    await db.close();
  }
});
