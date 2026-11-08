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

const regras = carregar('src/funcionalidades/perfil/regras.ts', {
  '@/compartilhado/utils/validadores': carregar('src/compartilhado/utils/validadores.ts'),
  '@/compartilhado/utils/datas': carregar('src/compartilhado/utils/datas.ts'),
});
const png = bytes => Buffer.from([0x89, 0x50, 0x4e, 0x47, ...bytes]).toString('base64');

test('Identidade (B28): nomes aparados, espaços repetidos removidos e limites', () => {
  assert.deepEqual(
    regras.validarIdentidade({
      nomeCurto: '  Horta   Viva ',
      nomeCompleto: ' Centro  Ocupacional ',
    }),
    { nome_curto: 'Horta Viva', nome_completo: 'Centro Ocupacional' },
  );
  assert.throws(
    () => regras.validarIdentidade({ nomeCurto: 'H', nomeCompleto: 'Centro' }),
    /nome curto/,
  );
  assert.throws(
    () => regras.validarIdentidade({ nomeCurto: 'a'.repeat(41), nomeCompleto: 'Centro' }),
    /nome curto/,
  );
  assert.throws(
    () => regras.validarIdentidade({ nomeCurto: 'Horta', nomeCompleto: 'AB' }),
    /nome completo/,
  );
});

test('Identidade (B28): logotipo só como PNG pequeno em data URI', () => {
  assert.equal(regras.logoDataUri(png([0x0d])), `data:image/png;base64,${png([0x0d])}`);
  assert.throws(() => regras.logoDataUri(''), /muito grande/);
  assert.throws(() => regras.logoDataUri('%%%%'), /ler o logotipo/);
  assert.throws(
    () => regras.logoDataUri(Buffer.from([0xff, 0xd8, 0xff]).toString('base64')),
    /preparar o logotipo/,
  );
  const grande = Buffer.alloc(regras.LIMITE_LOGO + 1);
  grande.set([0x89, 0x50, 0x4e, 0x47]);
  assert.throws(() => regras.logoDataUri(grande.toString('base64')), /muito grande/);
});

test('Identidade (B28): seletor reduz para 256 px sem recortar e salva PNG', async () => {
  const eventos = [];
  const { selecionarLogo } = carregar('src/funcionalidades/perfil/imagemLogo.ts', {
    'expo-image-picker': {
      launchImageLibraryAsync: async () => ({
        canceled: false,
        assets: [{ uri: 'file:///logo.png', width: 1024, height: 512 }],
      }),
    },
    'expo-image-manipulator': {
      ImageManipulator: {
        manipulate: () => ({
          resize: t => eventos.push(['resize', t]),
          renderAsync: async () => ({
            saveAsync: async o => {
              eventos.push(['save', o]);
              return { base64: png([1, 2]) };
            },
            release: () => eventos.push(['releaseImagem']),
          }),
          release: () => eventos.push(['releaseContexto']),
        }),
      },
      SaveFormat: { PNG: 'png' },
    },
    './regras': regras,
  });
  assert.equal(await selecionarLogo(), `data:image/png;base64,${png([1, 2])}`);
  assert.deepEqual(eventos, [
    ['resize', { width: 256, height: 128 }],
    ['save', { format: 'png', base64: true }],
    ['releaseImagem'],
    ['releaseContexto'],
  ]);
});

test('Identidade (B28): nome e logotipo vão para configuracao_instituicao', async () => {
  const atualizacoes = [];
  const rpcs = [];
  const base = {
    usuarios: { nome: 'Gestão', telefone: null, perfil_instagram: null, descricao: null },
    ongs: null,
    configuracao_instituicao: {
      whatsapp: null,
      nome_curto: 'Horta',
      nome_completo: 'Instituição da Horta',
      url_logo: null,
      chave_pix: null,
      nome_beneficiario_pix: null,
    },
  };
  const supabase = {
    from: tabela => ({
      select: () => {
        const resposta = async () => ({ data: base[tabela], error: null });
        const b = { eq: () => b, single: resposta, maybeSingle: resposta };
        return b;
      },
      update: valores => {
        const a = { tabela, valores, filtros: [] };
        atualizacoes.push(a);
        const b = {
          eq: (c, v) => {
            a.filtros.push([c, v]);
            return b;
          },
          select: async () => ({ data: [{ id: 1 }], error: null }),
        };
        return b;
      },
    }),
    rpc: async (nome, p) => {
      rpcs.push(nome, p);
      return { data: true, error: null };
    },
  };
  const api = carregar('src/funcionalidades/perfil/apiOng.ts', {
    '@/servicos/supabase': { supabase },
    './apiGestao': carregar('src/funcionalidades/perfil/apiGestao.ts', {
      '@/servicos/supabase': { supabase },
    }),
  });
  const perfil = await api.carregarPerfilOng('g');
  assert.equal(perfil.nome_curto, 'Horta');
  assert.equal(api.secaoOngCompleta('identidade', perfil), true);
  assert.equal(api.secaoOngCompleta('identidade', { ...perfil, nome_curto: ' ' }), false);
  assert.equal(api.SECOES_PERFIL_ONG[0].chave, 'identidade');

  await api.salvarPerfilOng({
    nome_curto: 'Horta Viva',
    nome_completo: 'Centro Ocupacional',
    url_logo: 'data:image/png;base64,AAAA',
  });
  assert.deepEqual(atualizacoes, [
    {
      tabela: 'configuracao_instituicao',
      valores: {
        nome_curto: 'Horta Viva',
        nome_completo: 'Centro Ocupacional',
        url_logo: 'data:image/png;base64,AAAA',
      },
      filtros: [['id', 1]],
    },
  ]);
  assert.deepEqual(rpcs, [], 'identidade não passa pela RPC do perfil da gestão');
});
