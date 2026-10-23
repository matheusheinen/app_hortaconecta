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
const { declararComComprovante } = m.exports;
const arquivo = new Uint8Array([255, 216, 255]).buffer;

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
    async a => {
      chamadas.push(['enviar', a.byteLength]);
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
