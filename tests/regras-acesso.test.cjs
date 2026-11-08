const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

const arquivo = 'src/funcionalidades/autenticacao/regras.ts';
const modulo = new Module(arquivo);
modulo.require = nome => {
  throw new Error('Import inesperado: ' + nome);
};
modulo._compile(
  ts.transpileModule(fs.readFileSync(arquivo, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  arquivo,
);
const regras = modulo.exports;

test('Acesso: login e cadastro exigem e-mail, senha e, no cadastro, o nome', () => {
  const campos = { nome: '', email: 'a@b.com', senha: 'segredo1' };
  assert.doesNotThrow(() => regras.validarEntrada('entrar', campos));
  assert.throws(() => regras.validarEntrada('entrar', { ...campos, email: ' ' }), {
    message: 'Informe e-mail e senha.',
  });
  assert.throws(() => regras.validarEntrada('entrar', { ...campos, senha: '' }), {
    message: 'Informe e-mail e senha.',
  });
  assert.throws(() => regras.validarEntrada('cadastrar', campos), {
    message: 'Informe seu nome completo.',
  });
  assert.doesNotThrow(() => regras.validarEntrada('cadastrar', { ...campos, nome: 'Ana' }));
  assert.throws(
    () => regras.validarEntrada('cadastrar', { ...campos, nome: 'Ana', senha: '1234567' }),
    /8 caracteres/,
  );
  // Login de conta antiga com senha de 6 ou 7 caracteres continua liberado.
  assert.doesNotThrow(() => regras.validarEntrada('entrar', { ...campos, senha: '123456' }));
  assert.throws(() => regras.validarEmailRecuperacao('  '), /e-mail da conta/);
});

test('Acesso: nova senha pede código de 6 a 10 dígitos, dispensado depois de confirmado', () => {
  const base = { codigo: '123456', senha: 'segredo1', codigoConfirmado: false };
  assert.doesNotThrow(() => regras.validarNovaSenha(base));
  assert.throws(() => regras.validarNovaSenha({ ...base, codigo: '12345' }), /código/);
  assert.throws(() => regras.validarNovaSenha({ ...base, codigo: 'abcdef' }), /código/);
  assert.doesNotThrow(() =>
    regras.validarNovaSenha({ ...base, codigo: '', codigoConfirmado: true }),
  );
  assert.throws(() => regras.validarNovaSenha({ ...base, senha: '1234567' }), /8 caracteres/);
});

test('Acesso: a máquina de estados segue o fluxo e ignora eventos fora de hora', () => {
  const seguir = (...eventos) => eventos.reduce(regras.proximaFase, regras.faseInicial);
  assert.deepEqual(seguir('alternarCadastro'), { modo: 'cadastrar' });
  assert.deepEqual(seguir('alternarCadastro', 'contaCriada'), { modo: 'entrar' });
  assert.deepEqual(seguir('abrirRecuperacao', 'codigoEnviado', 'codigoConfirmado'), {
    modo: 'recuperar',
    etapa: 'codigo',
    codigoConfirmado: true,
  });
  assert.deepEqual(seguir('abrirRecuperacao', 'codigoEnviado', 'voltarAoLogin'), {
    modo: 'entrar',
  });
  // Fora de hora: confirmar código sem tê-lo enviado, recuperar a partir do cadastro.
  assert.deepEqual(seguir('codigoConfirmado'), { modo: 'entrar' });
  assert.deepEqual(seguir('abrirRecuperacao', 'codigoConfirmado'), {
    modo: 'recuperar',
    etapa: 'email',
  });
  assert.deepEqual(seguir('alternarCadastro', 'abrirRecuperacao'), { modo: 'cadastrar' });
  assert.deepEqual(seguir('abrirRecuperacao', 'alternarCadastro'), {
    modo: 'recuperar',
    etapa: 'email',
  });
  assert.equal(regras.codigoConfirmado(seguir('abrirRecuperacao', 'codigoEnviado')), false);
});

test('Acesso: rótulo do botão principal acompanha a fase', () => {
  assert.equal(regras.rotuloAcao({ modo: 'entrar' }), 'Entrar');
  assert.equal(regras.rotuloAcao({ modo: 'cadastrar' }), 'Criar conta');
  assert.equal(regras.rotuloAcao({ modo: 'recuperar', etapa: 'email' }), 'Enviar código');
  assert.equal(
    regras.rotuloAcao({ modo: 'recuperar', etapa: 'codigo', codigoConfirmado: false }),
    'Redefinir senha',
  );
});
