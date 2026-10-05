# Prioridade 1 — Voluntariado

> **Situação em 05/10/2026.** Fluxo **dentro do MVP** ([ESCOPO_MVP.md](ESCOPO_MVP.md)).
> - **Requisitos e backlog ([CLAUDE.md](../../CLAUDE.md)):** RF0001–RF0005, RF0007, RF0008, RF0009; B01–B14, B16, B17, B18 (WhatsApp), B31 (perfil), B33 (histórico).
> - **Banco:** o contrato descrito aqui está no Supabase remoto desde 30/09, instalado pela
>   [reconciliação 02](../../supabase/reconciliacao/20260930141047_reconciliacao_02_fluxos_mvp.sql)
>   (derivada destas migrations). As migrations `20260923120000` e `20260924120000` **não** são
>   aplicadas no remoto; ficam como histórico. Ver [COMPATIBILIDADE](../reconciliacao/COMPATIBILIDADE_SUPABASE_20260930.md).
> - **Regras que mudaram depois deste registro:** a elegibilidade também exige logradouro,
>   número e cidade (endereço estruturado em `voluntarios`); só candidaturas APROVADA ocupam vaga.
> - **App:** o perfil virou um hub com cinco seções que salvam pela mesma RPC
>   `voluntariado_salvar_perfil`, com busca de CEP pelo ViaCEP. O detalhe da atividade tem
>   o botão de WhatsApp da gestão (`configuracao_instituicao.whatsapp`). A gestão marca áreas
>   da tarefa (`atividade_habilidades`), e o Início sugere tarefas por disponibilidade e área.
> - **Pendente:** homologação em Android e com JWT real; concorrência entre conexões independentes.
>
> As seções abaixo preservam o registro de 23–24/09; contagens de testes e estados de
> implantação citados nelas são daquela data.

> Correção integrada: após qualquer candidatura, os campos históricos da atividade
> ficam imutáveis por trigger. Descrição e vagas mantêm edição nas regras existentes.
> Ver [CORRECOES_MVP.md](CORRECOES_MVP.md) e [SEGURANCA_BASE.md](../auditoria/SEGURANCA_BASE.md).

Implementação de 23/09/2026. Escopo: perfil, atividades, detalhes, candidatura,
triagem, participação, check-in e histórico. Materiais, PIX, Diário, propostas
de oficinas, certificados, WhatsApp e notificações não foram alterados nesta etapa.

## Estado e dependências de implantação

*(Registro de 24/09. Em 30/09 o contrato foi instalado pela reconciliação 02; não
aplicar estas migrations no remoto.)* A migration `20260923120000_fluxo_voluntariado.sql`
e a correção complementar `20260924120000_valida_seguranca_voluntariado.sql` **não foram
aplicadas ao Supabase remoto**. Aplicar nessa ordem, após os pré-requisitos abaixo. As telas dependem
da primeira, e a restrição de leitura depende também da segunda; uma RPC ausente
produz mensagem de servidor desatualizado. Não implantar somente o app.

O repositório não contém o DDL inicial de `usuarios`, `voluntarios`, `atividades`
e respectivos enums, políticas e triggers. Antes de aplicar em homologação:

1. Conferir as tabelas/colunas de `src/lib/database.types.ts`, os enums
   `status_inscricao`, `status_atividade` e as três migrations históricas.
2. Confirmar `auth.uid()`, PostgreSQL com `gen_random_uuid()`, `sha256(bytea)`
   e `convert_to(text,text)`. Não é necessária extensão pgcrypto para essas funções.
3. Aplicar como proprietário das tabelas, normalmente `postgres` no Supabase,
   para que as RPCs SECURITY DEFINER tenham o comportamento esperado. Verificar
   ownership, FORCE RLS, grants e triggers remotos adicionais antes da aplicação.
4. Conferir que a sessão autenticada pode ler seu usuário, seu voluntário,
   habilidades e suas associações; gestão pode criar/editar/ler tarefas e
   voluntários podem listar atividades publicadas. Essas políticas iniciais
   continuam dependendo do schema remoto ausente; não foram reconstruídas.
5. Confirmar o trigger de cadastro: `usuarios` e `voluntarios` devem existir
   para a conta. A RPC de perfil recusa ausência da linha complementar e desfaz
   a transação, em vez de fabricar um cadastro possivelmente incompatível.
6. Conferir que cadastro público não permite criação de gestão por metadados ou
   INSERT direto em `usuarios`. A nova proteção impede UPDATE de `tipo_perfil`
   e `id` por sessões autenticadas, mas o provisionamento inicial é remoto.
7. Inventariar RPCs privilegiadas preexistentes que escrevam inscrições. As novas
   policies bloqueiam writes diretos de `anon`/`authenticated`, inclusive sob
   policies permissivas antigas, mas não neutralizam funções SECURITY DEFINER
   desconhecidas nem credenciais administrativas.
8. Conferir inscrições legadas: aprovações/presenças antigas são preservadas e
   não passam a ter evidências retroativas. Avaliar capacidade já excedida antes
   da migração; os testes não auditam dados de produção.

Não executar a fixture de testes no Supabase. Não editar migrations históricas.
O arquivo `voluntariado.types.ts` declara o contrato local da nova migration;
`database.types.ts` continua sendo o retrato gerado anteriormente. Regenerar e
integrar os tipos somente depois de conferir/aplicar o schema remoto.

## Fluxos e regras implementadas

- O perfil usa uma RPC única: usuário, complementos e habilidades são salvos
  na mesma transação. Qualquer erro desfaz tudo. Disponibilidade é um array de
  objetos `{dia, periodo}` com dias/períodos válidos e sem repetição. Array vazio
  é aceito como cadastro incompleto. Formato legado incompatível bloqueia o
  salvamento e solicita suporte, sem converter ou apagar dados automaticamente.
- A elegibilidade exige perfil VOLUNTARIO, CPF preenchido, nascimento no
  passado, profissão, disponibilidade válida não vazia e alguma habilidade.
  *(Desde 30/09 também logradouro, número e cidade.)*
  O app valida CPF pelo dígito verificador; o servidor valida formato e conserva
  as constraints existentes. A verificação é recalculada após salvar e ao voltar
  às telas, sem armazenar um nível de cadastro duplicado.
- Detalhes e edição carregam a atividade pelo ID. Local é exibido apenas se a
  resposta possuir `local`; não foi criada uma coluna que o schema não confirma.
- Candidatura somente para atividade ABERTA com início no futuro e perfil
  completo; o autor não se candidata à própria atividade. Sempre PENDENTE e
  sem presença. A unicidade existente impede duplicidade.
- Cancelamento próprio: PENDENTE ou APROVADA, sem presença, antes do início,
  em atividade ABERTA/ENCERRADA. Cancelamento e recusa são finais nesta etapa:
  não há recandidatura, reabertura ou revogação de aprovação pela triagem.
- Gestão decide apenas PENDENTE, antes do início, em atividade ABERTA/ENCERRADA.
  APROVADA/RECUSADA registram quem decidiu, quando e observação opcional. Nem um
  gestor com inscrição legada pode decidir a própria candidatura. A consulta de
  candidatos expõe nome, descrição, profissão, habilidades e disponibilidade,
  sem CPF, data de nascimento, endereço ou telefone.
- Aprovação bloqueia a linha da atividade antes de contar aprovados e mantém o
  lock até o commit. Todas as decisões concorrentes da atividade se serializam.
  Uma atualização da versão da atividade também força falha de serialização em
  snapshots antigos de isolamento mais forte. Reduzir vagas abaixo dos aprovados
  é bloqueado por trigger. Cancelamento usa a mesma ordem de locks.
- Escrita direta de inscrições é revogada e bloqueada por RLS restritiva. RPCs
  de mutação derivam o usuário da sessão, não recebem usuário/presença/status
  arbitrários do cliente. Helpers e tokens ficam em schema privado; execução
  anônima das RPCs é revogada. Nenhuma service role é usada no app.
- Leitura direta de inscrições exige titularidade ou perfil ONG. Ser autor
  voluntário de uma atividade não dá acesso às candidaturas de outras pessoas.
  A policy complementar é restritiva, inclusive diante de policies permissivas
  antigas; `anon` não lê inscrições. Grants de TRUNCATE, REFERENCES e TRIGGER
  também são revogados dos papéis do app e de PUBLIC.
- Gestão pode encerrar candidaturas, cancelar ou marcar uma tarefa como realizada
  após seu fim previsto. Atividade com inscrições não pode ser excluída: deve ser
  cancelada para preservar histórico. A migração não exclui registros existentes.
- Minhas candidaturas lista todas as inscrições próprias. Histórico filtra
  presença confirmada. A carga horária é um snapshot da duração PREVISTA no
  check-in, não duração medida nem horas certificadas. Registros antigos sem
  snapshot são identificados e exibem a carga atual da atividade.

## Check-in e decisões operacionais adotadas

Fluxo simples adotado: **gestão exibe, voluntário aprovado escaneia**.

- A gestão gera um token aleatório UUID no servidor. A tabela privada guarda
  somente seu SHA-256, a atividade, o emissor e o vencimento.
- Há um token ativo por atividade. Dura até cinco minutos; gerar outro invalida
  imediatamente o anterior. Não é o ID da atividade nem uma credencial permanente.
- Janela: 30 minutos antes do início até início + carga horária prevista.
- Só o próprio voluntário aprovado pode confirmar, com atividade ABERTA ou
  ENCERRADA, dentro da janela e com token válido. O servidor grava horário e
  presença na inscrição existente; o lock impede duplicidade.
- A câmera é montada somente na tela em foco e com app ativo, lê apenas QR e exige permissão.
  Ao retornar das configurações do sistema, a permissão é consultada novamente.
  Não há digitação de código alternativo nem marcação manual irrestrita.
- O app não grava o token em arquivos, logs ou AsyncStorage. A UI esconde o QR
  expirado; o relógio do servidor é a autoridade final.

Janela e validade são escolhas operacionais explícitas para homologação, não
requisitos previamente confirmados. Confirmar com a instituição se precisa de
check-out, janela diferente ou outro sentido de leitura antes de mudar o fluxo.
O QR comprova posse do token por participante autorizado; não impede que alguém
compartilhe uma foto durante sua validade. Não há geolocalização ou promessa de
comprovação física antifraude absoluta.

## Dependências adicionadas

- `expo-camera`: leitura nativa de QR, com plugin e permissão em português;
  gravação de áudio no Android desabilitada.
- `react-native-qrcode-svg` e `react-native-svg`: geração/exibição local do QR,
  sem enviar o token a um serviço externo.
- `@electric-sql/pglite` (somente desenvolvimento): executar SQL/PostgreSQL em
  memória nos testes. Não participa do bundle mobile.

## Validação e limites

Revisão de 24/09/2026. Não constitui aprovação de produção nem comprovação de
compatibilidade com o schema remoto. Nenhum dado remoto foi modificado.

### Validado automaticamente

- `node node_modules/typescript/bin/tsc --noEmit`: concluído sem erros.
- `node --test tests/*.test.cjs`: 16 testes/subtestes aprovados, sem falhas.
  Inclui instalação das migrations em fixture, catálogo de RPCs/permissões/FKs,
  rollback do perfil, RLS de escrita e leitura (inclusive autor voluntário e
  policy permissiva adicional), capacidade sequencial e regras de check-in.
- Exportação JS Android com `expo export --platform android --no-bytecode`:
  concluída, usando URL/chave Supabase fictícias. Não é build APK ou teste nativo.
- Integridade das quatro migrations anteriores conferida por SHA-256;
  `git diff --check` sem erros.

### Validado estaticamente

- Rotas `lista`, `detalhe`, `formulario`, `candidatos`, `minhas`, `historico` e
  `checkin` registradas; telas restritas por perfil e parâmetros de atividade por ID.
- Contratos das 11 RPCs compatíveis com as chamadas do frontend; imports também
  passaram pelo TypeScript e bundler. Fluxos de loading, erro, vazio e recarga
  revisados. Não houve execução interativa das telas.
- RPCs SECURITY DEFINER com search_path vazio, verificações de sessão/perfil,
  locks na atividade antes da inscrição, token privado e recusa de duplicidade.
  A serialização entre conexões foi analisada, não executada nesta sessão.

### Ainda depende de homologação no Supabase

- Conferir todos os pré-requisitos iniciais, políticas de dados pessoais,
  provisionamento de ONG, grants herdados, triggers e RPCs remotas existentes.
- Aplicar ambas as migrations em ambiente controlado e testar Data API/JWT reais,
  isolamento entre usuários, persistência, rollback e concorrência entre conexões.
- Confirmar janela de check-in e validade do token com a instituição.

### Ainda depende de teste em dispositivo

- Build nativo/instalação Android, layout, navegação e retorno às telas.
- Permissão concedida/negada permanentemente, retorno das configurações,
  segundo plano, câmera real, leitura entre dois aparelhos e falhas de rede.

### Inventário da revisão SQL

- Reutilizadas: `usuarios`, `voluntarios`, `habilidades`, `usuario_habilidades`,
  `atividades`, `inscricoes_atividades` e enums existentes. Nenhuma tabela pública nova.
- Inscrições recebem `decidido_em`, `decidido_por`, `motivo_decisao`, `checkin_em`,
  `carga_horaria_registrada`, todos opcionais para preservar registros legados.
  `decidido_por` referencia `usuarios(id)` com ON DELETE RESTRICT.
- `voluntariado_privado.tokens_checkin`: PK `atividade_id` também é FK para
  atividades (CASCADE); `token_hash`, `expira_em` e `criado_por` são NOT NULL;
  emissor referencia usuários (RESTRICT). RLS habilitado sem policies de acesso
  do aplicativo; schema/tabela/helpers sem acesso para anon/authenticated/PUBLIC.
- Reutilizados UNIQUE `(atividade_id, usuario_id)` e índices históricos das
  inscrições por atividade e usuário. A PK do token atende a busca por atividade.
  Não foram acrescentados índices redundantes ou constraints retroativas de presença.
- 11 RPCs públicas: elegibilidade, salvar_perfil, detalhe, candidatar, cancelar,
  candidatos, decidir, status_atividade, gerar_checkin, checkin, minhas_inscricoes
  (todas prefixadas com `voluntariado_`). EXECUTE apenas para authenticated;
  autorização adicional dentro das funções que exigem gestão ou voluntário.
- Cinco funções privadas: gestao, disponibilidade_valida, elegivel,
  proteger_identidade e proteger_atividade. Dois triggers: proteção de identidade
  antes de UPDATE de usuários; proteção de vagas/histórico antes de UPDATE/DELETE
  de atividades. Nenhum trigger novo na migration complementar.
- Três policies restritivas originais bloqueiam INSERT/UPDATE/DELETE diretos;
  a complementar adiciona duas restrições SELECT. Não remove políticas históricas,
  linhas ou colunas. As migrations são transacionais, de aplicação única e exigem
  proprietário com as permissões descritas nos pré-requisitos.

Comandos:

```sh
npm ci
npm run typecheck
npm test
npx expo start --android
```

Os testes de banco executam as migrations históricas e a nova migration sobre
uma fixture mínima e fictícia em memória. Exercitam RLS, RPCs, rollback de perfil,
decisões, capacidade, tokens e histórico. **Não representam validação do schema
remoto** nem teste de concorrência entre conexões PostgreSQL independentes.
Os testes unitários executam as funções reais de data, carga, disponibilidade e QR.

A exportação Android de JavaScript usa valores Supabase fictícios, sem bytecode,
apenas para verificar resolução de módulos e bundle. Não é APK, build nativo,
teste de câmera ou teste ponta a ponta. Permissões, layout e leitura do QR exigem
aparelhos físicos. Não há interface web nova.

## Roteiro manual de homologação

Validação executada nesta etapa: TypeScript sem erros; 16 testes/subtestes
aprovados no runner Node (incluindo PostgreSQL em memória); exportação do bundle
JavaScript Android concluída; `git diff --check` sem erros de whitespace.
Não executados: APK/build nativo, câmera em dispositivo, integração com Supabase
remoto e concorrência real entre conexões independentes.

1. Conferir os pré-requisitos, aplicar as duas migrations da Prioridade 1, na ordem indicada, em homologação,
   configurar `.env` com URL/chave pública e iniciar a versão mobile atualizada.
   Usar uma gestão e pelo menos três voluntários fictícios; não usar dados reais.
2. No voluntário A, completar CPF, nascimento, profissão, disponibilidade e
   habilidades. Salvar, sair/voltar à tela e conferir tudo persistido e a
   elegibilidade atualizada. Remover habilidades deve torná-lo inelegível.
3. Interromper conexão durante um salvamento: verificar mensagem de falha e,
   após reconectar/recarregar, estado integral anterior ou integral novo — nunca
   metade do perfil. Uma resposta perdida pode significar commit já concluído.
4. Gestão: criar atividade com início daqui a 10 minutos, duas vagas e carga
   `1,5`. `10:99`, `24:00` e datas inexistentes devem ser rejeitados. Abrir os
   detalhes e conferir título, texto completo, data, vagas, tipo e status.
5. A/B/C: candidatar-se e conferir PENDENTE em Minhas candidaturas. Repetir o
   envio deve falhar. Perfil incompleto e atividade encerrada devem impedir envio.
6. Gestão: abrir candidatos, ler habilidades/disponibilidade, aprovar A e recusar
   B com motivo. B deve ver a recusa e motivo. Nova decisão sobre B deve falhar.
7. Para testar concorrência, usar outra atividade com UMA vaga, dois candidatos
   pendentes e duas sessões de gestão: aprovar simultaneamente. Exatamente uma
   deve aprovar; a outra deve informar vaga preenchida. Repetir via duas conexões
   independentes ao banco, mantendo a primeira transação aberta antes do commit,
   para verificar bloqueio. Testar também redução de vagas concorrente.
8. A: cancelar candidatura antes do início; conferir liberação da vaga e status
   CANCELADA. Não deve cancelar inscrição alheia, recusada ou já com presença.
9. Em outra atividade, aprovar A e gerar QR como gestão dentro da janela. A deve
   conceder câmera, ler e receber confirmação. B recusado/pendente não pode fazer
   check-in, mesmo com o mesmo QR. Testar QR de outra atividade e texto aleatório.
10. Gerar outro QR antes de ler o primeiro: o primeiro deve falhar. Aguardar
    vencimento: o expirado deve falhar. Confirmar uma vez com código válido;
    uma segunda chamada deve ser recusada e não alterar a hora original.
11. Conferir histórico de A com presença, horário e carga prevista. Conferir
    presença na lista da gestão. Ao fim, marcar atividade como REALIZADA; antes
    do fim previsto a ação deve falhar.
12. Testar via API autenticada INSERT aprovado, INSERT com presença, UPDATE de
    atividade/usuário/status/presença, DELETE de inscrição, emissão de token pelo
    voluntário, autoaprovação e consulta aos tokens privados: todos devem falhar
    ou não afetar linhas. Sem JWT, nenhuma nova RPC pode ser executada.
13. Tentar excluir atividade com candidaturas: deve falhar, preservando histórico.
    Conferir logout/troca de conta: não deve reutilizar perfil ou dados de outra conta.
14. Como voluntário que seja autor de uma atividade legada, consultar inscrições
    diretamente pela API: não deve acessar inscrições de outros voluntários.
    Como gestão, confirmar a listagem; como anônimo, confirmar ausência de acesso.
15. Negar a câmera permanentemente, abrir as configurações pelo app, permitir
    acesso e voltar. Verificar que o leitor abre sem precisar reiniciar o app.

Parar nesta prioridade. A evolução para materiais e certificados requer outra etapa.
*(Histórico: contribuições seguem hoje o modelo de metas, ver [CONTRIBUICOES.md](CONTRIBUICOES.md);
certificados estão fora do MVP.)*
