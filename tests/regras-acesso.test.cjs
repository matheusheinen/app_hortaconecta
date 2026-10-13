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
  const campos = { nome: '', email: 'a@b.com', senha: 'segredo' };
  assert.equal(regras.validarEntrada('entrar', campos), null);
  assert.equal(
    regras.validarEntrada('entrar', { ...campos, email: ' ' }),
    'Informe e-mail e senha.',
  );
  assert.equal(
    regras.validarEntrada('entrar', { ...campos, senha: '' }),
    'Informe e-mail e senha.',
  );
  assert.equal(regras.validarEntrada('cadastrar', campos), 'Informe seu nome completo.');
  assert.equal(regras.validarEntrada('cadastrar', { ...campos, nome: 'Ana' }), null);
});

test('Acesso: nova senha pede código de 6 a 10 dígitos, dispensado depois de confirmado', () => {
  const base = { codigo: '123456', senha: 'segredo', codigoConfirmado: false };
  assert.equal(regras.validarNovaSenha(base), null);
  assert.match(regras.validarNovaSenha({ ...base, codigo: '12345' }), /código/);
  assert.match(regras.validarNovaSenha({ ...base, codigo: 'abcdef' }), /código/);
  assert.equal(regras.validarNovaSenha({ ...base, codigo: '', codigoConfirmado: true }), null);
  assert.match(regras.validarNovaSenha({ ...base, senha: '12345' }), /6 caracteres/);
});

test('Acesso: rótulo do botão principal acompanha modo e etapa', () => {
  assert.equal(regras.rotuloAcao('entrar', 'email'), 'Entrar');
  assert.equal(regras.rotuloAcao('cadastrar', 'email'), 'Criar conta');
  assert.equal(regras.rotuloAcao('recuperar', 'email'), 'Enviar código');
  assert.equal(regras.rotuloAcao('recuperar', 'codigo'), 'Redefinir senha');
});
