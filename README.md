# Horta Conecta

Aplicativo mobile de voluntariado, apadrinhamento e transparência para a Horta
Comunitária Guaporé (Guaporé/RS). Projeto de extensão da UNIVATES, Engenharia
de Software, 2026/2.

React Native + Expo SDK 57, TypeScript e Supabase.

## Começando

```sh
npm ci
cp .env.example .env   # preencher com a URL e a chave pública do Supabase
npm start
```

Guia completo para Windows, Expo Go, LAN e túnel: [docs/EXECUTAR_APP.md](docs/EXECUTAR_APP.md).

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm start` | Inicia o Expo |
| `npm run typecheck` | Verifica os tipos (`tsc --noEmit`) |
| `npm run lint` | ESLint (`eslint-config-expo` + Prettier) |
| `npm run format` | Formata o código com Prettier |
| `npm test` | Testes de regras e do banco (`node --test` + PGlite) |

## Documentação

- [DOCUMENTACAO.md](DOCUMENTACAO.md): visão, modelo de dados, regras de negócio,
  requisitos, backlog, **estrutura do código** e convenções. É a referência principal.
- [docs/INDICE.md](docs/INDICE.md): escopo do MVP, fluxos, auditorias e reconciliação do Supabase.
- [CONTRIBUTING.md](CONTRIBUTING.md): como trabalhar em equipe no GitHub (branches, PRs, conflitos).
