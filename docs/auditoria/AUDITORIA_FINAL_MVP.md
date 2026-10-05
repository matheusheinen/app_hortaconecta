# Auditoria final do MVP — 24/09/2026

> **Situação em 05/10/2026.** Este relatório é de 24/09. O que mudou desde então:
>
> | Achado de 24/09 | Situação em 05/10 |
> | --- | --- |
> | Base original do remoto desconhecida | Catálogo remoto capturado em 29/09 ([1A](../reconciliacao/RECONCILIACAO_1A_ESTRUTURA.md), [1B](../reconciliacao/RECONCILIACAO_1B_DIAGNOSTICO.md)) e reconciliações 01 e 02 aplicadas em 30/09 ([compatibilidade](../reconciliacao/COMPATIBILIDADE_SUPABASE_20260930.md)). As dez migrations listadas abaixo **não** são aplicadas no remoto; o contrato delas chegou pelas reconciliações. |
> | Leitura ampla de `ongs` e `usuarios` | Fechada pelas policies restritivas `ongs_privacidade_mvp` e `usuarios_privacidade_mvp` (reconciliação 02): cada conta lê o próprio cadastro; a gestão lê todos. |
> | "Exposição de PIX" no perfil da gestão | Deixou de ser inconsistência: metas em dinheiro (PIX) voltaram ao MVP. A chave passa para `configuracao_instituicao` pela reconciliação pendente `20261005150000` ([CONTRIBUICOES.md](../mvp/CONTRIBUICOES.md)). |
> | Contribuições de materiais (`solicitacoes_materiais`, `contribuicoes_materiais`, `materiais_*`) | Fluxo removido do app em 05/10; tabelas e funções serão **excluídas** pela reconciliação pendente. As linhas de materiais nas tabelas abaixo são históricas. |
> | `metas_demandas`/`contribuicoes` como legado | Voltaram a ser o modelo ativo, com escrita direta protegida por RLS (voluntário insere PENDENTE; gestão insere APROVADA e confere). |
> | Telas antigas `PilhaMetas`, `TelaMetas`, `TelaFormMeta`, `useOng` | Substituídas por `PilhaMetas` + `TelasMetas` novos; `useOng` removido. `expo-clipboard` é usado para copiar a chave PIX. |
> | Oficinas e certificados no MVP | Fora do MVP desde 05/10, ocultos no app; banco preservado. |
> | Escritas diretas do cliente | Além de atividades: `metas_demandas`, `contribuicoes`, `atividade_habilidades` e `configuracao_instituicao` (WhatsApp/PIX), todas sob RLS. |
> | Concorrência, Storage, Auth real e Android | **Continuam pendentes.** |
>
> A suíte local passou de 65 para 117 testes. O restante do relatório preserva o registro de 24/09.

## Escopo e conclusão

Revisão do repositório após as correções de coerência do MVP. Nesta etapa foram
criadas somente esta documentação e `AUDITORIA_SUPABASE_LEITURA.sql`. Nenhum código,
migration, dado, dependência ou legado foi alterado. Nenhuma conexão com Supabase
remoto foi utilizada. Não foram adicionados testes: os existentes exercitam as
regras locais identificadas; inventar a base ausente não ampliaria a comprovação.

Não foi encontrado novo defeito reproduzível nas regras cobertas pela suíte.
Persistem lacunas de segurança da base original e uma exposição confirmada de PIX
no perfil da gestão. Portanto, não é correto afirmar que todo o aplicativo está
livre de referências financeiras, nem que está aprovado para produção.

As cinco funcionalidades estão integradas: voluntariado com triagem/check-in e
histórico; contribuições de materiais inteiros; Diário autenticado; propostas
privadas de oficinas; certificados com visualização e compartilhamento de texto.
Oficinas não são eventos. Certificados não são PDF e não medem horas realizadas.

Vocabulário deste relatório:

- **Confirmado localmente:** observável no código ou reproduzido nos testes indicados.
- **Não comprovado:** informação ausente ou comportamento não executado no ambiente real.
- **Risco a testar:** hipótese concreta; não significa exploração remota demonstrada.

## Segurança da base original — bloqueio principal

| Objeto/fluxo | Confirmado no repositório | Não comprovado / risco a testar |
|---|---|---|
| Schema inicial | A primeira migration já usa `usuarios`, `voluntarios`, `atividades`, enums e helpers | DDL original, constraints, RLS, grants, owners e triggers completos dessas tabelas |
| Cadastro | `TelaLogin` envia nome; não oferece seleção de gestão | Trigger real de `auth.users`, metadados adicionais enviados por API, criação de complementos e confirmação de e-mail |
| Papel administrativo | Trigger `trg_voluntariado_identidade` bloqueia UPDATE de id/tipo_perfil por sessão autenticada; teste local passa | INSERT/UPSERT em usuarios, provisionamento ONG e RPC antiga que crie gestão. O trigger de UPDATE não resolve criação indevida |
| Dados pessoais | Novas RPCs restringem identidade e projeção conforme a operação | SELECT/UPDATE direto de usuarios e voluntarios por outro usuário; nomes/documentos/contatos expostos por views ou RPCs antigas |
| Atividades | Trigger congela campos históricos depois de qualquer candidatura; há proteção de capacidade/exclusão | RLS original permitindo ou negando CRUD a voluntário. Formulário administrativo ainda usa acesso direto à tabela |
| `ongs` | Migration inicial cria RLS: SELECT para todos autenticados, INSERT próprio com e_ong(), UPDATE próprio | Grants reais e eventual exposição integral de CNPJ, responsável, PIX e contato. UPDATE direto pode permitir cliente antigo não atômico |
| Helpers antigos | Tipos referenciam funções; migrations dependem de e_ong(), perfil_completo(), set_atualizado_em() | Definições/sobrecargas reais; solicitar_exclusao_conta; origem/segurança do papel, search_path e acesso privilegiado |
| Papéis e owners | Novas migrations revogam acessos e controlam RPCs | Grants herdados, permissões por coluna, memberships, BYPASSRLS, owners, schemas expostos, default privileges e funções adicionais |

`tests/fixtures/base-voluntariado.sql` é uma fixture mínima, não um dump do banco.
Seu `auth.uid()` lê uma configuração de sessão: não valida JWT, expiração, assinatura,
refresh token nem o serviço Auth. Seus helpers não comprovam os helpers originais.
`database.types.ts` descreve contratos, não comprova autorização.

As RPCs novas confiam no papel persistido em usuarios. Se o provisionamento remoto
permitir obter ONG indevidamente, a checagem correta dessas RPCs não elimina a
escalada. Essa verificação deve preceder a homologação funcional geral.

## As dez migrations, na ordem

| Ordem/arquivo | Estruturas, funções e proteções | Dependências / implantação |
|---|---|---|
| 1. `20260914120000_completa_modelo_dados.sql` | habilidades, ongs, usuario_habilidades, inscrições, metas/contribuições antigas, diário, configuração; enums; policies; índices; trigger financeiro e updated_at | Exige base original ausente. Continua necessária, inclusive suas estruturas não financeiras |
| 2. `20260914121500_revoga_execucao_trigger_arrecadacao.sql` | Revoga EXECUTE do trigger financeiro para PUBLIC/anon/authenticated | Exige função da 1; não desativa o trigger |
| 3. `20260914140000_seed_habilidades.sql` | Cadastro inicial de habilidades | Exige tabela da 1 |
| 4. `20260923120000_fluxo_voluntariado.sql` | Colunas de decisão/presença/horas, schema privado e tokens, helpers, RPCs, triggers de identidade/atividade, bloqueio de escrita direta em inscrições | Exige base original e 1. Clientes antigos que escrevem inscrições diretamente deixam de funcionar |
| 5. `20260924120000_valida_seguranca_voluntariado.sql` | SELECT restritivo próprio/gestão e revogação de privilégios de escrita em inscrições | Complementa 4; policies antigas permissivas não anulam a restrição |
| 6. `20260924140000_contribuicao_materiais.sql` | solicitações/contribuições materiais; constraints inteiras; índice único de pendência; RPCs e RLS | Usa usuarios e helper privado de gestão da 4; não usa trigger financeiro |
| 7. `20260924160000_diario_transparencia.sql` | Adapta diário, RLS/RPCs, bucket privado e policies de Storage | Exige 1/4 e Storage real com RLS. Bucket preexistente incompatível causa erro, não conversão silenciosa. Escritas antigas diretas deixam de funcionar |
| 8. `20260924180000_propostas_oficinas.sql` | Propostas, revisão, constraints de decisão, RPCs e isolamento | Usa usuarios e elegibilidade/gestão da 4; não cria atividades |
| 9. `20260924200000_certificados.sql` | Snapshot imutável, UUID, participação única, RLS/RPCs | Exige inscrições/check-in da 4 e configuração da 1; FK RESTRICT preserva emissões |
| 10. `20260924210000_coerencia_mvp.sql` | Revisão/trigger do Diário, wrappers com conflito, revogação das RPCs antigas, trigger de histórico, RPC atômica do perfil ONG | Exige 1/4/7; é executada após 9. Exige implantação coordenada do app |

A suíte integrada executou as dez migrations, ordenadas, sobre as fixtures locais.
Não houve conflito nessa base. Isso não comprova aplicação sobre dados, objetos,
owners ou políticas adicionais remotos. Não são um bootstrap independente: não
aplicar em banco vazio presumindo que contêm o schema original. Não reaplicar uma
migration já registrada: várias instruções CREATE/ADD não são idempotentes.

### Inventário de RPCs e triggers

- Voluntariado: `voluntariado_elegibilidade`, `voluntariado_salvar_perfil`,
  `voluntariado_detalhe`, `voluntariado_candidatar`, `voluntariado_cancelar`,
  `voluntariado_candidatos`, `voluntariado_decidir`, `voluntariado_status_atividade`,
  `voluntariado_gerar_checkin`, `voluntariado_checkin`, `voluntariado_minhas_inscricoes`.
- Materiais: `materiais_salvar`, `materiais_contribuir`, `materiais_decidir`,
  `materiais_status`, `materiais_listar`, `materiais_detalhe`, `materiais_minhas`.
- Diário: `diario_gestao`, `diario_imagem_visivel`, `diario_imagem_livre`,
  `diario_caminho`, `diario_listar`, `diario_detalhe`,
  `diario_salvar_revisao`, `diario_status_revisao`.
  `diario_salvar` e `diario_status` permanecem apenas como implementação interna;
  EXECUTE revogado dos papéis de clientes, em todas as assinaturas conhecidas.
- Oficinas: `oficinas_salvar`, `oficinas_cancelar`, `oficinas_decidir`,
  `oficinas_listar`, `oficinas_detalhe`.
- Certificados: `certificados_emitir`, `certificados_listar`, `certificados_detalhe`.
- Perfil gestão: `gestao_salvar_perfil`.
- Funções privadas: gestão, disponibilidade/elegibilidade, proteção de identidade,
  atividade, histórico e revisão do Diário. Sem execução direta pelos clientes.
- Triggers conhecidos: financeiro; updated_at de ongs/metas/configuração;
  proteção de identidade em usuarios; proteção e histórico em atividades;
  incremento de revisão em diário. Triggers da base original continuam desconhecidos.

RPCs privilegiadas novas usam `SECURITY DEFINER`, `search_path=''` e checagem de
autorização; funções de leitura invoker dependem da RLS. Não presumir que qualquer
RPC antiga segue esse padrão. Auditar todas as sobrecargas e chamadas internas.

### Coordenação obrigatória da migration 10

O app atual chama `diario_salvar_revisao`, `diario_status_revisao` e
`gestao_salvar_perfil`. Sem a migration, essas chamadas falham. Depois dela,
clientes antigos que usam as duas RPCs anteriores do Diário recebem negação de
permissão. Não restaurar EXECUTE antigo para compatibilidade: isso reabriria o
problema de edição desatualizada. Planejar janela de homologação/atualização e
retirada dos clientes antigos antes de permitir escrita no Diário.

O salvamento atômico de gestão está garantido pela RPC nova, não por proibição
universal de UPDATE direto na base original. Inventariar esses caminhos antes de
considerar clientes antigos seguros. Nenhuma migration histórica deve ser removida.

## Matriz de acesso local e seus limites

| Tabela/objeto | Leitura | Escrita pelo cliente atual / banco |
|---|---|---|
| usuarios / voluntarios / atividades | RLS original não comprovada | Perfis via RPC, atividades ainda diretamente; autorização original pendente. Triggers adicionais conhecidos não substituem RLS |
| ongs | Policy conhecida permite autenticados *(30/09: restrita ao próprio cadastro e à gestão)* | RPC atômica nova; policies legadas ainda permitem INSERT/UPDATE próprios nas condições acima; grants reais pendentes |
| habilidades / usuario_habilidades | Autenticados / próprio ou gestão | Gestão mantém catálogo; associação própria INSERT/DELETE permitidos na policy antiga; perfil atual usa transação |
| inscricoes_atividades | Próprio/gestão, limite restritivo | INSERT/UPDATE/DELETE diretos bloqueados; candidatura, decisão, cancelamento e presença somente RPCs conhecidas |
| tokens_checkin | Schema privado sem acesso do cliente | Gestão recebe token por RPC; voluntário entrega token à validação, não o consulta na tabela |
| solicitacoes_materiais *(a excluir, 05/10)* | Disponíveis, gestão, ou solicitante com contribuição conforme regra de detalhe | Writes diretos bloqueados; gestão por RPC |
| contribuicoes_materiais *(a excluir, 05/10)* | Próprio/gestão | Writes diretos bloqueados; criar/cancelar próprio e confirmar gestão por RPC |
| diario_transparencia | Autenticado PUBLICADA; gestão também OCULTA | Writes diretos bloqueados; gestão por RPC com revisão |
| storage.objects do Diário | Gestão ou imagem de publicação PUBLICADA para autenticados | Upload gestão/caminho autorizado; UPDATE proibido; DELETE gestão somente sem vínculo. Restritivas limitam policies amplas |
| propostas_oficinas | Próprio/gestão, limite restritivo | Writes diretos bloqueados; RPCs, revisão e estados finais |
| certificados | Próprio/gestão, limite restritivo | Writes diretos bloqueados; emissão própria por RPC verifica participação; gestão consulta |
| configuracao_instituicao | Policy permite anon/autenticado | UPDATE gestão pela policy; grants/helper original pendentes |
| metas_demandas / contribuicoes *(modelo ativo desde 05/10)* | Policies antigas ainda presentes | Não foram desativadas. Acessibilidade por API depende dos grants reais; não confundir ausência de tela com ausência de backend |

Todas as permissões desta matriz relativas às migrations são comprovadas somente
na combinação local conhecida. Conferir policies adicionais, grants por coluna,
funções privilegiadas e papel real do executor. Usuários de gestão são tratados
como administração da instituição única; não existe isolamento multi-instituição.

## Concorrência: nenhuma aprovação entre conexões independentes

| Operação | Proteção identificada | Teste remoto necessário |
|---|---|---|
| Última vaga | Lock da atividade antes da inscrição; recontagem; atualização da linha de atividade | Dois gestores aprovam candidatos diferentes para uma vaga: exatamente um sucesso, total aprovado <= capacidade |
| Decisões/cancelamento | Mesma ordem de locks e estado revalidado | Aprovar versus recusar/cancelar mesma candidatura; apenas transição válida persiste |
| Primeira candidatura versus edição | Candidatura trava atividade; edição é protegida pelo trigger de histórico | Duas conexões, inverter quem trava primeiro; depois da candidatura persistida não alterar título/data/horas |
| Recebimento material | Lock solicitação antes de contribuição, restante recalculado e constraint | Necessário 10, recebido 8, duas pendências de 2: uma confirmação, outra finalizada/recusada conforme estado; recebido 10, nunca 12 |
| Certificado | Locks atividade/inscrição, consulta emissão existente, UNIQUE participação | Duas emissões simultâneas: um registro e mesmo UUID; retentativa idempotente |
| Diário | Lock da publicação + revisão; trigger incrementa revisão | Editar/ocultar/republicar com mesma versão em conexões diferentes: operação perdedora informa conflito, sem restaurar conteúdo antigo |
| Oficina | Lock + revisão + validação de estado final | Edição versus aprovação/cancelamento; versão antiga não sobrescreve decisão |

PGlite nesta suíte usa uma conexão por instância. Até os testes com requisições
sobrepostas não comprovam espera de locks, snapshots, deadlock ou isolamento entre
conexões. Todos os cenários acima permanecem **pendentes**, inclusive nos níveis
de isolamento usados efetivamente pelas chamadas remotas.

## Histórico e certificados

Após qualquer candidatura, inclusive CANCELADA/RECUSADA, o banco congela título,
data/horário, carga horária, tipo e autoria da atividade. ID/exclusão e capacidade
têm proteção adicional. Descrição pode mudar como orientação operacional, pois
não é copiada no certificado; vagas podem mudar respeitando aprovados. Status
segue a RPC existente. A autorização para qualquer escrita direta nos demais
campos depende da RLS original, ainda não comprovada.

Nova emissão exige APROVADA + presença + check-in válido + carga registrada
positiva/finita, data iniciada, estado de atividade permitido e nomes oficiais.
O check-in registra a carga **prevista**, sem medir duração real. O certificado
preserva snapshot, UUID próprio e participação única. Retentativas retornam o
registro já emitido. Voluntário não pode editar o snapshot pelas interfaces locais
testadas. A emissão não exige término da atividade: não é certificado de horas
efetivamente cumpridas.

Certificado anterior continua consultável após cancelamento administrativo da
atividade; novas emissões nessa atividade são bloqueadas. Isso preserva história,
não implementa revogação. Dados antigos divergentes, presença antiga sem check-in,
alterações feitas antes do congelamento e intervenções privilegiadas exigem análise
administrativa. Não atualizar/reemitir automaticamente. Comparar título/data/horas
entre histórico e certificado; diferenças de nome atual versus snapshot podem
ser legítimas. `usuarios.nome` é o titular; `ongs.razao_social` é cadastro legal;
`configuracao_instituicao.nome_completo` é a instituição no certificado. Validar
essas fontes sem sobrescrever dados.

## Testes executados nesta auditoria

| Comando/validação | Resultado |
|---|---|
| `node --test tests/*.test.cjs` | 65 testes/subtestes, 65 aprovados, 0 falhas, 0 ignorados |
| `node node_modules/typescript/bin/tsc --noEmit` | Exit 0, sem erros |
| Expo export Android, `--no-bytecode --max-workers 2` | Exit 0, 1274 módulos; export JS em `.expo/auditoria-final-mvp` |
| `git diff --check` | Exit 0; somente avisos de conversão LF/CRLF, sem erro de whitespace |
| Hashes SHA-256 das dez migrations antes/depois | Idênticos; nenhuma migration alterada |

O bundle usou URL/chave pública fictícias para empacotamento, sem testar backend.
Não é APK, execução de dispositivo ou teste de credenciais. Testes de hooks/telas
e Storage usam simulações; testes SQL usam PostgreSQL/PGlite com fixtures.

| Cenário de segurança | Resultado e evidência |
|---|---|
| Voluntário altera tipo_perfil por UPDATE | Bloqueado localmente em `banco-voluntariado.test.cjs`; cadastro/INSERT/UPSERT remoto pendente |
| Acessa inscrições/propostas/certificados de outro | Bloqueado localmente nas suítes correspondentes; dados pessoais das tabelas originais pendentes |
| Altera atividade com candidatura/aprovação/presença | Bloqueado pelo trigger, inclusive SQL direto com grant extra na fixture, em `coerencia-mvp.test.cjs`; CRUD geral sem candidatura não comprovado |
| Aprova candidatura / confirma próprio material | Bloqueado localmente, `banco-voluntariado` e `materiais` |
| Altera presença/certificado diretamente | Bloqueado localmente por grants/RLS; certificado oficial e emissão repetida aprovados |
| Gestão executa operações autorizadas | Aprovado nas cinco suítes e perfil atômico; rollback da segunda parte aprovado |
| Chamadas antigas do Diário | EXECUTE negado localmente após migration 10; outras RPCs antigas desconhecidas |
| Anônimo/identidade nula/perfil incompleto | Rejeições locais aprovadas conforme operação; JWT inválido/expirado real pendente |
| Login/logout, erro, timeout e troca de conta | Testes de adaptador/hooks simulados aprovados em `auth-perfil.test.cjs`; serviço Auth e Android pendentes |
| Diário normal/conflito/ocultação/republicação | Aprovado sequencialmente com revisão; concorrência real pendente |
| Materiais inteiros, duplicação, limite e cancelamento | Aprovado localmente, inclusive impedir recebido > necessário |
| Storage e imagem 5 MiB | Policies SQL locais, bytes exatos/acima e adaptador simulado aprovados; serviço Storage remoto não testado |

## Supabase remoto: roteiro de homologação

O arquivo separado [AUDITORIA_SUPABASE_LEITURA.sql](AUDITORIA_SUPABASE_LEITURA.sql)
contém apenas consultas. Execute por bloco, primeiro confirmando existência dos
objetos. Foi preparado por inspeção estática; não foi executado no Supabase. Não
publicar dumps com dados pessoais ou definições sensíveis. Não é migration nem
comando de correção. Ausência de linhas visíveis pode refletir permissão do auditor.

1. **Schema:** executar blocos 1/3; obter também DDL original e dependências dos
   helpers. Não usar a fixture como baseline. Comparar defaults, tipos, FKs e índices.
2. **Migrations:** bloco 2; comparar dez versões e definições reais, não apenas
   presença no ledger. Se faltarem migrations, planejar aplicação manual após
   validar base/dados e cópia de homologação; nada foi aplicado por esta auditoria.
3. **RLS:** blocos 4/5; conferir ENABLE/FORCE e composição de policies. Testar
   SELECT/INSERT/UPDATE/DELETE por API com dois voluntários, gestão e sem JWT.
4. **Grants:** bloco 4; incluir coluna/sequência/schema/defaults e memberships.
   Distinguir grant de autorização por linha. Clientes não devem receber service_role.
5. **Ownership:** blocos 4/7; examinar owners de tabelas/funções e BYPASSRLS.
   SECURITY DEFINER não é automaticamente seguro por possuir search_path vazio.
6. **Triggers:** bloco 6; inspecionar cadastro Auth, funções chamadas indiretamente,
   estado habilitado e triggers adicionais. Manter financeiro inventariado.
7. **RPCs:** bloco 7; revisar fonte de todas as sobrecargas antigas, helpers e
   funções expostas. Testar escrita antiga capaz de contornar novas RPCs. Confirmar
   revogação do Diário antigo e deployment coordenado da migration 10.
8. **Storage:** bloco 8 + policies. Bucket privado, 5242880 bytes, jpeg/png/webp;
   gestão faz upload; voluntário/anon não fazem upload/overwrite/delete. Autenticado
   lê publicada, não oculta ou arquivo solto. Testar imagem exata 5 MiB, acima,
   MIME proibido, URL de 60s e expiração, substituição/remoção e falha de upload.
   URL assinada já emitida pode continuar válida até expirar; download já realizado
   não é revogado. Sem importação de imagens legadas ou limpeza de órfãos.
9. **Usuários/perfis:** bloco 9 inventaria inconsistências sem corrigi-las. Criar
   contas fictícias A/B e gestão por procedimento administrativo auditado. Via
   signup público enviar metadata tipo_perfil=ONG; tentar INSERT/UPSERT/UPDATE
   de perfil administrativo. Nenhuma dessas tentativas pode conceder gestão.
   A consulta cruzada de CPF/endereço/contatos deve ser negada ou não retornar
   dados; verificar também views/RPCs. Conferir finalidade da leitura ampla de ongs.
10. **Concorrência:** executar matriz anterior com clientes/conexões independentes,
    registrar ordem, respostas e estado final. Repetir conflitos invertendo a ordem.
11. **Autenticação:** cadastro, confirmação de e-mail, JWT válido/inválido/expirado,
    refresh, logout, troca de conta, retomada e falha de rede. JWT expirado usado
    diretamente sem refresh não pode autorizar escrita; refresh legítimo deve
    seguir política Auth. Logout local não prova revogação imediata de JWT emitido.

Os testes de escrita acima são instruções manuais para contas e registros fictícios
em homologação, não comandos executados nesta etapa. Usar chave pública + JWT do
usuário para comprovar RLS; SQL Editor/postgres/service_role não representam usuário
final. Para cada tentativa negada, verificar também que nenhum registro mudou.

## Android: testes indispensáveis, ainda pendentes

- Login/logout com sucesso, erro e timeout; troca A → B e gestão → voluntário sem
  dados antigos; sessão ao retomar segundo plano, expiração/refresh e reconexão.
- Abas/pilhas, voltar físico, voltar após salvar, recarregar listas e detalhes por
  ID, bloqueio de ações conforme perfil; draft e formulário após erro de carga.
- Câmera: concessão/negação de permissão, leitura QR, código inválido, expirado,
  substituído, atividade errada, não aprovado, duplicado e fora da janela.
- Galeria: conceder/negar/cancelar, formatos reais, conversão/tamanho, preview,
  upload sem rede, timeout e substituição/remoção sem referência quebrada.
- Teclado/rolagem de formulários, datas/horários, vírgula nas horas, quantidades
  inteiras, limites de texto, duplo toque, erro controlado e tentativa novamente.
- Diário aberto em dois dispositivos: ocultar em um e salvar formulário antigo
  no outro; conflito visível, recarga e preservação da alteração mais recente.
- Compartilhar certificado: texto com UUID/instituição e horas previstas, cancelar
  seletor, ausência/falha do aplicativo de destino. Nenhum PDF é esperado.
- Interromper rede durante mutação e retomar: conferir estado no servidor antes
  de repetir; timeout de cliente não é cancelamento garantido da transação.
- Completar os cinco fluxos: voluntariado até histórico/certificado; materiais
  até recebimento; Diário até ocultação/republicação; oficinas até decisão final.

## Legado e exposição financeira

*(Seção de 24/09. Em 05/10 o modelo financeiro voltou ao MVP; ver o bloco de situação no topo.)*

| Referência | Acessível/utilizada agora? | Tratamento nesta etapa |
|---|---|---|
| `TelaPerfilOng`: Recebimento de doações, Chave PIX, beneficiário | **Sim, na aba Perfil da gestão**, leitura e salvamento atuais | Inconsistência confirmada com MVP físico. Preservada por instrução; obter autorização para ocultar/adaptar UI sem apagar dados |
| `gestao_salvar_perfil` / ongs.chave_pix / nome_beneficiario_pix | Sim, contrato novo preserva campos antigos | Não remover sem plano compatível com dados/clientes |
| `PilhaMetas`, `TelaMetas`, `TelaFormMeta`, `useOng` | Sem caminho na navegação ativa; fluxo PIX antigo permanece nos arquivos | Candidato a retirada futura autorizada |
| `expo-clipboard` | Importado pela tela antiga de Metas; não pelo fluxo ativo de materiais | Dependência preservada, sem remoção automática |
| metas_demandas, contribuicoes, enums/campos monetários/comprovante | Legado de banco com policies; acesso API real depende de grants | Não desativado nem apagado; inventariar clientes externos antes de decidir |
| atualizar_arrecadacao_meta / trg_contribuicoes_arrecadacao | Continua associado à tabela antiga; não participa dos materiais novos | Migration 2 revoga execução direta, não elimina o trigger |
| Tipos antigos e migrations 1–3 | Contratos/histórico ainda presentes; migrations também criam estruturas atuais | Não remover arquivos inteiros como limpeza financeira |
| Aba interna `metas` / props aoIrParaMetas | Nome interno reutilizado; mostra Materiais/Contribuir | Não expõe tela financeira por esse nome |
| Buckets/imagens antigas | Sem inventário remoto completo; imagens legadas não importadas | Decisão posterior, sem exclusão |

O fluxo de contribuição física não chama pagamentos/PIX/trigger financeiro.
Entretanto, a exposição no perfil da gestão impede concluir ausência total de PIX.
Permissões das APIs antigas e quaisquer buckets financeiros continuam pendentes.

## Decisões e correções antes da homologação geral

- Prioridade máxima: obter catálogo remoto e provar que cadastro não concede
  gestão e que tabelas originais não expõem/escrevem dados indevidamente.
- Resolver achados reais do catálogo por migrations incrementais, somente após
  conhecer a base. Não reconstruir schema fictício nem declarar segurança integral.
- Aprovar tratamento visual dos campos PIX ainda acessíveis, preservando banco e
  contratos nesta etapa. Nenhuma remoção foi realizada.
- Coordenar atualização do app com migration 10 e validar chamadas antigas negadas.
- Executar concorrência real, Storage/Authentication reais e Android; registrar
  evidência de respostas e estado final para cada cenário.
- Inventariar divergências históricas antes de qualquer decisão sobre certificados.

Não há nova migration proposta apenas para produzir alterações nesta auditoria.
A próxima etapa é auditoria controlada do ambiente de homologação, começando pela
base original. Resultado local favorável não significa aprovação para produção.
