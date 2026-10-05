# Correções de coerência do MVP — 24/09/2026

> **Situação em 05/10/2026.**
> - **Requisitos e backlog ([CLAUDE.md](../../CLAUDE.md)):** RNF0007 (auditoria de registros), RNF0010 (falhas de conexão), RNF0011 (segurança da autenticação), RF0013 (Diário) e RF0015 (perfil da ONG, B30).
> - **Banco:** as correções valem no remoto desde 30/09, instaladas pela
>   [reconciliação 02](../../supabase/reconciliacao/20260930141047_reconciliacao_02_fluxos_mvp.sql).
>   A migration `20260924210000` fica como histórico; não aplicar no remoto.
> - **Continuam valendo:** revisão obrigatória do Diário, proteção do histórico de
>   atividades após a primeira candidatura e tratamento de autenticação com timeout de 30s.
> - **Perfil da gestão:** continua atômico por `gestao_salvar_perfil`, mas a tela virou um hub
>   de seções. WhatsApp e chave PIX passaram para `configuracao_instituicao` (contato público
>   da instituição); `ongs.whatsapp` e `ongs.chave_pix` ficaram como legado. O PIX depende da
>   reconciliação pendente `20261005150000` ([CONTRIBUICOES.md](CONTRIBUICOES.md)).
> - **Certificados:** fora do MVP desde 05/10; as regras abaixo continuam no banco.
>
> As seções abaixo preservam o registro de 24/09; contagens de testes são daquela data.

Migration incremental: `20260924210000_coerencia_mvp.sql`, após as nove migrations
anteriores. Nenhuma migration histórica, tabela financeira ou certificado emitido
foi alterado ou removido. A implementação observou a documentação Expo SDK 57.

## Diário: revisão obrigatória

Cada publicação recebe `revisao`, inicialmente 1. Um trigger incrementa a revisão
em qualquer UPDATE. O app usa `diario_salvar_revisao` e `diario_status_revisao`,
informando a revisão lida. As RPCs bloqueiam a linha e rejeitam versões diferentes
antes de gravar. O erro pede recarga e o formulário oferece “Recarregar dados
(descartar edição)”. Ocultação e republicação também verificam revisão.

As RPCs antigas permanecem para reutilização interna, mas EXECUTE foi revogado de
PUBLIC, anon e authenticated. Clientes antigos não podem contornar o controle;
deixarão de salvar até atualizar o app. Implantar migration e app coordenadamente.
O proprietário das funções continua podendo executar funções internas. Conferir
ownership e concessões adicionais no ambiente remoto.

Upload ainda precede a gravação: conflito após upload pode deixar um arquivo sem
vínculo, como outras falhas de banco. Não há limpeza automática nesta etapa.

## Atividades e certificados

A primeira candidatura, de qualquer status, torna imutáveis título, data/hora
prevista, carga horária, tipo e autor. Isso inclui candidaturas depois canceladas
ou recusadas: elas também fazem parte do histórico. A regra é um trigger BEFORE
UPDATE; funciona independentemente de o UPDATE vir do app ou de uma RPC.

Descrição continua editável para corrigir orientações e não compõe o certificado.
Vagas continuam editáveis respeitando o mínimo de aprovados já protegido pelo
trigger anterior. Status continua sob as regras existentes; não foi criada
reabertura de atividade. Sem candidaturas, campos continuam editáveis conforme
as permissões existentes. Nenhuma política original desconhecida foi reconstruída.

Os fluxos de candidatura/check-in/emissão bloqueiam a atividade; o novo trigger
complementa a serialização. Concorrência real entre conexões exige homologação.

O certificado permanece idempotente, imutável para o cliente e com horas
**previstas**, não medidas. Não foi alterada a RPC de emissão nem corrigido
automaticamente qualquer snapshot. Atividades cujo título/data foram alterados
antes desta migration podem já divergir dos certificados: inventariar e decidir
administrativamente, sem emitir correções retroativas automáticas. Nomes de
usuários e da instituição continuam sendo preservados na emissão; mudanças
posteriores desses cadastros não reescrevem certificados existentes.

## Perfil da gestão

`gestao_salvar_perfil(jsonb)` valida a sessão ONG, bloqueia o usuário, atualiza
seus campos e grava a linha de `ongs` na mesma transação. Falha em qualquer parte
desfaz tudo. A ausência de `ongs` após uma consulta bem-sucedida é permitida:
o perfil complementar é criado atomicamente para o gestor já existente. Não se
cria usuário, conta Auth ou permissão de gestão. A RPC retorna true somente após
as operações confirmadas. Campos PIX existentes são preservados no formulário
e no salvamento, sem fluxo financeiro novo. *(05/10: o PIX exibido aos voluntários
passa a vir de `configuracao_instituicao`; ver [CONTRIBUICOES.md](CONTRIBUICOES.md).)*

Carregamento consulta usuário e ONG; qualquer erro impede exibir/salvar o
formulário e oferece nova tentativa. Respostas de cargas anteriores são ignoradas.
O adaptador de salvamento também rejeita carga inválida. A recarga visual após
commit tem erro separado: o app distingue “salvo” de falha na atualização da tela.

## Autenticação

Login/cadastro, obtenção da sessão, carga de perfil e logout usam tratamento de
erros com finalização garantida e espera máxima de 30 segundos. Falha de logout
é informada sem apagar artificialmente a sessão; o evento do Supabase continua
sendo a fonte da troca de conta. Respostas de perfil de sessões anteriores são
descartadas usando identidade e geração da sessão.

Timeout não cancela uma operação já recebida pelo servidor: um evento tardio de
autenticação ainda é aceito como estado oficial. Em cadastro, conferir e-mail/conta
antes de repetir após resposta perdida. Nenhum método de autenticação novo foi
introduzido. Auth real, armazenamento e retomada do app exigem teste remoto/nativo.

## Comunicação e configuração

Foram retirados somente os avisos que anunciavam comprovantes/triagem como
futuros. Histórico e formulário de atividade identificam carga horária prevista.
Diário informa que a publicação se destina a usuários autenticados.

Fontes legítimas preservadas, sem alteração automática de dados:

| Fonte | Finalidade |
| --- | --- |
| usuarios.nome | nome de exibição da conta; nome do voluntário na emissão |
| ongs.razao_social | dado institucional do perfil de gestão |
| configuracao_instituicao.nome_curto | apresentação da instituição no Início |
| configuracao_instituicao.nome_completo | nome institucional oficial no certificado |

Editar o perfil de gestão não renomeia a configuração institucional. A tela
explica essa separação. Cadastro ausente/inválido continua bloqueando emissão,
sem fabricar um nome de instituição.

## Validação

Resultado final local: **65 testes/subtestes aprovados**, zero falhas; TypeScript
sem erros; bundle JavaScript Android gerado (1.274 módulos); `git diff --check`
aprovado, com avisos LF/CRLF. Os hashes das nove migrations históricas permaneceram
iguais. Nenhum teste foi executado contra Supabase remoto ou dispositivo Android.

Testes locais: conflito exato de ocultação/salvamento, edição normal,
republicação, RPC antiga bloqueada, proteção histórica em todos os status de
candidatura, presença real por RPC, emissão idempotente, dados oficiais,
escrita direta de certificado bloqueada, perfil atômico com rollback, ONG
ausente, sessão inválida e bloqueio de salvar sem carga válida.

Testes de autenticação usam adaptadores e hooks simulados: sucesso, erro
retornado, exceção, timeout, loading, troca de conta, resposta antiga e logout.
PGlite não comprova RLS original nem Supabase remoto. As fixtures são somente
para testes; não aplicá-las ao ambiente real.

Homologar no Android: conflito com recarga explícita, edição protegida com erro
legível, perfil após perda de rede, logout offline, troca de conta com consulta
pendente e teclado. No Supabase, seguir também `../auditoria/SEGURANCA_BASE.md`, testar a
migration sobre o schema real e concorrência entre sessões independentes.
