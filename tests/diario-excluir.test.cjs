const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const migration = fs.readFileSync('supabase/reconciliacao/20261005170000_diario_excluir.sql', 'utf8');

test('Diário: exclusão pela gestão sobre o remoto reconciliado (dados sintéticos)', async t => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  async function role(id, r = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
  const salvar = img => scalar("SELECT public.diario_salvar_revisao(NULL,'Relato institucional','Texto completo',$1,$2,NULL) AS value", ['PUBLICADA', img]);
  const revisao = id => scalar('SELECT revisao AS value FROM public.diario_transparencia WHERE id=$1', [id]);
  try {
    await db.exec(fs.readFileSync('tests/fixtures/reconciliacao-mvp-remoto.sql', 'utf8'));
    await db.exec(fs.readFileSync('tests/fixtures/storage-diario.sql', 'utf8'));
    await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'ana@example.invalid','{\"nome\":\"Ana Voluntária\"}'),($2,'gestao@example.invalid','{\"nome\":\"Gestão\"}')", [v, g]);
    await db.query("UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=$1", [g]);
    await db.exec("INSERT INTO public.configuracao_instituicao(nome_curto,nome_completo,cidade,uf) VALUES('Horta','Instituição da Horta','Guaporé','RS')");
    await db.exec(fs.readFileSync('supabase/migrations/reconciliacao_01_base_perfis_endereco.sql', 'utf8'));
    await db.exec(fs.readFileSync('supabase/reconciliacao/20260930141047_reconciliacao_02_fluxos_mvp.sql', 'utf8'));
    await db.exec(migration);

    await t.test('não reaplica', async () => {
      await role(null, 'owner');
      await assert.rejects(db.exec(migration), /não reaplicar/);
      await db.exec('ROLLBACK');
    });

    const caminho = g + '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg';
    let id;
    await t.test('voluntário não exclui; revisão desatualizada é recusada', async () => {
      await role(g);
      await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('diario-imagens',$1)", [caminho]);
      id = await salvar(caminho);
      await role(v);
      await assert.rejects(db.query('SELECT public.diario_excluir_revisao($1,$2)', [id, 1]), /Somente a gestão/);
      await role(g);
      await assert.rejects(db.query('SELECT public.diario_excluir_revisao($1,$2)', [id, 99]), /alterada por outra operação/);
      await assert.rejects(db.query('SELECT public.diario_excluir_revisao($1,$2)', [999999, 1]), /não encontrada/);
      assert.equal(await scalar('SELECT count(*)::int AS value FROM public.diario_transparencia WHERE id=$1', [id]), 1);
    });

    await t.test('gestão exclui, recebe o caminho e a imagem fica livre para remoção', async () => {
      await role(g);
      assert.equal(await scalar('SELECT public.diario_imagem_livre($1) AS value', [caminho]), false);
      assert.equal(await scalar('SELECT public.diario_excluir_revisao($1,$2) AS value', [id, await revisao(id)]), caminho);
      assert.equal(await scalar('SELECT count(*)::int AS value FROM public.diario_transparencia WHERE id=$1', [id]), 0);
      assert.equal(await scalar('SELECT public.diario_imagem_livre($1) AS value', [caminho]), true);
      assert.equal((await db.query('DELETE FROM storage.objects WHERE name=$1 RETURNING id', [caminho])).rows.length, 1);
      const semImagem = await salvar(null);
      assert.equal(await scalar('SELECT public.diario_excluir_revisao($1,$2) AS value', [semImagem, await revisao(semImagem)]), null);
    });

    await t.test('DELETE direto e anon continuam bloqueados', async () => {
      await role(g);
      const outra = await salvar(null);
      assert.equal((await db.query('DELETE FROM public.diario_transparencia WHERE id=$1 RETURNING id', [outra]).catch(() => ({ rows: [] }))).rows.length, 0);
      await role(null, 'anon');
      await assert.rejects(db.query('SELECT public.diario_excluir_revisao($1,$2)', [outra, 1]), /permission denied/);
    });
  } finally { await db.close(); }
});

test('Diário: excluirDiario chama a RPC e remove a imagem pela API Storage', async () => {
  const chamadas = [];
  let removerFalha = null;
  const supabase = {
    rpc: async (nome, args) => { chamadas.push(['rpc', nome, args]); return { data: args.p_id === 1 ? 'g/img.jpg' : null, error: null }; },
    storage: { from: bucket => ({ remove: async caminhos => { chamadas.push(['remove', bucket, caminhos]); return { data: [], error: removerFalha }; } }) },
  };
  const modulo = new Module('src/lib/diario.ts');
  modulo.require = nome => {
    if (nome === './supabase') return { supabase };
    if (nome === './regrasDiario') return {};
    throw new Error('Import inesperado: ' + nome);
  };
  modulo._compile(ts.transpileModule(fs.readFileSync('src/lib/diario.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, 'diario.cjs');
  const { excluirDiario } = modulo.exports;

  await excluirDiario(1, 3);
  assert.deepEqual(chamadas, [
    ['rpc', 'diario_excluir_revisao', { p_id: 1, p_revisao: 3 }],
    ['remove', 'diario-imagens', ['g/img.jpg']],
  ]);
  chamadas.length = 0;
  await excluirDiario(2, 1);
  assert.deepEqual(chamadas, [['rpc', 'diario_excluir_revisao', { p_id: 2, p_revisao: 1 }]]);
  // Publicação já excluída: arquivo que não sai fica só sem vínculo, sem erro para o usuário.
  removerFalha = new Error('falha de rede');
  await excluirDiario(1, 3);
});
