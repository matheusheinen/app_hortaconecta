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
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
    }).outputText,
    arquivo,
  );
  return modulo.exports;
}

function montarFoto(valores = {}) {
  const estados = [];
  let cursor = 0;
  const chamadas = { selecionar: 0, remover: 0, recarregar: 0, imagemFalhou: 0 };
  const confirmacoes = [];
  const hook = {
    fotoUrl: null,
    temFoto: false,
    carregando: false,
    ocupado: false,
    erro: null,
    aviso: null,
    ...Object.fromEntries(
      Object.keys(chamadas).map(nome => [
        nome,
        async () => {
          chamadas[nome]++;
        },
      ]),
    ),
    ...valores,
  };
  const react = {
    createElement: (tipo, props, ...filhos) =>
      typeof tipo === 'function'
        ? tipo({ ...props, children: filhos })
        : { tipo, props: props ?? {}, filhos },
    useState: inicial => {
      const indice = cursor++;
      if (!(indice in estados)) estados[indice] = inicial;
      return [estados[indice], valor => (estados[indice] = valor)];
    },
    useCallback: (acao, dependencias) => {
      const indice = cursor++;
      const anterior = estados[indice];
      if (!anterior || dependencias.some((valor, i) => !Object.is(valor, anterior.dependencias[i])))
        estados[indice] = { acao, dependencias };
      return estados[indice].acao;
    },
  };
  react.default = react;
  const rn = {
    StyleSheet: { create: valor => valor },
    ActivityIndicator: 'ActivityIndicator',
    Image: 'Image',
    Pressable: 'Pressable',
    Text: 'Text',
    TextInput: 'TextInput',
    View: 'View',
  };
  const tema = carregar('src/compartilhado/tema.ts');
  const ui = carregar('src/compartilhado/componentes/Ui.tsx', {
    react,
    'react-native': rn,
    '../tema': tema,
  });
  const { FotoPerfil } = carregar('src/funcionalidades/perfil/componentes/FotoPerfil.tsx', {
    react,
    'react-native': rn,
    '@/compartilhado/componentes/Ui': ui,
    '@/compartilhado/tema': tema,
    '@/compartilhado/utils/confirmar': {
      confirmarExclusao: (...argumentos) => confirmacoes.push(argumentos),
    },
    '../useFotoPerfil': { useFotoPerfil: () => hook },
  });
  const render = () => {
    cursor = 0;
    return FotoPerfil({ nome: 'Ana Maria Silva', papel: 'voluntário' });
  };
  return { render, hook, chamadas, confirmacoes };
}

function nos(arvore) {
  if (!arvore || typeof arvore !== 'object') return [];
  return [arvore, ...(arvore.filhos ?? []).flat(Infinity).flatMap(nos)];
}

function botao(arvore, rotulo) {
  return nos(arvore).find(no => no.props.accessibilityLabel === rotulo);
}

test('Foto do perfil: sem foto mostra iniciais e explica salvamento opcional', () => {
  const foto = montarFoto();
  const arvore = foto.render();
  const texto = JSON.stringify(arvore);
  assert.match(texto, /AS/);
  assert.match(texto, /foto de perfil é opcional/);
  assert.match(texto, /salva na hora/);
  assert.equal(botao(arvore, 'Adicionar foto').props.disabled, false);
  assert.equal(botao(arvore, 'Remover foto'), undefined);
  botao(arvore, 'Adicionar foto').props.onPress();
  assert.equal(foto.chamadas.selecionar, 1);
});

test('Foto do perfil: salvar bloqueia ações e informa estado ocupado acessível', () => {
  const foto = montarFoto({ temFoto: true, ocupado: true });
  const arvore = foto.render();
  const alterar = botao(arvore, 'Alterar foto');
  assert.equal(alterar.props.disabled, true);
  assert.deepEqual(alterar.props.accessibilityState, { disabled: true, busy: true });
  assert.equal(botao(arvore, 'Remover foto').props.disabled, true);
  assert.ok(botao(arvore, 'Atualizando foto de perfil'));
});

test('Foto do perfil: imagem indisponível mantém remoção e exige confirmação', () => {
  const foto = montarFoto({ temFoto: true, erro: 'Falha ao carregar foto.' });
  const arvore = foto.render();
  assert.ok(nos(arvore).some(no => no.props.accessibilityRole === 'alert'));
  botao(arvore, 'Remover foto').props.onPress();
  assert.equal(foto.chamadas.remover, 0);
  assert.equal(foto.confirmacoes.length, 1);
  foto.confirmacoes[0][2]();
  assert.equal(foto.chamadas.remover, 1);
  botao(arvore, 'Tentar carregar foto').props.onPress();
  assert.equal(foto.chamadas.recarregar, 1);
});

test('Foto do perfil: erro de imagem oferece iniciais e permite renovar a prévia', () => {
  const foto = montarFoto({ temFoto: true, fotoUrl: 'https://example.invalid/foto-assinada' });
  const imagem = nos(foto.render()).find(no => no.tipo === 'Image');
  assert.equal(imagem.props.accessibilityLabel, 'Foto de perfil de Ana Maria Silva');
  imagem.props.onError();
  assert.equal(foto.chamadas.imagemFalhou, 1);
  const falha = foto.render();
  assert.equal(
    nos(falha).some(no => no.tipo === 'Image'),
    false,
  );
  botao(falha, 'Tentar carregar foto').props.onPress();
  assert.equal(foto.chamadas.recarregar, 1);
  assert.ok(nos(foto.render()).some(no => no.tipo === 'Image'));
});

test('Foto do perfil: renders não reiniciam a imagem por recriar callbacks', () => {
  const foto = montarFoto({ temFoto: true, fotoUrl: 'https://example.invalid/foto-assinada' });
  const antes = nos(foto.render()).find(no => no.tipo === 'Image');
  antes.props.onLoad();
  const depois = nos(foto.render()).find(no => no.tipo === 'Image');
  assert.equal(depois.props.onLoad, antes.props.onLoad);
  assert.equal(depois.props.onError, antes.props.onError);
  assert.equal(
    nos(foto.render()).some(no => no.props.accessibilityLabel === 'Carregando foto de perfil'),
    false,
  );
  foto.hook.fotoUrl = 'https://example.invalid/foto-renovada';
  const renovada = nos(foto.render()).find(no => no.tipo === 'Image');
  assert.notEqual(renovada.props.onLoad, antes.props.onLoad);
  assert.notEqual(renovada.props.onError, antes.props.onError);
});
