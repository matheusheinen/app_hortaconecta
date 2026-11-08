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
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    arquivo,
  );
  return modulo.exports;
}

const validadores = carregar('src/compartilhado/utils/validadores.ts');
const mascaras = carregar('src/compartilhado/utils/mascaras.ts', { './validadores': validadores });
const regrasVoluntariado = carregar('src/funcionalidades/voluntariado/regras.ts');
const datas = carregar('src/compartilhado/utils/datas.ts');
const regrasPerfil = carregar('src/funcionalidades/perfil/regras.ts', {
  '@/compartilhado/utils/validadores': validadores,
  '@/compartilhado/utils/datas': datas,
});
const tipos = carregar('src/compartilhado/tipos.ts');

const dados = () => ({
  usuarios: {
    nome: 'Pessoa de Teste',
    telefone: '51999999999',
    descricao: 'Descrição atual',
    perfil_instagram: 'horta.teste',
  },
  voluntarios: {
    cpf: '52998224725',
    data_nascimento: '1990-06-21',
    profissao: 'Profissão de teste',
    disponibilidade_horarios: [{ dia: 'seg', periodo: 'manha' }],
    cep: '95800000',
    logradouro: 'Rua de Teste',
    numero: '10',
    complemento: 'Fundos',
    bairro: 'Bairro de Teste',
    cidade: 'Cidade de Teste',
    uf: 'RS',
  },
  habilidades: [{ id: 1, nome_habilidade: 'Plantio', categoria: 'Horta' }],
  usuario_habilidades: [{ habilidade_id: 1 }],
  ongs: {
    cnpj: null,
    razao_social: 'Instituição de Teste',
    data_criacao: null,
    responsavel_legal: null,
  },
  configuracao_instituicao: {
    whatsapp: '51999999999',
    chave_pix: 'chave-ficticia',
    nome_beneficiario_pix: 'Horta Teste',
  },
});

/** Supabase simulado: registra consultas e RPCs; `falhaTabela` faz a carga falhar. */
function supabaseFalso({ falhaTabela = null, base = dados() } = {}) {
  const consultas = [],
    rpcs = [],
    atualizacoes = [];
  return {
    consultas,
    rpcs,
    atualizacoes,
    supabase: {
      from: tabela => ({
        select: colunas => {
          consultas.push({ tabela, colunas });
          const resposta = () =>
            Promise.resolve(
              tabela === falhaTabela
                ? { data: null, error: new Error('Falha na carga de ' + tabela) }
                : { data: base[tabela], error: null },
            );
          const builder = {
            eq: () => builder,
            order: () => builder,
            single: resposta,
            maybeSingle: resposta,
            then: (ok, falha) => resposta().then(ok, falha),
          };
          return builder;
        },
        update: valores => {
          const atualizacao = { tabela, valores, filtros: [] };
          atualizacoes.push(atualizacao);
          const builder = {
            eq: (campo, valor) => {
              atualizacao.filtros.push([campo, valor]);
              return builder;
            },
            select: async () => ({ data: base[tabela] ? [{ id: 1 }] : [], error: null }),
          };
          return builder;
        },
      }),
      rpc: async (nome, parametros) => {
        rpcs.push({ nome, parametros });
        return { data: true, error: null };
      },
    },
  };
}

function libVoluntario(falso) {
  return carregar('src/funcionalidades/perfil/apiVoluntario.ts', {
    '@/servicos/supabase': { supabase: falso.supabase },
    '@/compartilhado/tipos': tipos,
    '@/funcionalidades/voluntariado/regras': regrasVoluntariado,
    './regras': regrasPerfil,
  });
}

function libOng(falso) {
  const perfilGestao = carregar('src/funcionalidades/perfil/apiGestao.ts', {
    '@/servicos/supabase': { supabase: falso.supabase },
  });
  return carregar('src/funcionalidades/perfil/apiOng.ts', {
    '@/servicos/supabase': { supabase: falso.supabase },
    './apiGestao': perfilGestao,
  });
}

/** React mínimo: componentes viram árvores; o contexto devolve o valor informado. */
function reactFalso(contexto) {
  const estados = [];
  let cursor = 0;
  const react = {
    createElement: (tipo, props, ...filhos) => ({ tipo, props: props ?? {}, filhos }),
    Fragment: 'Fragment',
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => contexto.valor,
    useState: inicial => {
      const indice = cursor++;
      estados[indice] ??= { valor: inicial };
      return [
        estados[indice].valor,
        valor => {
          estados[indice].valor =
            typeof valor === 'function' ? valor(estados[indice].valor) : valor;
        },
      ];
    },
  };
  react.default = react;
  return {
    react,
    reiniciar: () => {
      cursor = 0;
    },
  };
}

const rn = {
  StyleSheet: { create: valor => valor },
  Pressable: 'Pressable',
  Text: 'Text',
  View: 'View',
};
const secoes = {
  SecaoPerfil: 'SecaoPerfil',
  CartaoSecao: 'CartaoSecao',
  HubPerfil: 'HubPerfil',
  StatusPerfil: 'StatusPerfil',
  OpcaoMarcavel: 'OpcaoMarcavel',
  estilosPerfil: {},
};

/** Carrega as telas (uma por arquivo) e junta as exportações num só objeto. */
function carregarTelas(nomes, dependencias) {
  return Object.assign(
    {},
    ...nomes.map(nome => carregar(`src/funcionalidades/perfil/telas/${nome}.tsx`, dependencias)),
  );
}

function dependenciasTelas(react) {
  return {
    react,
    'react-native': rn,
    '@/compartilhado/tema': { cores: {}, espaco: {} },
    '@/compartilhado/tipos': tipos,
    '@/compartilhado/utils/validadores': validadores,
    '@/compartilhado/utils/mascaras': mascaras,
    '@/compartilhado/utils/datas': datas,
    '@/compartilhado/componentes/Ui': { Campo: 'Campo' },
    '@/compartilhado/componentes/CampoData': { CampoData: 'CampoData' },
    '../componentes/PerfilSecoes': secoes,
    '../regras': regrasPerfil,
  };
}

function telasVoluntario(contexto, buscarCep = async () => null) {
  const { react, reiniciar } = reactFalso(contexto);
  const telas = carregarTelas(
    [
      'TelaHubPerfilVoluntario',
      'TelaSecaoDadosPessoais',
      'TelaSecaoCadastro',
      'TelaSecaoEndereco',
      'TelaSecaoDisponibilidade',
      'TelaSecaoHabilidades',
    ],
    {
      ...dependenciasTelas(react),
      '../ContextoPerfilVoluntario': carregar(
        'src/funcionalidades/perfil/ContextoPerfilVoluntario.tsx',
        { react },
      ),
      '../apiVoluntario': { buscarCep },
      '../componentes/SolicitarExclusao': { SolicitarExclusao: () => null },
    },
  );
  return { telas, reiniciar };
}

function telasOng(contexto) {
  const { react, reiniciar } = reactFalso(contexto);
  const telas = carregarTelas(
    [
      'TelaHubPerfilOng',
      'TelaSecaoContaOng',
      'TelaSecaoInstitucionalOng',
      'TelaSecaoWhatsappOng',
      'TelaSecaoRecebimentoOng',
    ],
    {
      ...dependenciasTelas(react),
      '../ContextoPerfilOng': carregar('src/funcionalidades/perfil/ContextoPerfilOng.tsx', {
        react,
      }),
      '../apiOng': carregar('src/funcionalidades/perfil/apiOng.ts', {
        '@/servicos/supabase': {},
        './apiGestao': {},
      }),
    },
  );
  return { telas, reiniciar };
}

function encontrar(arvore, tipo, atributo, valor) {
  if (!arvore) return undefined;
  if (Array.isArray(arvore)) {
    for (const filho of arvore) {
      const achado = encontrar(filho, tipo, atributo, valor);
      if (achado) return achado;
    }
    return undefined;
  }
  if (typeof arvore !== 'object') return undefined;
  if (arvore.tipo === tipo && (atributo === undefined || arvore.props[atributo] === valor))
    return arvore;
  return encontrar(arvore.filhos, tipo, atributo, valor);
}

test('Perfil voluntário: carga lê endereço estruturado sem usuarios.endereco', async () => {
  const falso = supabaseFalso();
  const perfil = await libVoluntario(falso).carregarPerfilVoluntario('conta-teste');
  assert.doesNotMatch(falso.consultas.find(c => c.tabela === 'usuarios').colunas, /\bendereco\b/);
  const colunas = falso.consultas
    .find(c => c.tabela === 'voluntarios')
    .colunas.split(',')
    .map(c => c.trim());
  for (const campo of ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'])
    assert.ok(colunas.includes(campo));
  assert.equal(perfil.dados.logradouro, 'Rua de Teste');
  assert.deepEqual(perfil.habilidades, [1]);
  assert.equal(perfil.elegivel, true);
});

test('Perfil voluntário: falha em qualquer tabela rejeita a carga inteira', async () => {
  for (const tabela of ['voluntarios', 'usuarios', 'habilidades', 'usuario_habilidades']) {
    await assert.rejects(
      libVoluntario(supabaseFalso({ falhaTabela: tabela })).carregarPerfilVoluntario('x'),
      /Falha na carga/,
    );
  }
});

test('Perfil voluntário: seção de endereço salva só os sete campos normalizados com as habilidades atuais', async () => {
  const falso = supabaseFalso();
  const lib = libVoluntario(falso);
  const perfil = await lib.carregarPerfilVoluntario('conta-teste');
  const contexto = {
    valor: {
      perfil,
      salvar: (parcial, habilidades) =>
        lib.salvarPerfilVoluntario(parcial, habilidades ?? perfil.habilidades),
    },
  };
  const { telas, reiniciar } = telasVoluntario(contexto);
  const render = () => {
    reiniciar();
    return telas.TelaSecaoEndereco({ voltar() {} });
  };
  let arvore = render();
  assert.equal(encontrar(arvore, 'Campo', 'rotulo', 'CEP').props.value, '95800-000');
  const alterados = {
    Logradouro: '  Avenida Nova  ',
    Número: '  s/n  ',
    Complemento: '  Casa 2  ',
    Bairro: '  Centro  ',
    Cidade: '  Porto Alegre  ',
    UF: 'rs',
  };
  for (const [rotulo, valor] of Object.entries(alterados))
    encontrar(render(), 'Campo', 'rotulo', rotulo).props.onChangeText(valor);
  await encontrar(render(), 'Campo', 'rotulo', 'CEP').props.onChangeText('90001-234');
  arvore = render();
  assert.equal(await encontrar(arvore, 'SecaoPerfil').props.salvar(), null);
  const { p_dados, p_habilidades } = falso.rpcs.find(
    r => r.nome === 'voluntariado_salvar_perfil',
  ).parametros;
  assert.deepEqual(p_dados, {
    cep: '90001234',
    logradouro: 'Avenida Nova',
    numero: 's/n',
    complemento: 'Casa 2',
    bairro: 'Centro',
    cidade: 'Porto Alegre',
    uf: 'RS',
  });
  assert.deepEqual(p_habilidades, [1]);
});

test('Perfil voluntário: CEP preenchido pelo ViaCEP e CEP/UF inválidos barram a gravação', async () => {
  for (const [rotulo, valor] of [
    ['CEP', '1234'],
    ['UF', 'R1'],
  ]) {
    let salvou = false;
    const perfil = await libVoluntario(supabaseFalso()).carregarPerfilVoluntario('x');
    const { telas, reiniciar } = telasVoluntario({
      valor: {
        perfil,
        salvar: async () => {
          salvou = true;
        },
      },
    });
    const render = () => {
      reiniciar();
      return telas.TelaSecaoEndereco({ voltar() {} });
    };
    await encontrar(render(), 'Campo', 'rotulo', rotulo).props.onChangeText(valor);
    await assert.rejects(
      encontrar(render(), 'SecaoPerfil').props.salvar(),
      new RegExp(rotulo + ' inválid'),
    );
    assert.equal(salvou, false);
  }
  const perfil = await libVoluntario(supabaseFalso()).carregarPerfilVoluntario('x');
  const { telas, reiniciar } = telasVoluntario(
    { valor: { perfil, salvar: async () => {} } },
    async () => ({ logradouro: 'Praça da Sé', bairro: 'Sé', cidade: 'São Paulo', uf: 'SP' }),
  );
  const render = () => {
    reiniciar();
    return telas.TelaSecaoEndereco({ voltar() {} });
  };
  await encontrar(render(), 'Campo', 'rotulo', 'CEP').props.onChangeText('01001000');
  const arvore = render();
  assert.equal(encontrar(arvore, 'Campo', 'rotulo', 'Logradouro').props.value, 'Praça da Sé');
  assert.equal(encontrar(arvore, 'Campo', 'rotulo', 'Cidade').props.value, 'São Paulo');
  assert.equal(encontrar(arvore, 'Campo', 'rotulo', 'Número').props.value, '10');
});

test('Perfil voluntário: hub sem carga mostra só o erro, sem seções editáveis', () => {
  const { telas, reiniciar } = telasVoluntario({
    valor: { perfil: null, erro: 'Falha', carregando: false, carregar() {}, salvar() {} },
  });
  reiniciar();
  const arvore = telas.TelaHubPerfilVoluntario({ nome: 'Pessoa', sair() {}, abrir() {} });
  assert.equal(arvore.props.erro, 'Falha');
  assert.equal(encontrar(arvore, 'CartaoSecao'), undefined);
});

test('Perfil voluntário: status das seções segue os campos exigidos pela elegibilidade', () => {
  const base = { ...dados().usuarios, ...dados().voluntarios };
  assert.deepEqual(regrasPerfil.secoesPendentes(base, 1), []);
  assert.deepEqual(
    regrasPerfil.secoesPendentes({ ...base, numero: '  ', disponibilidade_horarios: [] }, 0),
    ['endereco', 'disponibilidade', 'habilidades'],
  );
  assert.deepEqual(regrasPerfil.secoesPendentes({ ...base, cpf: null }, 1), ['cadastro']);
});

test('CEP: resposta do ViaCEP, CEP inexistente e falha de rede', async () => {
  assert.deepEqual(
    regrasPerfil.enderecoDoViaCep({
      logradouro: 'Praça da Sé',
      bairro: 'Sé',
      localidade: 'São Paulo',
      uf: 'sp',
    }),
    { logradouro: 'Praça da Sé', bairro: 'Sé', cidade: 'São Paulo', uf: 'SP' },
  );
  assert.equal(regrasPerfil.enderecoDoViaCep({ erro: 'true' }), null);
  assert.equal(regrasPerfil.enderecoDoViaCep(null), null);
  assert.equal(regrasPerfil.mascararCep('95800000'), '95800-000');
  const lib = libVoluntario(supabaseFalso());
  const original = global.fetch;
  try {
    global.fetch = async () => {
      throw new Error('offline');
    };
    assert.equal(await lib.buscarCep('01001000'), null);
    global.fetch = async () => ({ ok: true, json: async () => ({ erro: true }) });
    assert.equal(await lib.buscarCep('99999999'), null);
    let chamadas = 0;
    global.fetch = async () => {
      chamadas++;
      return { ok: true, json: async () => ({}) };
    };
    assert.equal(await lib.buscarCep('123'), null);
    assert.equal(chamadas, 0, 'CEP incompleto não consulta a rede');
  } finally {
    global.fetch = original;
  }
});

test('Perfil gestão: conta sem complemento carrega e salva só a seção, sem endereço nem PIX', async () => {
  const base = dados();
  base.ongs = null;
  const falso = supabaseFalso({ base });
  const lib = libOng(falso);
  const perfil = await lib.carregarPerfilOng('g');
  assert.equal(perfil.razao_social, null);
  assert.doesNotMatch(falso.consultas.find(c => c.tabela === 'ongs').colunas, /pix/);
  await lib.salvarPerfilOng({ nome: 'Nova Gestão', razao_social: 'Instituição Nova' });
  const { p_dados } = falso.rpcs.find(r => r.nome === 'gestao_salvar_perfil').parametros;
  assert.deepEqual(p_dados, { nome: 'Nova Gestão', razao_social: 'Instituição Nova' });
});

test('Perfil gestão: seção de WhatsApp valida e envia só os dígitos', async () => {
  const enviados = [];
  const perfil = await libOng(supabaseFalso()).carregarPerfilOng('g');
  const { telas, reiniciar } = telasOng({
    valor: {
      dados: perfil,
      salvar: async parcial => {
        enviados.push(parcial);
      },
    },
  });
  const render = () => {
    reiniciar();
    return telas.TelaSecaoWhatsappOng({ voltar() {} });
  };
  encontrar(render(), 'Campo', 'rotulo', 'WhatsApp').props.onChangeText('5199');
  await assert.rejects(encontrar(render(), 'SecaoPerfil').props.salvar(), /WhatsApp inválido/);
  encontrar(render(), 'Campo', 'rotulo', 'WhatsApp').props.onChangeText('(51) 98888-7777');
  assert.equal(await encontrar(render(), 'SecaoPerfil').props.salvar(), null);
  assert.deepEqual(enviados, [{ whatsapp: '51988887777' }]);
});

test('Perfil gestão: falha de carga é propagada e o hub não oferece seções', async () => {
  await assert.rejects(
    libOng(supabaseFalso({ falhaTabela: 'ongs' })).carregarPerfilOng('g'),
    /Falha na carga/,
  );
  const { telas, reiniciar } = telasOng({
    valor: { dados: null, erro: 'Falha', carregando: false, carregar() {}, salvar() {} },
  });
  reiniciar();
  const arvore = telas.TelaHubPerfilOng({ nome: 'Gestão', sair() {}, abrir() {} });
  assert.equal(arvore.props.erro, 'Falha');
  assert.equal(encontrar(arvore, 'CartaoSecao'), undefined);
});

test('Perfil gestão: WhatsApp vai para a configuração da instituição, não para ongs', async () => {
  const falso = supabaseFalso();
  const lib = libOng(falso);
  assert.equal((await lib.carregarPerfilOng('g')).whatsapp, '51999999999');
  await lib.salvarPerfilOng({ whatsapp: '51988887777' });
  assert.deepEqual(falso.atualizacoes, [
    {
      tabela: 'configuracao_instituicao',
      valores: { whatsapp: '51988887777' },
      filtros: [['id', 1]],
    },
  ]);
  assert.equal(falso.rpcs.length, 0, 'Seção de WhatsApp não chama a RPC do perfil');
  const semConfiguracao = dados();
  semConfiguracao.configuracao_instituicao = null;
  await assert.rejects(
    libOng(supabaseFalso({ base: semConfiguracao })).salvarPerfilOng({ whatsapp: null }),
    /não foram atualizados/,
  );
});

test('WhatsApp: link com código do país e números inválidos recusados', () => {
  const { linkWhatsApp } = carregar('src/compartilhado/utils/whatsapp.ts', {
    'react-native': { Linking: {} },
  });
  assert.equal(
    linkWhatsApp('(51) 98888-7777', 'Olá & até'),
    'https://wa.me/5551988887777?text=Ol%C3%A1%20%26%20at%C3%A9',
  );
  assert.equal(linkWhatsApp('5551988887777', 'x'), 'https://wa.me/5551988887777?text=x');
  for (const invalido of ['', '123', '999999999999999'])
    assert.equal(linkWhatsApp(invalido, 'x'), null);
});

test('Perfil gestão: PIX lido e gravado na configuração; sem a coluna, a seção fica indisponível', async () => {
  const falso = supabaseFalso();
  const lib = libOng(falso);
  const perfil = await lib.carregarPerfilOng('g');
  assert.equal(perfil.chave_pix, 'chave-ficticia');
  assert.equal(perfil.pixDisponivel, true);
  await lib.salvarPerfilOng({ chave_pix: 'nova', nome_beneficiario_pix: null });
  assert.deepEqual(falso.atualizacoes.at(-1).valores, {
    chave_pix: 'nova',
    nome_beneficiario_pix: null,
  });
  assert.equal(falso.rpcs.length, 0);
  const semColuna = supabaseFalso();
  const original = semColuna.supabase.from;
  semColuna.supabase.from = tabela => {
    const consulta = original(tabela);
    if (tabela !== 'configuracao_instituicao') return consulta;
    return {
      ...consulta,
      select: colunas =>
        colunas.includes('chave_pix')
          ? {
              maybeSingle: async () => ({
                data: null,
                error: { code: '42703', message: 'column does not exist' },
              }),
            }
          : consulta.select(colunas),
    };
  };
  const antigo = await libOng(semColuna).carregarPerfilOng('g');
  assert.equal(antigo.pixDisponivel, false);
  assert.equal(antigo.whatsapp, '51999999999');
});

test('Perfil: validações das seções lançam a mensagem ou devolvem os campos normalizados', () => {
  const conta = { nome: ' Ana ', telefone: '(51) 98888-7777', instagram: '@ana.h', descricao: '' };
  assert.deepEqual(regrasPerfil.validarConta(conta, 'A apresentação'), {
    nome: 'Ana',
    telefone: '51988887777',
    perfil_instagram: 'ana.h',
    descricao: null,
  });
  assert.throws(() => regrasPerfil.validarConta({ ...conta, nome: 'A' }, 'X'), /nome/);
  assert.throws(() => regrasPerfil.validarConta({ ...conta, telefone: '123' }, 'X'), /Telefone/);
  assert.throws(() => regrasPerfil.validarConta({ ...conta, instagram: 'a b' }, 'X'), /Instagram/);
  assert.throws(
    () => regrasPerfil.validarConta({ ...conta, descricao: 'x'.repeat(501) }, 'A descrição'),
    { message: 'A descrição pode ter no máximo 500 caracteres.' },
  );

  const cadastro = { cpf: '', nascimento: '10/05/1990', profissao: ' Agrônoma ' };
  assert.deepEqual(regrasPerfil.validarCadastroVoluntario(cadastro, '2026-10-13'), {
    cpf: null,
    data_nascimento: '1990-05-10',
    profissao: 'Agrônoma',
  });
  assert.throws(
    () => regrasPerfil.validarCadastroVoluntario({ ...cadastro, cpf: '111.111.111-11' }),
    /CPF/,
  );
  assert.throws(
    () =>
      regrasPerfil.validarCadastroVoluntario(
        { ...cadastro, nascimento: '13/10/2026' },
        '2026-10-13',
      ),
    /no passado/,
  );
  assert.throws(
    () =>
      regrasPerfil.validarInstitucional(
        { cnpj: '', razaoSocial: '', fundacao: '01/01/2030', responsavel: '' },
        '2026-10-13',
      ),
    /futuro/,
  );
  assert.deepEqual(regrasPerfil.validarWhatsapp(''), { whatsapp: null });
  assert.throws(
    () => regrasPerfil.validarRecebimento({ chave: 'x', beneficiario: 'A' }),
    /beneficiário/,
  );
});
