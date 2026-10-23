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
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    arquivo,
  );
  return modulo.exports;
}

const regras = carregar('src/funcionalidades/metas/regras.ts', {
  '@/compartilhado/utils/datas': carregar('src/compartilhado/utils/datas.ts'),
});
const nbsp = texto => texto.replace(/ /g, ' ');

test('Metas: valores aceitam vírgula/ponto com até 2 casas e recusam milhar, zero e lixo', () => {
  assert.equal(regras.interpretarQuantidade('25,50'), 25.5);
  assert.equal(regras.interpretarQuantidade('R$ 10.5'), 10.5);
  assert.equal(regras.interpretarQuantidade('3'), 3);
  for (const invalido of ['', '0', '-5', '1.000,00', '1,234', 'abc', '12345678901', 'Infinity']) {
    assert.equal(regras.interpretarQuantidade(invalido), null, invalido);
  }
});

test('Metas: progresso em reais ou unidades, percentual limitado e prazo', () => {
  const financeira = {
    tipo: 'FINANCEIRA',
    unidade_medida: null,
    quantidade_meta: 100,
    quantidade_arrecadada: 30,
  };
  const material = {
    tipo: 'MATERIAL',
    unidade_medida: 'kg',
    quantidade_meta: 10,
    quantidade_arrecadada: 12,
  };
  assert.equal(nbsp(regras.descreverProgresso(financeira)), 'R$ 30,00 de R$ 100,00');
  assert.equal(regras.descreverProgresso(material), '12 de 10 kg');
  assert.equal(nbsp(regras.descreverQuantidade(2.5, financeira)), 'R$ 2,50');
  assert.equal(regras.descreverQuantidade(3, { tipo: 'MATERIAL', unidade_medida: null }), '3 un.');
  assert.equal(regras.percentualMeta(financeira), 30);
  assert.equal(regras.percentualMeta(material), 100);
  assert.equal(regras.prazoVencido({ data_limite: '2026-10-04' }, '2026-10-05'), true);
  assert.equal(regras.prazoVencido({ data_limite: '2026-10-05' }, '2026-10-05'), false);
  assert.equal(
    regras.recebendoContribuicoes({ status: 'ABERTA', data_limite: null }, '2026-10-05'),
    true,
  );
  assert.equal(
    regras.recebendoContribuicoes({ status: 'ENCERRADA', data_limite: null }, '2026-10-05'),
    false,
  );
});

test('Metas: escritas enviam o contrato esperado pela RLS', async () => {
  const chamadas = [];
  const builder = (registro, resposta = { data: [{ id: 1 }], error: null }) => {
    const b = {
      eq: (c, v) => {
        registro.filtros.push([c, v]);
        return b;
      },
      select: async () => resposta,
      then: (ok, falha) => Promise.resolve({ error: null }).then(ok, falha),
    };
    return b;
  };
  let respostaUpdate = { data: [{ id: 1 }], error: null };
  const enviados = [],
    removidos = [],
    rpcs = [];
  let falharInsert = false;
  const supabase = {
    rpc: async (nome, args) => {
      rpcs.push([nome, args]);
      return {
        data: nome === 'comprovante_caminho' ? `uid/novo.${args.p_ext}` : null,
        error: null,
      };
    },
    storage: {
      from: bucket => ({
        upload: async (caminho, arquivo, opcoes) => {
          enviados.push({ bucket, caminho, bytes: arquivo.byteLength, opcoes });
          return { error: null };
        },
        remove: async caminhos => {
          removidos.push(...caminhos);
          return { error: null };
        },
      }),
    },
    from: tabela => ({
      insert: valores => {
        const r = { tabela, op: 'insert', valores, filtros: [] };
        chamadas.push(r);
        if (falharInsert) return Promise.resolve({ error: new Error('meta encerrada') });
        return builder(r);
      },
      update: valores => {
        const r = { tabela, op: 'update', valores, filtros: [] };
        chamadas.push(r);
        return builder(r, respostaUpdate);
      },
    }),
  };
  const metas = carregar('src/funcionalidades/metas/api.ts', {
    '@/servicos/supabase': { supabase },
    './comprovante': carregar('src/funcionalidades/metas/comprovante.ts'),
  });
  await metas.declararContribuicao(7, 'v', 25.5);
  assert.deepEqual(chamadas.at(-1).valores, {
    meta_id: 7,
    usuario_id: 'v',
    quantidade_oferecida: 25.5,
  });
  assert.deepEqual(enviados, []);
  const jpeg = Buffer.from([255, 216, 255, 224, 0, 1]).toString('base64');
  await metas.declararContribuicao(7, 'v', 10, jpeg);
  assert.deepEqual(enviados, [
    {
      bucket: 'comprovantes',
      caminho: 'uid/novo.jpg',
      bytes: 6,
      opcoes: { contentType: 'image/jpeg', upsert: false, cacheControl: '60' },
    },
  ]);
  assert.deepEqual(chamadas.at(-1).valores, {
    meta_id: 7,
    usuario_id: 'v',
    quantidade_oferecida: 10,
    url_comprovante: 'uid/novo.jpg',
  });
  assert.deepEqual(rpcs.at(-1), ['comprovante_caminho', { p_ext: 'jpg' }]);
  // PNG vai com a extensão e o tipo certos.
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]).toString('base64');
  await metas.declararContribuicao(7, 'v', 10, png);
  assert.deepEqual(rpcs.at(-1), ['comprovante_caminho', { p_ext: 'png' }]);
  assert.equal(enviados.at(-1).opcoes.contentType, 'image/png');
  enviados.length = 0;
  falharInsert = true;
  await assert.rejects(metas.declararContribuicao(7, 'v', 10, jpeg), /meta encerrada/);
  assert.deepEqual(removidos, ['uid/novo.jpg']);
  await assert.rejects(metas.declararContribuicao(7, 'v', 10, 'não-é-base64!'), /imagem/i);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
  const antesDoSvg = enviados.length;
  await assert.rejects(metas.declararContribuicao(7, 'v', 10, svg), /Formato não aceito/);
  assert.equal(enviados.length, antesDoSvg);
  falharInsert = false;
  await metas.registrarRecebimento({
    metaId: 7,
    doadorId: 'v',
    gestaoId: 'g',
    quantidade: 3,
    observacao: null,
  });
  assert.equal('url_comprovante' in chamadas.at(-1).valores, false);
  await metas.registrarRecebimento({
    metaId: 7,
    doadorId: 'v',
    gestaoId: 'g',
    quantidade: 3,
    observacao: null,
    comprovanteBase64: jpeg,
  });
  assert.equal(chamadas.at(-1).valores.url_comprovante, 'uid/novo.jpg');
  assert.equal(chamadas.at(-1).valores.status_validacao, 'APROVADA');
  const lancamento = chamadas.at(-1).valores;
  assert.equal(lancamento.status_validacao, 'APROVADA');
  assert.equal(lancamento.validado_por, 'g');
  assert.ok(lancamento.validado_em);
  await metas.validarContribuicao(9, 'g', false, null);
  assert.deepEqual(chamadas.at(-1).filtros, [
    ['id', 9],
    ['status_validacao', 'PENDENTE'],
  ]);
  assert.equal(chamadas.at(-1).valores.status_validacao, 'RECUSADA');
  respostaUpdate = { data: [], error: null };
  await assert.rejects(metas.validarContribuicao(9, 'g', true, null), /já foi conferida/);
  await assert.rejects(metas.alterarStatusMeta(7, 'ENCERRADA'), /não foi atualizada/);
});

test('Metas: só ABERTA fica na aba de abertas', () => {
  assert.equal(regras.metaFinalizada({ status: 'ABERTA' }), false);
  assert.equal(regras.metaFinalizada({ status: 'ENCERRADA' }), true);
  assert.equal(regras.metaFinalizada({ status: 'CANCELADA' }), true);
});

test('Metas: o formulário valida os campos e devolve os dados prontos para salvar', () => {
  const entrada = {
    tipo: 'MATERIAL',
    titulo: '  Sementes  ',
    descricao: ' Para o canteiro ',
    unidade: ' kg ',
    quantidade: '2,5',
    prazo: '10/10/2026',
  };
  assert.deepEqual(regras.validarMeta(entrada, true, '2026-10-05'), {
    titulo: 'Sementes',
    descricao: 'Para o canteiro',
    tipo: 'MATERIAL',
    unidade_medida: 'kg',
    quantidade_meta: 2.5,
    data_limite: '2026-10-10',
  });
  assert.equal(
    regras.validarMeta({ ...entrada, tipo: 'FINANCEIRA', prazo: '' }, true, '2026-10-05')
      .unidade_medida,
    null,
  );
  const erro =
    (mudanca, nova = true) =>
    () =>
      regras.validarMeta({ ...entrada, ...mudanca }, nova, '2026-10-20');
  assert.throws(erro({ titulo: 'ab' }), /ao menos 3/);
  assert.throws(erro({ descricao: ' ' }), /Descreva/);
  assert.throws(erro({ unidade: '' }), /unidade de medida/);
  assert.throws(erro({ quantidade: '0' }), /quantidade da meta/);
  assert.throws(erro({ prazo: '31/02/2026' }), /DD\/MM\/AAAA/);
  assert.throws(erro({}), /hoje ou uma data futura/);
  // Ao editar, o prazo já vencido continua aceito.
  assert.equal(regras.validarMeta(entrada, false, '2026-10-20').data_limite, '2026-10-10');
});

test('Conferência: aprovar aceita nota opcional; recusar exige motivo', () => {
  assert.equal(regras.validarConferencia(true, ''), null);
  assert.equal(regras.validarConferencia(true, '  Conferido no extrato '), 'Conferido no extrato');
  assert.equal(regras.validarConferencia(false, ' Valor não consta '), 'Valor não consta');
  assert.throws(() => regras.validarConferencia(false, ''), /motivo da recusa/);
  assert.throws(() => regras.validarConferencia(false, ' a '), /motivo da recusa/);
  assert.throws(() => regras.validarConferencia(true, 'x'.repeat(501)), /500 caracteres/);
});
