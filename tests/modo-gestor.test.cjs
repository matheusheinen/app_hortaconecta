const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const migration = fs.readFileSync('supabase/reconciliacao/20261006120000_modo_gestor.sql', 'utf8');

test('Modo gestor: alternância ONG <-> voluntário (dados sintéticos)', async t => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function role(id, r = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
  const tipo = id =>
    scalar('SELECT tipo_perfil::text AS value FROM public.usuarios WHERE id=$1', [id]);
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

    await t.test('voluntário comum não alterna nem se promove', async () => {
      await role(v);
      assert.equal(await scalar('SELECT public.gestor_pode_alternar_modo() AS value'), false);
      await assert.rejects(
        db.query('SELECT public.gestor_alternar_modo(true)'),
        /Somente a gestão/,
      );
      await assert.rejects(
        db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1", [v]),
        /não permitida|Não é permitido alterar/,
      );
      await role(null, 'owner');
      assert.equal(await tipo(v), 'VOLUNTARIO');
    });

    await t.test('gestão vira voluntário de verdade e volta', async () => {
      await role(g);
      assert.equal(await scalar('SELECT public.gestor_pode_alternar_modo() AS value'), true);
      assert.equal(
        await scalar('SELECT public.gestor_alternar_modo(false) AS value'),
        'VOLUNTARIO',
      );
      await role(null, 'owner');
      assert.equal(await tipo(g), 'VOLUNTARIO');
      await role(g);
      // Em modo voluntário continua podendo voltar; chamada repetida é idempotente.
      assert.equal(await scalar('SELECT public.gestor_pode_alternar_modo() AS value'), true);
      assert.equal(
        await scalar('SELECT public.gestor_alternar_modo(false) AS value'),
        'VOLUNTARIO',
      );
      assert.equal(
        await scalar(
          'SELECT public.voluntariado_salvar_perfil($1::jsonb,ARRAY[]::bigint[]) AS value',
          ['{"profissao":"Chef"}'],
        ),
        false,
      );
      assert.equal(await scalar('SELECT public.gestor_alternar_modo(true) AS value'), 'ONG');
      await role(null, 'owner');
      assert.equal(await tipo(g), 'ONG');
      assert.equal(
        await scalar('SELECT profissao AS value FROM public.voluntarios WHERE usuario_id=$1', [g]),
        'Chef',
      );
    });

    await t.test('UPDATE direto e anon continuam bloqueados', async () => {
      await role(g);
      await assert.rejects(
        db.query("UPDATE public.usuarios SET tipo_perfil='VOLUNTARIO' WHERE id=$1", [g]),
        /não permitida|Não é permitido alterar/,
      );
      await role(null, 'anon');
      await assert.rejects(
        db.query('SELECT public.gestor_alternar_modo(false)'),
        /permission denied/,
      );
    });
  } finally {
    await db.close();
  }
});
