const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const c = '44444444-4444-4444-8444-444444444444';
const migration = fs.readFileSync(
  'supabase/reconciliacao/20261026120000_dispositivos_push.sql',
  'utf8',
);
const tokenA = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const tokenB = 'ExpoPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

test('Dispositivos de push (B29), dados sintéticos', async t => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function role(id, r = 'authenticated', anonimo = false) {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      id ? JSON.stringify({ sub: id, is_anonymous: anonimo }) : '',
    ]);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
  const donos = async () => {
    await role(null, 'owner');
    return (
      await db.query(
        'SELECT token, usuario_id, plataforma FROM voluntariado_privado.dispositivos_push ORDER BY token',
      )
    ).rows;
  };
  try {
    await db.exec(fs.readFileSync('tests/fixtures/reconciliacao-mvp-remoto.sql', 'utf8'));
    await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql', 'utf8'));
    await db.query(
      'INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,\'ana@example.invalid\',\'{"nome":"Ana Voluntária"}\'),($2,\'gestao@example.invalid\',\'{"nome":"Gestão"}\')',
      [v, g],
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
    await assert.rejects(db.exec(migration), /já instalados/, 'não reaplica');
    await db.exec('ROLLBACK');

    await t.test('registra o token e repetir não duplica', async () => {
      await role(v);
      await db.query("SELECT public.push_registrar_token($1,'android')", [tokenA]);
      await db.query("SELECT public.push_registrar_token($1,'android')", [tokenA]);
      assert.deepEqual(await donos(), [{ token: tokenA, usuario_id: v, plataforma: 'android' }]);
    });

    await t.test('um usuário pode ter vários aparelhos', async () => {
      await role(v);
      await db.query("SELECT public.push_registrar_token($1,'ios')", [tokenB]);
      assert.equal((await donos()).filter(d => d.usuario_id === v).length, 2);
    });

    await t.test('o aparelho que troca de conta passa o token para a nova sessão', async () => {
      await role(g);
      await db.query("SELECT public.push_registrar_token($1,'android')", [tokenA]);
      const dono = (await donos()).find(d => d.token === tokenA);
      assert.equal(dono.usuario_id, g);
    });

    await t.test('só remove o próprio token', async () => {
      await role(v);
      await db.query('SELECT public.push_remover_token($1)', [tokenA]);
      assert.ok(
        (await donos()).some(d => d.token === tokenA),
        'token de outro usuário fica',
      );
      await role(g);
      await db.query('SELECT public.push_remover_token($1)', [tokenA]);
      assert.ok(!(await donos()).some(d => d.token === tokenA));
    });

    await t.test('rejeita token e plataforma inválidos', async () => {
      await role(v);
      for (const ruim of [
        null,
        '',
        'abc',
        'ExponentPushToken[]',
        'ExponentPushToken[x',
        'x'.repeat(300),
      ])
        await assert.rejects(
          db.query("SELECT public.push_registrar_token($1,'android')", [ruim]),
          /Token de notificação inválido/,
          String(ruim),
        );
      for (const ruim of [null, 'web', ''])
        await assert.rejects(
          db.query('SELECT public.push_registrar_token($1,$2)', [tokenB, ruim]),
          /Plataforma inválida/,
          String(ruim),
        );
    });

    await t.test('convidado e anônimo sem sessão não registram', async () => {
      await role(null, 'owner');
      await db.query(
        'INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,\'conv@example.invalid\',\'{"nome":"Convidado"}\')',
        [c],
      );
      await role(c, 'authenticated', true);
      await assert.rejects(
        db.query("SELECT public.push_registrar_token($1,'android')", [tokenA]),
        /Convidado não recebe/,
      );
      await role(null, 'anon');
      await assert.rejects(
        db.query("SELECT public.push_registrar_token($1,'android')", [tokenA]),
        /permission denied/,
      );
    });

    await t.test('o app não lê nem escreve a tabela direto', async () => {
      await role(v);
      await assert.rejects(
        db.query('SELECT token FROM voluntariado_privado.dispositivos_push'),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "INSERT INTO voluntariado_privado.dispositivos_push(usuario_id,token,plataforma) VALUES($1,$2,'ios')",
          [v, tokenA],
        ),
        /permission denied/,
      );
    });

    await t.test('excluir o usuário apaga seus tokens', async () => {
      await role(null, 'owner');
      await db.query('DELETE FROM public.usuarios WHERE id=$1', [v]);
      assert.equal(
        Number(
          await scalar(
            'SELECT count(*) AS value FROM voluntariado_privado.dispositivos_push WHERE usuario_id=$1',
            [v],
          ),
        ),
        0,
      );
    });
  } finally {
    await db.close();
  }
});
