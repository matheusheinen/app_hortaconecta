const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'),
  Module = require('node:module'),
  ts = require('typescript');
const m = new Module('comprovante');
m._compile(
  ts.transpileModule(fs.readFileSync('src/funcionalidades/metas/comprovante.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  'comprovante.cjs',
);
const { declararComComprovante, imagemComprovante, LIMITE_COMPROVANTE } = m.exports;
const arquivo = {
  arquivo: new Uint8Array([255, 216, 255]).buffer,
  extensao: 'jpg',
  tipo: 'image/jpeg',
};
const b64 = bytes => Buffer.from(bytes).toString('base64');
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];

test('Comprovante: reconhece JPEG, PNG e WebP pelos bytes, não pela extensão', () => {
  assert.deepEqual(
    [[255, 216, 255, 224], PNG, WEBP].map(b => {
      const r = imagemComprovante(b64(b));
      return [r.extensao, r.tipo, r.arquivo.byteLength];
    }),
    [
      ['jpg', 'image/jpeg', 4],
      ['png', 'image/png', 10],
      ['webp', 'image/webp', 12],
    ],
  );
});

test('Comprovante: recusa SVG, GIF, texto, base64 inválido e arquivo acima de 5 MiB', () => {
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
  );
  for (const ruim of [svg, Buffer.from('GIF89a'), Buffer.from('texto qualquer')])
    assert.throws(() => imagemComprovante(ruim.toString('base64')), /Formato não aceito/);
  assert.throws(() => imagemComprovante('%%%%'), /ler a imagem/);
  assert.throws(() => imagemComprovante(''), /5 MiB/);
  const grande = Buffer.alloc(LIMITE_COMPROVANTE + 1);
  grande.set([255, 216, 255]);
  assert.equal(
    imagemComprovante(grande.subarray(0, LIMITE_COMPROVANTE).toString('base64')).arquivo.byteLength,
    LIMITE_COMPROVANTE,
  );
  assert.throws(() => imagemComprovante(grande.toString('base64')), /5 MiB/);
});

test('Comprovante: sem arquivo só registra a contribuição, sem tocar no Storage', async () => {
  const chamadas = [];
  await declararComComprovante(
    null,
    async () => chamadas.push('enviar'),
    async () => chamadas.push('remover'),
    async caminho => chamadas.push(['inserir', caminho]),
  );
  assert.deepEqual(chamadas, [['inserir', null]]);
});

test('Comprovante: envia primeiro e registra a contribuição com o caminho devolvido', async () => {
  const chamadas = [];
  await declararComComprovante(
    arquivo,
    async i => {
      chamadas.push(['enviar', i.arquivo.byteLength]);
      return 'uid/arquivo.jpg';
    },
    async () => chamadas.push('remover'),
    async caminho => chamadas.push(['inserir', caminho]),
  );
  assert.deepEqual(chamadas, [
    ['enviar', 3],
    ['inserir', 'uid/arquivo.jpg'],
  ]);
});

test('Comprovante: falha no envio não registra nem remove nada', async () => {
  const chamadas = [];
  await assert.rejects(
    declararComComprovante(
      arquivo,
      async () => {
        throw new Error('sem rede');
      },
      async () => chamadas.push('remover'),
      async () => chamadas.push('inserir'),
    ),
    /sem rede/,
  );
  assert.deepEqual(chamadas, []);
});

test('Comprovante: falha no registro remove o arquivo e mantém o erro original', async () => {
  const removidos = [];
  await assert.rejects(
    declararComComprovante(
      arquivo,
      async () => 'uid/arquivo.jpg',
      async c => removidos.push(c),
      async () => {
        throw new Error('meta encerrada');
      },
    ),
    /meta encerrada/,
  );
  assert.deepEqual(removidos, ['uid/arquivo.jpg']);
});

test('Comprovante: se a remoção também falhar, o erro mostrado ainda é o do registro', async () => {
  await assert.rejects(
    declararComComprovante(
      arquivo,
      async () => 'uid/arquivo.jpg',
      async () => {
        throw new Error('remoção falhou');
      },
      async () => {
        throw new Error('meta encerrada');
      },
    ),
    /meta encerrada/,
  );
});
