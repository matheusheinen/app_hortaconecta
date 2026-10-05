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
| Contribuições (apadrinhamento) | Metas em dinheiro (PIX) e de materiais; voluntário informa a doação e a gestão confere, ou a gestão registra o que recebeu | [CONTRIBUICOES.md](CONTRIBUICOES.md) (migration pendente no remoto) |
| Diário de Transparência | Publicações com revisão e imagens privadas | [DIARIO.md](DIARIO.md) |
| Parametrização da instituição | Nome, textos e contatos de `configuracao_instituicao` | CLAUDE.md |
| Perfil em seções | Hub com status por seção; voluntário com busca de CEP (ViaCEP) | Abaixo |
| Contato por WhatsApp | Botão no detalhe da atividade, número de `configuracao_instituicao.whatsapp` | Abaixo |
| Áreas da atividade e sugestões | Gestão marca habilidades da tarefa; o Início sugere tarefas compatíveis | Abaixo |

## Funcionalidades trazidas do redesenho

Adaptadas ao contrato atual do banco, sem migration nova.

- **Perfil em seções.** Voluntário: dados pessoais, cadastro, endereço,
  disponibilidade e habilidades. Cada seção envia só suas chaves para
  `voluntariado_salvar_perfil` (que preserva as omitidas) e sempre reenvia as
  habilidades atuais, porque a RPC substitui esse conjunto. A elegibilidade
  exibida vem do banco. Gestão: conta e dados institucionais, por
  `gestao_salvar_perfil`; WhatsApp e PIX, no registro da instituição.
- **CEP.** Consulta ao ViaCEP (público, sem chave) quando o CEP tem 8 dígitos.
  CEP inexistente ou falha de rede mantêm o preenchimento manual.
- **WhatsApp.** A RLS `ongs_privacidade_mvp` impede voluntários de lerem `ongs`,
  então o número vem de `configuracao_instituicao.whatsapp`, que é público. A
  seção "WhatsApp para voluntários" grava nesse registro (policy "só a gestão
  atualiza"). Sem número cadastrado, o botão não aparece.
- **Áreas e sugestões.** O formulário de tarefa grava `atividade_habilidades`
  (policy da migration `20260927230000_areas_da_atividade`, já aplicada no
  remoto). A sugestão exige que a tarefa caiba na disponibilidade do
  voluntário; quando a tarefa tem área, a categoria precisa coincidir com a de
  alguma habilidade dele. Não sugere tarefas lotadas, passadas ou já pedidas.
  **É recomendação, não matching:** ninguém é inscrito ou escalado
  automaticamente.

## Fora do MVP por enquanto

| Recurso | Situação |
| --- | --- |
| Propostas de oficinas | Implementado em 24/09 ([OFICINAS.md](OFICINAS.md)). Oculto no app; código, testes, tabela e RPCs preservados. |
| Certificados de participação | Implementado em 24/09 ([CERTIFICADOS.md](CERTIFICADOS.md)). Oculto no app; código, testes, tabela e RPCs preservados. |
| Comprovante de doação em imagem | Planejado (B09). Por ora o voluntário informa o valor e a gestão confere no extrato. |
| Solicitações de materiais (24/09) | Removidas: duplicavam metas/contribuições. Ver histórico em [CONTRIBUICOES.md](CONTRIBUICOES.md). |

A ocultação é feita por `src/lib/escopoMvp.ts` (`recursosPosMvp`). Com a flag em
`false`, as rotas não são registradas e os atalhos das telas de Início não
aparecem. O banco não foi alterado. Para reativar um recurso, basta mudar a
flag para `true` e revisar os textos de interface.

As horas exibidas no Início continuam sendo a carga **prevista** registrada no
check-in. Sem certificados, o indicador leva ao histórico de participação.

O tipo legado `OFICINA_AUTORAL` em `atividades` continua no banco e ainda pode
aparecer no Início, com o rótulo "Oficina", caso exista uma atividade desse tipo.
