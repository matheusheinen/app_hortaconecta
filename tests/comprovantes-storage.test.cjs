const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const migration = fs.readFileSync(
  'supabase/reconciliacao/20261023170000_comprovantes_storage.sql',
  'utf8',
);

test('Comprovantes: bucket privado e policies sobre o remoto (dados sintéticos)', async t => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function role(id, r = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
  const inserirArquivo = caminho =>
    db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('comprovantes',$1)", [caminho]);
  const arquivos = async () =>
    (await db.query("SELECT name FROM storage.objects WHERE bucket_id='comprovantes'")).rows.map(
      r => r.name,
    );
  try {
    await db.exec(fs.readFileSync('tests/fixtures/reconciliacao-mvp-remoto.sql', 'utf8'));
    await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql', 'utf8'));
    await db.query(
      'INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,\'ana@example.invalid\',\'{"nome":"Ana Voluntária"}\'),($2,\'gestao@example.invalid\',\'{"nome":"Gestão"}\'),($3,\'bia@example.invalid\',\'{"nome":"Bia Voluntária"}\')',
      [v, g, other],
    );
    await db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1", [g]);
    const meta = await scalar(
      "INSERT INTO public.metas_demandas(titulo,descricao,tipo,quantidade_meta) VALUES('Kit','Plantar','FINANCEIRA',200) RETURNING id AS value",
    );
    await db.exec(migration);

    await t.test('cria o bucket privado de 5 MiB só com JPEG e não reaplica', async () => {
      const b = (await db.query("SELECT * FROM storage.buckets WHERE id='comprovantes'")).rows[0];
      assert.equal(b.public, false);
      assert.equal(Number(b.file_size_limit), 5242880);
      assert.deepEqual(b.allowed_mime_types, ['image/jpeg']);
      await assert.rejects(db.exec(migration), /não reaplicar/);
      await db.exec('ROLLBACK');
    });

    let caminhoAna;
    await t.test('caminho gerado pelo banco começa pelo uid de quem pede', async () => {
      await role(v);
      caminhoAna = await scalar('SELECT public.comprovante_caminho() AS value');
      assert.match(caminhoAna, new RegExp('^' + v + '/[0-9a-f-]{36}\\.jpg$'));
      await role('', 'anon');
      await assert.rejects(db.query('SELECT public.comprovante_caminho()'), /permission denied/);
    });

    await t.test('voluntário envia só na própria pasta, com nome e extensão válidos', async () => {
      await role(v);
      await inserirArquivo(caminhoAna);
      await assert.rejects(
        inserirArquivo(other + '/' + '4'.repeat(8) + '-4444-4444-4444-' + '4'.repeat(12) + '.jpg'),
        /row-level security/,
      );
      await assert.rejects(inserirArquivo(v + '/foto.jpg'), /row-level security/);
      await assert.rejects(
        inserirArquivo(v + '/' + '5'.repeat(8) + '-5555-4555-8555-' + '5'.repeat(12) + '.png'),
        /row-level security/,
      );
      await role('', 'anon');
      await assert.rejects(inserirArquivo(caminhoAna + 'x'), /row-level security|permission/);
    });

    await t.test('leitura: dono e gestão veem; outro voluntário e anônimo não', async () => {
      await role(v);
      assert.deepEqual(await arquivos(), [caminhoAna]);
      await role(g);
      assert.deepEqual(await arquivos(), [caminhoAna]);
      await role(other);
      assert.deepEqual(await arquivos(), []);
      await role('', 'anon');
      assert.deepEqual(await arquivos(), []);
    });

    await t.test('arquivos são imutáveis: update é bloqueado até para a gestão', async () => {
      for (const quem of [v, g]) {
        await role(quem);
        const r = await db.query(
          "UPDATE storage.objects SET name=name||'x' WHERE bucket_id='comprovantes' RETURNING id",
        );
        assert.equal(r.rows.length, 0);
      }
      assert.deepEqual(await arquivos(), [caminhoAna]);
    });

    await t.test('contribuição só aponta para arquivo da própria pasta', async () => {
      await role(v);
      const outroDono = other + '/' + '4'.repeat(8) + '-4444-4444-4444-' + '4'.repeat(12) + '.jpg';
      await assert.rejects(
        db.query(
          'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,url_comprovante) VALUES($1,$2,10,$3)',
          [meta, v, outroDono],
        ),
        /row-level security/,
      );
      await assert.rejects(
        db.query(
          "INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,url_comprovante) VALUES($1,$2,10,'qualquer-coisa')",
          [meta, v],
        ),
        /row-level security/,
      );
      await db.query(
        'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,url_comprovante) VALUES($1,$2,10,$3)',
        [meta, v, caminhoAna],
      );
      await db.query(
        'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida) VALUES($1,$2,5)',
        [meta, v],
      );
    });

    await t.test('gestão vê o comprovante da contribuição e confere normalmente', async () => {
      await role(g);
      assert.equal(
        await scalar(
          'SELECT url_comprovante AS value FROM public.contribuicoes WHERE quantidade_oferecida=10',
        ),
        caminhoAna,
      );
      assert.equal(
        (
          await db.query(
            "UPDATE public.contribuicoes SET status_validacao='APROVADA',validado_por=$1,validado_em=now() WHERE quantidade_oferecida=10 RETURNING id",
            [g],
          )
        ).rows.length,
        1,
      );
    });

    await t.test('apagar: só arquivo solto da própria pasta; ligado ou alheio, não', async () => {
      await role(v);
      const solto = await scalar('SELECT public.comprovante_caminho() AS value');
      await inserirArquivo(solto);
      await role(other);
      assert.equal(
        (await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name', [solto])).rows
          .length,
        0,
      );
      await role(g);
      assert.equal(
        (await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name', [solto])).rows
          .length,
        0,
      );
      await role(v);
      assert.equal(
        (await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name', [caminhoAna]))
          .rows.length,
        0,
      );
      assert.equal(
        (await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name', [solto])).rows
          .length,
        1,
      );
    });

    await t.test('policy ampla de outro bucket não abre o de comprovantes', async () => {
      await role(null, 'owner');
      await db.exec(
        'CREATE POLICY teste_ampla ON storage.objects FOR ALL TO PUBLIC USING(true) WITH CHECK(true)',
      );
      await role(other);
      assert.deepEqual(await arquivos(), []);
      await assert.rejects(inserirArquivo(caminhoAna + 'y'), /row-level security/);
      assert.equal(
        (
          await db.query(
            "UPDATE storage.objects SET name=name||'z' WHERE bucket_id='comprovantes' RETURNING id",
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (await db.query("DELETE FROM storage.objects WHERE bucket_id='comprovantes' RETURNING id"))
          .rows.length,
        0,
      );
    });
  } finally {
    await db.close();
  }
});
