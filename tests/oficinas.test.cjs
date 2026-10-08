const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
test('Oficinas: migration e fluxo privado de propostas em PostgreSQL isolado', async t => {
  const db = new PGlite();
  const a = '11111111-1111-4111-8111-111111111111',
    b = '22222222-2222-4222-8222-222222222222',
    g = '33333333-3333-4333-8333-333333333333';
  async function papel(uid, role = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid ?? '']);
    if (role !== 'owner') await db.exec('SET ROLE ' + role);
  }
  const val = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.v;
  const salvar = (id = null, rev = null, campos = {}) =>
    val('SELECT public.oficinas_salvar($1,$2,$3,$4,$5,$6,$7,$8,$9) AS v', [
      id,
      rev,
      campos.titulo ?? 'Oficina de música',
      campos.descricao ?? 'Aprender ritmos',
      campos.tema ?? 'Música',
      campos.objetivo ?? 'Experimentar instrumentos',
      campos.duracao ?? 60,
      campos.conhecimentos ?? null,
      campos.observacoes ?? null,
    ]);
  const detalhe = id => val('SELECT public.oficinas_detalhe($1) AS v', [id]);
  const decidir = (id, rev, status = 'APROVADA', nota = null) =>
    val('SELECT public.oficinas_decidir($1,$2,$3,$4) AS v', [id, rev, status, nota]);
  let id;
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
      [a, b, g],
    );
    await db.query(
      "INSERT INTO public.voluntarios(usuario_id,cpf,data_nascimento,profissao,disponibilidade_horarios) VALUES($1,'52998224725','1990-01-01','Educador','[]'),($2,'11144477735','1990-01-01','Educador','[]')",
      [a, b],
    );
    await db.query(
      'INSERT INTO public.usuario_habilidades(usuario_id,habilidade_id) VALUES($1,1),($2,1)',
      [a, b],
    );
    await t.test(
      'criação requer voluntário elegível, inicia pendente e registra autoria',
      async () => {
        await papel(a);
        await assert.rejects(salvar(), /Complete seu perfil/);
        await papel(null, 'owner');
        await db.exec(
          `UPDATE public.voluntarios SET disponibilidade_horarios='[{"dia":"seg","periodo":"manha"}]'`,
        );
        await papel(a);
        id = await salvar();
        const p = await detalhe(id);
        assert.equal(p.autor_id, a);
        assert.equal(p.status, 'PENDENTE');
        assert.equal(p.revisao, 1);
        assert.ok(p.criado_em);
        assert.equal(p.decidido_por, null);
        assert.equal(p.nome_autor, 'Ana');
        await papel(g);
        await assert.rejects(salvar(), /perfil de voluntário/);
      },
    );
    await t.test('campos e limites são validados no servidor', async () => {
      await papel(a);
      for (const c of [
        { titulo: 'ab' },
        { titulo: 'a'.repeat(121) },
        { descricao: '' },
        { tema: ' ' },
        { objetivo: '' },
        { duracao: 0 },
        { duracao: 1441 },
        { conhecimentos: 'x'.repeat(2001) },
        { observacoes: 'x'.repeat(2001) },
      ]) {
        await assert.rejects(salvar(null, null, c), /constraint/);
      }
      await assert.rejects(salvar(null, null, { duracao: 1.5 }), /integer/);
      const x = await salvar(null, null, { duracao: 1440 });
      assert.equal((await detalhe(x)).duracao_minutos, 1440);
    });
    await t.test(
      'isolamento entre autores, edição pendente e proteção contra conteúdo desatualizado',
      async () => {
        await papel(b);
        await assert.rejects(detalhe(id), /não encontrada/);
        assert.equal((await val('SELECT public.oficinas_listar() AS v')).length, 0);
        assert.equal(
          (await db.query('SELECT * FROM public.propostas_oficinas WHERE id=$1', [id])).rows.length,
          0,
        );
        await assert.rejects(salvar(id, 1), /não encontrada/);
        await assert.rejects(
          val('SELECT public.oficinas_cancelar($1,1) AS v', [id]),
          /não encontrada/,
        );
        await papel(a);
        await salvar(id, 1, { titulo: 'Oficina revisada' });
        assert.equal((await detalhe(id)).revisao, 2);
        await assert.rejects(salvar(id, 1), /atualizada/);
        await papel(g);
        await assert.rejects(decidir(id, 1), /Releia/);
        assert.equal((await detalhe(id)).titulo, 'Oficina revisada');
      },
    );
    await t.test('aprovação registra gestão/data/observação e encerra edição', async () => {
      await papel(a);
      await assert.rejects(decidir(id, 2), /Somente a gestão/);
      await papel(g);
      await decidir(id, 2, 'APROVADA', 'Proposta adequada.');
      const p = await detalhe(id);
      assert.equal(p.status, 'APROVADA');
      assert.equal(p.decidido_por, g);
      assert.ok(p.decidido_em);
      assert.equal(p.observacao_decisao, 'Proposta adequada.');
      await assert.rejects(decidir(id, p.revisao, 'REJEITADA', 'Outra decisão'), /finalizada/);
      await papel(a);
      await assert.rejects(salvar(id, p.revisao), /pendentes/);
      await assert.rejects(
        val('SELECT public.oficinas_cancelar($1,$2) AS v', [id, p.revisao]),
        /pendentes/,
      );
    });
    await t.test('rejeição exige justificativa e não pode virar aprovação', async () => {
      await papel(b);
      const x = await salvar();
      await papel(g);
      await assert.rejects(decidir(x, 1, 'REJEITADA', ' '), /justificativa/);
      await assert.rejects(decidir(x, 1, 'REJEITADA', 'a'.repeat(2001)), /2.000/);
      await decidir(x, 1, 'REJEITADA', 'Tema fora da programação.');
      const p = await detalhe(x);
      assert.equal(p.status, 'REJEITADA');
      assert.equal(p.decidido_por, g);
      assert.equal(p.observacao_decisao, 'Tema fora da programação.');
      await assert.rejects(decidir(x, p.revisao), /finalizada/);
      await papel(b);
      await assert.rejects(salvar(x, p.revisao), /pendentes/);
    });
    await t.test('cancelamento é próprio e final; gestão não decide proposta própria', async () => {
      await papel(a);
      const x = await salvar();
      await val('SELECT public.oficinas_cancelar($1,1) AS v', [x]);
      const p = await detalhe(x);
      assert.equal(p.status, 'CANCELADA');
      assert.ok(p.cancelado_em);
      assert.equal(p.decidido_por, null);
      await assert.rejects(
        val('SELECT public.oficinas_cancelar($1,$2) AS v', [x, p.revisao]),
        /pendentes/,
      );
      await papel(g);
      await assert.rejects(decidir(x, p.revisao), /finalizada/);
      await papel(null, 'owner');
      const propria = await val(
        "INSERT INTO public.propostas_oficinas(autor_id,titulo,descricao,tema,objetivo,duracao_minutos) VALUES($1,'Legada','Relato','Tema','Objetivo',60) RETURNING id AS v",
        [g],
      );
      await papel(g);
      await assert.rejects(decidir(propria, 1), /própria proposta/);
      await assert.rejects(decidir(id, 3, 'PENDENTE'), /Decisão inválida/);
    });
    await t.test(
      'RLS bloqueia writes mesmo com grants e policy permissiva; anon sem RPCs',
      async () => {
        await papel(a);
        await assert.rejects(
          db.query(
            "UPDATE public.propostas_oficinas SET status='APROVADA',decidido_por=$1,decidido_em=now() WHERE id=$2",
            [g, id],
          ),
          /permission denied/,
        );
        await papel(null, 'owner');
        await db.exec(
          'GRANT SELECT,INSERT,UPDATE,DELETE ON public.propostas_oficinas TO anon,authenticated; GRANT USAGE ON SEQUENCE public.propostas_oficinas_id_seq TO authenticated; CREATE POLICY teste_aberta ON public.propostas_oficinas FOR ALL TO PUBLIC USING(true) WITH CHECK(true)',
        );
        await papel(b);
        assert.equal(
          (await db.query('SELECT * FROM public.propostas_oficinas WHERE id=$1', [id])).rows.length,
          0,
        );
        assert.equal(
          (await db.query("UPDATE public.propostas_oficinas SET status='PENDENTE' RETURNING id"))
            .rows.length,
          0,
        );
        assert.equal(
          (await db.query('DELETE FROM public.propostas_oficinas RETURNING id')).rows.length,
          0,
        );
        await assert.rejects(
          db.query(
            "INSERT INTO public.propostas_oficinas(autor_id,titulo,descricao,tema,objetivo,duracao_minutos) VALUES($1,'Forjada','Texto','Tema','Objetivo',60)",
            [b],
          ),
          /row-level security/,
        );
        await papel(null, 'anon');
        assert.equal((await db.query('SELECT * FROM public.propostas_oficinas')).rows.length, 0);
        await assert.rejects(val('SELECT public.oficinas_listar() AS v'), /permission denied/);
        await papel(null, 'owner');
        const f = (
          await db.query("SELECT oid,proconfig FROM pg_proc WHERE proname LIKE 'oficinas_%'")
        ).rows;
        assert.equal(f.length, 5);
        for (const func of f) {
          assert.ok(func.proconfig.includes('search_path=""'));
          assert.equal(
            await val("SELECT has_function_privilege('anon',$1::oid,'EXECUTE') AS v", [func.oid]),
            false,
          );
        }
      },
    );
  } finally {
    await db.close();
  }
});
