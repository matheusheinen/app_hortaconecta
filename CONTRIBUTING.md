# Como trabalhar no repositório

Regras para a equipe desenvolver junto sem pisar no trabalho dos outros. As convenções de código estão em [DOCUMENTACAO.md](DOCUMENTACAO.md#convenções).

## A regra principal

**Ninguém commita direto no `main`.** Toda mudança entra por Pull Request (PR), passa pelo CI e é revisada por outra pessoa da equipe.

O `main` é sempre a versão que funciona. Se ele quebrar, todo mundo herda o problema na próxima atualização.

## Primeira vez

```sh
git clone https://github.com/matheusheinen/app_hortaconecta.git
cd app_hortaconecta
npm install
```

O `npm install` também ativa o hook `scripts/git-hooks/pre-push`, que recusa `git push` direto no `main`. Quem já tinha o projeto clonado precisa rodar `npm install` uma vez para ativá-lo.

## O dia a dia

### 1. Antes de começar, combine

Avise no grupo em qual item do backlog vai trabalhar (ex.: "peguei o B21"). Duas pessoas na mesma tela ao mesmo tempo é a principal causa de conflito.

### 2. Crie uma branch a partir do `main` atualizado

```sh
git switch main
git pull
git switch -c feat/b21-chave-pix
```

Nome da branch: `tipo/descricao-curta`, com o ID do backlog quando houver.

| Tipo        | Quando usar                                |
| ----------- | ------------------------------------------ |
| `feat/`     | funcionalidade nova                        |
| `fix/`      | correção de bug                            |
| `refactor/` | reorganização sem mudar comportamento      |
| `docs/`     | só documentação                            |
| `chore/`    | configuração, dependências, CI             |

### 3. Commits pequenos, no padrão da equipe

```text
feat: copia a chave PIX no detalhe da meta
fix: corrige loop de carregamento da imagem do Diário
```

Prefixos: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`. Mensagem em português, dizendo o que muda.

### 4. Traga o `main` para a sua branch com frequência

Pelo menos uma vez por dia e sempre antes de abrir o PR:

```sh
git fetch origin
git rebase origin/main
```

Quanto mais tempo a branch fica sem isso, maior o conflito no final. Se aparecer conflito, veja [Resolvendo conflitos](#resolvendo-conflitos).

Depois de um rebase, a branch já enviada precisa de `git push --force-with-lease`. Use só na **sua** branch, nunca no `main` ou numa branch que outra pessoa também usa.

### 5. Verifique e abra o PR

```sh
npm run format
npm run typecheck
npm run lint
npm test
git push -u origin feat/b21-chave-pix
```

Abra o PR no GitHub (ou `gh pr create`). O modelo de descrição já vem preenchido: diga o que muda e como testar.

### 6. Revisão e merge

- Pelo menos **uma pessoa** além do autor aprova.
- O CI (formatação, lint, tipos e testes) precisa estar verde.
- Merge com **Squash and merge**: o PR vira um commit só no `main`.
- Depois do merge, apague a branch e volte ao passo 2 para a próxima tarefa.

PRs pequenos são revisados mais rápido e conflitam menos. Se o PR passar de umas 400 linhas, vale dividir.

## Arquivos que todo mundo mexe

Esses arquivos são compartilhados por várias telas. Mudanças neles merecem um aviso no grupo antes, e de preferência um PR só para elas:

- `src/compartilhado/tema.ts` e `src/compartilhado/componentes/Ui.tsx`
- `src/app/AbasPrincipais.tsx` e `src/app/App.tsx` (navegação)
- `src/servicos/database.types.ts` (tipos do banco)
- `package.json` e `package-lock.json`

## Banco de dados (Supabase)

- Toda mudança no banco vira um arquivo novo em `supabase/migrations`, com o prefixo de data e hora: `20261008143000_descricao.sql`. O horário no nome evita que duas pessoas criem migrations com o mesmo número.
- **Nunca edite uma migration que já foi aplicada.** Para corrigir, crie outra.
- Combine no grupo antes de aplicar uma migration no projeto do Supabase: o banco é um só para a equipe toda.
- Depois de aplicar, regenere `src/servicos/database.types.ts` no mesmo PR.

## Resolvendo conflitos

Durante o `git rebase origin/main`, o Git para em cada commit que conflita:

1. `git status` mostra os arquivos em conflito.
2. Abra cada um no VS Code e escolha, trecho a trecho, o que fica (_Accept Current_, _Incoming_ ou _Both_). Na dúvida sobre o código de outra pessoa, pergunte para ela.
3. `git add <arquivo>` em cada arquivo resolvido.
4. `git rebase --continue`.
5. Rode `npm run typecheck` e `npm test` antes de enviar.

Se ficar confuso, `git rebase --abort` volta tudo para antes do rebase.

**Conflito no `package-lock.json`:** não resolva à mão. Aceite a versão do `main` e regenere:

```sh
git checkout --ours package-lock.json   # no rebase, "ours" é a versão do main
npm install                             # acrescenta as dependências da sua branch
git add package-lock.json
```

## Segredos e dados pessoais

- O `.env` nunca vai para o repositório; o modelo é o `.env.example`.
- Não commitar dados reais de voluntários, CPF, CNPJ, chave PIX de produção ou fotos de crianças e adolescentes.
