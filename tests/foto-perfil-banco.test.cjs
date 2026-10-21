const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const voluntario = '11111111-1111-4111-8111-111111111111';
const gestor = '22222222-2222-4222-8222-222222222222';
const outro = '33333333-3333-4333-8333-333333333333';
const convidado = '44444444-4444-4444-8444-444444444444';
const legado = 'https://example.invalid/foto-antiga.jpg';
const migration = fs.readFileSync('supabase/reconciliacao/20261021120000_foto_perfil.sql', 'utf8');

async function prepararBanco(comConvidado = false) {
  const db = new PGlite();
  await db.exec(fs.readFileSync('tests/fixtures/reconciliacao-mvp-remoto.sql', 'utf8'));
  await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql', 'utf8'));
  for (const [id, nome] of [
    [voluntario, 'Ana'],
    [gestor, 'Gestão'],
    [outro, 'Bia'],
    [convidado, 'Convidado'],
  ]) {
    await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)', [
      id,
      nome + '@example.invalid',
      JSON.stringify({ nome }),
    ]);
  }
  await db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1", [gestor]);
  await db.query('UPDATE public.usuarios SET foto_perfil=$1 WHERE id=$2', [legado, voluntario]);
  await db.exec(
    fs.readFileSync('supabase/migrations/reconciliacao_01_base_perfis_endereco.sql', 'utf8'),
  );
  await db.exec(
    fs.readFileSync(
      'supabase/reconciliacao/20260930141047_reconciliacao_02_fluxos_mvp.sql',
      'utf8',
    ),
  );
  if (comConvidado) {
    await db.exec(fs.readFileSync('supabase/reconciliacao/20261006120000_modo_gestor.sql', 'utf8'));
    await db.exec(fs.readFileSync('supabase/reconciliacao/20261006180000_convidado.sql', 'utf8'));
  } else {
    // A foto também instala quando as tabelas do fluxo antigo de materiais já saíram.
    await db.exec(
      fs.readFileSync('supabase/reconciliacao/20261005150000_contribuicoes_metas_pix.sql', 'utf8'),
    );
  }
  return db;
}

test('Foto do perfil: RPC e Storage privados sobre catálogo reconciliado (dados sintéticos)', async t => {
  const db = await prepararBanco();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function role(id, papel = 'authenticated', anonimo = false) {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      id ? JSON.stringify({ sub: id, is_anonymous: anonimo }) : '',
    ]);
    if (papel !== 'owner') await db.exec('SET ROLE ' + papel);
  }
  async function enviar() {
    const caminho = await scalar('SELECT public.perfil_foto_caminho() AS value');
    await db.query(
      'INSERT INTO storage.objects(bucket_id,name,metadata) VALUES(\'perfil-fotos\',$1,\'{"mimetype":"image/jpeg","size":1024}\')',
      [caminho],
    );
    return caminho;
  }
  const salvar = (caminho, anterior, usuarioId = voluntario) =>
    scalar('SELECT public.perfil_foto_salvar($1,$2,$3) AS value', [caminho, anterior, usuarioId]);
  let foto1, foto2, fotoOutro, fotoGestor, fotoConvidado;
  try {
    await db.exec(migration);
    await t.test(
      'bucket privado JPEG 2 MiB, legado preservado e reaplicação rejeitada',
      async () => {
        assert.deepEqual(
          (
            await db.query(
              "SELECT public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='perfil-fotos'",
            )
          ).rows[0],
          { public: false, file_size_limit: 2097152, allowed_mime_types: ['image/jpeg'] },
        );
        assert.equal(
          await scalar('SELECT foto_perfil AS value FROM public.usuarios WHERE id=$1', [
            voluntario,
          ]),
          legado,
        );
        await assert.rejects(db.exec(migration), /não reaplicar/);
        await db.exec('ROLLBACK');
        // Mesmo uma policy permissiva legada não pode abrir este bucket.
        await db.exec(
          'CREATE POLICY foto_teste_permissiva ON storage.objects FOR ALL TO anon,authenticated USING(true) WITH CHECK(true)',
        );
      },
    );
    await t.test('cada conta envia somente em sua pasta e lê somente suas fotos', async () => {
      await role(voluntario);
      foto1 = await enviar();
      foto2 = await enviar();
      assert.match(foto1, new RegExp('^' + voluntario + '/[0-9a-f-]{36}\\.jpg$'));
      await role(outro);
      fotoOutro = await enviar();
      assert.equal(
        await scalar(
          "SELECT count(*)::int AS value FROM storage.objects WHERE bucket_id='perfil-fotos'",
        ),
        1,
      );
      await assert.rejects(
        db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('perfil-fotos',$1)", [
          voluntario + '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',
        ]),
        /row-level security/,
      );
      await role(gestor);
      fotoGestor = await enviar();
      assert.equal(
        await scalar(
          "SELECT count(*)::int AS value FROM storage.objects WHERE bucket_id='perfil-fotos'",
        ),
        1,
      );
      await role(voluntario);
      assert.equal(
        await scalar(
          "SELECT count(*)::int AS value FROM storage.objects WHERE bucket_id='perfil-fotos'",
        ),
        2,
      );
    });
    await t.test(
      'API direta não altera a foto; outros campos e RPCs de perfil continuam funcionando',
      async () => {
        await role(voluntario);
        await assert.rejects(
          db.query('UPDATE public.usuarios SET foto_perfil=$1 WHERE id=$2', [foto1, voluntario]),
          /opções do perfil/,
        );
        await db.query("UPDATE public.usuarios SET nome='Ana Atualizada' WHERE id=$1", [
          voluntario,
        ]);
        await scalar(
          'SELECT public.voluntariado_salvar_perfil(\'{"telefone":"51999999999"}\',ARRAY[]::bigint[]) AS value',
        );
        assert.equal(
          await scalar('SELECT foto_perfil AS value FROM public.usuarios WHERE id=$1', [
            voluntario,
          ]),
          legado,
        );
        await role(gestor);
        assert.equal(await salvar(fotoGestor, null, gestor), true);
        assert.equal(
          await scalar(
            'SELECT public.gestao_salvar_perfil(\'{"nome":"Gestão Atualizada"}\') AS value',
          ),
          true,
        );
        assert.equal(
          await scalar('SELECT foto_perfil AS value FROM public.usuarios WHERE id=$1', [gestor]),
          fotoGestor,
        );
      },
    );
    await t.test(
      'RPC rejeita arquivo ausente, caminho alheio, URL e sessão de outra conta',
      async () => {
        await role(voluntario);
        await assert.rejects(
          salvar(voluntario + '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg', legado),
          /Envie a foto/,
        );
        await assert.rejects(salvar(fotoOutro, legado), /enviada pela sua conta/);
        await assert.rejects(
          salvar('https://example.invalid/nova.jpg', legado),
          /enviada pela sua conta/,
        );
        await assert.rejects(salvar(foto1, legado, outro), /Entre com sua conta/);
        assert.equal(
          await scalar('SELECT foto_perfil AS value FROM public.usuarios WHERE id=$1', [
            voluntario,
          ]),
          legado,
        );
      },
    );
    await t.test('salva com CAS, rejeita resposta antiga e protege arquivo vinculado', async () => {
      assert.equal(await salvar(foto1, legado), true);
      await assert.rejects(salvar(foto2, legado), /alterada em outra operação/);
      assert.equal(
        await scalar('SELECT foto_perfil AS value FROM public.usuarios WHERE id=$1', [voluntario]),
        foto1,
      );
      assert.equal(
        (
          await db.query(
            "DELETE FROM storage.objects WHERE bucket_id='perfil-fotos' AND name=$1 RETURNING id",
            [foto1],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "UPDATE storage.objects SET metadata='{}' WHERE bucket_id='perfil-fotos' AND name=$1 RETURNING id",
            [foto1],
          )
        ).rows.length,
        0,
      );
      assert.equal(await salvar(foto2, foto1), true);
      assert.equal(
        (
          await db.query(
            "DELETE FROM storage.objects WHERE bucket_id='perfil-fotos' AND name=$1 RETURNING id",
            [foto1],
          )
        ).rows.length,
        1,
      );
    });
    await t.test('remoção null-safe libera somente a foto desvinculada', async () => {
      await assert.rejects(salvar(null, null), /alterada em outra operação/);
      assert.equal(await salvar(null, foto2), true);
      assert.equal(
        await scalar('SELECT foto_perfil AS value FROM public.usuarios WHERE id=$1', [voluntario]),
        null,
      );
      assert.equal(
        (
          await db.query(
            "DELETE FROM storage.objects WHERE bucket_id='perfil-fotos' AND name=$1 RETURNING id",
            [foto2],
          )
        ).rows.length,
        1,
      );
      assert.equal(await salvar(null, null), true);
    });
    await t.test(
      'convidado bloqueado pelo claim sem depender da migration de convidado',
      async () => {
        await role(convidado);
        fotoConvidado = await enviar();
        await role(convidado, 'authenticated', true);
        assert.equal(
          await scalar(
            "SELECT count(*)::int AS value FROM storage.objects WHERE bucket_id='perfil-fotos'",
          ),
          0,
        );
        await assert.rejects(
          scalar('SELECT public.perfil_foto_caminho() AS value'),
          /Entre com sua conta/,
        );
        await assert.rejects(salvar(fotoConvidado, null, convidado), /Entre com sua conta/);
        await assert.rejects(
          db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('perfil-fotos',$1)", [
            convidado + '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg',
          ]),
          /row-level security/,
        );
        assert.equal(
          (
            await db.query(
              "DELETE FROM storage.objects WHERE bucket_id='perfil-fotos' AND name=$1 RETURNING id",
              [fotoConvidado],
            )
          ).rows.length,
          0,
        );
        await role(null, 'anon');
        assert.equal(
          await scalar(
            "SELECT count(*)::int AS value FROM storage.objects WHERE bucket_id='perfil-fotos'",
          ),
          0,
        );
        await assert.rejects(
          scalar('SELECT public.perfil_foto_caminho() AS value'),
          /permission denied/,
        );
        await role(null, 'owner');
        assert.equal(
          await scalar(
            "SELECT has_function_privilege('service_role','public.perfil_foto_salvar(text,text,uuid)','EXECUTE') AS value",
          ),
          false,
        );
      },
    );
    await t.test('regras do Diário continuam independentes', async () => {
      await role(gestor);
      const caminho = await scalar("SELECT public.diario_caminho('jpg') AS value");
      await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('diario-imagens',$1)", [
        caminho,
      ]);
      assert.equal(
        await scalar(
          "SELECT count(*)::int AS value FROM storage.objects WHERE bucket_id='diario-imagens'",
        ),
        1,
      );
    });
  } finally {
    await db.close();
  }
});

test('Foto do perfil também instala sobre a reconciliação de convidado já aplicada', async () => {
  const db = await prepararBanco(true);
  try {
    await db.exec(migration);
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [voluntario]);
    await db.query("SELECT set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: voluntario, is_anonymous: false }),
    ]);
    await db.exec('SET ROLE authenticated');
    assert.match(
      (await db.query('SELECT public.perfil_foto_caminho() AS caminho')).rows[0].caminho,
      new RegExp('^' + voluntario + '/'),
    );
  } finally {
    await db.close();
  }
});
