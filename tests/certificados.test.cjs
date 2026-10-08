const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
test('Certificados: emissão oficial, elegibilidade e RLS em PostgreSQL local', async t => {
  const db = new PGlite();
  const a = '11111111-1111-4111-8111-111111111111',
    b = '22222222-2222-4222-8222-222222222222',
    g = '33333333-3333-4333-8333-333333333333';
  const val = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.v;
  async function papel(uid, role = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid ?? '']);
    if (role !== 'owner') await db.exec('SET ROLE ' + role);
  }
  const emitir = id => val('SELECT public.certificados_emitir($1) AS v', [id]);
  const detalhe = id => val('SELECT public.certificados_detalhe($1) AS v', [id]);
  const lista = () => val('SELECT public.certificados_listar() AS v');
  let at, ins, cert;
  try {
    await db.exec(fs.readFileSync('tests/fixtures/base-voluntariado.sql', 'utf8'));
    await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql', 'utf8'));
    for (const f of fs
      .readdirSync('supabase/migrations')
      .filter(f => /^\d{14}_.*\.sql$/.test(f))
      .sort())
      await db.exec(fs.readFileSync('supabase/migrations/' + f, 'utf8'));
    await db.exec(
      'GRANT SELECT ON public.usuarios TO authenticated; DELETE FROM public.configuracao_instituicao',
    );
    await db.query(
      "INSERT INTO public.usuarios(id,nome,tipo_perfil) VALUES($1,'Ana','VOLUNTARIO'),($2,'Bruno','VOLUNTARIO'),($3,'Gestão','ONG')",
      [a, b, g],
    );
    at = await val(
      "INSERT INTO public.atividades(titulo,descricao,tipo,autor_id,data_hora_prevista,vagas_totais,carga_horaria) VALUES('Horta comunitária','Plantio','TAREFA_ONG',$1,now()-interval '10 minutes',10,2.5) RETURNING id AS v",
      [g],
    );
    ins = await val(
      "INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id,status_inscricao) VALUES($1,$2,'APROVADA') RETURNING id AS v",
      [at, a],
    );
    await t.test('aprovação sem presença e atividade sem participação não emitem', async () => {
      await papel(a);
      await assert.rejects(emitir(ins), /check-in/);
      await assert.rejects(emitir(9999), /indisponível/);
      assert.equal((await lista()).disponiveis.length, 0);
      await assert.rejects(
        db.query('UPDATE public.inscricoes_atividades SET presenca_confirmada=true WHERE id=$1', [
          ins,
        ]),
      );
    });
    await t.test(
      'check-in real via RPC habilita emissão; instituição ausente bloqueia',
      async () => {
        await papel(g);
        const token = await val('SELECT public.voluntariado_gerar_checkin($1) AS v', [at]);
        await papel(a);
        await db.query('SELECT public.voluntariado_checkin($1,$2)', [at, token.token]);
        assert.equal((await lista()).disponiveis.length, 1);
        await assert.rejects(emitir(ins), /instituição/);
        await papel(null, 'owner');
        await db.exec(
          "INSERT INTO public.configuracao_instituicao(id,nome_completo,nome_curto,cidade,uf) VALUES(1,'Instituição Teste','Teste','Cidade','SP')",
        );
        await papel(a);
        cert = await emitir(ins);
        assert.match(cert, /^[0-9a-f-]{36}$/);
        assert.equal(await emitir(ins), cert);
        const c = await detalhe(cert);
        assert.equal(c.nome_voluntario, 'Ana');
        assert.equal(c.instituicao, 'Instituição Teste');
        assert.equal(c.atividade, 'Horta comunitária');
        assert.equal(c.carga_horaria_prevista, 2.5);
        assert.ok(c.emitido_em);
        assert.ok(c.data_atividade);
        assert.equal((await lista()).disponiveis.length, 0);
        assert.equal((await lista()).emitidos.length, 1);
      },
    );
    await t.test(
      'isolamento, leitura administrativa e bloqueio de criação/alteração direta',
      async () => {
        await papel(b);
        assert.equal((await lista()).emitidos.length, 0);
        await assert.rejects(detalhe(cert), /indisponível/);
        await assert.rejects(emitir(ins), /indisponível/);
        assert.equal((await db.query('SELECT * FROM public.certificados')).rows.length, 0);
        await papel(g);
        assert.equal((await lista()).emitidos.length, 1);
        assert.equal((await detalhe(cert)).usuario_id, a);
        await assert.rejects(emitir(ins), /indisponível/);
        await papel(a);
        await assert.rejects(
          db.query("UPDATE public.certificados SET nome_voluntario='Falso' WHERE id=$1", [cert]),
        );
        await papel(null, 'owner');
        await db.exec(
          'GRANT INSERT,UPDATE,DELETE ON public.certificados TO authenticated; CREATE POLICY teste_ampla ON public.certificados FOR ALL TO authenticated USING(true) WITH CHECK(true)',
        );
        await papel(a);
        assert.equal(
          (await db.query('DELETE FROM public.certificados RETURNING id')).rows.length,
          0,
        );
        assert.equal(
          (await db.query('UPDATE public.certificados SET carga_horaria_prevista=99 RETURNING id'))
            .rows.length,
          0,
        );
        await assert.rejects(
          db.query('INSERT INTO public.certificados SELECT * FROM public.certificados'),
          /row-level security/,
        );
        await papel(b);
        assert.equal((await db.query('SELECT * FROM public.certificados')).rows.length, 0);
        await papel(null, 'anon');
        await assert.rejects(lista(), /permission denied/);
        await assert.rejects(detalhe(cert), /permission denied/);
      },
    );
    await t.test(
      'dados emitidos são preservados e identificadores não são reutilizados',
      async () => {
        await papel(null, 'owner');
        await db.query("UPDATE public.usuarios SET nome='Nome atualizado' WHERE id=$1", [a]);
        await db.exec(
          "UPDATE public.configuracao_instituicao SET nome_completo='Instituição atualizada'",
        );
        const segundo = await val(
          "INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id,status_inscricao,presenca_confirmada,checkin_em,carga_horaria_registrada) VALUES($1,$2,'APROVADA',true,now(),2.5) RETURNING id AS v",
          [at, b],
        );
        await papel(b);
        const outro = await emitir(segundo);
        assert.notEqual(outro, cert);
        await papel(a);
        const c = await detalhe(cert);
        assert.equal(c.nome_voluntario, 'Ana');
        assert.equal(c.instituicao, 'Instituição Teste');
      },
    );
    await t.test(
      'cancelada, pendente, recusada, presença sem check-in e horas ausentes não emitem',
      async () => {
        for (const status of ['CANCELADA', 'PENDENTE', 'RECUSADA', 'APROVADA']) {
          await papel(null, 'owner');
          const atividade = await val(
            "INSERT INTO public.atividades(titulo,descricao,tipo,autor_id,data_hora_prevista,vagas_totais,carga_horaria) VALUES('Outra','Plantio','TAREFA_ONG',$1,now()-interval '1 hour',10,2) RETURNING id AS v",
            [g],
          );
          const id = await val(
            'INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id,status_inscricao,presenca_confirmada) VALUES($1,$2,$3,true) RETURNING id AS v',
            [atividade, a, status],
          );
          await papel(a);
          await assert.rejects(emitir(id), /check-in/);
          if (status === 'APROVADA') {
            await papel(null, 'owner');
            await db.query('UPDATE public.inscricoes_atividades SET checkin_em=now() WHERE id=$1', [
              id,
            ]);
            await papel(a);
            await assert.rejects(emitir(id), /check-in/);
            await papel(null, 'owner');
            await db.query(
              'UPDATE public.inscricoes_atividades SET carga_horaria_registrada=2 WHERE id=$1',
              [id],
            );
            await db.query("UPDATE public.atividades SET status='CANCELADA' WHERE id=$1", [
              atividade,
            ]);
            await papel(a);
            await assert.rejects(emitir(id), /check-in/);
          }
        }
      },
    );
  } finally {
    await db.close();
  }
});
