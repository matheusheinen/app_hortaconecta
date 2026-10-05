# Escopo do MVP

Decisão da equipe em 05/10/2026, após a comparação entre a versão de redesenho
(commits locais de 27–29/09) e a versão integrada ao Supabase (`origin/main`,
PRs #1 e #2). A primeira documentação não deixava claro o que compunha o MVP;
este documento passa a ser a referência. Os relatórios em `docs/mvp/` continuam
como registro histórico de cada implementação.

## Base de integração

O código de `origin/main` é a base, porque o banco remoto já segue seu contrato
(RPCs, RLS e reconciliações de 30/09). Funcionalidades do redesenho são trazidas
por cima, adaptadas às RPCs. O estilo visual é o atual de `origin/main`: o
posicionamento pode mudar e elementos faltantes podem ser adicionados.

## Dentro do MVP

| Área | Conteúdo | Referência |
| --- | --- | --- |
| Autenticação e perfil progressivo | Cadastro simples, perfil completo verificado pelo banco | [VOLUNTARIADO.md](VOLUNTARIADO.md) |
| Voluntariado | Tarefas da gestão, candidatura, triagem, check-in por QR e histórico | [VOLUNTARIADO.md](VOLUNTARIADO.md) |
| Contribuição de materiais | Solicitações da gestão e intenções de entrega confirmadas no recebimento | [MATERIAIS.md](MATERIAIS.md) |
| Lançamento de doação pela gestão | A gestão registra uma entrega recebida em mãos | A especificar |
| Diário de Transparência | Publicações com revisão e imagens privadas | [DIARIO.md](DIARIO.md) |
| Parametrização da instituição | Nome, textos e contatos de `configuracao_instituicao` | CLAUDE.md |

## Fora do MVP por enquanto

| Recurso | Situação |
| --- | --- |
| Propostas de oficinas | Implementado em 24/09 ([OFICINAS.md](OFICINAS.md)). Oculto no app; código, testes, tabela e RPCs preservados. |
| Certificados de participação | Implementado em 24/09 ([CERTIFICADOS.md](CERTIFICADOS.md)). Oculto no app; código, testes, tabela e RPCs preservados. |
| PIX, comprovantes e metas financeiras | Legado; ver seção de legado em [MATERIAIS.md](MATERIAIS.md). |

A ocultação é feita por `src/lib/escopoMvp.ts` (`recursosPosMvp`). Com a flag em
`false`, as rotas não são registradas e os atalhos das telas de Início não
aparecem. O banco não foi alterado. Para reativar um recurso, basta mudar a
flag para `true` e revisar os textos de interface.

As horas exibidas no Início continuam sendo a carga **prevista** registrada no
check-in. Sem certificados, o indicador leva ao histórico de participação.

O tipo legado `OFICINA_AUTORAL` em `atividades` continua no banco e ainda pode
aparecer no Início, com o rótulo "Oficina", caso exista uma atividade desse tipo.
