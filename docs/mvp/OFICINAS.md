# Prioridade 4 — Propostas de oficinas

Implementação em 24/09/2026. Esta prioridade registra propostas privadas e a
decisão da instituição. **Não é um sistema completo de eventos.** Uma aprovação
não cria atividade, calendário, inscrição, presença ou certificado.

## Auditoria e reutilização

O projeto já possui o tipo `OFICINA_AUTORAL` em atividades e referências antigas
a aprovação nesse contexto. Atividades exigem data, vagas e carga horária; não
havia fluxo específico de propostas. Foi criada `propostas_oficinas` para não
exigir a organização de um evento durante a proposta. Nenhum registro legado
foi convertido ou apagado.

Foram reutilizados Campo, Botao, cards, tema, TelaFluxoVoluntariado,
useDadosVoluntariado, sessão, cliente Supabase e navegação nativa. A exigência
de perfil completo já anunciada no aplicativo foi preservada: a criação usa
`voluntariado_privado.elegivel`. Habilidades e disponibilidade permanecem no
perfil existente. O campo opcional de conhecimentos da proposta é texto livre.

## Fluxo e regras

- Voluntário: Início → Oficinas → Minhas oficinas → Nova proposta → Detalhes.
- Gestão: Início → Oficinas → Propostas de oficinas → Detalhes → Aprovar/Rejeitar.
- O autor pode editar ou cancelar somente enquanto PENDENTE.
- Apenas gestão pode decidir; não pode decidir a própria proposta.
- APROVADA, REJEITADA e CANCELADA são estados finais. Não há reabertura.
- Rejeição exige justificativa; aprovação permite observação opcional.
- Decisões registram responsável e data no servidor. Cancelamento registra data.
- Perfil completo é necessário para criar, mas não para editar/cancelar uma
  proposta própria já enviada.
- Propostas são privadas: somente autor e gestão podem consultar conteúdo e decisão.
- Não há exclusão física pelo aplicativo nem publicação em um catálogo público.

Título: 3–120 caracteres; descrição: 1–5.000; tema: 1–120; objetivo: 1–2.000.
Conhecimentos, observações e nota da decisão: até 2.000 caracteres cada.
Duração: **minutos inteiros de 1 a 1.440**, sem vírgulas ou frações. Os limites
são validados no formulário e no banco. Campos opcionais vazios viram NULL.

Os detalhes são carregados pelo ID. As listas são atualizadas ao receber foco,
e decisões/cancelamentos recarregam os detalhes. Há loading, erro com nova
tentativa, lista vazia e confirmação antes de decisões/cancelamento. O envio
bloqueia toques repetidos enquanto está em andamento. Não há rascunho salvo
automaticamente nem restrição de propostas semelhantes; se a conexão cair após
o envio, consulte a lista antes de reenviar.

## Banco e segurança

Migration: `supabase/migrations/20260924180000_propostas_oficinas.sql`.

Tabela `public.propostas_oficinas`:

| Campos | Função |
| --- | --- |
| id | bigint identity, chave primária |
| autor_id | FK para usuarios.id, exclusão RESTRICT |
| titulo, descricao, tema, objetivo | conteúdo obrigatório com limites |
| duracao_minutos | inteiro positivo, até 1.440 |
| conhecimentos, observacoes | conteúdo opcional |
| status | PENDENTE, APROVADA, REJEITADA ou CANCELADA |
| criado_em, atualizado_em | datas mantidas no servidor |
| revisao | versão positiva incrementada nas alterações |
| decidido_em, decidido_por, observacao_decisao | decisão; responsável é FK usuarios.id RESTRICT |
| cancelado_em | data de cancelamento |

Constraints conferem o estado, coerência dos campos de decisão/cancelamento,
justificativa de rejeição e proibição de decisão pelo autor. Índices: chave
primária, autor/data/id e status/data/id. Não foram criados triggers.

RLS permite SELECT ao autor ou perfil ONG. Uma política restritiva reforça esse
limite; anônimos não podem consultar. INSERT/UPDATE/DELETE diretos são revogados
e bloqueados também por políticas restritivas. A sequência não é liberada aos
clientes. Escrever exige RPC; nunca depende apenas dos botões da interface.

| RPC | Autorização e comportamento |
| --- | --- |
| oficinas_salvar | voluntário cria com autor próprio e PENDENTE; somente autor edita PENDENTE |
| oficinas_cancelar | somente autor cancela PENDENTE |
| oficinas_decidir | somente gestão aprova/rejeita PENDENTE; bloqueia decisão própria |
| oficinas_listar | invoker, respeita a RLS da tabela |
| oficinas_detalhe | valida autor/gestão e acrescenta somente o nome do autor |

Execução das cinco funções é concedida somente a authenticated. Funções
privilegiadas usam SECURITY DEFINER, search_path vazio e nomes qualificados.
As alterações bloqueiam a linha com FOR UPDATE e exigem a revisão lida. Se
o autor editar enquanto a gestão analisa, a decisão antiga é rejeitada até
recarregar e reler o conteúdo. Uma segunda decisão não sobrescreve a primeira.

Dependências: usuarios e tipo_perfil, auth.uid(), papéis Supabase e funções
privadas gestao/elegivel da Prioridade 1. O modelo atual trata gestão como
perfil ONG da instituição, sem separação entre múltiplas instituições.
Não há bucket, upload nem dependência de Storage nesta prioridade.

## Validação local executada

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit` — passou.
- `git diff --check` — passou; somente avisos de conversão LF/CRLF. Os hashes
  das sete migrations anteriores permaneceram iguais aos do início desta etapa.
- Suíte: `node --test tests/*.test.cjs` — 49 testes/subtestes passaram.
- PGlite: migrations aplicadas em ordem sobre fixtures locais, incluindo as
  Prioridades 1, 2 e 3 antes da nova migration. Fixtures simulam estruturas
  anteriores; não devem ser usadas para reconstruir o banco remoto.
- Testes de oficinas cobrem criação, elegibilidade, limites, duração inteira,
  consulta própria, isolamento, edição pendente, cancelamento, aprovação,
  rejeição/justificativa, responsável/data, autoaprovação, estados finais,
  versão desatualizada, RLS e bloqueio de escrita direta mesmo com concessão
  adicional de CRUD e política permissiva no cenário de teste.
- Bundle JavaScript Android: Expo export com `--platform android --no-bytecode`
  passou, usando URL/chave Supabase fictícias. Saída em
  `.expo/validacao-oficinas`. Não corresponde a APK nem execução em dispositivo.
- Imports, rotas por ID e integração das telas foram verificados por análise
  estática, typecheck e bundle; isso não substitui navegação real.

## Homologação remota pendente

Não foi executada validação contra Supabase remoto. Antes de aplicar, conferir
o schema real, histórico de migrations e funções privadas citadas. Aplicar
somente a nova migration no ambiente de homologação com pré-requisitos presentes,
sem modificar migrations históricas. Conferir RPCs no PostgREST, permissões e
RLS com JWTs reais de dois voluntários e uma conta de gestão.

O teste local de revisão desatualizada é sequencial. Validar também disputas
reais entre conexões: editar versus decidir e duas decisões simultâneas. A
proteção usa bloqueio de linha e revisão, mas concorrência entre conexões não
foi executada no ambiente disponível.

## Roteiro manual no Android

1. Com voluntário de perfil incompleto, tentar enviar: deve informar a exigência
   de completar perfil, habilidades e disponibilidade. Completar e tentar novamente.
2. Criar proposta com campos obrigatórios e sem opcionais. Conferir detalhes,
   PENDENTE e atualização da lista. Exercitar duração vazia, zero e decimal.
3. Editar enquanto pendente. Voltar e conferir conteúdo atualizado. Cancelar
   outra proposta: deve ficar CANCELADA sem ações de edição ou decisão.
4. Entrar como segundo voluntário: não deve ver propostas do primeiro. Tentar
   consultas/escritas indevidas via API também deve falhar.
5. Entrar como gestão, abrir proposta e conferir autor/conteúdo. Aprovar e
   verificar status, data e observação. Rejeitar outra: justificativa obrigatória.
6. Voltar ao autor e conferir decisão. Tentar editar/cancelar estados finais
   via RPC deve falhar, assim como autoaprovação ou escrita direta de status.
7. Manter detalhe aberto na gestão e editar com o autor em outra sessão:
   decidir com a versão anterior deve solicitar releitura.
8. Testar voltar após salvar, alternar abas, retorno ao Início, troca de conta,
   teclado, campos longos, carregamento, lista vazia, conexão interrompida e nova
   tentativa. Conferir que o conteúdo de outra conta não permanece visível.

Esses testes de interface, teclado, navegação e rede **dependem de dispositivo
ou emulador Android** e ainda não foram executados.

## Limitações e escopo preservado

Sem calendário, inscrições em oficinas, presença, QR Code, certificados,
notificações, chat ou WhatsApp. A instituição organiza propostas aprovadas
posteriormente, fora deste fluxo. Sem conversão automática para atividades.
Legado financeiro/PIX, tabelas, contratos e migrations antigos foram preservados.
