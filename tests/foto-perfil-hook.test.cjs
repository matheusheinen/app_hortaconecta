const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

function carregar(arquivo, dependencias) {
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

function pendencia() {
  let resolver, rejeitar;
  const promise = new Promise((resolve, reject) => {
    resolver = resolve;
    rejeitar = reject;
  });
  return { promise, resolver, rejeitar };
}

const tick = () => new Promise(resolve => setImmediate(resolve));

/** Hooks simulados com commit de efeitos, para testar respostas assíncronas fora de ordem. */
function montar(opcoes = {}) {
  const slots = [];
  let cursor = 0;
  let efeitos = [];
  let layouts = [];
  let sessao = { usuarioId: 'a', convidado: false };
  let foco = true;
  let escritas = 0;
  const chamadas = [];
  const mudou = (anterior, atual) =>
    !anterior ||
    !atual ||
    anterior.length !== atual.length ||
    anterior.some((v, i) => v !== atual[i]);
  const efeito = fila => (executar, dependencias) => {
    const indice = cursor++;
    if (!slots[indice] || mudou(slots[indice].dependencias, dependencias)) {
      const anterior = slots[indice];
      const slot = { dependencias };
      slots[indice] = slot;
      fila().push(() => {
        anterior?.limpar?.();
        slot.limpar = executar();
      });
    }
  };
  const react = {
    useState: inicial => {
      const indice = cursor++;
      slots[indice] ??= { valor: typeof inicial === 'function' ? inicial() : inicial };
      return [
        slots[indice].valor,
        valor => {
          escritas++;
          slots[indice].valor = typeof valor === 'function' ? valor(slots[indice].valor) : valor;
        },
      ];
    },
    useRef: inicial => {
      const indice = cursor++;
      return (slots[indice] ??= { current: inicial });
    },
    useMemo: (executar, dependencias) => {
      const indice = cursor++;
      if (!slots[indice] || mudou(slots[indice].dependencias, dependencias)) {
        slots[indice] = { valor: executar(), dependencias };
      }
      return slots[indice].valor;
    },
    useCallback: (executar, dependencias) => react.useMemo(() => executar, dependencias),
    useEffect: efeito(() => efeitos),
    useLayoutEffect: efeito(() => layouts),
  };
  const api = {
    carregarCaminhoFoto: async id => {
      chamadas.push(['carregar', id]);
      return opcoes.carregar ? opcoes.carregar(id) : `${id}/antiga.jpg`;
    },
    urlFotoPerfil: async (caminho, id) => {
      chamadas.push(['url', caminho, id]);
      return opcoes.url ? opcoes.url(caminho, id) : caminho ? `assinada:${id}:${caminho}` : null;
    },
    salvarFotoPerfil: async (id, anterior, imagem) => {
      chamadas.push(['salvar', id, anterior, imagem]);
      return opcoes.salvar
        ? opcoes.salvar(id, anterior, imagem)
        : { caminho: `${id}/nova.jpg`, aviso: null };
    },
    removerFotoPerfil: async (id, anterior) => {
      chamadas.push(['remover', id, anterior]);
      return opcoes.remover ? opcoes.remover(id, anterior) : { caminho: null, aviso: null };
    },
  };
  const { useFotoPerfil } = carregar('src/funcionalidades/perfil/useFotoPerfil.ts', {
    react,
    '@react-navigation/native': {
      useFocusEffect: executar =>
        react.useEffect(() => (foco ? executar() : undefined), [executar, foco]),
    },
    '@/funcionalidades/autenticacao/ContextoSessao': { useSessaoAtual: () => sessao },
    '@/compartilhado/utils/erros': { mensagemErro: falha => falha.message },
    './apiFoto': api,
    './imagemFoto': {
      selecionarFotoPerfil: async () => {
        chamadas.push(['selecionar']);
        return opcoes.selecionar ? opcoes.selecionar() : 'jpeg';
      },
    },
  });
  function render(novaSessao = sessao) {
    sessao = novaSessao;
    cursor = 0;
    const valor = useFotoPerfil();
    const filaLayout = layouts;
    layouts = [];
    filaLayout.forEach(executar => executar());
    const filaEfeitos = efeitos;
    efeitos = [];
    filaEfeitos.forEach(executar => executar());
    return valor;
  }
  return {
    chamadas,
    render,
    escritas: () => escritas,
    desfocar: () => {
      foco = false;
      render();
    },
    focar: () => {
      foco = true;
      render();
    },
    desmontar: () => slots.forEach(slot => slot.limpar?.()),
  };
}

async function iniciar(opcoes) {
  const app = montar(opcoes);
  app.render();
  await tick();
  return app;
}

test('Foto hook: cancelar preserva foto e duplo toque abre uma única seleção', async () => {
  const escolha = pendencia();
  const app = await iniciar({ selecionar: () => escolha.promise });
  let foto = app.render();
  const original = foto.fotoUrl;
  const primeira = foto.selecionar();
  const segunda = foto.selecionar();
  assert.equal(app.render().ocupado, true);
  assert.equal(app.chamadas.filter(c => c[0] === 'selecionar').length, 1);
  escolha.resolver(null);
  await Promise.all([primeira, segunda]);
  foto = app.render();
  assert.equal(foto.fotoUrl, original);
  assert.equal(foto.temFoto, true);
  assert.equal(foto.ocupado, false);
  assert.equal(
    app.chamadas.some(c => c[0] === 'salvar'),
    false,
  );
});

test('Foto hook: salvar/remover exibem estado confirmado e avisos de limpeza', async () => {
  const app = await iniciar({
    salvar: async () => ({ caminho: 'a/nova.jpg', aviso: 'Limpeza pendente.' }),
  });
  await app.render().selecionar();
  let foto = app.render();
  assert.equal(foto.fotoUrl, 'assinada:a:a/nova.jpg');
  assert.equal(foto.aviso, 'Limpeza pendente.');
  assert.equal(foto.erro, null);
  await foto.remover();
  foto = app.render();
  assert.equal(foto.temFoto, false);
  assert.equal(foto.fotoUrl, null);
  assert.match(foto.aviso, /removida/);
  assert.deepEqual(
    app.chamadas.find(c => c[0] === 'remover'),
    ['remover', 'a', 'a/nova.jpg'],
  );
});

test('Foto hook: resposta perdida recarrega o vínculo efetivo e encerra o estado ocupado', async () => {
  let caminho = 'a/antiga.jpg';
  const app = await iniciar({
    carregar: async () => caminho,
    salvar: async () => {
      caminho = 'a/nova.jpg';
      throw new Error('Resposta perdida');
    },
  });
  await app.render().selecionar();
  const foto = app.render();
  assert.equal(foto.fotoUrl, 'assinada:a:a/nova.jpg');
  assert.match(foto.erro, /Resposta perdida/);
  assert.equal(foto.ocupado, false);
});

test('Foto hook: troca de conta durante seleção impede upload da sessão antiga', async () => {
  const escolha = pendencia();
  const app = await iniciar({ selecionar: () => escolha.promise });
  const operacao = app.render().selecionar();
  app.render({ usuarioId: 'b', convidado: false });
  await tick();
  escolha.resolver('jpeg');
  await operacao;
  const foto = app.render();
  assert.equal(foto.fotoUrl, 'assinada:b:b/antiga.jpg');
  assert.equal(
    app.chamadas.some(c => c[0] === 'salvar'),
    false,
  );
  assert.equal(foto.aviso, null);
  assert.equal(foto.erro, null);
});

test('Foto hook: carga atrasada de outra conta não substitui a foto atual', async () => {
  const primeira = pendencia();
  const app = montar({ carregar: id => (id === 'a' ? primeira.promise : 'b/atual.jpg') });
  app.render();
  app.render({ usuarioId: 'b', convidado: false });
  await tick();
  primeira.resolver('a/antiga.jpg');
  await tick();
  assert.equal(app.render().fotoUrl, 'assinada:b:b/atual.jpg');
  assert.equal(
    app.chamadas.some(c => c[0] === 'url' && c[2] === 'a'),
    false,
  );
});

test('Foto hook: resultado de salvamento não reaparece após A→B→A', async () => {
  const salvamento = pendencia();
  const app = await iniciar({ salvar: () => salvamento.promise });
  const operacao = app.render().selecionar();
  await tick();
  app.render({ usuarioId: 'b', convidado: false });
  await tick();
  app.render({ usuarioId: 'a', convidado: false });
  await tick();
  salvamento.resolver({ caminho: 'a/resultado-antigo.jpg', aviso: 'Resposta antiga' });
  await operacao;
  const foto = app.render();
  assert.equal(foto.fotoUrl, 'assinada:a:a/antiga.jpg');
  assert.equal(foto.aviso, null);
});

test('Foto hook: desmontagem descarta resultado e erro de imagem antigo é ignorado', async () => {
  const salvamento = pendencia();
  const app = await iniciar({ salvar: () => salvamento.promise });
  let foto = app.render();
  foto.imagemFalhou('assinada:obsoleta');
  assert.equal(app.render().erro, null);
  foto.imagemFalhou(foto.fotoUrl);
  assert.match(app.render().erro, /mostrar sua foto/);
  await app.render().recarregar();
  assert.equal(app.render().erro, null);
  const operacao = app.render().selecionar();
  await tick();
  app.desmontar();
  const escritas = app.escritas();
  salvamento.resolver({ caminho: 'a/nova.jpg', aviso: null });
  await operacao;
  assert.equal(app.escritas(), escritas);
});

test('Foto hook: falha na prévia conserva vínculo salvo e permite nova tentativa', async () => {
  let falhar = false;
  let caminho = 'a/antiga.jpg';
  const app = await iniciar({
    carregar: async () => caminho,
    salvar: async () => {
      caminho = 'a/nova.jpg';
      falhar = true;
      return { caminho, aviso: null };
    },
    url: async valor => {
      if (falhar) throw new Error('URL indisponível');
      return `assinada:${valor}`;
    },
  });
  await app.render().selecionar();
  let foto = app.render();
  assert.equal(foto.temFoto, true);
  assert.equal(foto.fotoUrl, null);
  assert.match(foto.erro, /URL indisponível/);
  falhar = false;
  await foto.recarregar();
  foto = app.render();
  assert.equal(foto.fotoUrl, 'assinada:a/nova.jpg');
  assert.equal(foto.erro, null);
});
