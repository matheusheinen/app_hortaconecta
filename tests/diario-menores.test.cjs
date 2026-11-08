const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const v = '11111111-1111-4111-8111-111111111111';
const g = '22222222-2222-4222-8222-222222222222';
const migration = fs.readFileSync(
  'supabase/reconciliacao/20261108120000_diario_menores.sql',
  'utf8',
);

test('Diário (B26): imagem com menores exige autorização dos responsáveis (dados sintéticos)', async t => {
  const db = new PGlite();
  const scalar = async (sql, args = []) => (await db.query(sql, args)).rows[0]?.value;
  const linha = async id =>
    (
      await db.query(
        'SELECT imagem_caminho,imagem_com_menores,autorizacao_responsaveis,revisao FROM public.diario_transparencia WHERE id=$1',
        [id],
      )
    ).rows[0];
  async function role(id, r = 'authenticated') {
    await db.exec('RESET ROLE');
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id ?? '']);
    if (r !== 'owner') await db.exec('SET ROLE ' + r);
  }
  const salvar = (id, imagem, menores, autorizacao, revisao = null) =>
    scalar(
      "SELECT public.diario_salvar_revisao($1,'Mutirão de plantio','Relato completo','PUBLICADA',$2,$3,$4,$5) AS value",
      [id, imagem, revisao, menores, autorizacao],
    );
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
    await role(g);
    const antiga = await scalar(
      "SELECT public.diario_salvar_revisao(NULL,'Antiga','Texto','PUBLICADA',NULL,NULL) AS value",
    );
    await role(null, 'owner');
    await db.exec(migration);

    await t.test('não reaplica e publicações antigas ficam sem marcação', async () => {
      await assert.rejects(db.exec(migration), /não reaplicar/);
      await db.exec('ROLLBACK');
      assert.deepEqual(await linha(antiga), {
        imagem_caminho: null,
        imagem_com_menores: false,
        autorizacao_responsaveis: false,
        revisao: 1,
      });
    });

    const imagem = g + '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg';
    let id;
    await t.test('sem autorização a imagem com menores é recusada e nada é salvo', async () => {
      await role(g);
      await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES('diario-imagens',$1)", [
        imagem,
      ]);
      const antes = await scalar('SELECT count(*)::int AS value FROM public.diario_transparencia');
      await assert.rejects(salvar(null, imagem, true, false), /autorização dos responsáveis/);
      await db.exec('ROLLBACK').catch(() => {});
      await role(g);
      assert.equal(
        await scalar('SELECT count(*)::int AS value FROM public.diario_transparencia'),
        antes,
      );
    });

    await t.test('com autorização salva e grava as duas marcações', async () => {
      await role(g);
      id = await salvar(null, imagem, true, true);
      assert.deepEqual(await linha(id), {
        imagem_caminho: imagem,
        imagem_com_menores: true,
        autorizacao_responsaveis: true,
        revisao: 2,
      });
    });

    await t.test('sem imagem a marcação é descartada; sem mudança não soma revisão', async () => {
      await role(g);
      const atual = (await linha(id)).revisao;
      await salvar(id, null, true, false, atual);
      const depois = await linha(id);
      assert.equal(depois.imagem_com_menores, false);
      assert.equal(depois.autorizacao_responsaveis, false);
      const semImagem = await salvar(null, null, false, false);
      assert.equal((await linha(semImagem)).revisao, 1);
    });

    await t.test('restrição no banco, voluntário e RPC antiga bloqueados', async () => {
      await role(null, 'owner');
      await assert.rejects(
        db.query(
          'UPDATE public.diario_transparencia SET imagem_com_menores=true,autorizacao_responsaveis=false WHERE id=$1',
          [id],
        ),
        /diario_menores_com_autorizacao/,
      );
      await role(v);
      await assert.rejects(salvar(null, null, false, false), /Somente a gestão/);
      await role(g);
      await assert.rejects(
        db.query(
          "SELECT public.diario_salvar_revisao(NULL,'Velha','Texto','PUBLICADA',NULL,NULL::integer)",
        ),
        /permission denied/,
      );
    });
  } finally {
    await db.close();
  }
});

const Module = require('node:module');
const ts = require('typescript');
const { base: esquemasBase, esquemasDe } = require('./apoio/esquemas.cjs');

function compilar(arquivo, dependencias) {
  const modulo = new Module(arquivo);
  modulo.require = nome => {
    if (nome in dependencias) return dependencias[nome];
    throw new Error('Import inesperado: ' + nome);
  };
  modulo._compile(
    ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    arquivo,
  );
  return modulo.exports;
}

const regras = compilar('src/funcionalidades/diario/regras.ts', {});

test('Diário (B26): regra no app espelha o banco', () => {
  regras.validarMenores(false, true, false);
  regras.validarMenores(true, false, false);
  regras.validarMenores(true, true, true);
  assert.throws(() => regras.validarMenores(true, true, false), /autorização dos responsáveis/);
});

test('Diário (B26): salvarDiario envia a marcação e barra antes do upload', async () => {
  const chamadas = [];
  const supabase = {
    rpc: async (nome, args) => {
      chamadas.push([nome, args]);
      return { data: nome === 'diario_caminho' ? 'g/nova.jpg' : 7, error: null };
    },
    storage: {
      from: () => ({
        upload: async caminho => {
          chamadas.push(['upload', caminho]);
          return { error: null };
        },
      }),
    },
  };
  const { salvarDiario } = compilar('src/funcionalidades/diario/api.ts', {
    '@/servicos/supabase': { supabase },
    '@/compartilhado/esquemas': esquemasBase,
    './esquemas': esquemasDe('diario'),
    './regras': regras,
  });
  const base = {
    id: null,
    titulo: 'Mutirão',
    texto: 'Relato',
    status: 'PUBLICADA',
    imagem: null,
  };
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]).toString('base64');
  await assert.rejects(
    salvarDiario({ ...base, base64: jpeg, comMenores: true, autorizacao: false }),
    /autorização/,
  );
  assert.deepEqual(chamadas, [], 'nada é enviado sem autorização');

  await salvarDiario({ ...base, base64: jpeg, comMenores: true, autorizacao: true });
  const salvar = chamadas.find(c => c[0] === 'diario_salvar_revisao')[1];
  assert.equal(salvar.p_imagem, 'g/nova.jpg');
  assert.equal(salvar.p_imagem_com_menores, true);
  assert.equal(salvar.p_autorizacao_responsaveis, true);

  chamadas.length = 0;
  await salvarDiario({ ...base, base64: null, comMenores: true, autorizacao: false });
  const semImagem = chamadas.find(c => c[0] === 'diario_salvar_revisao')[1];
  assert.equal(semImagem.p_imagem, null);
  assert.equal(semImagem.p_imagem_com_menores, false);
  assert.equal(semImagem.p_autorizacao_responsaveis, false);
});

test('Diário (B26): resposta sem as colunas novas (antes da migration) continua válida', () => {
  const { esquemaPublicacao } = esquemasDe('diario');
  const antiga = {
    revisao: 1,
    id: 1,
    titulo: 'Antiga',
    texto: 'Texto',
    descricao_curta: null,
    status: 'PUBLICADA',
    imagem_caminho: null,
    data_publicacao: '2026-10-01T12:00:00Z',
    autor_id: g,
    atualizado_em: '2026-10-01T12:00:00Z',
  };
  const lida = esquemaPublicacao.parse(antiga);
  assert.equal(lida.imagem_com_menores, false);
  assert.equal(lida.autorizacao_responsaveis, false);
});
