const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
// Executa as funções reais do app, sem carregar React Native no Node.
const modulo = new Module('regras');
modulo._compile(ts.transpileModule(fs.readFileSync('src/lib/regrasVoluntariado.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, 'regras.cjs');
const { interpretarDataHora, interpretarCarga, disponibilidadeValida, lerQrCheckin } = modulo.exports;

test('datas rejeitam horário normalizado, datas inexistentes e aceitam ano bissexto', () => {
  for (const valor of ['24/09/2026 10:60', '24/09/2026 10:99', '24/09/2026 24:00', '31/02/2026 10:00', '29/02/2025 10:00']) {
    assert.equal(interpretarDataHora(valor), null, valor);
  }
  assert.ok(interpretarDataHora('29/02/2028 23:59'));
});
test('carga horária aceita vírgula sem aceitar NaN, infinito ou precisão indevida', () => {
  assert.equal(interpretarCarga('1,5'), 1.5);
  assert.equal(interpretarCarga('1.25'), 1.25);
  for (const valor of ['', 'Infinity', '1e2', '0', '-1', '1000', '1,234']) assert.equal(interpretarCarga(valor), null);
});
test('disponibilidade exige array estruturado sem períodos duplicados', () => {
  assert.equal(disponibilidadeValida([]), true);
  assert.equal(disponibilidadeValida([{ dia: 'seg', periodo: 'manha' }]), true);
  for (const valor of [null, {}, [null], [{ dia: 'seg', periodo: 'madrugada' }],
    [{ dia: 'seg', periodo: 'manha' }, { dia: 'seg', periodo: 'manha' }]]) assert.equal(disponibilidadeValida(valor), false);
});
test('leitura de QR exige versão, atividade correta e token aleatório', () => {
  const token = '44444444-4444-4444-8444-444444444444';
  const qr = JSON.stringify({ tipo: 'hortaconecta-checkin-v1', atividade_id: 1, token });
  assert.equal(lerQrCheckin(qr, 1), token);
  assert.throws(() => lerQrCheckin(qr, 2));
  assert.throws(() => lerQrCheckin('1', 1));
  assert.throws(() => lerQrCheckin('{', 1));
  assert.throws(() => lerQrCheckin(JSON.stringify({ tipo: 'hortaconecta-checkin-v1', atividade_id: 1, token: '1' }), 1));
});
