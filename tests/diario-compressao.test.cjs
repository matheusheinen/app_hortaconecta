const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

function carregar(arquivo, dependencias = {}) {
  const modulo = new Module(arquivo);
  modulo.require = nome => {
    if (nome in dependencias) return dependencias[nome];
    throw new Error('Import inesperado: ' + nome);
  };
  modulo._compile(
    ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
      fileName: arquivo,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    arquivo,
  );
  return modulo.exports;
}

const regras = carregar('src/funcionalidades/diario/regras.ts');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]).toString('base64');

function seletor({ assets, base64 = jpeg, eventos = [] }) {
  return carregar('src/funcionalidades/diario/imagemDiario.ts', {
    'expo-image-picker': {
      launchImageLibraryAsync: async opcoes => {
        eventos.push(['picker', opcoes]);
        return assets ? { canceled: false, assets } : { canceled: true };
      },
    },
    'expo-image-manipulator': {
      ImageManipulator: {
        manipulate: uri => {
          eventos.push(['manipulate', uri]);
          return {
            resize: tamanho => eventos.push(['resize', tamanho]),
            renderAsync: async () => ({
              saveAsync: async opcoes => {
                eventos.push(['save', opcoes]);
                return { uri: 'file:///comprimida.jpg', base64 };
              },
              release: () => eventos.push(['releaseImagem']),
            }),
            release: () => eventos.push(['releaseContexto']),
          };
        },
      },
      SaveFormat: { JPEG: 'jpeg' },
    },
    './regras': regras,
  }).selecionarImagemDiario;
}

test('Diário (B27): reduz o maior lado a 1600 px, mantém a proporção e não amplia', () => {
  assert.deepEqual(regras.dimensoesDiario(4000, 3000), { width: 1600, height: 1200 });
  assert.deepEqual(regras.dimensoesDiario(3000, 4000), { width: 1200, height: 1600 });
  assert.deepEqual(regras.dimensoesDiario(1600, 900), { width: 1600, height: 900 });
  assert.deepEqual(regras.dimensoesDiario(800, 600), { width: 800, height: 600 });
  assert.deepEqual(regras.dimensoesDiario(20000, 10), { width: 1600, height: 1 });
  assert.throws(() => regras.dimensoesDiario(0, 100), /ler a imagem/);
  assert.throws(() => regras.dimensoesDiario(Number.NaN, 100), /ler a imagem/);
});

test('Diário (B27): comprime em JPEG no aparelho e libera os recursos', async () => {
  const eventos = [];
  const selecionar = seletor({
    eventos,
    assets: [{ uri: 'file:///original.png', width: 4032, height: 3024 }],
  });
  assert.deepEqual(await selecionar(), { uri: 'file:///comprimida.jpg', base64: jpeg });
  assert.equal(eventos[0][1].exif, false);
  assert.equal(eventos[0][1].base64, undefined, 'a original não deve ser lida em base64');
  assert.deepEqual(eventos.slice(1), [
    ['manipulate', 'file:///original.png'],
    ['resize', { width: 1600, height: 1200 }],
    ['save', { format: 'jpeg', compress: regras.QUALIDADE_IMAGEM_DIARIO, base64: true }],
    ['releaseImagem'],
    ['releaseContexto'],
  ]);
});

test('Diário (B27): cancelamento não processa e saída inválida é recusada', async () => {
  const eventos = [];
  assert.equal(await seletor({ eventos })(), null);
  assert.equal(eventos.length, 1);
  const invalida = seletor({
    eventos,
    assets: [{ uri: 'file:///x.png', width: 10, height: 10 }],
    base64: Buffer.from('PNG').toString('base64'),
  });
  await assert.rejects(invalida(), /converter a imagem para JPEG/);
  assert.deepEqual(eventos.slice(-2), [['releaseImagem'], ['releaseContexto']]);
});
