const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  Module = require('node:module'),
  ts = require('typescript');
const m = new Module('diario');
m._compile(
  ts.transpileModule(fs.readFileSync('src/funcionalidades/diario/regras.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  'diario.cjs',
);
const { imagemJpeg, validarPublicacao, salvarDiarioComImagem, LIMITE_IMAGEM_DIARIO } = m.exports;
const jpeg = Buffer.from([255, 216, 255, 224, 0, 1]).toString('base64');
test('Diário: limite exato de 5 MiB e um byte acima (validação de bytes, não decodificação de foto)', () => {
  const bytes = Buffer.alloc(LIMITE_IMAGEM_DIARIO + 1);
  bytes.set([255, 216, 255]);
  assert.equal(
    imagemJpeg(bytes.subarray(0, LIMITE_IMAGEM_DIARIO).toString('base64')).byteLength,
    LIMITE_IMAGEM_DIARIO,
  );
  assert.throws(() => imagemJpeg(bytes.toString('base64')), /5 MiB/);
});
test('Diário: valida texto, imagem JPEG e limite sem carregar React Native', () => {
  validarPublicacao('Atividade', 'Relato');
  assert.throws(() => validarPublicacao('AB', 'Relato'));
  assert.throws(() => validarPublicacao('Título', ''));
  assert.throws(() => validarPublicacao('Título', 'a'.repeat(20001)));
  assert.equal(imagemJpeg(jpeg).byteLength, 6);
  assert.throws(() => imagemJpeg('%%%%'));
  assert.throws(() => imagemJpeg(Buffer.from('arquivo inválido').toString('base64')));
  assert.throws(() => imagemJpeg('A'.repeat(Math.ceil(LIMITE_IMAGEM_DIARIO / 3) * 4 + 4)));
});
test('Diário: falha no upload não publica; imagem vinculada somente após upload', async () => {
  let publicou = false;
  await assert.rejects(
    salvarDiarioComImagem(
      jpeg,
      null,
      async () => {
        throw new Error('Falha de upload');
      },
      async () => {
        publicou = true;
        return 1;
      },
    ),
    /upload/,
  );
  assert.equal(publicou, false);
  const ordem = [];
  assert.equal(
    await salvarDiarioComImagem(
      jpeg,
      null,
      async arquivo => {
        ordem.push('upload');
        assert.equal(arquivo.byteLength, 6);
        return 'gestao/foto.jpg';
      },
      async caminho => {
        ordem.push('banco');
        assert.equal(caminho, 'gestao/foto.jpg');
        return 10;
      },
    ),
    10,
  );
  assert.deepEqual(ordem, ['upload', 'banco']);
});
test('Diário: sem imagem dispensa upload; falha de banco não aparenta sucesso', async () => {
  const nunca = async () => {
    throw new Error('Upload indevido');
  };
  assert.equal(
    await salvarDiarioComImagem(null, null, nunca, async path => {
      assert.equal(path, null);
      return 1;
    }),
    1,
  );
  await assert.rejects(
    salvarDiarioComImagem(null, 'foto.jpg', nunca, async () => {
      throw new Error('Banco indisponível');
    }),
    /Banco indisponível/,
  );
});

test('Diário: adaptador envia JPEG sem sobrescrever, solicita URL por 60s e propaga erro (Storage simulado)', async () => {
  const chamadas = [];
  let falhaUpload = false;
  const cliente = {
    rpc: async (nome, args) => {
      chamadas.push({ nome, args });
      return { data: nome === 'diario_caminho' ? 'gestao/arquivo.jpg' : 7, error: null };
    },
    storage: {
      from: bucket => ({
        upload: async (caminho, arquivo, opcoes) => {
          chamadas.push({ bucket, caminho, arquivo, opcoes });
          return { error: falhaUpload ? { message: 'Envio recusado' } : null };
        },
        createSignedUrl: async (caminho, segundos) => {
          chamadas.push({ bucket, caminho, segundos });
          return { data: { signedUrl: 'https://exemplo.invalid/assinada' }, error: null };
        },
      }),
    },
  };
  const api = new Module('diario-api');
  api.require = id => {
    if (id === '@/servicos/supabase') return { supabase: cliente };
    if (id === './regras') return m.exports;
    throw new Error('Importação inesperada: ' + id);
  };
  api._compile(
    ts.transpileModule(fs.readFileSync('src/funcionalidades/diario/api.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    'diario-api.cjs',
  );
  const dados = {
    id: 1,
    revisao: 3,
    titulo: 'Publicação',
    texto: 'Relato',
    status: 'PUBLICADA',
    imagem: 'antiga.jpg',
    base64: jpeg,
  };
  assert.equal(await api.exports.salvarDiario(dados), 7);
  const envio = chamadas.find(c => c.arquivo);
  assert.equal(envio.bucket, 'diario-imagens');
  assert.ok(envio.arquivo instanceof ArrayBuffer);
  assert.deepEqual(envio.opcoes, { contentType: 'image/jpeg', upsert: false, cacheControl: '60' });
  assert.equal(
    chamadas.find(c => c.nome === 'diario_salvar_revisao').args.p_imagem,
    'gestao/arquivo.jpg',
  );
  assert.equal(chamadas.find(c => c.nome === 'diario_salvar_revisao').args.p_revisao, 3);
  await api.exports.urlImagemDiario('gestao/arquivo.jpg');
  assert.equal(chamadas.at(-1).segundos, 60);
  falhaUpload = true;
  chamadas.length = 0;
  await assert.rejects(api.exports.salvarDiario(dados), /Falha no envio da imagem/);
  assert.equal(
    chamadas.some(c => c.nome === 'diario_salvar_revisao'),
    false,
  );
});
