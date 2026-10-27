const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const g2 = '33333333-3333-4333-8333-333333333333';
const v2 = '55555555-5555-4555-8555-555555555555';
const arq = f => fs.readFileSync(f, 'utf8');
const migration = arq('supabase/reconciliacao/20261026130000_notificacoes.sql');

test('Notificações (B29), dados sintéticos', async t => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function role(id, r = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      id ? JSON.stringify({ sub: id, is_anonymous: false }) : '',
    ]);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
  // Notificações por destinatário, lidas como dono para não depender da RLS.
  const de = async (tipo, quem) => {
    await role(null, 'owner');
    return (
      await db.query(
        'SELECT usuario_id, titulo, corpo FROM public.notificacoes WHERE tipo=$1 ORDER BY usuario_id',
        [tipo],
      )
    ).rows.filter(n => !quem || quem.includes(n.usuario_id));
  };
  const total = async () => {
    await role(null, 'owner');
    return Number(await scalar('SELECT count(*) AS value FROM public.notificacoes'));
  };
  try {
    await db.exec(arq('tests/fixtures/reconciliacao-mvp-remoto.sql'));
    await db.exec(arq('tests/fixtures/storage-diario.sql'));
    await db.query(
      'INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,\'ana@example.invalid\',\'{"nome":"Ana Voluntária"}\'),($2,\'gestao@example.invalid\',\'{"nome":"Gestão"}\'),($3,\'gestor2@example.invalid\',\'{"nome":"Gestor Dois"}\'),($4,\'bia@example.invalid\',\'{"nome":"Bia Voluntária"}\')',
      [v, g, g2, v2],
    );
    await db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id IN ($1,$2)", [g, g2]);
    await db.exec(arq('supabase/migrations/reconciliacao_01_base_perfis_endereco.sql'));
    await db.exec(arq('supabase/reconciliacao/20260930141047_reconciliacao_02_fluxos_mvp.sql'));
    await db.exec(arq('supabase/reconciliacao/20261006120000_modo_gestor.sql'));
    // g2 passa a atuar como voluntário, mas segue sendo gestão.
    await role(g2);
    await db.query('SELECT public.gestor_alternar_modo(false)');
    await role(null, 'owner');
    await db.exec(migration);
    await db.query('ROLLBACK').catch(() => {});

    const atividade = await scalar(
      "INSERT INTO public.atividades(titulo,descricao,tipo,autor_id,data_hora_prevista,vagas_totais,carga_horaria,status) VALUES('Plantio','Plantar mudas','TAREFA_ONG',$1,now()+interval '3 days',5,2,'ABERTA') RETURNING id AS value",
      [g],
    );
    const meta = await scalar(
      "INSERT INTO public.metas_demandas(titulo,descricao,tipo,quantidade_meta) VALUES('Sementes','Comprar sementes','MATERIAL',10) RETURNING id AS value",
    );
    const candidatar = async quem => {
      await role(null, 'owner');
      return scalar(
        'INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id) VALUES($1,$2) RETURNING id AS value',
        [atividade, quem],
      );
    };
    const gestao = [g, g2];

    await t.test('não reaplica', async () => {
      await role(null, 'owner');
      await assert.rejects(db.exec(migration), /não reaplicar/);
      await db.exec('ROLLBACK');
    });

    let ins;
    await t.test('candidatura nova avisa toda a gestão, inclusive em modo voluntário', async () => {
      ins = await candidatar(v);
      const n = await de('CANDIDATURA_NOVA');
      assert.deepEqual(n.map(x => x.usuario_id).sort(), [...gestao].sort());
      assert.match(n[0].corpo, /Ana Voluntária se candidatou a "Plantio"/);
      assert.equal((await de('CANDIDATURA_NOVA', [v])).length, 0, 'quem agiu não é avisado');
    });

    await t.test('quem está em modo voluntário e se candidata não avisa a si mesmo', async () => {
      await role(g2, 'owner');
      await db.query(
        'INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id) VALUES($1,$2)',
        [atividade, g2],
      );
      const destinos = (await de('CANDIDATURA_NOVA')).filter(x => x.corpo.includes('Gestor Dois'));
      assert.deepEqual(
        destinos.map(x => x.usuario_id),
        [g],
      );
      await role(null, 'owner');
      await db.query('DELETE FROM public.inscricoes_atividades WHERE usuario_id=$1', [g2]);
    });

    await t.test('aprovar avisa o voluntário', async () => {
      await role(null, 'owner');
      await db.query(
        "UPDATE public.inscricoes_atividades SET status_inscricao='APROVADA' WHERE id=$1",
        [ins],
      );
      const n = await de('CANDIDATURA_APROVADA');
      assert.deepEqual(
        n.map(x => x.usuario_id),
        [v],
      );
      assert.match(n[0].corpo, /"Plantio" foi aprovada/);
    });

    await t.test('presença confirmada avisa a gestão', async () => {
      await role(null, 'owner');
      await db.query(
        'UPDATE public.inscricoes_atividades SET presenca_confirmada=true WHERE id=$1',
        [ins],
      );
      const n = await de('PRESENCA_CONFIRMADA');
      assert.deepEqual(n.map(x => x.usuario_id).sort(), [...gestao].sort());
    });

    await t.test('voluntário cancelando a candidatura avisa a gestão', async () => {
      const outra = await candidatar(v2);
      await db.query(
        "UPDATE public.inscricoes_atividades SET status_inscricao='CANCELADA' WHERE id=$1",
        [outra],
      );
      const n = await de('CANDIDATURA_CANCELADA');
      assert.deepEqual(n.map(x => x.usuario_id).sort(), [...gestao].sort());
      assert.match(n[0].corpo, /Bia Voluntária cancelou/);
    });

    await t.test('recusar avisa o voluntário com o motivo', async () => {
      const outra = await candidatar(g2);
      await db.query(
        "UPDATE public.inscricoes_atividades SET status_inscricao='RECUSADA', motivo_decisao='Sem vaga' WHERE id=$1",
        [outra],
      );
      const n = await de('CANDIDATURA_RECUSADA');
      assert.deepEqual(
        n.map(x => x.usuario_id),
        [g2],
      );
      assert.match(n[0].corpo, /Motivo: Sem vaga/);
      const antes = await total();
      await db.query(
        "UPDATE public.inscricoes_atividades SET status_inscricao='CANCELADA' WHERE id=$1",
        [outra],
      );
      assert.equal(await total(), antes, 'cancelar uma recusada não avisa ninguém');
    });

    await t.test('atividade cancelada avisa só quem estava aprovado', async () => {
      await role(null, 'owner');
      await db.query("UPDATE public.atividades SET status='CANCELADA' WHERE id=$1", [atividade]);
      const n = await de('ATIVIDADE_CANCELADA');
      assert.deepEqual(
        n.map(x => x.usuario_id),
        [v],
      );
      assert.match(n[0].corpo, /"Plantio" foi cancelada/);
      const antes = await total();
      await db.query("UPDATE public.atividades SET descricao='Nova descrição' WHERE id=$1", [
        atividade,
      ]);
      assert.equal(await total(), antes, 'outras mudanças não notificam');
    });

    let contribuicao;
    await t.test('contribuição nova avisa a gestão', async () => {
      await role(v);
      contribuicao = await scalar(
        'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida) VALUES($1,$2,5) RETURNING id AS value',
        [meta, v],
      );
      const n = await de('CONTRIBUICAO_NOVA');
      assert.deepEqual(n.map(x => x.usuario_id).sort(), [...gestao].sort());
      assert.match(n[0].corpo, /Ana Voluntária enviou uma contribuição para "Sementes"/);
    });

    await t.test('contribuição aprovada e recusada avisam o voluntário', async () => {
      await role(null, 'owner');
      await db.query(
        "UPDATE public.contribuicoes SET status_validacao='APROVADA',validado_por=$2,validado_em=now() WHERE id=$1",
        [contribuicao, g],
      );
      assert.deepEqual(
        (await de('CONTRIBUICAO_APROVADA')).map(x => x.usuario_id),
        [v],
      );
      const outra = await scalar(
        'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida) VALUES($1,$2,3) RETURNING id AS value',
        [meta, v],
      );
      await db.query(
        "UPDATE public.contribuicoes SET status_validacao='RECUSADA',validado_por=$2,validado_em=now(),observacao_validacao='Valor não consta' WHERE id=$1",
        [outra, g],
      );
      const n = await de('CONTRIBUICAO_RECUSADA');
      assert.deepEqual(
        n.map(x => x.usuario_id),
        [v],
      );
      assert.match(n[0].corpo, /Motivo: Valor não consta/);
    });

    await t.test('cada um lê só as próprias e não escreve direto', async () => {
      await role(v);
      const minhas = (await db.query('SELECT usuario_id FROM public.notificacoes')).rows;
      assert.ok(minhas.length > 0 && minhas.every(n => n.usuario_id === v));
      await assert.rejects(
        db.query('UPDATE public.notificacoes SET lida_em=now()'),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "INSERT INTO public.notificacoes(usuario_id,tipo,titulo,corpo) VALUES($1,'CANDIDATURA_NOVA','x','y')",
          [v],
        ),
        /permission denied/,
      );
      await role(null, 'anon');
      await assert.rejects(db.query('SELECT 1 FROM public.notificacoes'), /permission denied/);
    });

    await t.test('marcar como lida vale só para a própria notificação', async () => {
      await role(null, 'owner');
      const alheia = await scalar(
        'SELECT id AS value FROM public.notificacoes WHERE usuario_id=$1 LIMIT 1',
        [g],
      );
      await role(v);
      await db.query('SELECT public.notificacoes_marcar_lida($1)', [alheia]);
      await role(null, 'owner');
      assert.equal(
        await scalar('SELECT lida_em IS NULL AS value FROM public.notificacoes WHERE id=$1', [
          alheia,
        ]),
        true,
        'notificação de outro usuário continua não lida',
      );
      await role(v);
      await db.query('SELECT public.notificacoes_marcar_todas_lidas()');
      await role(null, 'owner');
      assert.equal(
        Number(
          await scalar(
            'SELECT count(*) AS value FROM public.notificacoes WHERE usuario_id=$1 AND lida_em IS NULL',
            [v],
          ),
        ),
        0,
      );
      assert.ok(
        Number(
          await scalar(
            'SELECT count(*) AS value FROM public.notificacoes WHERE usuario_id=$1 AND lida_em IS NULL',
            [g],
          ),
        ) > 0,
        'as dos outros seguem não lidas',
      );
    });
  } finally {
    await db.close();
  }
});
