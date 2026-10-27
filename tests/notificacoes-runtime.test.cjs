const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

function carregar(nome, resolver) {
  const arquivo = `src/funcionalidades/notificacoes/${nome}`;
  const modulo = new Module(arquivo);
  modulo.require = resolver;
  modulo._compile(
    ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
      fileName: arquivo,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
      },
    }).outputText,
    arquivo,
  );
  return modulo.exports;
}

const aviso = {
  id: 9,
  tipo: 'CANDIDATURA_APROVADA',
  titulo: 'Inscrição aprovada',
  corpo: 'Sua inscrição foi aprovada.',
  atividade_id: 7,
  meta_id: null,
};
const tick = () => new Promise(resolve => setImmediate(resolve));

function ambiente(os, expoGo, permissaoInicial = { granted: true, canAskAgain: true }) {
  const chamadas = [];
  const efeitos = [];
  const estados = [];
  let importsNativos = 0;
  let handler, resposta, receber, alterarEstado;
  let permissao = permissaoInicial;
  const nativo = {
    AndroidImportance: { DEFAULT: 3 },
    setNotificationHandler: valor => {
      chamadas.push(['handler']);
      handler = valor;
    },
    setNotificationChannelAsync: async (...args) => chamadas.push(['canal', ...args]),
    getPermissionsAsync: async () => {
      chamadas.push(['permissao']);
      return permissao;
    },
    requestPermissionsAsync: async () => {
      chamadas.push(['pedir']);
      permissao = { granted: true, canAskAgain: true };
      return permissao;
    },
    scheduleNotificationAsync: async valor => chamadas.push(['agendar', valor]),
    getExpoPushTokenAsync: async opcoes => {
      chamadas.push(['token', opcoes]);
      return { data: 'ExpoPushToken[teste]' };
    },
    addNotificationResponseReceivedListener: executar => {
      chamadas.push(['ouvirToque']);
      resposta = executar;
      return { remove: () => chamadas.push(['removerToque']) };
    },
  };
  const react = {
    createElement: (...args) => args,
    createContext: valor => ({ valor, Provider: 'Provider' }),
    useContext: contexto => contexto.valor,
    useCallback: executar => executar,
    useMemo: executar => executar(),
    useEffect: executar => efeitos.push(executar),
    useState: inicial => {
      const indice = estados.length;
      estados.push(inicial);
      return [
        inicial,
        valor => {
          estados[indice] = typeof valor === 'function' ? valor(estados[indice]) : valor;
        },
      ];
    },
  };
  const deps = {
    expo: { isRunningInExpoGo: () => expoGo },
    'react-native': {
      Platform: { OS: os },
      AppState: {
        addEventListener: (_, executar) => {
          alterarEstado = executar;
          return { remove: () => chamadas.push(['removerAppState']) };
        },
      },
    },
    'expo-constants': {
      __esModule: true,
      default: { expoConfig: { extra: { eas: { projectId: 'projeto' } } } },
    },
    'expo-device': { isDevice: true },
    react: { ...react, default: react },
    '@/funcionalidades/autenticacao/ContextoSessao': {
      useSessaoAtual: () => ({ ehGestao: false }),
    },
    './api': {
      registrarTokenPush: async (...args) => chamadas.push(['registrar', ...args]),
      removerTokenPush: async (...args) => chamadas.push(['desregistrar', ...args]),
      contarNaoLidas: async () => 2,
      assinarNotificacoes: (usuarioId, executar) => {
        chamadas.push(['ouvirApp', usuarioId]);
        receber = executar;
        return () => chamadas.push(['removerApp']);
      },
      marcarNotificacaoLida: async id => chamadas.push(['lida', id]),
    },
    './destino': {
      destinoNotificacao: dados => ({ tela: 'atividade', atividadeId: dados.atividade_id }),
    },
    './navegacao': { abrirDestino: destino => chamadas.push(['abrir', destino]) },
  };
  function resolver(nome) {
    if (nome === 'expo-notifications') {
      importsNativos++;
      if (os === 'web' || (os === 'android' && expoGo)) {
        throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
      }
      return nativo;
    }
    if (nome in deps) return deps[nome];
    throw new Error('Import inesperado: ' + nome);
  }
  deps['./toque'] = carregar('toque.ts', resolver);
  deps['./sistema'] = carregar('sistema.ts', resolver);
  deps['./push'] = carregar('push.ts', resolver);
  const contexto = carregar('ContextoNotificacoes.tsx', resolver);
  return {
    ...deps['./sistema'],
    push: deps['./push'],
    chamadas,
    estados,
    nativo,
    importsNativos: () => importsNativos,
    handler: () => handler,
    registrarNaSessao: () => {
      const { useRegistroPush } = carregar('useRegistroPush.ts', resolver);
      useRegistroPush('usuario', true);
      efeitos.forEach(executar => executar());
    },
    montar: () => {
      contexto.ProvedorNotificacoes({ usuarioId: 'usuario', children: null });
      const limpezas = efeitos.map(executar => executar());
      return () => limpezas.forEach(limpar => limpar?.());
    },
    receber: notificacao => receber(notificacao),
    responder: dados => resposta({ notification: { request: { content: { data: dados } } } }),
    ativar: () => alterarEstado('active'),
  };
}

for (const os of ['web', 'android']) {
  test(`${os}: abertura e operações no Expo Go não importam o módulo nativo ausente`, async () => {
    const a = ambiente(os, true);
    assert.equal(a.importsNativos(), 0, 'carregar push e contexto deve ser seguro');
    assert.equal(a.obterNotificacoesDoSistema(), null);
    assert.equal(await a.push.pedirPermissaoNotificacoes(), false);
    await a.push.mostrarAvisoLocal(aviso);
    assert.equal(await a.push.registrarDispositivoPush(), null);
    assert.equal(a.importsNativos(), 0);
    assert.deepEqual(a.chamadas, []);
  });
}

test('Android Expo Go: sino recebe eventos e atualiza não lidas sem avisos do sistema', async () => {
  const a = ambiente('android', true);
  const desmontar = a.montar();
  await tick();
  assert.deepEqual(a.estados, [2, 0]);
  a.receber(aviso);
  await tick();
  assert.deepEqual(a.estados, [3, 1]);
  a.ativar();
  await tick();
  assert.deepEqual(a.estados, [2, 2]);
  assert.equal(a.importsNativos(), 0);
  assert.deepEqual(a.chamadas, [['ouvirApp', 'usuario']]);
  desmontar();
  assert.deepEqual(a.chamadas.slice(-2), [['removerApp'], ['removerAppState']]);
});

test('build Android: carga sob demanda e handler configurado uma única vez', async () => {
  const a = ambiente('android', false);
  assert.equal(a.importsNativos(), 0);
  assert.equal(a.obterNotificacoesDoSistema(), a.nativo);
  assert.equal(a.obterNotificacoesDoSistema(), a.nativo);
  assert.equal(a.importsNativos(), 1);
  assert.deepEqual(a.chamadas, [['handler']]);
  assert.deepEqual(await a.handler().handleNotification(), {
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  });
});

test('build Android: canal precede permissão; aviso, registro e saída continuam funcionando', async () => {
  const a = ambiente('android', false, { granted: false, canAskAgain: true });
  assert.equal(await a.push.pedirPermissaoNotificacoes(), true);
  assert.deepEqual(
    a.chamadas.map(c => c[0]),
    ['handler', 'canal', 'permissao', 'pedir'],
  );
  await a.push.mostrarAvisoLocal(aviso);
  assert.deepEqual(a.chamadas.find(c => c[0] === 'agendar')[1], {
    content: {
      title: aviso.titulo,
      body: aviso.corpo,
      data: { notificacaoId: 9, tipo: aviso.tipo, atividade_id: 7, meta_id: null },
    },
    trigger: null,
  });
  assert.equal(await a.push.registrarDispositivoPush(), 'ExpoPushToken[teste]');
  assert.deepEqual(
    a.chamadas.find(c => c[0] === 'token'),
    ['token', { projectId: 'projeto' }],
  );
  assert.deepEqual(
    a.chamadas.find(c => c[0] === 'registrar'),
    ['registrar', 'ExpoPushToken[teste]', 'android'],
  );
  await a.push.desregistrarDispositivoPush();
  await a.push.desregistrarDispositivoPush();
  assert.deepEqual(
    a.chamadas.filter(c => c[0] === 'desregistrar'),
    [['desregistrar', 'ExpoPushToken[teste]']],
  );
  assert.equal(a.importsNativos(), 1);
});

test('iOS Expo Go: remoto bloqueado antes de permissão, avisos locais preservados', async () => {
  const a = ambiente('ios', true);
  assert.equal(await a.push.registrarDispositivoPush(), null);
  assert.equal(a.importsNativos(), 0);
  assert.deepEqual(a.chamadas, []);
  assert.equal(await a.push.pedirPermissaoNotificacoes(), true);
  await a.push.mostrarAvisoLocal(aviso);
  assert.equal(a.importsNativos(), 1);
  assert.deepEqual(
    a.chamadas.map(c => c[0]),
    ['handler', 'permissao', 'permissao', 'agendar'],
  );
});

test('Expo Go: flag de push remoto preserva permissão local no iOS sem registrar a sessão', async () => {
  const anterior = process.env.EXPO_PUBLIC_PUSH_REMOTO;
  process.env.EXPO_PUBLIC_PUSH_REMOTO = 'true';
  try {
    for (const os of ['android', 'ios']) {
      const a = ambiente(os, true);
      a.registrarNaSessao();
      await tick();
      assert.equal(a.importsNativos(), os === 'ios' ? 1 : 0);
      assert.deepEqual(a.chamadas, os === 'ios' ? [['handler'], ['permissao']] : []);
    }
  } finally {
    if (anterior === undefined) delete process.env.EXPO_PUBLIC_PUSH_REMOTO;
    else process.env.EXPO_PUBLIC_PUSH_REMOTO = anterior;
  }
});

test('permissão negada: não agenda aviso nem registra token', async () => {
  const a = ambiente('android', false, { granted: false, canAskAgain: false });
  assert.equal(await a.push.pedirPermissaoNotificacoes(), false);
  await a.push.mostrarAvisoLocal(aviso);
  assert.equal(await a.push.registrarDispositivoPush(), null);
  assert.ok(!a.chamadas.some(c => ['agendar', 'pedir', 'token', 'registrar'].includes(c[0])));
});

test('build Android: toque navega, marca como lida e remove listener ao desmontar', async () => {
  const a = ambiente('android', false);
  const desmontar = a.montar();
  a.responder({ notificacaoId: 9, tipo: aviso.tipo, atividade_id: 7, meta_id: null });
  await tick();
  assert.ok(a.chamadas.some(c => c[0] === 'ouvirToque'));
  assert.deepEqual(
    a.chamadas.find(c => c[0] === 'abrir'),
    ['abrir', { tela: 'atividade', atividadeId: 7 }],
  );
  assert.deepEqual(
    a.chamadas.find(c => c[0] === 'lida'),
    ['lida', 9],
  );
  assert.deepEqual(a.estados, [2, 0]);
  desmontar();
  assert.ok(a.chamadas.some(c => c[0] === 'removerToque'));
});
