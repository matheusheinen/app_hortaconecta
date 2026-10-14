// Carrega os esquemas Zod do app (TypeScript) para os testes em Node, com o Zod real.
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

function compilar(arquivo, dependencias) {
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

const base = compilar('src/compartilhado/esquemas.ts', { zod: require('zod') });

/** Esquemas de uma funcionalidade, ex.: esquemasDe('diario'). */
function esquemasDe(funcionalidade) {
  return compilar(`src/funcionalidades/${funcionalidade}/esquemas.ts`, {
    '@/compartilhado/esquemas': base,
    '@/servicos/database.types': compilar('src/servicos/database.types.ts', {}),
  });
}

module.exports = { base, esquemasDe };
