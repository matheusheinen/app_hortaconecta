const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const migration = fs.readFileSync(
  'supabase/reconciliacao/20261019120000_atividades_arquivar.sql',
  'utf8',
);

test('Atividades: arquivar pela gestão sobre o remoto reconciliado (dados sintéticos)', async t => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function role(id, r = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
  const arquivada = async id => {
    await role(null, 'owner');
    return scalar('SELECT arquivada_em IS NOT NULL AS value FROM public.atividades WHERE id=$1', [
      id,
    ]);
  };
  const criar = async status => {
    await role(null, 'owner');
    return scalar(
      `INSERT INTO public.atividades(titulo,descricao,tipo,autor_id,data_hora_prevista,vagas_totais,carga_horaria,status)
       VALUES('Mutirão','Capina','TAREFA_ONG',$1,now()+interval '1 day',5,2,$2) RETURNING id AS value`,
      [g, status],
    );
  };
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

    await t.test('não reaplica', async () => {
      await role(null, 'owner');
      await assert.rejects(db.exec(migration), /não reaplicar/);
      await db.exec('ROLLBACK');
    });

    await t.test('voluntário e anon não arquivam', async () => {
      const id = await criar('REALIZADA');
      await role(v);
      await assert.rejects(
        db.query('SELECT public.voluntariado_arquivar_atividade($1,true)', [id]),
        /Somente a gestão/,
      );
      await role(null, 'anon');
      await assert.rejects(
        db.query('SELECT public.voluntariado_arquivar_atividade($1,true)', [id]),
        /permission denied/,
      );
      assert.equal(await arquivada(id), false);
    });

    await t.test('gestão arquiva e restaura atividade finalizada', async () => {
      for (const status of ['REALIZADA', 'CANCELADA', 'RECUSADA']) {
        const id = await criar(status);
        await role(g);
        await db.query('SELECT public.voluntariado_arquivar_atividade($1,true)', [id]);
        assert.equal(await arquivada(id), true, status);
        await role(g);
        await assert.rejects(
          db.query('SELECT public.voluntariado_arquivar_atividade($1,true)', [id]),
          /já está arquivada/,
        );
        await db.query('SELECT public.voluntariado_arquivar_atividade($1,false)', [id]);
        assert.equal(await arquivada(id), false, status);
        await role(g);
        await assert.rejects(
          db.query('SELECT public.voluntariado_arquivar_atividade($1,false)', [id]),
          /não está arquivada/,
        );
      }
    });

    await t.test(
      'atividade aberta ou encerrada não é arquivada; id inexistente falha',
      async () => {
        for (const status of ['ABERTA', 'ENCERRADA']) {
          const id = await criar(status);
          await role(g);
          await assert.rejects(
            db.query('SELECT public.voluntariado_arquivar_atividade($1,true)', [id]),
            /realizadas, canceladas ou recusadas/,
          );
          assert.equal(await arquivada(id), false, status);
        }
        await role(g);
        await assert.rejects(
          db.query('SELECT public.voluntariado_arquivar_atividade($1,true)', [999999]),
          /não encontrada/,
        );
      },
    );

    await t.test('UPDATE direto da coluna segue sem efeito para o cliente', async () => {
      const id = await criar('REALIZADA');
      await role(v);
      const r = await db
        .query('UPDATE public.atividades SET arquivada_em=now() WHERE id=$1 RETURNING id', [id])
        .catch(() => ({ rows: [] }));
      assert.equal(r.rows.length, 0);
      assert.equal(await arquivada(id), false);
    });
  } finally {
    await db.close();
  }
});
