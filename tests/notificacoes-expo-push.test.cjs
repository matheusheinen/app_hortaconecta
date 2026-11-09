const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

// O adaptador é TypeScript do Deno sem dependências do Deno: transpila e carrega no Node.
function carregar(arquivo) {
  const modulo = new Module(arquivo);
  modulo._compile(
    ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
      fileName: arquivo,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    arquivo,
  );
  return modulo.exports;
}
const expo = carregar('supabase/functions/_compartilhado/canais/expoPush.ts');

const entrega = (id, extra = {}) => ({
  id,
  canal: 'push',
  destino: `ExpoPushToken[${id}]`,
  tentativas: 1,
  notificacao_id: 100 + id,
  tipo: 'CANDIDATURA_APROVADA',
  titulo: 'Candidatura aprovada',
  corpo: 'Sua candidatura foi aprovada.',
  atividade_id: 7,
  meta_id: null,
  ...extra,
});

function buscarFalso(respostas) {
  const chamadas = [];
  const buscar = async (url, init) => {
    chamadas.push({ url, init, corpo: JSON.parse(init.body) });
    const r = respostas.shift();
    if (r instanceof Error) throw r;
    return { ok: r.status < 400, status: r.status, json: async () => r.corpo };
  };
  return { buscar, chamadas };
}

test('Canal push do Expo (B29)', async t => {
  await t.test('a mensagem leva os dados que o app usa ao tocar', () => {
    const m = expo.montarMensagem(entrega(1));
    assert.equal(m.to, 'ExpoPushToken[1]');
    assert.equal(m.channelId, 'padrao');
    assert.deepEqual(m.data, {
      notificacaoId: 101,
      tipo: 'CANDIDATURA_APROVADA',
      atividade_id: 7,
      meta_id: null,
    });
  });

  await t.test('tickets ok e com erro viram resultados na mesma ordem', async () => {
    const { buscar, chamadas } = buscarFalso([
      {
        status: 200,
        corpo: {
          data: [
            { status: 'ok', id: 'tk-1' },
            {
              status: 'error',
              message: 'not registered',
              details: { error: 'DeviceNotRegistered' },
            },
            { status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } },
          ],
        },
      },
    ]);
    const canal = expo.criarCanalExpoPush(buscar, 'segredo-expo');
    const r = await canal.enviar([entrega(1), entrega(2), entrega(3)]);
    assert.equal(chamadas[0].url, expo.URL_ENVIO);
    assert.equal(chamadas[0].init.headers.Authorization, 'Bearer segredo-expo');
    assert.deepEqual(r[0], { id: 1, ok: true, id_externo: 'tk-1' });
    assert.equal(r[1].definitivo, true);
    assert.equal(r[1].remover_destino, true);
    assert.equal(r[2].definitivo, false, 'limite de taxa tenta de novo');
  });

  await t.test('sem token de acesso não manda Authorization', async () => {
    const { buscar, chamadas } = buscarFalso([
      { status: 200, corpo: { data: [{ status: 'ok', id: 'x' }] } },
    ]);
    await expo.criarCanalExpoPush(buscar).enviar([entrega(1)]);
    assert.equal(chamadas[0].init.headers.Authorization, undefined);
  });

  await t.test('lotes de no máximo 100 mensagens', async () => {
    const ok = n => ({
      status: 200,
      corpo: { data: Array.from({ length: n }, (_, i) => ({ status: 'ok', id: `t${i}` })) },
    });
    const { buscar, chamadas } = buscarFalso([ok(100), ok(50)]);
    const r = await expo
      .criarCanalExpoPush(buscar)
      .enviar(Array.from({ length: 150 }, (_, i) => entrega(i + 1)));
    assert.deepEqual(
      chamadas.map(c => c.corpo.length),
      [100, 50],
    );
    assert.equal(r.length, 150);
    assert.ok(r.every(x => x.ok));
  });

  await t.test('erro do lote inteiro e queda de rede voltam para a fila', async () => {
    const { buscar } = buscarFalso([
      { status: 429, corpo: { errors: [{ code: 'TOO_MANY_REQUESTS' }] } },
      new Error('ECONNRESET'),
    ]);
    const canal = expo.criarCanalExpoPush(buscar);
    const [a] = await canal.enviar([entrega(1)]);
    assert.deepEqual(a, { id: 1, ok: false, erro: 'TOO_MANY_REQUESTS' });
    const [b] = await canal.enviar([entrega(2)]);
    assert.equal(b.ok, false);
    assert.match(b.erro, /ECONNRESET/);
    assert.ok(!b.definitivo);
  });

  await t.test('recibos: ok, erro e ausente (ainda não pronto)', async () => {
    const { buscar, chamadas } = buscarFalso([
      {
        status: 200,
        corpo: {
          data: {
            'tk-1': { status: 'ok' },
            'tk-2': { status: 'error', details: { error: 'DeviceNotRegistered' } },
          },
        },
      },
    ]);
    const r = await expo.consultarRecibos(buscar, [
      { id: 1, id_externo: 'tk-1' },
      { id: 2, id_externo: 'tk-2' },
      { id: 3, id_externo: 'tk-3' },
    ]);
    assert.equal(chamadas[0].url, expo.URL_RECIBOS);
    assert.deepEqual(chamadas[0].corpo, { ids: ['tk-1', 'tk-2', 'tk-3'] });
    assert.deepEqual(r, [
      { id: 1, ok: true },
      { id: 2, ok: false, erro: 'DeviceNotRegistered', remover_destino: true },
    ]);
  });
});
