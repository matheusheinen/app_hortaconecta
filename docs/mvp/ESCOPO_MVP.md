# Escopo do MVP

Decisão da equipe em 05/10/2026, após a comparação entre a versão de redesenho
(commits locais de 27–29/09) e a versão integrada ao Supabase (`origin/main`,
PRs #1 e #2). A primeira documentação não deixava claro o que compunha o MVP;
este documento passa a ser a referência de escopo. Requisitos (RF/RNF), backlog
(B01–B34) e cronograma estão no [DOCUMENTACAO.md](../../DOCUMENTACAO.md); a situação oficial
de cada item é a registrada lá. Os relatórios em `docs/mvp/` continuam como
registro histórico de cada implementação.

## Base de integração

O código de `origin/main` é a base, porque o banco remoto já segue seu contrato
(RPCs, RLS e reconciliações de 30/09). Funcionalidades do redesenho são trazidas
por cima, adaptadas às RPCs, na branch `integracao/mvp`. O estilo visual é o atual
de `origin/main`: o posicionamento pode mudar e elementos faltantes podem ser
adicionados.

## Dentro do MVP

| Área | Conteúdo | Requisitos | Backlog | Referência |
| --- | --- | --- | --- | --- |
| Autenticação e acesso | Cadastro simples, sessão persistida, navegação por perfil | RF0001, RF0003, RNF0011 | B01–B05, B09 | [VOLUNTARIADO.md](VOLUNTARIADO.md), [CORRECOES_MVP.md](CORRECOES_MVP.md) |
| Perfil do voluntário | Hub em seções: dados pessoais, cadastro, endereço com ViaCEP, disponibilidade e habilidades; elegibilidade calculada pelo banco | RF0002, RF0003 | B06–B09, B31 | [VOLUNTARIADO.md](VOLUNTARIADO.md) |
| Tarefas e candidatura | Publicação pela gestão com áreas, lista e detalhe, candidatura com vagas, "Minhas candidaturas" | RF0004, RF0005 | B10–B14 | [VOLUNTARIADO.md](VOLUNTARIADO.md) |
| Triagem e presença | Aprovação/recusa com motivo; check-in por QR | RF0007 | B16, B17 | [VOLUNTARIADO.md](VOLUNTARIADO.md) |
| Histórico | Participações com carga **prevista** registrada no check-in | RF0008 | B33 | [VOLUNTARIADO.md](VOLUNTARIADO.md) |
| Contato | WhatsApp da instituição no detalhe da atividade e da meta | RF0009 | B18 | Abaixo |
| Contribuições (apadrinhamento) | Metas em dinheiro (PIX) e de materiais; voluntário informa a doação e a gestão confere, ou a gestão registra o que recebeu | RF0010, RF0011, RF0012, RNF0004 | B19–B24, B34 | [CONTRIBUICOES.md](CONTRIBUICOES.md) |
| Diário de Transparência | Publicações com revisão e imagens privadas | RF0013, RNF0003 | B25, B26 | [DIARIO.md](DIARIO.md) |
| Dados da instituição | Perfil da gestão em seções (conta, institucional, WhatsApp, PIX); textos e contatos de `configuracao_instituicao` | RF0015, RNF0008 | B28, B30 | Abaixo |
| Sugestões no Início | Tarefas que cabem na disponibilidade e nas áreas do voluntário | RF0005 | — | Abaixo |

## Funcionalidades trazidas do redesenho

Adaptadas ao contrato atual do banco. Só o PIX da instituição depende de migration
nova (ver Pendências).

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

| Recurso | Requisitos / backlog | Situação |
| --- | --- | --- |
| Propostas de oficinas | RF0006, B15 (e oficinas no B16) | Implementado em 24/09 ([OFICINAS.md](OFICINAS.md)). Oculto no app; código, testes, tabela e RPCs preservados. O cronograma ainda prevê B15 na Sprint 3: a equipe precisa conciliar. |
| Certificados de participação | Complemento do RF0008 | Implementado em 24/09 ([CERTIFICADOS.md](CERTIFICADOS.md)). Oculto no app; código, testes, tabela e RPCs preservados. PDF fora de escopo. |
| Solicitações de materiais (24/09) | — | Removidas: duplicavam metas/contribuições. Ver histórico em [CONTRIBUICOES.md](CONTRIBUICOES.md). |

A ocultação é feita por `src/compartilhado/escopoMvp.ts` (`recursosPosMvp`). Com a flag em
`false`, as rotas não são registradas e os atalhos das telas de Início não
aparecem. O banco não foi alterado. Para reativar um recurso, basta mudar a
flag para `true` e revisar os textos de interface.

As horas exibidas no Início continuam sendo a carga **prevista** registrada no
check-in. Sem certificados, o indicador leva ao histórico de participação.

O tipo legado `OFICINA_AUTORAL` em `atividades` continua no banco e ainda pode
aparecer no Início, com o rótulo "Oficina", caso exista uma atividade desse tipo.

## Pendências do MVP (05/10/2026)

| Pendência | Backlog | Detalhe |
| --- | --- | --- |
| Aplicar a reconciliação `20261005150000_contribuicoes_metas_pix.sql` | B21, B30 | Move o PIX para `configuracao_instituicao`, exige meta aberta para o voluntário e exclui as tabelas de materiais. Depois, regenerar `database.types.ts` e remover o bloco `ColunasPix`. Ver [CONTRIBUICOES.md](CONTRIBUICOES.md). |
| Upload de comprovante | B22 | Código pronto: anexo opcional (JPEG, PNG ou WebP, até 5 MiB) em bucket privado `comprovantes`, visto pela gestão na fila de conferência. Migration `20261023170000_comprovantes_storage.sql` aplicada em 23/10/2026. |
| Compressão local de imagens | B27 (RNF0005) | `expo-image-manipulator` ainda não está instalado; o Diário envia a imagem com `quality: 0.8`, sem redimensionar. |
| Restrição de imagens de menores | B26 (RNF0003) | O feed mostra só publicações PUBLICADA; não há regra específica para imagens de crianças e adolescentes. |
| Parametrização da instituição | B28 (RF0015) | Não há tela para editar nome, textos, cores e logo de `configuracao_instituicao`; só WhatsApp e PIX pelo perfil da gestão. |
| Compartilhamento | B18 (RF0009) | WhatsApp pronto; compartilhamento de conteúdo não implementado. |
| Foto do usuário | B31 (RF0002) | Implementada e com reconciliação aplicada em 21/10; funções e permissões verificadas. Homologação de seleção/envio em aparelho pendente. Ver [FOTO_PERFIL.md](FOTO_PERFIL.md). |
| Histórico e mensagem de impacto | B32 (RF0008) | Pronto: histórico com total de horas previstas acumuladas e mensagem de impacto no check-in e em cada participação (texto fixo no app, sem migration). |
| Apresentação da instituição | B32 (RF0016) | Não implementada. |
| Notificações | B29 (RF0014) | Notificações dentro do app: tabela `notificacoes` (RLS), gatilhos nos fluxos de voluntariado e contribuições, sino no Início e aviso do sistema com o app aberto, em tempo real pelo Supabase Realtime. Cada notificação leva ao lugar certo (gestão: lista de candidatos ou fila de conferência; voluntário: atividade ou Minhas contribuições) e o Voltar retorna à lista de notificações. Migration `20261026130000_notificacoes.sql` **aplicada em 26/10/2026** (5 gatilhos e Realtime conferidos); `20261026140000_notificacoes_cancelamento_pendentes.sql` (atividade cancelada avisa também candidatura pendente) **aplicada em 26/10/2026**. Push com o app fechado (01/11/2026): fila de entregas por canal, preferências no Perfil e Edge Functions `notificacoes-despachar`/`notificacoes-recibos` com Expo Push, em `20261101120000_notificacoes_entregues.sql`, **não aplicada**. Falta aplicar com `dispositivos_push`, fazer o deploy, configurar o FCM e ligar `EXPO_PUBLIC_PUSH_REMOTO`. E-mail e WhatsApp têm a estrutura pronta, mas os canais estão desligados. Ver [NOTIFICACOES.md](NOTIFICACOES.md). |
| Homologação | — | Android, login/JWT reais, Storage real, concorrência entre conexões independentes. |
| Dependências | — | `npm audit` aponta 30 vulnerabilidades (19 altas), ainda não avaliadas. |
| Política de `contribuicoes` | B23 (RNF0007) | A gestão pode alterar a quantidade de uma contribuição já aprovada (policy de UPDATE herdada). Avaliar se deve ser travado. |
