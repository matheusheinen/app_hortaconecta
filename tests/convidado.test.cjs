const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const c = '44444444-4444-4444-8444-444444444444';
const migration = fs.readFileSync('supabase/reconciliacao/20261006180000_convidado.sql', 'utf8');

test('Convidado: sessão anônima só lê (dados sintéticos)', async t => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  // anonimo=true imita o JWT de signInAnonymously; false, o de uma conta comum.
  async function role(id, r = 'authenticated', anonimo = false) {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      id ? JSON.stringify({ sub: id, is_anonymous: anonimo }) : '',
    ]);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
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
    await db.exec(fs.readFileSync('supabase/reconciliacao/20261006120000_modo_gestor.sql', 'utf8'));
    await db.query(
      "INSERT INTO public.atividades(titulo,descricao,tipo,autor_id,data_hora_prevista,vagas_totais,carga_horaria,status) VALUES('Plantio','Plantar mudas','TAREFA_ONG',$1,now()+interval '3 days',5,2,'ABERTA')",
      [g],
    );
    await db.query(
      "INSERT INTO public.metas_demandas(titulo,descricao,tipo,quantidade_meta) VALUES('Sementes','Comprar sementes','MATERIAL',10)",
    );
    await db.query(
      "INSERT INTO public.diario_transparencia(titulo,autor_id) VALUES('Relato','" + g + "')",
    );
    await db.exec(migration);
    // Mesmo com o gatilho do Auth: a conta anônima nasce sem e-mail nem nome.
    await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,NULL,'{}')", [c]);

    await t.test('não reaplica', async () => {
      await role(null, 'owner');
      await assert.rejects(db.exec(migration), /não reaplicar/);
      await db.exec('ROLLBACK');
    });

    await t.test('conta anônima ganha perfil com nome de reserva', async () => {
      await role(null, 'owner');
      assert.equal(
        await scalar('SELECT nome AS value FROM public.usuarios WHERE id=$1', [c]),
        'Convidado',
      );
      assert.equal(
        await scalar('SELECT tipo_perfil::text AS value FROM public.usuarios WHERE id=$1', [c]),
        'VOLUNTARIO',
      );
    });

    await t.test('e_convidado reflete o claim do JWT', async () => {
      await role(c, 'authenticated', true);
      assert.equal(await scalar('SELECT public.e_convidado() AS value'), true);
      await role(v, 'authenticated', false);
      assert.equal(await scalar('SELECT public.e_convidado() AS value'), false);
      await role(null, 'owner');
      assert.equal(await scalar('SELECT public.e_convidado() AS value'), false);
    });

    await t.test('convidado lê atividades abertas e metas', async () => {
      await role(c, 'authenticated', true);
      assert.equal(await scalar('SELECT count(*)::int AS value FROM public.atividades'), 1);
      assert.equal(await scalar('SELECT count(*)::int AS value FROM public.metas_demandas'), 1);
      assert.equal(
        await scalar('SELECT count(*)::int AS value FROM public.configuracao_instituicao'),
        1,
      );
    });

    await t.test('convidado não escreve por SQL direto nem por RPC', async () => {
      await role(c, 'authenticated', true);
      await assert.rejects(
        db.query("UPDATE public.usuarios SET nome='Invasor' WHERE id=$1", [c]),
        /Convidado não pode/,
      );
      await assert.rejects(
        db.query("UPDATE public.voluntarios SET profissao='Chef' WHERE usuario_id=$1", [c]),
        /Convidado não pode/,
      );
      await assert.rejects(
        db.query('INSERT INTO public.inscricoes_atividades(atividade_id,usuario_id) VALUES(1,$1)', [
          c,
        ]),
        /permission denied|Convidado não pode/,
      );
      await assert.rejects(
        db.query('DELETE FROM public.usuarios WHERE id=$1', [c]),
        /Convidado não pode/,
      );
      await assert.rejects(
        db.query('SELECT public.voluntariado_salvar_perfil($1::jsonb,ARRAY[]::bigint[])', [
          '{"profissao":"Chef"}',
        ]),
        /Convidado não pode/,
      );
      await assert.rejects(
        db.query('SELECT public.solicitar_exclusao_conta()'),
        /Convidado não pode/,
      );
      await role(null, 'owner');
      assert.equal(
        await scalar('SELECT nome AS value FROM public.usuarios WHERE id=$1', [c]),
        'Convidado',
      );
    });

    await t.test('convidado não vê o Diário; voluntário comum vê', async () => {
      await role(c, 'authenticated', true);
      assert.equal(
        await scalar('SELECT count(*)::int AS value FROM public.diario_transparencia'),
        0,
      );
      await role(v);
      assert.equal(
        await scalar('SELECT count(*)::int AS value FROM public.diario_transparencia'),
        1,
      );
    });

    await t.test('imagens do Diário ficam fechadas a convidado', async () => {
      await role(null, 'owner');
      await db.exec(
        "INSERT INTO storage.buckets(id,name) VALUES('diario-imagens','diario-imagens'),('outro','outro') ON CONFLICT DO NOTHING",
      );
      await db.exec(
        "INSERT INTO storage.objects(bucket_id,name) VALUES('diario-imagens','x.jpg'),('outro','y.jpg')",
      );
      await db.exec(
        'CREATE POLICY teste_leitura ON storage.objects FOR SELECT TO authenticated USING (true)',
      );
      await role(c, 'authenticated', true);
      assert.equal(
        await scalar(
          "SELECT count(*)::int AS value FROM storage.objects WHERE bucket_id='diario-imagens'",
        ),
        0,
      );
      assert.equal(
        await scalar("SELECT count(*)::int AS value FROM storage.objects WHERE bucket_id='outro'"),
        1,
      );
      // A policy ampla de teste deixaria ler tudo: o 0 acima vem só da restritiva de convidado.
    });

    await t.test('voluntário comum continua escrevendo', async () => {
      await role(v);
      await db.query("UPDATE public.usuarios SET nome='Ana Souza' WHERE id=$1", [v]);
      await role(null, 'owner');
      assert.equal(
        await scalar('SELECT nome AS value FROM public.usuarios WHERE id=$1', [v]),
        'Ana Souza',
      );
    });
  } finally {
    await db.close();
  }
});
