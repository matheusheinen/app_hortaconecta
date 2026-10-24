# Contribuições: metas em dinheiro e de materiais

Decisão da equipe em 05/10/2026. Contribuições usam **metas** (`metas_demandas`)
de dois tipos, **em dinheiro (PIX)** ou **de materiais**, e **contribuições**
(`contribuicoes`) conferidas pela gestão. É o modelo que já existia no banco e
foi evoluído no redesenho (27–29/09). As tabelas de solicitações de materiais
criadas em 24/09 duplicavam esse papel e são removidas (ver Histórico, abaixo).

**Requisitos e backlog ([DOCUMENTACAO.md](../../DOCUMENTACAO.md)):** RF0010 (B19, B20), RF0011
(B21, B22, B34), RF0012 (B23, B24), RF0015 (PIX no perfil da gestão, B30) e RNF0004.
Na branch `integracao/mvp` falta o upload de comprovante (B22); o restante aguarda a
reconciliação pendente e homologação.

## Fluxo

| Quem | Meta em dinheiro | Meta de materiais |
| --- | --- | --- |
| Gestão | Publica a meta com valor e prazo opcional | Publica a meta com quantidade, unidade e prazo opcional |
| Voluntário | Copia a chave PIX, transfere fora do app e informa o valor (PENDENTE) | Combina a entrega com a gestão, pelo WhatsApp se houver número cadastrado |
| Gestão | Confere no extrato, pela fila geral ("Fila de conferência", em Metas e doações) ou pela meta, e confirma ou recusa; recusar exige o motivo, que o voluntário vê. Decisão tomada não se desfaz | Registra a doação recebida, já APROVADA |

- O pagamento acontece **fora do app**. Não há integração bancária, PIX dinâmico
  nem conciliação automática. O comprovante em imagem é opcional (B22): JPEG, PNG ou WebP de até
  5 MiB (SVG não é aceito) no bucket privado `comprovantes`, em `{uid}/{uuid}.{ext}`; `url_comprovante`
  guarda o caminho. O voluntário lê só os próprios, a gestão lê todos, ninguém
  altera, e o dono só apaga arquivo ainda sem contribuição ligada. A gestão também
  pode anexar o comprovante ao registrar uma doação recebida; o doador o enxerga.
- A gestão pode registrar diretamente qualquer doação recebida, em dinheiro ou
  material, desde que o doador seja um voluntário cadastrado. O registro entra
  APROVADA, com `validado_por` e `validado_em` da gestão.
- `quantidade_arrecadada` é calculada pelo trigger `atualizar_arrecadacao_meta`,
  que soma só contribuições APROVADA em qualquer inserção, alteração ou exclusão.
  O app nunca grava esse total.
- Prazo vencido não encerra a meta: o app deixa de convidar a doar e a gestão
  decide quando encerrar. Metas podem ser encerradas, canceladas e reabertas.
  O app não exclui metas, para preservar o histórico de doações.
- O voluntário vê só as próprias contribuições; a gestão vê todas (RLS).
- O tipo da meta não muda depois de haver contribuições confirmadas.

## Banco

Tabelas e policies que já existem no remoto (migrations `20260914120000` e
`20260928010000_gestao_lanca_contribuicao`):

- `metas_demandas`: leitura para autenticados; inserção, alteração e exclusão só pela gestão.
- `contribuicoes`: o voluntário insere a própria como PENDENTE; a gestão insere
  APROVADA como validadora e confere (UPDATE) as pendentes.

Reconciliação `supabase/reconciliacao/20261005150000_contribuicoes_metas_pix.sql`,
**ainda não aplicada no Supabase remoto**:

1. Adiciona `chave_pix` e `nome_beneficiario_pix` em `configuracao_instituicao`.
   A policy `ongs_privacidade_mvp` impede voluntários de lerem `ongs`, então a
   chave precisa estar no registro público da instituição. Se houver exatamente
   uma chave em `ongs`, ela é copiada. `ongs.chave_pix` fica como legado.
2. Cria a policy restritiva `contribuicoes_meta_aberta`: o voluntário só declara
   contribuição em meta ABERTA. A gestão continua podendo registrar doações
   recebidas depois do encerramento.
3. **Exclui** `solicitacoes_materiais`, `contribuicoes_materiais` e as funções
   `materiais_*`, **com os dados** (decisão da equipe). Faça backup antes, se
   houver algo a guardar.

Aplicar pelo SQL Editor (ou MCP), depois das reconciliações 01 e 02. Não usar
`db push` sobre o histórico. A migration aborta se já tiver sido aplicada.
Depois, regenerar `src/servicos/database.types.ts` e remover o bloco `ColunasPix` de
`src/servicos/database.api.types.ts`. Até lá, a seção de PIX do perfil da gestão fica
indisponível e as metas em dinheiro avisam que a chave não foi cadastrada.

## App

- Aba **Contribuir** (voluntário) / **Doações** (gestão): `src/funcionalidades/metas/PilhaMetas.tsx`,
  telas em `src/funcionalidades/metas/telas/`, acesso a dados em `src/funcionalidades/metas/api.ts` e
  regras puras em `src/funcionalidades/metas/regras.ts`.
- Perfil da gestão: seção **Recebimento de doações (PIX)**.
- **Minhas contribuições** (voluntário, B33): lista as contribuições do voluntário
  com a situação da conferência em etiqueta colorida (aguardando, confirmada,
  recusada), a observação do revisor e o comprovante. As abas Todas, Em análise,
  Confirmadas e Recusadas filtram a lista e mostram a contagem de cada situação
  (`contarPorSituacao` e `filtrarPorSituacao` em `regras.ts`).
- Início do voluntário: "Precisamos de" mostra a meta aberta mais recente, ainda
  não atingida e dentro do prazo. O indicador de contribuições conta as APROVADA
  do voluntário.
- Testes: `tests/contribuicoes-metas.test.cjs` (reconciliação em PGlite sobre o
  catálogo remoto, dados fictícios), `tests/regras-metas.test.cjs` e
  `tests/resumo-inicio.test.cjs`.

**Pendente de validação:** aplicação remota da migration, fluxo completo com JWT
real entre voluntário e gestão e homologação em Android.

## Histórico — fluxo de solicitações de materiais (24/09/2026, removido em 05/10/2026)

O registro abaixo descreve a implementação anterior, que criou
`solicitacoes_materiais` e `contribuicoes_materiais` com RPCs próprias e tratou o
modelo de metas como legado financeiro. A equipe decidiu voltar ao modelo de
metas, que já estava em uso. O código do app foi removido; as migrations
históricas permanecem no repositório como registro.

### Prioridade 2 — Contribuição de materiais (registro original)

Implementação de 24/09/2026. **"Contribuição" significa entrega de materiais ou
itens físicos. Não significa contribuição financeira.** Não há campos monetários,
PIX, pagamentos ou comprovantes no novo fluxo. Diário, Oficinas e Certificados
não foram implementados.

#### Auditoria anterior à implementação

| Estrutura encontrada | Avaliação e decisão |
| --- | --- |
| TelaMetas / CartaoMeta | Listagem, cards, quantidades e ações administrativas servem como referência visual. A tela mistura reais, tipo FINANCEIRA e cópia de PIX; permanece no repositório, desconectada das abas. |
| TelaFormMeta | Já tinha título, descrição, quantidade e unidade. Também seleciona FINANCEIRA por padrão e grava diretamente no banco. Preservada; o novo formulário reutiliza Campo/Botao e o padrão visual, mas grava via RPC. |
| PilhaMetas | Estrutura de stack reutilizada como padrão. O novo stack usa IDs, buscando detalhes atualizados; o stack antigo permanece sem ligação às abas. |
| metas_demandas | Mistura MATERIAL/FINANCEIRA, não identifica responsável pela criação e usa quantidade_arrecadada. Adaptar mantendo convivência segura exigiria regras condicionais com o legado financeiro. |
| contribuicoes | Exige url_comprovante NOT NULL, status_validacao e validado_por até para estados finais. Não representa cancelamento pelo contribuinte e está ligada ao trigger financeiro. |
| atualizar_arrecadacao_meta | Atualiza acumulado em mudanças de validação sem o limite transacional exigido para materiais. Não foi reaproveitado nem alterado. |
| RLS antiga | Metas: leitura por autenticados, CRUD gestão via e_ong. Contribuições: leitura própria/gestão, inserção própria PENDENTE, validação/exclusão gestão. Não deve governar o novo fluxo. |
| useOng / useConfiguracaoInstituicao | Primeiro fornece PIX à tela antiga; não é usado pelo fluxo novo. Configuração institucional continua servindo as telas iniciais. Não há hook de contribuições materiais existente. |
| tipos.ts / database.types.ts | Mantêm contratos financeiros antigos. Não foram reinterpretados ou apresentados como tipos remotos atualizados. |
| Ui, tema, TelaFluxoVoluntariado, CartaoFluxo, useDadosVoluntariado | Reutilizados diretamente: campos, botões, cards, loading, erros, atualização ao foco e descarte de respostas antigas. Nomes históricos dos componentes não exigem reescrita. |

Decisão: duas tabelas novas, exclusivamente físicas, sem converter/copiar/apagar
dados de metas antigas. A aba interna mantém a chave "metas" para minimizar
mudanças, mas exibe **Contribuir** para voluntários e **Materiais** para gestão.
Se existirem metas antigas do tipo MATERIAL, sua migração exige inventário e
conferência de unidades, autor e recebimentos; elas não aparecem automaticamente.

#### Regras de negócio implementadas

- Quantidades inteiras de 1 a 1.000.000, em **unidades**. Pacotes, caixas ou kits
  devem ser descritos claramente como unidade do item. Não há frações/kg/litros
  nesta etapa. Validar essa escolha operacional com a instituição.
- Necessário, recebido e restante são exibidos; restante = necessário - recebido.
- Recebido começa em zero e só aumenta pela confirmação de uma entrega pela gestão.
  Não há edição manual do recebido, entrada retroativa ou importação automática.
- Registrar intenção cria PENDENTE. Intenções não reservam quantidade; a soma das
  pendentes pode exceder o restante. Cada intenção individual deve caber no
  restante no momento do cadastro e novamente no momento da confirmação.
- Só uma intenção PENDENTE por usuário/material (índice único parcial). Após
  cancelar ou receber, pode-se registrar outra, se a solicitação continuar aberta.
- O botão "Quero contribuir" confirma a quantidade informada. Minhas contribuições
  mostra material, quantidade, estado, criação, decisão e observação.
- Somente ONG confirma a entrega de outro usuário. O app pede confirmação da gestão
  e o servidor verifica autorização independentemente do diálogo.
- Se uma entrega inteira não couber mais, a confirmação falha e nada é alterado.
  Cancelar a intenção e registrar outra com a quantidade correta. Não há recebimento
  parcial nem ajuste silencioso da quantidade.
- Voluntário cancela somente sua intenção PENDENTE; gestão também pode cancelar
  pendentes. CONFIRMADA e CANCELADA são finais, sem estorno nesta etapa.
- Solicitação nasce ABERTA. Gestão pode marcar EM_ANDAMENTO; uma entrega parcial
  também faz isso. Ao receber exatamente o necessário, vira CONCLUIDA automaticamente
  e as outras intenções pendentes são canceladas com observação.
- Gestão pode cancelar ABERTA/EM_ANDAMENTO. Pendentes são canceladas na mesma
  transação, mas entregas confirmadas e recebido são preservados.
- Edição permitida só em ABERTA/EM_ANDAMENTO; necessário deve continuar maior que
  recebido. Não se conclui artificialmente uma solicitação reduzindo sua quantidade.
  CONCLUIDA/CANCELADA não reabrem. Não há exclusão física: usa-se cancelamento.
- Descrição pode conter orientações de entrega, sem novo módulo de contato.
  Não há WhatsApp, notificações ou agendamento automático.

#### Banco, segurança e dependências

Migration nova: 20260924140000_contribuicao_materiais.sql.
Aplicar depois das migrations existentes, incluindo as duas da Prioridade 1.
Nenhuma migration histórica foi editada.

- solicitacoes_materiais: id (bigint identity/PK), nome, descricao,
  quantidade_necessaria, quantidade_recebida, status, criado_em, atualizado_em,
  criado_por (FK usuarios, RESTRICT).
- contribuicoes_materiais: id (bigint identity/PK), solicitacao_id (FK RESTRICT),
  usuario_id (FK usuarios RESTRICT), quantidade, status, criado_em, decidido_em,
  decidido_por (FK usuarios RESTRICT), observacao.
- CHECKs: limites de quantidades, recebido entre zero e necessário, conclusão
  equivalente ao recebimento integral, estados válidos, nome/descrição limitados
  e coerência de auditoria da contribuição.
- Índices: status/data de solicitação, usuário/data e solicitação/data de
  contribuição; único parcial para uma intenção pendente por usuário/material.
- Não há trigger novo. O acumulado é atualizado junto à contribuição na mesma
  transação da RPC. Todas as mutações de um material bloqueiam primeiro a
  solicitação; decisão bloqueia a contribuição em seguida. UPDATE do acumulado
  disputa a mesma versão da linha: concorrência serializa ou falha com 40001.
- Nenhum grant direto de escrita/DELETE/TRUNCATE, nem acesso às sequências para
  anon/authenticated/PUBLIC. SELECT apenas para authenticated. RLS habilitado
  nas duas tabelas; policies restritivas bloqueiam INSERT/UPDATE/DELETE mesmo
  diante de grants/permissões de escrita posteriores.
- Leitura: gestão vê tudo; usuário vê solicitações ABERTA/EM_ANDAMENTO e antigas
  em que contribuiu. Contribuições são visíveis apenas ao titular ou gestão.
- RPCs: materiais_salvar, materiais_contribuir, materiais_decidir,
  materiais_status, materiais_listar, materiais_detalhe, materiais_minhas.
  EXECUTE concedido apenas a authenticated, search_path vazio.
- Mutação e detalhe são SECURITY DEFINER, com autorização explícita por auth.uid().
  Detalhe retorna somente contribuições próprias ou todas para gestão, com nome
  do contribuinte, sem CPF/endereço/telefone. Listagem e minhas usam SECURITY
  INVOKER e mantêm RLS. Não há parâmetro usuario_id vindo do aplicativo.
- Reutiliza usuarios e voluntariado_privado.gestao() da Prioridade 1. As contas ONG
  continuam representando gestão única da instituição, sem modelo multitenant.
- materiais.types.ts estende os contratos locais das RPCs; não afirma ser geração
  do Supabase remoto. O app usa RPCs para o novo fluxo, sem escrita direta nas tabelas.

**Antes da aplicação remota:** conferir schema inicial, auth.uid(), roles,
propriedade das tabelas/funções e provisionamento seguro de ONG; usuários
autenticados precisam ler seu próprio registro em usuarios. As garantias dependem
de tipo_perfil protegido e de ausência de outras funções privilegiadas remotas
que contornem autorização. Conferir objetos de mesmo nome e migrations já
aplicadas; não usar DROP ou recriar o banco para resolver diferenças.

As novas FKs usam RESTRICT para preservar histórico: exclusão administrativa de
usuários com contribuições exigirá decisão de retenção/anonimização futura.
Nenhum dado real foi alterado ou apagado.

#### Validações executadas

Revisão de preparação em 24/09/2026. A migration de materiais foi executada
depois das migrations da Prioridade 1 na fixture; nenhuma correção SQL foi
necessária. As seis migrations existentes foram preservadas byte a byte.

### Testes automatizados

- TypeScript: node node_modules/typescript/bin/tsc --noEmit, sem erros.
- node --test tests/*.test.cjs: **27 testes/subtestes aprovados**, incluindo
  regressões da Prioridade 1 e testes de materiais.
- Todas as migrations executadas em PGlite sobre a fixture fictícia:
  criação, autorização, pendência/duplicidade, privacidade, confirmação,
  limite de quantidade e rollback, cancelamento, conclusão, edição, grants/RLS.
- Regras TypeScript reais de quantidade testadas no Node.
- Catálogo conferido: três colunas de quantidade integer, quatro FKs e seis
  índices (incluindo PKs), RLS ativo e ausência de TRUNCATE para authenticated.
  Parâmetros fracionários/NaN/infinito rejeitados pelas RPCs em PostgreSQL.
- Recebido 8 de 10 não aceita confirmação de 5; confirmação de 2 conclui.
  CANCELADA não confirma; solicitações CANCELADA/CONCLUIDA não recebem intenções.
- Consultas e decisões testadas também com usuarios limitado por RLS ao próprio
  usuário; detalhes de gestão revelam o nome, sem campos pessoais adicionais.
- Chamadas iniciadas com Promise.allSettled ao PGlite não excederam quantidade
  nem duplicaram confirmação. **É uma conexão com fila interna**, não um teste
  de locks, isolamento ou concorrência de sessões PostgreSQL independentes.
- Bundle JavaScript Android via expo export --platform android --no-bytecode:
  concluído, com URL/chave Supabase fictícias.
- git diff --check aprovado; comparação SHA-256 das seis migrations sem alterações.

### Validação estática

- Revisão estática: rotas registradas por perfil, IDs, imports, chamadas de RPC,
  estados de loading/vazio/erro, recarga após ações. Nenhuma biblioteca adicionada.
- TypeScript usa number; a restrição a inteiros é validada em tempo de execução
  por quantidadeMaterial nos dois formulários, pelos argumentos integer das RPCs
  e pelos tipos/constraints das tabelas. O teclado numérico não é a proteção.
- Fluxo atual: detalhes mostram o campo de quantidade; tocar "Quero contribuir"
  envia a intenção. Gestão confirma recebimento em diálogo explícito. Não há
  uma tela intermediária adicional de confirmação do voluntário.
- Corrigida navegação tardia: uma resposta de salvamento após desmontar o
  formulário não executa outro voltar(). A transação pode ter concluído no banco;
  a listagem deve ser recarregada. Correção revisada estaticamente, sem teste UI.
- Troca de conta: useSessao limpa o perfil e App desmonta a navegação durante
  a transição. O comportamento no Android ainda deve ser homologado.

### Dependências do Supabase remoto

Conferir schema inicial, provisionamento de gestão e permissões conforme seção
de implantação. Executar API/JWT reais e duas confirmações com transações em
conexões independentes. Não foram encontrados postgres/pg_ctl/initdb ou Docker
no PATH, nem instalação no diretório padrão de PostgreSQL desta máquina.

### Testes pendentes no Android

Build nativo, teclado/rolagem, diálogos, retorno das telas, troca de usuário,
falhas de rede, salvamento seguido de saída imediata e fluxo completo entre
voluntário e gestão. **Não foi confirmado funcionamento ponta a ponta em dispositivo.**

**Não validado:** Supabase remoto, API/JWT reais, schema inicial ausente,
concorrência em duas conexões PostgreSQL independentes, APK/build nativo,
renderização/interações em Android ou teste ponta a ponta. PGlite não comprova
compatibilidade remota nem concorrência real.

#### Homologação manual

1. Conferir pré-requisitos e aplicar a migration em homologação. Configurar URL
   e chave pública; usar uma gestão e dois voluntários fictícios.
2. Gestão: criar "Bolsa esportiva", necessário 10; editar descrição e confirmar
   persistência ao sair/voltar. Zero, negativo e quantidade fracionária devem falhar.
3. A: abrir Contribuir, detalhes, informar 8 e tocar Quero contribuir. Deve aparecer
   PENDENTE em Minhas contribuições e recebido deve continuar zero.
4. B: registrar 5. Gestão confirma as 8 de A: recebido 8, restante 2. Confirmar
   as 5 de B deve falhar sem mudar estado ou acumulado.
5. B cancela; registra 2; gestão confirma. Recebido 10, restante zero e CONCLUIDA.
   Repetir confirmação deve falhar. Verificar encerramento de outras pendências.
6. Outra solicitação: cancelar intenção própria, tentar cancelar alheia e tentar
   confirmar como voluntário. Só a primeira operação é autorizada.
7. Cancelar solicitação com entregas parciais e intenções pendentes: preservar
   recebido e confirmadas, cancelar pendentes e bloquear novos cadastros.
8. Executar INSERT/UPDATE/DELETE direto com JWT voluntário e gestão: bloqueados.
   Consultar contribuições alheias como voluntário: nenhuma linha deve vazar.
   Testar listagem/detalhe de cancelada sem contribuição própria.
9. Duas sessões de gestão confirmam simultaneamente entregas que somadas excedem
   necessário: somente uma deve confirmar; a outra falha ou pede atualização.
   Repetir com transações em conexões independentes e editar quantidade em paralelo.
10. Android: validar teclado, rolagem, botões, diálogos, retorno ao detalhe/listagem,
    troca de conta, falhas de rede e recarga. Resposta perdida pode ter sido
    confirmada no servidor: recarregar antes de repetir.
11. Conferir que a aba atual abre materiais e não oferece a tela financeira antiga.

#### Legado preservado e limpeza futura

### Ainda utilizado

- AbasPrincipais importa TelaPerfilOng: seus campos chave_pix e
  nome_beneficiario_pix continuam sendo lidos, exibidos e salvos em ongs.
- TelaInicioOng/TelaInicioVoluntario continuam exibindo textos de comprovantes
  nos cartões de desenvolvimento. CLAUDE.md mantém referências históricas,
  agora identificadas como obsoletas no aviso inicial.
- database.types.ts participa dos contratos do cliente Supabase e ainda declara
  tabelas/campos/enums antigos; essas declarações não significam uso de suas APIs.
- Migrations e testes locais ainda criam as tabelas e o trigger financeiro.
  O trigger continua vinculado a UPDATE de contribuicoes no DDL. Sua utilização
  por clientes externos e seu estado remoto não foram inspecionados.

### Não utilizado pelo fluxo atual navegável

- PilhaMetas não tem importador ativo. Ela referencia TelaMetas/TelaFormMeta;
  TelaMetas referencia useOng, expo-clipboard e rotuloStatusMeta. Essa cadeia
  permanece no código, mas não é alcançada a partir de App/AbasPrincipais.
- TipoMeta, StatusMeta e Meta são usados nessa cadeia legada; MetaFormulario
  não tem consumidor identificado. Nenhum deles governa materiais novos.
- Não há chamadas atuais a contribuicoes financeiras no frontend. Chamadas
  a metas_demandas estão restritas às duas telas antigas desconectadas.

### Pode ser removido futuramente

Após autorização e nova verificação de dependências: PilhaMetas, TelaMetas,
TelaFormMeta, useOng, expo-clipboard, tipos/rotuladores exclusivos desse fluxo
e textos financeiros obsoletos. Nada foi removido nesta validação.

### Precisa de decisão antes de remover

Campos PIX ainda editáveis no perfil, tabelas/dados/enums antigos, políticas,
trigger financeiro e contratos gerados: inventariar consumidores externos,
reter/exportar dados conforme decisão da instituição e definir destino de metas
MATERIAL legadas. As migrations históricas devem permanecer, inclusive após
eventual desativação futura por migration incremental. A habilidade
"Administração e financeiro" é um item de competências, não um fluxo de pagamento.

Permanecem PilhaMetas, TelaMetas, TelaFormMeta, tipos financeiros,
metas_demandas, contribuicoes, trigger atualizar_arrecadacao_meta,
políticas históricas, useOng, campos PIX de ongs/TelaPerfilOng e dependência
expo-clipboard. O stack financeiro não é mais importado pelas abas atuais.
O perfil da gestão ainda expõe os campos PIX antigos: não foi alterado por
estar fora da substituição do fluxo de Metas autorizada nesta etapa.

Também permanecem frases antigas de comprovantes nos cartões "Em desenvolvimento"
das telas iniciais e trechos históricos do CLAUDE.md. Não são funcionalidades do
modelo novo; sua remoção foi adiada conforme a orientação de não fazer limpeza
automática do legado.

Candidatos a remoção futura: stack/telas de metas antigas e expo-clipboard após
busca de dependências; campos/formulários PIX e textos obsoletos após revisão de
escopo; banco financeiro somente após inventário de dados, backup e autorização
específica. Não excluir migrations históricas. Não avançar automaticamente para
a Prioridade 3.
