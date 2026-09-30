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
  modulo._compile(ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
    fileName: arquivo,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText, arquivo);
  return modulo.exports;
}

const validadores = carregar('src/lib/validadores.ts');
const mascaras = carregar('src/lib/mascaras.ts', { './validadores': validadores });
const regras = carregar('src/lib/regrasVoluntariado.ts');
const tipos = carregar('src/lib/tipos.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));

// Executa os componentes e seus handlers reais; somente React Native e o transporte são simulados.
function montarPerfil(gestao, { falhaTabela = null, semComplemento = false } = {}) {
  const estados = [], consultas = [], rpcs = [];
  let cursor = 0, foco, recargas = 0;
  const react = {
    createElement: (tipo, props, ...filhos) => ({ tipo, props: props ?? {}, filhos }),
    Fragment: 'Fragment',
    useState: inicial => {
      const indice = cursor++;
      estados[indice] ??= { valor: inicial };
      return [estados[indice].valor, valor => {
        estados[indice].valor = typeof valor === 'function' ? valor(estados[indice].valor) : valor;
      }];
    },
    useRef: inicial => {
      const indice = cursor++;
      return estados[indice] ??= { current: inicial };
    },
    useCallback: callback => callback,
  };
  react.default = react;
  const dados = {
    usuarios: { id: 'conta-teste', nome: 'Pessoa de Teste', telefone: '51999999999', descricao: 'Descrição atual', perfil_instagram: 'horta.teste' },
    voluntarios: {
      cpf: '52998224725', data_nascimento: '1990-06-21', profissao: 'Profissão de teste',
      disponibilidade_horarios: [{ dia: 'seg', periodo: 'manha' }],
      cep: '95800000', logradouro: 'Rua de Teste', numero: '10', complemento: 'Fundos',
      bairro: 'Bairro de Teste', cidade: 'Cidade de Teste', uf: 'RS',
    },
    habilidades: [{ id: 1, nome_habilidade: 'Plantio', categoria: 'Horta' }],
    usuario_habilidades: [{ habilidade_id: 1 }],
    ongs: semComplemento ? null : { razao_social: 'Instituição de Teste', whatsapp: '51999999999' },
  };
  const supabase = {
    from: tabela => ({
      select: colunas => {
        const consulta = { tabela, colunas, filtros: [] };
        consultas.push(consulta);
        const resposta = () => Promise.resolve(tabela === falhaTabela
          ? { data: null, error: new Error('Falha na carga de ' + tabela) }
          : { data: dados[tabela], error: null });
        const builder = {
          eq: (campo, valor) => { consulta.filtros.push({ campo, valor }); return builder; },
          order: () => builder,
          single: resposta,
          maybeSingle: resposta,
          then: (resolve, reject) => resposta().then(resolve, reject),
        };
        return builder;
      },
    }),
    rpc: async (nome, parametros) => {
      rpcs.push({ nome, parametros });
      return { data: true, error: null };
    },
  };
  const rn = {
    Platform: { OS: 'android' }, StyleSheet: { create: valor => valor },
    KeyboardAvoidingView: 'KeyboardAvoidingView', Pressable: 'Pressable',
    ScrollView: 'ScrollView', Text: 'Text', View: 'View',
  };
  const perfilGestao = carregar('src/lib/perfilGestao.ts', { './supabase': { supabase } });
  const exportado = gestao ? 'TelaPerfilOng' : 'TelaPerfilVoluntario';
  const tela = carregar('src/telas/' + exportado + '.tsx', {
    react, 'react-native': rn,
    '@react-navigation/native': { useFocusEffect: callback => { foco = callback; } },
    '../lib/supabase': { supabase }, '../lib/tema': { cores: {}, espaco: {}, tipo: {} },
    '../lib/tipos': tipos, '../lib/validadores': validadores, '../lib/mascaras': mascaras,
    '../lib/regrasVoluntariado': regras, '../lib/voluntariado': { mensagemErro: erro => erro.message },
    '../lib/perfilGestao': perfilGestao,
    '../componentes/Ui': { Aviso: 'Aviso', Botao: 'Botao', Campo: 'Campo' },
    '../componentes/CampoData': { CampoData: 'CampoData' },
  })[exportado];
  const render = () => {
    cursor = 0;
    return tela({ perfil: { ...dados.usuarios, tipo_perfil: gestao ? 'ONG' : 'VOLUNTARIO' },
      sair() {}, recarregarPerfil: async () => { recargas++; } });
  };
  return { render, carregar: () => foco(), consultas, rpcs, recargas: () => recargas };
}

function encontrar(arvore, tipo, atributo, valor) {
  if (!arvore) return undefined;
  if (Array.isArray(arvore)) {
    for (const filho of arvore) {
      const encontrado = encontrar(filho, tipo, atributo, valor);
      if (encontrado) return encontrado;
    }
    return undefined;
  }
  if (typeof arvore !== 'object') return undefined;
  if (arvore.tipo === tipo && arvore.props[atributo] === valor) return arvore;
  return encontrar(arvore.filhos, tipo, atributo, valor);
}

test('Perfil voluntário: carrega endereço remoto, edita e salva os sete campos normalizados', async () => {
  const app = montarPerfil(false);
  app.render();
  app.carregar();
  await tick();
  let arvore = app.render();
  assert.equal(encontrar(arvore, 'Campo', 'rotulo', 'CEP').props.value, '95800-000');
  assert.equal(encontrar(arvore, 'Campo', 'rotulo', 'Logradouro').props.value, 'Rua de Teste');
  assert.equal(encontrar(arvore, 'Campo', 'rotulo', 'Complemento').props.value, 'Fundos');
  const consultaUsuario = app.consultas.find(consulta => consulta.tabela === 'usuarios');
  assert.doesNotMatch(consultaUsuario.colunas, /\bendereco\b/);
  const consultaVoluntario = app.consultas.find(consulta => consulta.tabela === 'voluntarios');
  for (const campo of ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf']) {
    assert.ok(consultaVoluntario.colunas.split(',').map(valor => valor.trim()).includes(campo));
  }
  const alterados = {
    CEP: '90001-234', Logradouro: '  Avenida Nova  ', Número: '  s/n  ',
    Complemento: '  Casa 2  ', Bairro: '  Centro  ', Cidade: '  Porto Alegre  ', UF: 'rs',
  };
  for (const [rotulo, valor] of Object.entries(alterados)) {
    encontrar(arvore, 'Campo', 'rotulo', rotulo).props.onChangeText(valor);
  }
  arvore = app.render();
  await encontrar(arvore, 'Botao', 'titulo', 'Salvar').props.onPress();
  const salva = app.rpcs.find(rpc => rpc.nome === 'voluntariado_salvar_perfil');
  assert.ok(salva, 'O handler Salvar precisa chamar a RPC de perfil.');
  const { p_dados, p_habilidades } = salva.parametros;
  assert.equal(Object.hasOwn(p_dados, 'endereco'), false);
  assert.deepEqual(Object.fromEntries(['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'].map(campo => [campo, p_dados[campo]])), {
    cep: '90001234', logradouro: 'Avenida Nova', numero: 's/n', complemento: 'Casa 2',
    bairro: 'Centro', cidade: 'Porto Alegre', uf: 'RS',
  });
  assert.equal(p_dados.cpf, '52998224725');
  assert.equal(p_dados.data_nascimento, '1990-06-21');
  assert.deepEqual(p_habilidades, [1]);
  assert.equal(app.recargas(), 1);
});

test('Perfil voluntário: erro de carga desabilita Salvar e o handler não chama RPC', async () => {
  const app = montarPerfil(false, { falhaTabela: 'voluntarios' });
  app.render();
  app.carregar();
  await tick();
  const arvore = app.render();
  const salvar = encontrar(arvore, 'Botao', 'titulo', 'Salvar');
  assert.equal(salvar.props.desabilitado, true);
  assert.ok(encontrar(arvore, 'Botao', 'titulo', 'Tentar carregar novamente'));
  await salvar.props.onPress();
  assert.equal(app.rpcs.length, 0);
});

test('Perfil voluntário: CEP ou UF inválidos barram a gravação no handler real', async () => {
  for (const [rotulo, valor] of [['CEP', '1234'], ['UF', 'R1']]) {
    const app = montarPerfil(false);
    app.render();
    app.carregar();
    await tick();
    encontrar(app.render(), 'Campo', 'rotulo', rotulo).props.onChangeText(valor);
    await encontrar(app.render(), 'Botao', 'titulo', 'Salvar').props.onPress();
    assert.equal(app.rpcs.filter(rpc => rpc.nome === 'voluntariado_salvar_perfil').length, 0);
    assert.match(JSON.stringify(app.render()), new RegExp(rotulo + ' inválid'));
  }
});

test('Perfil gestão: conta sem complemento salva pela RPC sem endereço pessoal ou institucional', async () => {
  const app = montarPerfil(true, { semComplemento: true });
  app.render();
  app.carregar();
  await tick();
  let arvore = app.render();
  assert.equal(encontrar(arvore, 'Campo', 'rotulo', 'Endereço'), undefined);
  encontrar(arvore, 'Campo', 'rotulo', 'Nome de exibição').props.onChangeText('  Nova Gestão  ');
  encontrar(arvore, 'Campo', 'rotulo', 'Razão social').props.onChangeText('  Instituição Nova  ');
  arvore = app.render();
  await encontrar(arvore, 'Botao', 'titulo', 'Salvar').props.onPress();
  const salva = app.rpcs.find(rpc => rpc.nome === 'gestao_salvar_perfil');
  assert.ok(salva);
  assert.equal(salva.parametros.p_dados.nome, 'Nova Gestão');
  assert.equal(salva.parametros.p_dados.razao_social, 'Instituição Nova');
  for (const campo of ['endereco', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf']) {
    assert.equal(Object.hasOwn(salva.parametros.p_dados, campo), false);
  }
  assert.equal(app.recargas(), 1);
});

test('Perfil gestão: falha na carga do complemento não permite gravar dados parciais', async () => {
  const app = montarPerfil(true, { falhaTabela: 'ongs' });
  app.render();
  app.carregar();
  await tick();
  const arvore = app.render();
  assert.equal(encontrar(arvore, 'Botao', 'titulo', 'Salvar'), undefined);
  assert.ok(encontrar(arvore, 'Botao', 'titulo', 'Tentar novamente'));
  assert.equal(app.rpcs.length, 0);
});
