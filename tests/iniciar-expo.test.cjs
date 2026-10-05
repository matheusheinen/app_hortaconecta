const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { lerArgumentos, encontrarUrlTunel, verificarPorta } = require('../scripts/start-cloudflare.cjs');

test('Iniciador Expo: porta válida, limpeza e ajuda; rejeita valores e opções inválidas', () => {
  assert.deepEqual(lerArgumentos([]), { porta: 8081, limpar: false, ajuda: false });
  assert.deepEqual(lerArgumentos(['--port', '8090', '--clear']), { porta: 8090, limpar: true, ajuda: false });
  assert.equal(lerArgumentos(['--port=8091', '--help']).porta, 8091);
  for (const argumentos of [['--port'], ['--port', '0'], ['--port', '65536'], ['--port=NaN'], ['--tunnel']]) {
    assert.throws(() => lerArgumentos(argumentos));
  }
});

test('Iniciador Expo: extrai somente a URL HTTPS de um Quick Tunnel', () => {
  assert.equal(encontrarUrlTunel('INFO | https://horta-teste.trycloudflare.com |'), 'https://horta-teste.trycloudflare.com');
  assert.equal(encontrarUrlTunel('http://horta-teste.trycloudflare.com'), null);
  assert.equal(encontrarUrlTunel('https://example.com'), null);
});

test('Iniciador Expo: porta ocupada falha antes de abrir túnel ou encerrar outro serviço', async () => {
  const servidor = net.createServer();
  await new Promise(resolve => servidor.listen(0, 'localhost', resolve));
  const porta = servidor.address().port;
  try {
    await assert.rejects(verificarPorta(porta), /já está em uso/);
    assert.equal(servidor.listening, true);
  } finally { await new Promise(resolve => servidor.close(resolve)); }
  await verificarPorta(porta);
});
