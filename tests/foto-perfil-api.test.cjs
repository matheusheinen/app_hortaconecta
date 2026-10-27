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

const usuario = '11111111-1111-4111-8111-111111111111';
const outro = '22222222-2222-4222-8222-222222222222';
const antiga = `${usuario}/33333333-3333-4333-8333-333333333333.jpg`;
const nova = `${usuario}/44444444-4444-4444-8444-444444444444.jpg`;
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]).toString('base64');
const regras = carregar('src/funcionalidades/perfil/regrasFoto.ts');

function cliente(opcoes = {}) {
  const eventos = [];
  let caminhoAtual = opcoes.atual ?? antiga;
  const supabase = {
    from: tabela => ({
      select: colunas => ({
        eq: (campo, id) => ({
          single: async () => {
            eventos.push(['consulta', tabela, colunas, campo, id]);
            return { data: { foto_perfil: caminhoAtual }, error: opcoes.erroConsulta ?? null };
          },
        }),
      }),
    }),
    rpc: async (nome, parametros) => {
      eventos.push(['rpc', nome, parametros]);
      if (nome === 'perfil_foto_caminho') {
        return { data: opcoes.novoCaminho ?? nova, error: opcoes.erroCaminho ?? null };
      }
      if ((!opcoes.erroSalvar && opcoes.confirmacao !== false) || opcoes.respostaPerdida) {
        caminhoAtual = parametros.p_caminho;
      }
      return { data: opcoes.confirmacao ?? true, error: opcoes.erroSalvar ?? null };
    },
    storage: {
      from: bucket => ({
        upload: async (caminho, arquivo, configuracao) => {
          eventos.push(['upload', bucket, caminho, arquivo, configuracao]);
          return { error: opcoes.erroUpload ?? null };
        },
        remove: async caminhos => {
          eventos.push(['remove', bucket, caminhos]);
          if (opcoes.rejeitaRemocao) throw new Error('Storage indisponível');
          // Imita a policy: uma resposta perdida da RPC não libera arquivo vinculado.
          const vinculado = caminhos.includes(caminhoAtual);
          return {
            error:
              opcoes.erroRemocao || vinculado ? new Error('Arquivo não pode ser removido') : null,
          };
        },
        createSignedUrl: async (caminho, segundos) => {
          eventos.push(['url', bucket, caminho, segundos]);
          return {
            data: opcoes.semUrl ? null : { signedUrl: 'https://example.invalid/assinada' },
            error: opcoes.erroUrl ?? null,
          };
        },
      }),
    },
  };
  return {
    eventos,
    atual: () => caminhoAtual,
    api: carregar('src/funcionalidades/perfil/apiFoto.ts', {
      '@/servicos/supabase': { supabase },
      './regrasFoto': regras,
    }),
  };
}

test('Foto: upload privado precede CAS e limpeza da foto anterior', async () => {
  const { api, eventos, atual } = cliente();
  assert.deepEqual(await api.salvarFotoPerfil(usuario, antiga, jpeg), {
    caminho: nova,
    aviso: null,
  });
  assert.equal(atual(), nova);
  assert.deepEqual(
    eventos.map(e => (e[0] === 'rpc' ? e[1] : e[0])),
    ['perfil_foto_caminho', 'upload', 'perfil_foto_salvar', 'remove'],
  );
  assert.deepEqual(eventos[1].slice(1, 3), ['perfil-fotos', nova]);
  assert.ok(eventos[1][3] instanceof ArrayBuffer);
  assert.deepEqual(eventos[1][4], {
    contentType: 'image/jpeg',
    upsert: false,
    cacheControl: '300',
  });
  assert.deepEqual(eventos[2][2], {
    p_usuario_id: usuario,
    p_caminho: nova,
    p_anterior: antiga,
  });
  assert.deepEqual(eventos[3], ['remove', 'perfil-fotos', [antiga]]);
});

test('Foto: falha de upload não vincula; CAS recusado só limpa a imagem nova', async () => {
  for (const opcoes of [
    { erroUpload: new Error('Upload falhou') },
    { erroSalvar: new Error('Foto alterada em outra sessão') },
    { confirmacao: false },
  ]) {
    const { api, eventos, atual } = cliente(opcoes);
    await assert.rejects(api.salvarFotoPerfil(usuario, antiga, jpeg));
    assert.equal(atual(), antiga);
    const vinculacoes = eventos.filter(e => e[1] === 'perfil_foto_salvar');
    assert.equal(vinculacoes.length, opcoes.erroUpload ? 0 : 1);
    assert.deepEqual(
      eventos.filter(e => e[0] === 'remove'),
      [['remove', 'perfil-fotos', [nova]]],
    );
  }
});

test('Foto: resposta perdida conserva o vínculo e a proteção do arquivo no Storage', async () => {
  const { api, eventos, atual } = cliente({
    erroSalvar: new Error('Resposta perdida'),
    respostaPerdida: true,
  });
  await assert.rejects(api.salvarFotoPerfil(usuario, antiga, jpeg), /Resposta perdida/);
  assert.equal(atual(), nova);
  assert.deepEqual(
    eventos.filter(e => e[0] === 'remove'),
    [['remove', 'perfil-fotos', [nova]]],
  );
});

test('Foto: falha retornada ou lançada na limpeza não desfaz o salvamento', async () => {
  for (const opcoes of [{ erroRemocao: true }, { rejeitaRemocao: true }]) {
    const { api, atual } = cliente(opcoes);
    const resultado = await api.salvarFotoPerfil(usuario, antiga, jpeg);
    assert.equal(atual(), nova);
    assert.equal(resultado.caminho, nova);
    assert.match(resultado.aviso, /Foto atualizada.*limpeza ficou pendente/);
  }
});

test('Foto: remover desvincula antes de apagar; erro de CAS preserva o arquivo', async () => {
  const sucesso = cliente();
  assert.deepEqual(await sucesso.api.removerFotoPerfil(usuario, antiga), {
    caminho: null,
    aviso: null,
  });
  assert.equal(sucesso.atual(), null);
  assert.deepEqual(sucesso.eventos, [
    ['rpc', 'perfil_foto_salvar', { p_usuario_id: usuario, p_caminho: null, p_anterior: antiga }],
    ['remove', 'perfil-fotos', [antiga]],
  ]);
  const falha = cliente({ erroSalvar: new Error('Conflito') });
  await assert.rejects(falha.api.removerFotoPerfil(usuario, antiga), /Conflito/);
  assert.equal(falha.eventos.filter(e => e[0] === 'remove').length, 0);
  const limpeza = cliente({ erroRemocao: true });
  assert.match((await limpeza.api.removerFotoPerfil(usuario, antiga)).aviso, /Foto removida/);
});

test('Foto: legado e caminhos de terceiros não recebem URL nem exclusão', async () => {
  for (const caminho of [
    'https://example.invalid/foto-antiga.jpg',
    `${outro}/33333333-3333-4333-8333-333333333333.jpg`,
  ]) {
    const { api, eventos } = cliente();
    assert.equal(await api.urlFotoPerfil(caminho, usuario), null);
    await api.removerFotoPerfil(usuario, caminho);
    assert.equal(eventos.filter(e => ['remove', 'url'].includes(e[0])).length, 0);
    assert.equal(eventos[0][2].p_anterior, caminho);
  }
});

test('Foto: caminho de outra sessão não faz upload; erros de leitura/URL são propagados', async () => {
  const trocada = cliente({ novoCaminho: nova.replace(usuario, outro) });
  await assert.rejects(trocada.api.salvarFotoPerfil(usuario, antiga, jpeg), /sessão mudou/);
  assert.equal(
    trocada.eventos.some(e => e[0] === 'upload'),
    false,
  );
  const leitura = cliente({ erroConsulta: new Error('Consulta falhou') });
  await assert.rejects(leitura.api.carregarCaminhoFoto(usuario), /Consulta falhou/);
  const url = cliente({ erroUrl: new Error('URL falhou') });
  await assert.rejects(url.api.urlFotoPerfil(antiga, usuario), /URL falhou/);
  const ausente = cliente({ semUrl: true });
  await assert.rejects(ausente.api.urlFotoPerfil(antiga, usuario), /carregar sua foto/);
  const sucesso = cliente();
  assert.equal(await sucesso.api.carregarCaminhoFoto(usuario), antiga);
  assert.equal(
    await sucesso.api.urlFotoPerfil(antiga, usuario),
    'https://example.invalid/assinada',
  );
  assert.deepEqual(sucesso.eventos.at(-1), ['url', 'perfil-fotos', antiga, 300]);
});

test('Foto: normalização recorta ao centro, limita a 512px e libera recursos', async () => {
  for (const [largura, altura] of [
    [1600, 900],
    [200, 300],
  ]) {
    const eventos = [];
    const contexto = {
      crop: retangulo => eventos.push(['crop', retangulo]),
      resize: tamanho => eventos.push(['resize', tamanho]),
      renderAsync: async () => ({
        saveAsync: async opcoes => {
          eventos.push(['save', opcoes]);
          return { base64: jpeg };
        },
        release: () => eventos.push(['releaseImagem']),
      }),
      release: () => eventos.push(['releaseContexto']),
    };
    const { selecionarFotoPerfil } = carregar('src/funcionalidades/perfil/imagemFoto.ts', {
      'expo-image-picker': {
        launchImageLibraryAsync: async opcoes => {
          assert.deepEqual(opcoes.aspect, [1, 1]);
          assert.equal(opcoes.exif, false);
          return {
            canceled: false,
            assets: [{ uri: 'file:///foto.jpg', width: largura, height: altura }],
          };
        },
      },
      'expo-image-manipulator': {
        ImageManipulator: { manipulate: () => contexto },
        SaveFormat: { JPEG: 'jpeg' },
      },
      './regrasFoto': regras,
    });
    assert.equal(await selecionarFotoPerfil(), jpeg);
    const lado = Math.min(largura, altura);
    assert.deepEqual(eventos[0], [
      'crop',
      {
        originX: Math.floor((largura - lado) / 2),
        originY: Math.floor((altura - lado) / 2),
        width: lado,
        height: lado,
      },
    ]);
    assert.deepEqual(eventos[1], [
      'resize',
      {
        width: Math.min(512, lado),
        height: Math.min(512, lado),
      },
    ]);
    assert.deepEqual(eventos[2], ['save', { format: 'jpeg', compress: 0.82, base64: true }]);
    assert.deepEqual(eventos.slice(-2), [['releaseImagem'], ['releaseContexto']]);
  }
});

test('Foto: cancelamento não processa imagem e saída inválida libera os recursos', async () => {
  let cancelar = true;
  const liberacoes = [];
  const { selecionarFotoPerfil } = carregar('src/funcionalidades/perfil/imagemFoto.ts', {
    'expo-image-picker': {
      launchImageLibraryAsync: async () =>
        cancelar
          ? { canceled: true }
          : { canceled: false, assets: [{ uri: 'file:///foto.png', width: 100, height: 100 }] },
    },
    'expo-image-manipulator': {
      ImageManipulator: {
        manipulate: () => ({
          crop() {},
          resize() {},
          renderAsync: async () => ({
            saveAsync: async () => ({ base64: Buffer.from('PNG inválido').toString('base64') }),
            release: () => liberacoes.push('imagem'),
          }),
          release: () => liberacoes.push('contexto'),
        }),
      },
      SaveFormat: { JPEG: 'jpeg' },
    },
    './regrasFoto': regras,
  });
  assert.equal(await selecionarFotoPerfil(), null);
  assert.deepEqual(liberacoes, []);
  cancelar = false;
  await assert.rejects(selecionarFotoPerfil(), /preparar a foto/);
  assert.deepEqual(liberacoes, ['imagem', 'contexto']);
  const limite = Buffer.alloc(regras.LIMITE_FOTO_PERFIL, 0);
  limite.set([0xff, 0xd8, 0xff]);
  assert.equal(regras.arquivoFotoPerfil(limite.toString('base64')).byteLength, limite.length);
  await assert.rejects(
    async () =>
      regras.arquivoFotoPerfil(Buffer.concat([limite, Buffer.from([0])]).toString('base64')),
    /grande/,
  );
});
