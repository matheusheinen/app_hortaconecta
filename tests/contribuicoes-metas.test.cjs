const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const migration = fs.readFileSync(
  'supabase/reconciliacao/20261005150000_contribuicoes_metas_pix.sql',
  'utf8',
);

test('Contribuições por metas sobre o remoto reconciliado (dados sintéticos)', async t => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function role(id, r = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
  try {
    await db.exec(fs.readFileSync('tests/fixtures/reconciliacao-mvp-remoto.sql', 'utf8'));
    await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql', 'utf8'));
    await db.query(
      'INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,\'ana@example.invalid\',\'{"nome":"Ana Voluntária"}\'),($2,\'gestao@example.invalid\',\'{"nome":"Gestão"}\'),($3,\'bia@example.invalid\',\'{"nome":"Bia Voluntária"}\')',
      [v, g, other],
    );
    await db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1", [g]);
    await db.query(
      "INSERT INTO public.ongs(usuario_id,razao_social,chave_pix,nome_beneficiario_pix) VALUES($1,'Instituição','chave-ficticia@example.invalid','Horta Teste')",
      [g],
    );
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
    await role(g);
    await db.query("SELECT public.materiais_salvar(NULL,'Regadores','Para a horta',10)");
    await role(null, 'owner');
    const metaAntiga = await scalar(
      "INSERT INTO public.metas_demandas(titulo,descricao,tipo,quantidade_meta) VALUES('Meta antiga','Legado','FINANCEIRA',100) RETURNING id AS value",
    );
    await db.query(
      "INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,status_validacao,validado_por,validado_em) VALUES($1,$2,25,'APROVADA',$3,now())",
      [metaAntiga, v, g],
    );
    const antes = await scalar(
      'SELECT jsonb_agg(to_jsonb(c) ORDER BY id) AS value FROM public.contribuicoes c',
    );
    await db.exec(migration);

    await t.test('remove materiais, preserva contribuições e copia a chave PIX única', async () => {
      assert.equal(
        await scalar("SELECT to_regclass('public.solicitacoes_materiais') AS value"),
        null,
      );
      assert.equal(
        await scalar("SELECT to_regclass('public.contribuicoes_materiais') AS value"),
        null,
      );
      assert.equal(
        await scalar(
          "SELECT count(*)::int AS value FROM pg_proc WHERE proname LIKE 'materiais\\_%'",
        ),
        0,
      );
      assert.deepEqual(
        await scalar(
          'SELECT jsonb_agg(to_jsonb(c) ORDER BY id) AS value FROM public.contribuicoes c',
        ),
        antes,
      );
      assert.deepEqual(
        (
          await db.query(
            'SELECT chave_pix, nome_beneficiario_pix FROM public.configuracao_instituicao',
          )
        ).rows,
        [{ chave_pix: 'chave-ficticia@example.invalid', nome_beneficiario_pix: 'Horta Teste' }],
      );
      await assert.rejects(db.exec(migration), /não reaplicar/);
      await db.exec('ROLLBACK');
    });

    let meta;
    await t.test(
      'gestão cria meta; voluntário declara PENDENTE sem comprovante; total só conta aprovadas',
      async () => {
        await role(g);
        meta = await scalar(
          "INSERT INTO public.metas_demandas(titulo,descricao,tipo,unidade_medida,quantidade_meta) VALUES('Sementes','Para o canteiro','MATERIAL','pacotes',20) RETURNING id AS value",
        );
        await role(v);
        assert.equal(
          await scalar('SELECT chave_pix AS value FROM public.configuracao_instituicao'),
          'chave-ficticia@example.invalid',
        );
        const pendente = await scalar(
          'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida) VALUES($1,$2,5) RETURNING id AS value',
          [meta, v],
        );
        await assert.rejects(
          db.query(
            'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida) VALUES($1,$2,5)',
            [meta, other],
          ),
          /row-level security/,
        );
        await assert.rejects(
          db.query(
            "INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,status_validacao,validado_por,validado_em) VALUES($1,$2,5,'APROVADA',$2,now())",
            [meta, v],
          ),
          /row-level security/,
        );
        assert.equal(
          Number(
            await scalar(
              'SELECT quantidade_arrecadada AS value FROM public.metas_demandas WHERE id=$1',
              [meta],
            ),
          ),
          0,
        );
        await role(g);
        await db.query(
          "UPDATE public.contribuicoes SET status_validacao='APROVADA',validado_por=$2,validado_em=now() WHERE id=$1",
          [pendente, g],
        );
        await db.query(
          "INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,status_validacao,validado_por,validado_em,observacao_validacao) VALUES($1,$2,3,'APROVADA',$3,now(),'Recebido em mãos')",
          [meta, other, g],
        );
        assert.equal(
          Number(
            await scalar(
              'SELECT quantidade_arrecadada AS value FROM public.metas_demandas WHERE id=$1',
              [meta],
            ),
          ),
          8,
        );
        await role(other);
        assert.equal(
          await scalar('SELECT count(*)::int AS value FROM public.contribuicoes'),
          1,
          'Voluntário só vê as próprias',
        );
      },
    );

    await t.test(
      'meta encerrada não recebe declaração do voluntário, mas aceita lançamento da gestão',
      async () => {
        await role(g);
        await db.query("UPDATE public.metas_demandas SET status='ENCERRADA' WHERE id=$1", [meta]);
        await role(v);
        await assert.rejects(
          db.query(
            'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida) VALUES($1,$2,1)',
            [meta, v],
          ),
          /row-level security/,
        );
        await role(g);
        await db.query(
          "INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,status_validacao,validado_por,validado_em) VALUES($1,$2,1,'APROVADA',$3,now())",
          [meta, v, g],
        );
        assert.equal(
          Number(
            await scalar(
              'SELECT quantidade_arrecadada AS value FROM public.metas_demandas WHERE id=$1',
              [meta],
            ),
          ),
          9,
        );
      },
    );

    await t.test(
      'total arrecadado recalcula ao recusar, reverter e excluir; pendente não soma (B24)',
      async () => {
        const total = async () =>
          Number(
            await scalar(
              'SELECT quantidade_arrecadada AS value FROM public.metas_demandas WHERE id=$1',
              [meta],
            ),
          );
        assert.equal(await total(), 9);
        await role(null, 'owner');
        await db.exec(
          fs.readFileSync('supabase/reconciliacao/20261023200000_arrecadacao_trigger.sql', 'utf8'),
        );
        assert.equal(await total(), 9, 'migration é idempotente sobre o remoto');
        await role(g);
        const aberta = await scalar(
          "INSERT INTO public.metas_demandas(titulo,descricao,tipo,quantidade_meta) VALUES('Aberta B24','Teste','FINANCEIRA',100) RETURNING id AS value",
        );
        await role(v);
        const c = await scalar(
          'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida) VALUES($1,$2,40) RETURNING id AS value',
          [aberta, v],
        );
        const totalAberta = async () =>
          Number(
            await scalar(
              'SELECT quantidade_arrecadada AS value FROM public.metas_demandas WHERE id=$1',
              [aberta],
            ),
          );
        assert.equal(await totalAberta(), 0, 'PENDENTE não soma');
        await role(g);
        await db.query(
          "UPDATE public.contribuicoes SET status_validacao='APROVADA',validado_por=$2,validado_em=now() WHERE id=$1",
          [c, g],
        );
        assert.equal(await totalAberta(), 40);
        await db.query(
          "UPDATE public.contribuicoes SET status_validacao='RECUSADA',validado_por=$2,validado_em=now() WHERE id=$1",
          [c, g],
        );
        assert.equal(await totalAberta(), 0, 'reverter aprovação desfaz a soma');
        await db.query(
          "UPDATE public.contribuicoes SET status_validacao='APROVADA',validado_por=$2,validado_em=now() WHERE id=$1",
          [c, g],
        );
        assert.equal(await totalAberta(), 40);
        await db.query('DELETE FROM public.contribuicoes WHERE id=$1', [c]);
        assert.equal(await totalAberta(), 0, 'excluir contribuição aprovada desfaz a soma');
        assert.equal(await total(), 9, 'outra meta não é afetada');
        await role(v);
        await db
          .query('UPDATE public.metas_demandas SET quantidade_arrecadada=999 WHERE id=$1', [aberta])
          .catch(() => {});
        await role(null, 'owner');
        assert.equal(await totalAberta(), 0, 'voluntário não grava o total direto');
      },
    );

    await t.test('PIX: só a gestão altera; voluntário não', async () => {
      await role(g);
      assert.equal(
        (
          await db.query(
            "UPDATE public.configuracao_instituicao SET chave_pix='nova-chave' RETURNING id",
          )
        ).rows.length,
        1,
      );
      await role(v);
      const r = await db
        .query("UPDATE public.configuracao_instituicao SET chave_pix='invasor' RETURNING id")
        .catch(e => e);
      assert.ok(r instanceof Error || r.rows.length === 0);
      assert.equal(
        await scalar('SELECT chave_pix AS value FROM public.configuracao_instituicao'),
        'nova-chave',
      );
    });
  } finally {
    await db.close();
  }
});
