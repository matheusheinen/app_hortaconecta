const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const uuid = n =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const migracao1 = fs.readFileSync(
  'supabase/reconciliacao/20261023170000_comprovantes_storage.sql',
  'utf8',
);
const migracao2 = fs.readFileSync(
  'supabase/reconciliacao/20261023190000_comprovantes_formatos.sql',
  'utf8',
);

test('Comprovantes: formatos JPEG, PNG e WebP e registro pela gestão (dados sintéticos)', async t => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function role(id, r = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
  const inserirArquivo = caminho =>
    db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('comprovantes',$1)", [caminho]);
  const nomes = async () =>
    (await db.query("SELECT name FROM storage.objects WHERE bucket_id='comprovantes'")).rows.map(
      r => r.name,
    );
  try {
    await db.exec(fs.readFileSync('tests/fixtures/reconciliacao-mvp-remoto.sql', 'utf8'));
    await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql', 'utf8'));
    await db.query(
      'INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,\'ana@example.invalid\',\'{"nome":"Ana"}\'),($2,\'gestao@example.invalid\',\'{"nome":"Gestão"}\'),($3,\'bia@example.invalid\',\'{"nome":"Bia"}\')',
      [v, g, other],
    );
    await db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1", [g]);
    const meta = await scalar(
      "INSERT INTO public.metas_demandas(titulo,descricao,tipo,quantidade_meta) VALUES('Kit','Plantar','FINANCEIRA',200) RETURNING id AS value",
    );
    await assert.rejects(db.exec(migracao2), /ausente ou já alterado/);
    await db.exec('ROLLBACK');
    await db.exec(migracao1);
    await db.exec(migracao2);

    await t.test('bucket aceita os três formatos e não reaplica', async () => {
      const b = (await db.query("SELECT * FROM storage.buckets WHERE id='comprovantes'")).rows[0];
      assert.deepEqual(b.allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
      assert.equal(b.public, false);
      await assert.rejects(db.exec(migracao2), /não reaplicar/);
      await db.exec('ROLLBACK');
    });

    await t.test('caminho gerado aceita jpg, png e webp; recusa svg, gif e vazio', async () => {
      await role(v);
      for (const ext of ['jpg', 'png', 'webp']) {
        const c = await scalar('SELECT public.comprovante_caminho($1) AS value', [ext]);
        assert.match(c, new RegExp('^' + v + '/[0-9a-f-]{36}\\.' + ext + '$'));
      }
      for (const ruim of ['svg', 'gif', 'JPG', '']) {
        await assert.rejects(
          db.query('SELECT public.comprovante_caminho($1)', [ruim]),
          /não permitido/,
        );
      }
      await assert.rejects(db.query('SELECT public.comprovante_caminho(NULL)'), /não permitido/);
      await assert.rejects(db.query('SELECT public.comprovante_caminho()'), /does not exist/);
    });

    let png, webp;
    await t.test('voluntário envia jpg, png e webp na própria pasta; svg e gif não', async () => {
      await role(v);
      png = await scalar("SELECT public.comprovante_caminho('png') AS value");
      webp = await scalar("SELECT public.comprovante_caminho('webp') AS value");
      await inserirArquivo(png);
      await inserirArquivo(webp);
      await inserirArquivo(await scalar("SELECT public.comprovante_caminho('jpg') AS value"));
      for (const ext of ['svg', 'gif'])
        await assert.rejects(inserirArquivo(`${v}/${uuid(7)}.${ext}`), /row-level security/);
      await assert.rejects(inserirArquivo(`${other}/${uuid(7)}.png`), /row-level security/);
    });

    await t.test(
      'voluntário declara com png; não aponta para pasta alheia nem formato ruim',
      async () => {
        await role(v);
        await db.query(
          'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,url_comprovante) VALUES($1,$2,10,$3)',
          [meta, v, png],
        );
        await assert.rejects(
          db.query(
            'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,url_comprovante) VALUES($1,$2,10,$3)',
            [meta, v, `${other}/${uuid(4)}.png`],
          ),
          /row-level security/,
        );
        await assert.rejects(
          db.query(
            'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,url_comprovante) VALUES($1,$2,10,$3)',
            [meta, v, `${v}/${uuid(4)}.svg`],
          ),
          /row-level security/,
        );
      },
    );

    let doGestao;
    await t.test('gestão anexa comprovante ao registrar doação em nome do doador', async () => {
      await role(g);
      doGestao = await scalar("SELECT public.comprovante_caminho('webp') AS value");
      await inserirArquivo(doGestao);
      await db.query(
        "INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,url_comprovante,status_validacao,validado_por,validado_em) VALUES($1,$2,30,$3,'APROVADA',$4,now())",
        [meta, v, doGestao, g],
      );
      // A gestão não aponta para a pasta de um terceiro.
      await assert.rejects(
        db.query(
          "INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,url_comprovante,status_validacao,validado_por,validado_em) VALUES($1,$2,30,$3,'APROVADA',$4,now())",
          [meta, v, `${other}/${uuid(4)}.png`, g],
        ),
        /row-level security/,
      );
    });

    await t.test(
      'doador vê o arquivo que a gestão anexou à contribuição dele; outro voluntário não',
      async () => {
        await role(v);
        assert.ok((await nomes()).includes(doGestao));
        await role(other);
        assert.deepEqual(await nomes(), []);
        await role(g);
        assert.equal((await nomes()).length, 4);
      },
    );

    await t.test(
      'voluntário não aponta a própria contribuição para arquivo da gestão',
      async () => {
        await role(v);
        await assert.rejects(
          db.query(
            'INSERT INTO public.contribuicoes(meta_id,usuario_id,quantidade_oferecida,url_comprovante) VALUES($1,$2,10,$3)',
            [meta, v, doGestao],
          ),
          /row-level security/,
        );
      },
    );

    await t.test('imutável e sem apagar arquivo ligado, como antes', async () => {
      await role(v);
      assert.equal(
        (await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name', [png])).rows
          .length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "UPDATE storage.objects SET name=name||'x' WHERE bucket_id='comprovantes' RETURNING id",
          )
        ).rows.length,
        0,
      );
      await role(g);
      assert.equal(
        (await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING name', [doGestao]))
          .rows.length,
        0,
      );
      void webp;
    });
  } finally {
    await db.close();
  }
});
