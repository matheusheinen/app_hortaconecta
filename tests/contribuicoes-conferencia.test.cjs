const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const arrecadacao = fs.readFileSync(
  'supabase/reconciliacao/20261023200000_arrecadacao_trigger.sql',
  'utf8',
);
const migration = fs.readFileSync(
  'supabase/reconciliacao/20261023210000_contribuicoes_conferencia.sql',
  'utf8',
);

test('Conferência de contribuições (B23), dados sintéticos', async t => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function role(id, r = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
  try {
    await db.exec(fs.readFileSync('tests/fixtures/reconciliacao-mvp-remoto.sql', 'utf8'));
    await db.query(
      'INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,\'ana@example.invalid\',\'{"nome":"Ana Voluntária"}\'),($2,\'gestao@example.invalid\',\'{"nome":"Gestão"}\')',
      [v, g],
    );
    await db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1", [g]);
    await db.exec(arrecadacao);
    await db.exec(migration);
    await db.exec(migration); // idempotente

    const meta = await scalar(
      "INSERT INTO public.metas_demandas(titulo,descricao,tipo,quantidade_meta) VALUES('Meta','Teste','FINANCEIRA',100) RETURNING id AS value",
    );
    const nova = async (valor = 10) => {
      await role(v);
      const id = await scalar(
        'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida) VALUES($1,$2,$3) RETURNING id AS value',
        [meta, v, valor],
      );
      await role(g);
      return id;
    };
    const total = async () => {
      await role(null, 'owner');
      return Number(
        await scalar(
          'SELECT quantidade_arrecadada AS value FROM public.metas_demandas WHERE id=$1',
          [meta],
        ),
      );
    };
    const aprovar = id =>
      db.query(
        "UPDATE public.contribuicoes SET status_validacao='APROVADA',validado_por=$2,validado_em=now() WHERE id=$1",
        [id, g],
      );

    await t.test('aprova pendente e o total passa a contar', async () => {
      const id = await nova(10);
      await aprovar(id);
      assert.equal(await total(), 10);
    });

    await t.test('contribuição já aprovada não pode ser alterada nem revertida', async () => {
      const id = await nova(5);
      await aprovar(id);
      await role(g);
      await assert.rejects(
        db.query(
          "UPDATE public.contribuicoes SET status_validacao='RECUSADA',validado_por=$2,validado_em=now(),observacao_validacao='desfeito' WHERE id=$1",
          [id, g],
        ),
        /já foi conferida/,
      );
      await assert.rejects(
        db.query('UPDATE public.contribuicoes SET quantidade_oferecida=500 WHERE id=$1', [id]),
        /já foi conferida/,
      );
      assert.equal(await total(), 15);
    });

    await t.test('recusa exige motivo e a recusada também fica travada', async () => {
      const id = await nova(7);
      await assert.rejects(
        db.query(
          "UPDATE public.contribuicoes SET status_validacao='RECUSADA',validado_por=$2,validado_em=now() WHERE id=$1",
          [id, g],
        ),
        /motivo da recusa/,
      );
      await assert.rejects(
        db.query(
          "UPDATE public.contribuicoes SET status_validacao='RECUSADA',validado_por=$2,validado_em=now(),observacao_validacao='  ' WHERE id=$1",
          [id, g],
        ),
        /motivo da recusa/,
      );
      await db.query(
        "UPDATE public.contribuicoes SET status_validacao='RECUSADA',validado_por=$2,validado_em=now(),observacao_validacao='Valor não consta no extrato' WHERE id=$1",
        [id, g],
      );
      assert.equal(await total(), 15, 'recusada não soma');
      await role(g);
      await assert.rejects(aprovar(id), /já foi conferida/);
    });

    await t.test('conferir não altera meta, doador, valor, comprovante nem envio', async () => {
      const id = await nova(3);
      for (const alteracao of [
        'quantidade_oferecida=99',
        'usuario_id=' + `'${g}'`,
        "url_comprovante='" + v + "/x.png'",
        "data_envio=now()-interval '1 day'",
      ]) {
        await assert.rejects(
          db.query(`UPDATE public.contribuicoes SET ${alteracao} WHERE id=$1`, [id]),
          /dados enviados não mudam/,
          alteracao,
        );
      }
      await aprovar(id);
      assert.equal(await total(), 18);
    });

    await t.test('voluntário continua sem conferir contribuição', async () => {
      const id = await nova(2);
      await role(v);
      const { affectedRows } = await db
        .query(
          "UPDATE public.contribuicoes SET status_validacao='APROVADA',validado_por=$2,validado_em=now() WHERE id=$1",
          [id, v],
        )
        .catch(() => ({ affectedRows: 0 }));
      assert.equal(affectedRows, 0);
      assert.equal(await total(), 18);
    });

    await t.test(
      'gestão registra doação recebida direto como aprovada (INSERT livre)',
      async () => {
        await role(g);
        await db.query(
          "INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,status_validacao,validado_por,validado_em) VALUES($1,$2,4,'APROVADA',$3,now())",
          [meta, v, g],
        );
        assert.equal(await total(), 22);
      },
    );
  } finally {
    await db.close();
  }
});
