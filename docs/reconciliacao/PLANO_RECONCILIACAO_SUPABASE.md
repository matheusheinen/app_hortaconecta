# Plano de reconciliação do Supabase — HortaConecta

Data de referência: 29/09/2026. Projeto remoto: `hnawclapixopwjyrpxpq`.

> **Situação em 05/10/2026.**
> - **Desfecho:** o plano foi executado em etapas (1A, 1B, 1C) e resultou nas reconciliações 01 e 02,
>   aplicadas no remoto em 30/09.
> - **Reversão de 05/10:** onde este relatório trata `metas_demandas`/`contribuicoes` como legado
>   financeiro e as tabelas de materiais como contrato do MVP, vale o contrário: metas em dinheiro e de
>   materiais são o modelo ativo, e `solicitacoes_materiais`/`contribuicoes_materiais` serão excluídas pela
>   reconciliação pendente `20261005150000` ([CONTRIBUICOES.md](../mvp/CONTRIBUICOES.md)).
> - Oficinas e certificados estão fora do MVP desde 05/10 ([ESCOPO_MVP.md](../mvp/ESCOPO_MVP.md)).
> - O estado atual do remoto está em [COMPATIBILIDADE_SUPABASE_20260930.md](COMPATIBILIDADE_SUPABASE_20260930.md).
>
> O texto abaixo preserva a análise de 29/09.

**Documento de análise, não autorização de implantação.** Nenhuma migration,
policy, grant, função, trigger, tabela, dado ou configuração remota foi alterada.
Não houve deploy. A única entrega local desta etapa é este relatório.

Fontes: dez migrations locais; código em `src/`; `CLAUDE.md`; documentos em
`docs/`; catálogo e histórico `supabase_migrations.schema_migrations` consultados
em leitura na auditoria de 29/09 e nas conferências complementares desta análise.
O SQL armazenado nas migrations remotas foi lido como texto, nunca executado.

Legenda:

- **FATO:** observado no arquivo ou catálogo identificado.
- **INFERÊNCIA:** consequência técnica da combinação observada; não equivale a
  teste de exploração com usuário final.
- **DECISÃO NECESSÁRIA:** escolha ainda não autorizada. Recomendações anteriores
  nesta conversa não são aprovação para mudar regras de negócio.
- Segurança: **compatível**, **divergente**, **risco** ou **desconhecido**.

As consultas administrativas usam `postgres`; não demonstram isolamento por JWT.
Não foi usada service_role como prova de segurança. Os 65 testes aprovados,
TypeScript e bundle são evidências locais da etapa anterior, não validação do
schema remoto reconciliado. Nenhuma suíte foi reaplicada contra o remoto.

## 1. Estado atual

### 1.1 Migrations locais versus histórico remoto

| Migration local | Histórico remoto | Estado dos objetos |
|---|---|---|
| 20260914120000_completa_modelo_dados | Aplicada | Base complementar presente, com mudanças remotas posteriores |
| 20260914121500_revoga_execucao_trigger_arrecadacao | Aplicada | Execução direta da função financeira revogada para os papéis do app |
| 20260914140000_seed_habilidades | Aplicada | Catálogo de habilidades existente |
| 20260923120000_fluxo_voluntariado | Ausente | Novas RPCs/check-in ausentes; há solução alternativa de vagas |
| 20260924120000_valida_seguranca_voluntariado | Ausente | Não existem as restrições adicionais de inscrições |
| 20260924140000_contribuicao_materiais | Ausente | Tabelas/RPCs novas ausentes |
| 20260924160000_diario_transparencia | Ausente | Diário ainda antigo; bucket ausente |
| 20260924180000_propostas_oficinas | Ausente | Propostas privadas ausentes |
| 20260924200000_certificados | Ausente | Emissão persistida ausente |
| 20260924210000_coerencia_mvp | Ausente | Revisão do Diário, perfil ONG atômico e congelamento histórico ausentes |

O histórico remoto contém 11 versões: três compartilhadas e oito exclusivas,
detalhadas na seção 3. Estar no ledger não prova igualdade byte a byte com um
arquivo local; o estado efetivo foi comparado pelo catálogo. As versões mais
recentes remotas não incluem as sete pendentes do MVP.

### 1.2 Tabelas e contratos

“Somente local” significa definida em SQL/contrato local, não banco local em uso.

| Situação | Objetos |
|---|---|
| Definidos localmente e ausentes remotamente | `solicitacoes_materiais`, `contribuicoes_materiais`, `propostas_oficinas`, `certificados`, `voluntariado_privado.tokens_checkin`; schema privado também ausente |
| Remoto, sem definição nas dez migrations locais | `atividade_habilidades`; a criação original de usuarios/voluntarios/atividades também só está no histórico remoto, embora o app local já use essas tabelas |
| Nos dois, mas com diferenças relevantes | `usuarios`, `voluntarios`, `atividades`, `inscricoes_atividades`, `diario_transparencia`, `configuracao_instituicao`, `contribuicoes` |
| Nos dois, sem conflito estrutural principal identificado | `ongs`, `habilidades`, `usuario_habilidades`, `metas_demandas`; permissões e legado continuam exigindo análise |

Diferenças: usuarios perdeu endereco; voluntarios ganhou sete campos de endereço;
atividades ganhou vagas_ocupadas; inscrições não têm decisão/check-in/horas;
Diário não tem texto/status/caminho/revisão; configuração ganhou endereco;
contribuicoes tornou url_comprovante opcional e ganhou policy administrativa.
Não confundir `diario_transparencia` antiga, que existe, com ausência total da tabela.

Inventário agregado observado, sem copiar dados pessoais:

| Estrutura | Quantidade | Preservação necessária |
|---|---:|---|
| usuarios | 4 | Identidade, nome, contatos, perfil e datas |
| voluntarios | 4 | Dados pessoais, endereço e disponibilidade |
| ongs | 1 | Dados legais/PIX; há duas contas ONG, uma sem complemento |
| atividades | 2 | Ambas TAREFA_ONG/ABERTA; preservar IDs, agenda, horas e autoria |
| inscrições | 2 | Uma PENDENTE e uma APROVADA, ambas sem presença |
| atividade_habilidades | 2 vínculos | Preservar áreas já cadastradas |
| Diário | 0 | Recontar antes de implantar; não presumir vazio permanente |
| metas_demandas | 1 | Tipo MATERIAL, dentro do contrato legado compartilhado |
| contribuicoes | 1 | APROVADA; preservar vínculo e recebimento |
| configuração institucional | 1 | Nome oficial e endereço institucional |

Um dos quatro complementos de voluntário tem logradouro/número/cidade completos.
Não inferir que os outros três sejam todos voluntários ativos: cadastro cria
complemento antes de eventual provisionamento administrativo de gestão.
Na fotografia auditada, zero presenças e nenhum contador de vagas divergente
segundo a regra remota atual. Isso não prova ausência de corridas futuras.

## 2. Matriz de divergências

| Área | Local | Remoto | Divergência | Impacto | Decisão necessária |
|---|---|---|---|---|---|
| Endereço | usuarios.endereco | Sete campos em voluntarios | Fonte/payload diferentes | Perfil local falha ao carregar/salvar | Preservar estruturado é a recomendação; aprovar contrato final |
| Perfil completo | Habilidades, dados pessoais e disponibilidade validada | Também exige rua, número, cidade; disponibilidade só testada como array não vazio | Duas elegibilidades | Candidato pode passar numa regra e falhar noutra | Unificar predicado e confirmar exigência de endereço |
| Vagas | Somente aprovados ocupam | Pendentes + aprovados reservam | Capacidade em momentos distintos | Trigger remoto interfere na RPC local | DECISÃO NECESSÁRIA: qual momento reserva vaga |
| Atividades | Proteção histórica adicional | CRUD direto por gestão; autor edita oficina pendente | Sem congelamento/exclusão protegida | Histórico pode mudar | Aprovar corte dos caminhos antigos, preservando registros |
| Inscrições | RPCs, estado inicial fixo, cancelamento final | Escrita direta, recandidatura, INSERT sem proteção de presença/status | Estados/autorização diferentes | Autoatribuição administrativa não bloqueada no INSERT | Fechar falha; confirmar fim de recandidatura e prazo de cancelamento |
| Materiais | Tabelas próprias, inteiros, recebimento por RPC | Meta MATERIAL e contribuição antiga | Modelos não equivalentes | Importação cega duplicaria entregas | Preservar legado separado; decidir eventual importação depois |
| Diário | Texto, status, revisão | Apenas tabela antiga | Sem ocultação/conflito | App novo não opera | Implantar contrato revisado desde o início |
| Oficinas | Propostas privadas, sem evento | OFICINA_AUTORAL em atividades | Proposta confundida com atividade | Dois caminhos incompatíveis | Novas propostas no modelo MVP; destino do caminho antigo |
| Certificados | Snapshot e UUID por presença real | Ausentes | Sem infraestrutura de emissão | Não pode habilitar app ainda | Nenhuma emissão retroativa automática |
| Check-in | Token temporário privado e RPC | Booleano de presença | Sem evidência/token/hora | Aprovação não comprova presença | Usar check-in seguro; preservar legado sem fabricar evidência |
| Storage | Bucket privado de 5 MiB | Zero buckets/objetos/policies | Infraestrutura ausente | Upload/assinatura falham | Parâmetros já aprovados; conferir novamente antes de criar |
| Configuração institucional | Nome oficial usado no certificado | Singleton com endereço adicional | Tipos locais incompletos | Risco de confundir perfil da conta com instituição | Definir edição do endereço institucional; não renomear instituição |
| Financeiro/PIX | Legado preservado, fora de materiais | Tabelas/policies/trigger ativos | Remoto também registra materiais pelo legado | Limpeza destruiria evolução válida | Não remover; decidir migração funcional separadamente |
| Usuários | Novas RPCs, base original não versionada | SELECT amplo autenticado | Privacidade insuficiente | Telefone e outras colunas acessíveis | Escopo mínimo de leitura por finalidade |
| Voluntários | Endereço ausente do tipo, nova RPC atômica | Endereço estruturado e writes próprios | Contrato/validação diferentes | Falha de perfil e elegibilidade | Escrita transacional e preservação de dados omitidos |
| ONG | RPC atômica esperada | UPDATE próprio, SELECT amplo | Sem atomicidade obrigatória | Dados parciais e exposição de PIX | Restringir leitura; definir complemento ausente |

## 3. Migrations remotas fora do repositório

As oito definições foram obtidas do histórico remoto nesta sequência de auditoria.
As recomendações abaixo não autorizam reaplicação, descarte ou substituição.

### 3.1 20260914025837_remote_schema

**FATO:** dump de schema com CREATE SCHEMA public; enums status_atividade,
tipo_atividade e tipo_perfil; tabelas usuarios/voluntarios/atividades; identity
de atividades; PKs; UNIQUE cpf; FKs usuarios→auth.users CASCADE,
voluntarios→usuarios CASCADE e atividades→usuarios RESTRICT. Constraints incluem
limites de nome/título, telefone, Instagram, CPF/nascimento, vagas 1–500 e carga
numeric(5,2) positiva. Índices atividades_agenda_idx e atividades_autor_idx.

Funções: e_ong(uuid default auth.uid()), perfil_completo(uuid default auth.uid()),
handle_new_user(), proteger_campos_perfil(), set_atualizado_em(),
solicitar_exclusao_conta(). Triggers de updated_at nas três tabelas, proteção de
perfil e on_auth_user_created em auth.users. RLS habilitada; policies de leitura/
escrita de atividades, leitura ampla/update próprio em usuarios, leitura
própria/gestão e insert/update próprios em voluntarios.

handle_new_user cria sempre VOLUNTARIO e complemento; não lê tipo_perfil dos
metadados. proteger_campos_perfil bloqueia troca do papel quando current_user
é anon/authenticated, mas libera executores administrativos. Cadastro é
dependência do useSessao e das telas de perfil.

**Equivalente local:** tipos e fixture parcial, não baseline fiel. **Recomendação:**
incorporar como histórico e preservar funções válidas, com correções novas de
segurança. O dump não deve ser executado como bootstrap cego: CREATE SCHEMA public
pode colidir com schema já provisionado; Auth é dependência externa; grants e
revokes efetivos auditados não estão todos descritos nesse dump. Ele não substitui
o catálogo final nem garante reconstrução completa por si só.

### 3.2 20260927213000_controle_vagas_candidatura

Adiciona atividades.vagas_ocupadas integer NOT NULL DEFAULT 0, preenche contando
PENDENTE/APROVADA e cria atividades_vagas_ocupadas_check (0..vagas_totais).
Cria atualizar_vagas_ocupadas() SECURITY DEFINER e trg_inscricoes_vagas AFTER
INSERT/UPDATE/DELETE; recalcula o contador da atividade obtida por coalesce de
NEW/OLD. Cria validar_transicao_inscricao() e trigger BEFORE UPDATE; bloqueia
mudança de presença por voluntário, permite cancelamento de pendente/aprovada e
retorno CANCELADA→PENDENTE. Revoga execução direta das duas funções. Substitui
policies de INSERT/UPDATE de inscrições; é modificada novamente pela 28020000.

Depende de atividades, inscrições, e_ong e perfil_completo. Equivalente parcial:
RPCs locais de candidatura/decisão/cancelamento e proteção de atividade, mas com
regra diferente. App local não usa vagas_ocupadas como autoridade.
**Recomendação:** incorporar histórico; **DECISÃO NECESSÁRIA** sobre reserva;
adaptar ou substituir implementação operacional, nunca apagar inscrições.

### 3.3 20260927220000_perfil_completo_exige_habilidades

Substitui perfil_completo(uuid), exigindo ao menos uma linha em usuario_habilidades
para voluntário, além dos campos anteriores. Não cria tabela/índice/trigger novo.
Depende do catálogo e associação da migration compartilhada. Equivalente local:
voluntariado_privado.elegivel também exige habilidade. A função é usada por
policies antigas; o app novo chama voluntariado_elegibilidade.
**Recomendação:** incorporar histórico e preservar requisito, unificando lógica.

### 3.4 20260927230000_areas_da_atividade

Cria atividade_habilidades(atividade_id,habilidade_id), PK composta, FKs CASCADE
para atividades/habilidades, índice atividade_habilidades_habilidade_idx e RLS.
Policies: SELECT autenticado; INSERT/DELETE por gestão ou autor de atividade
PENDENTE_APROVACAO. Não cria RPC/trigger. Não há equivalente nem consumo dessa
tabela no app local pesquisado. **Recomendação:** incorporar/preservar tabela e
dois vínculos; revisar escrita do caminho antigo quando oficinas forem separadas.
Não implementar sugestão por área apenas porque o schema existe.

### 3.5 20260928010000_gestao_lanca_contribuicao

Remove NOT NULL de contribuicoes.url_comprovante; documenta entrega física sem
comprovante; substitui atualizar_arrecadacao_meta() para recalcular soma APROVADA;
substitui trg_contribuicoes_arrecadacao por AFTER INSERT/UPDATE/DELETE; acrescenta
policy INSERT "contribuicoes: gestão lança o que recebeu", exigindo gestão,
APROVADA e validado_por=auth.uid(). Constraint de validação exige também data.

Depende de metas/contribuições antigas; é evolução real do legado, não equivalente
às tabelas novas de materiais. **Recomendação:** incorporar e preservar. Não
restaurar o trigger antigo que só cobria UPDATE. O app novo não usa esse caminho;
outros clientes existentes precisam ser identificados antes de limitar seu uso.

### 3.6 20260928020000_candidatura_so_para_atividade_futura

Substitui policy INSERT de inscrições: próprio usuário, perfil completo, atividade
ABERTA, data futura e vagas disponíveis. Substitui policy UPDATE: gestão ou próprio
usuário cancelando/retornando a PENDENTE; retorno depende de atividade aberta/futura.
Não cria tabela/função/trigger. Mantém cancelamento depois da data no caminho antigo.

**Equivalente local:** exigência temporal nas RPCs; divergência em recandidatura e
cancelamento após início. **Recomendação:** incorporar histórico, preservar regra
temporal e substituir policies por acesso RPC na estratégia aprovada. Mudança das
transições é **DECISÃO NECESSÁRIA**, não simples correção sintática.

### 3.7 20260929180000_endereco_em_campos

Adiciona cep/logradouro/numero/complemento/bairro/cidade/uf a voluntarios;
constraints de CEP com oito dígitos e UF com duas letras maiúsculas. Copia o antigo
usuarios.endereco não vazio para logradouro. Adiciona configuracao_instituicao.endereco,
preenche quando ausente com endereço de conta ONG e remove usuarios.endereco.
Não cria RPC/policy/trigger. A consulta desta análise apenas leu esse SQL histórico.

Depende de usuarios/voluntarios/ongs/configuração. **Equivalente local:** somente
campo livre antigo. **Recomendação:** incorporar/preservar campos e dados; adaptar
app/RPCs, sem restaurar coluna duplicada. Não repetir UPDATE de migração de endereço.
O histórico não prova que o logradouro migrado já esteja corretamente separado.

### 3.8 20260929193000_perfil_completo_exige_endereco

Substitui perfil_completo(uuid) para exigir logradouro, numero e cidade não vazios;
CEP não é obrigatório. Mantém habilidades e requisitos anteriores. Depende da
29180000; não cria outros objetos. **Equivalente local:** falta esse requisito.
**Recomendação:** incorporar histórico; preservar a exigência é a proposta, mas
confirmar regra de produto e unificar predicado. Comentário menciona ViaCEP; isso
não comprova integração no app local nem autoriza implementá-la.

## 4. Migrations locais pendentes

| Migration | Objetos e dependências | Conflito/efeito em dados | Tratamento proposto antes de implantar |
|---|---|---|---|
| 20260923120000_fluxo_voluntariado | Schema privado, tokens; colunas decidido_em/por, motivo, checkin_em, carga registrada; helpers; 12 RPCs; triggers de identidade/atividade; policies restritivas | Salvar perfil escreve coluna removida; elegibilidade ignora endereço; trigger remoto continua reservando pendentes; política antiga de leitura ainda existe até correção complementar | ADAPTAR em migration nova; integrar segurança, endereço, vagas e histórico; preservar dados antigos e deixar metadados novos nulos |
| 20260924120000_valida_seguranca_voluntariado | SELECT restritivo próprio/gestão; anon bloqueado; revoga INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER | Aplicar isoladamente interrompe cliente antigo sem fornecer RPCs | REAPROVEITAR conteúdo junto ao corte de voluntariado, com todas as dependências disponíveis |
| 20260924140000_contribuicao_materiais | Duas tabelas, FKs RESTRICT, checks inteiros/recebimento, índices inclusive pendência única, sete RPCs, RLS | Helper privado ausente; paralelo à meta MATERIAL existente; duplicação se houver importação automática | REAPROVEITAR sem copiar legado; validar contexto de gestão e leitura; decidir destino da meta antiga separadamente |
| 20260924160000_diario_transparencia | Colunas texto/status/caminho/atualizado, índices, RPCs; bucket privado e policies | Depende de helper/Storage; versão inicial sem revisão; status default PUBLICADA afeta linhas antigas que existirem; upload e banco não são transação única | ADAPTAR com revisão desde o início; preflight de conteúdo/bucket; não importar URLs legadas |
| 20260924180000_propostas_oficinas | Tabela, autor/decisor FKs, estados/revisão/checks, índices, cinco RPCs e RLS | Helper/elegibilidade ausentes; caminho antigo cria oficinas como atividade | REAPROVEITAR modelo; definir bloqueio de novas entradas antigas sem converter/apagar atividades |
| 20260924200000_certificados | Tabela snapshot UUID, UNIQUE participação, FKs RESTRICT, índice, três RPCs e RLS | Depende de novas colunas/participação; futura FK impede certas exclusões de usuário; não há evidência retroativa | REAPROVEITAR somente após histórico/check-in; nenhuma emissão automática; revisar retenção/exclusão de conta |
| 20260924210000_coerencia_mvp | Revisão/trigger e RPCs novas do Diário; revoga antigas; trigger histórico; perfil ONG atômico | usuarios.endereco ausente; RPCs/tabelas anteriores faltam; cortar RPCs quebra versões antigas | SUBSTITUIR aplicação monolítica por correções incorporadas às migrations novas; não editar arquivo histórico |

Nenhuma das sete apaga dados existentes por intenção de projeto, mas revokes,
FKs, defaults e novas validações podem bloquear clientes/operações. A função
PL/pgSQL que referencia coluna removida pode ser criada e falhar somente quando
chamada: aceitar DDL não comprova compatibilidade de execução.

Materiais: apenas recebimento confirmado aumenta quantidade; intenções não reservam;
inteiros 1..1.000.000; constraint recebido<=necessário; lock solicitação→contribuição;
conclusão cancela pendências. Não usar quantidade financeira para preencher esses
campos automaticamente. Oficinas: revisão e estado final, sem conversão em evento.
Certificados: aprovação+presença+check-in+horas previstas válidas, idempotência e
snapshot oficial; não implantar PDF ou revogação.

As três migrations locais já aplicadas continuam como histórico. Não reaplicar
CREATEs/seeds nem substituir o trigger financeiro remoto pela versão mais antiga.

## 5. Contrato de endereço

### 5.1 Dependências encontradas

| Arquivo/objeto | Dependência e adaptação futura |
|---|---|
| src/telas/TelaPerfilVoluntario.tsx | Estado perfil.endereco; SELECT explícito de usuarios.endereco; formulário livre; payload endereco. Trocar por carga/salvamento estruturados de voluntarios |
| src/telas/TelaPerfilOng.tsx | Estado/carga de u.endereco, formulário e payload. Separar dado compartilhado da instituição do perfil da conta |
| src/lib/database.types.ts | Row/Insert/Update de usuarios incluem endereco; faltam campos novos de voluntarios/configuração. Atualizar contrato após ensaio do schema reconciliado |
| src/lib/tipos.ts | Usuario/Voluntario derivam do contrato antigo; revisar consumidores, sem recriar arquitetura |
| src/lib/voluntariado.types.ts | Payload Json não impõe formato de endereço; tornar contrato documentado/coerente com nova RPC |
| src/lib/perfilGestao.ts | Payload Json genérico; delimitar campos admitidos e evitar nulos silenciosos |
| src/lib/useConfiguracaoInstituicao.ts | Já lê singleton; pode fornecer endereço institucional com tipos corretos e tratamento de carga |
| src/lib/useSessao.ts | Lê usuário próprio com select('*'); não depende explicitamente de endereco, mas entrega tipo antigo aos perfis |
| src/telas/TelaInicioVoluntario.tsx | Consome elegibilidade; mensagem deverá explicar novos requisitos se aprovados |
| src/telas/TelasOficinas.tsx | Texto de perfil completo e resultado de elegibilidade precisam refletir requisito final |
| 20260923120000_fluxo_voluntariado.sql | voluntariado_salvar_perfil escreve usuarios.endereco; elegivel não exige endereço |
| 20260924210000_coerencia_mvp.sql | gestao_salvar_perfil escreve usuarios.endereco |
| tests/fixtures/base-voluntariado.sql | Mantém endereco e helper perfil_completo fictício; insuficiente para ensaiar remoto |
| tests/auth-perfil.test.cjs, tests/coerencia-mvp.test.cjs, tests/banco-voluntariado.test.cjs | Precisam de cenários de preservação estruturada, payload antigo, rollback e elegibilidade após adaptação |
| CLAUDE.md | Tabela de usuarios ainda descreve endereco |
| docs/mvp/VOLUNTARIADO.md, docs/mvp/OFICINAS.md | Elegibilidade precisa registrar decisão sobre endereço; instrução de implantação antiga deve ser revista |
| docs/mvp/CORRECOES_MVP.md | Contrato de salvamento da gestão precisa distinguir endereço institucional |
| docs/auditoria/SEGURANCA_BASE.md, docs/auditoria/AUDITORIA_FINAL_MVP.md | Registram base antes desconhecida; conservar como retrato datado, acrescentando vínculo com evidências remotas depois |

docs/mvp/CONTRIBUICOES.md (histórico de materiais) menciona endereço como dado que não é exposto, não como campo
que precise ser transferido. docs/auditoria/AUDITORIA_SUPABASE_LEITURA.sql permanece roteiro
de leitura; não é ferramenta de migração. Documentação antiga não deve ser lida
como instrução para aplicar a sequência local sem reconciliar o histórico.

### 5.2 Estratégia recomendada, ainda não executada

Preservar modelo remoto, sem recriar usuarios.endereco. Uma RPC atômica salva
usuário+voluntário+habilidades. Validar CEP/UF quando informados; diferenciar chave
omitida (preservar) de limpeza explícita. Clientes antigos com somente endereco
devem receber erro de contrato ou tradução especificamente aprovada; nunca
decompor texto livre em número/cidade por suposição.

DECISÃO NECESSÁRIA: manter logradouro/número/cidade como elegibilidade obrigatória?
Recomendação: sim, preservando evolução remota; permitir salvar perfil incompleto
sem permitir candidatura/proposta. Revalidar na aprovação conforme regra do MVP.

DECISÃO NECESSÁRIA: endereço institucional será apenas exibido no perfil da gestão
ou editável ali? Recomendação de menor escopo: exibir a configuração existente,
sem permitir que salvar o perfil individual sobrescreva singleton compartilhado.
Nome da conta, razão social e nome oficial da instituição continuam distintos.

## 6. Regra de vagas

| Operação | Local implementado | Remoto implementado |
|---|---|---|
| Candidatar | RPC; perfil elegível, ABERTA/futura, não autor, sem inscrição anterior; PENDENTE/sem presença | INSERT direto; próprio, perfil completo, ABERTA/futura, vagas_ocupadas<total; não fixa status/presença |
| Disponíveis | Total menos APROVADAS | Total menos PENDENTES+APROVADAS |
| PENDENTE | Não reserva; fila pode exceder capacidade | Reserva vaga |
| Aprovar | Gestão não decide própria inscrição; lock atividade→inscrição; reconta aprovados e valida capacidade/perfil | Gestão altera diretamente; contador já inclui pendente; falta contrato novo de decisão |
| Cancelar | Próprio PENDENTE/APROVADA, sem presença, antes do início, ABERTA/ENCERRADA | Próprio pode cancelar após início; trigger impede alterar presença, mas não impõe guarda de presença para cancelar |
| Recandidatar | Não; CANCELADA é final | CANCELADA→PENDENTE em atividade aberta/futura |
| Recusar | Gestão sobre PENDENTE, decisão final | Gestão passa pelas policies e é isenta no trigger de transição |
| Concorrência | Ordem de locks, contagem protegida e toque da atividade na aprovação | AFTER trigger recalcula agregado e atualiza atividade; constraint limita contador, mas concorrência real não foi comprovada |
| Check-in | Somente APROVADA e token válido na janela; não altera vagas | Não existe; presença é booleano administrado diretamente |

**DECISÃO NECESSÁRIA:** reservar na candidatura ou na aprovação? Recomendação:
somente APROVADA ocupa, preservando a triagem do MVP. Isso é mudança de regra
remota, não mera sincronização técnica. Se escolhida reserva na candidatura,
RPC/UI/testes locais precisam ser adaptados; não manter dois cálculos oficiais.

Se aprovada a recomendação: preservar vagas_ocupadas como projeção de aprovados,
recalcular sem mudar inscrições, adaptar atualizar_vagas_ocupadas e seu trigger,
manter constraint coerente com aprovados, bloquear escrita arbitrária do contador.
A RPC de aprovação continua recontando sob lock; o contador não é sua única
autoridade. Alternativa é manter contador legado com significado antigo e não
usá-lo no MVP, mas a constraint atual impediria excesso de pendentes; exigiria
outro contrato e maior risco de confusão. Não é a recomendação.

Rever trigger antigo de transição junto com revogação de writes e novas RPCs;
não confiar no bypass por current_user do SECURITY DEFINER. Conferir que nenhum
trigger remanescente reintroduz reserva ou atualiza apenas a atividade nova em
uma troca de atividade. A identidade da inscrição deve ficar imutável.

DECISÃO NECESSÁRIA: adotar cancelamento final/antes do início ou preservar
recandidatura/prazo remoto? Recomenda-se o MVP, sem mudar status legados.

Histórico: preservar título/data/horas/tipo/autor desde qualquer candidatura;
descrição pode continuar orientação editável, vagas respeitam aprovados. Status
não é congelado em absoluto: precisa seguir transições administrativas da RPC,
sem UPDATE direto que as contorne. Excluir atividade com inscrições deve ser
bloqueado. Duas conexões reais devem testar primeira candidatura versus edição,
última vaga, cancelar versus aprovar, reduzir capacidade e check-in simultâneo.

## 7. Segurança

| Objeto | Local × remoto / classificação | Compatibilização proposta e limite da conclusão |
|---|---|---|
| usuarios | RISCO: SELECT true autenticado; tipos locais não definem proteção original | Leitura própria e projeções por finalidade; não ampliar leitura para resolver erro de UI. Configuração observada, exploração JWT não executada |
| voluntarios | COMPATÍVEL para isolamento entre voluntários pela policy própria/gestão; DIVERGENTE para campos/validação | Preservar dados; salvar atomicamente; decidir necessidade de acesso integral da gestão versus projeção de triagem |
| ongs | RISCO: SELECT true expõe também responsável/PIX; DIVERGENTE: não há RPC atômica | Restringir leitura própria/gestão conforme finalidade aprovada; manter configuração como apresentação institucional |
| atividades | DIVERGENTE: gestão CRUD e autoria pendente; sem congelamento | Triggers históricos, capacidade e identidade; restringir status/contador a operações controladas; preservar áreas e registros |
| inscrições | RISCO: INSERT não fixa PENDENTE/false; SELECT autor vê terceiros; escrita direta | RPCs + grants mínimos + restritivas; inserir usuário derivado de auth.uid; preservar linhas, sem forjar decisão/check-in |
| e_ong(uuid) | COMPATÍVEL como leitura do papel persistido; RISCO de consulta de qualquer UUID | Manter dependências de policies; reduzir consulta arbitrária sem criar recursão RLS |
| perfil_completo(uuid) | DIVERGENTE em endereço/disponibilidade; RISCO de consulta de terceiros | Predicado canônico com wrappers próprios/gestão; não tornar função cega à restrição necessária à aprovação |
| RPCs novas | DIVERGENTE: ausentes no remoto | Criar somente contratos revisados; SECURITY DEFINER com autorização, nomes qualificados e grants explícitos |
| RPC antiga solicitar_exclusao_conta | COMPATÍVEL: atualiza solicitação do próprio auth.uid | Preservar; não executada nesta análise; retenção de certificados futura precisa ser considerada |
| Grants | RISCO: anon/authenticated têm inclusive TRUNCATE/TRIGGER nas tabelas públicas, writes em sequências e defaults amplos | Aplicar menor privilégio futuramente, por objeto/coluna. Não assumir que RLS protege TRUNCATE; rota HTTP de exploração não demonstrada |
| Ownership | CONFIRMADO no catálogo; COMPATÍVEL com funções administrativas, mas exige controle | Tabelas públicas/funções do app: postgres; tabelas Storage: supabase_storage_admin; postgres tem BYPASSRLS. Não usar essas consultas como prova de isolamento |
| RLS | Habilitada nas tabelas públicas auditadas, FORCE RLS false | Habilitação não significa policy adequada; políticas permissivas combinam por OR; novas restritivas limitam caminhos legados |
| Cadastro | COMPATÍVEL: cria VOLUNTARIO fixo e complemento | Preservar on_auth_user_created/handle_new_user; testar signup manipulado depois, sem criar contas agora |
| Proteção de papel | COMPATÍVEL no caminho direto observado; DESCONHECIDO em integrações externas | Trigger remoto bloqueia tipo_perfil por papel do app; novo guard de identidade deve ser compatibilizado, sem duplicação desnecessária |
| Provisionamento ONG | DESCONHECIDO como processo operacional | Não existe RPC pública de promoção entre funções auditadas; definir responsável/processo; não inferir origem das duas contas ONG |
| API/JWT | DESCONHECIDO funcionalmente | Schemas expostos/pre-request não foram determinados pela sessão SQL; teste real posterior obrigatório |

Policies/grants devem ser implantados com suas RPCs já prontas, dentro de corte
coordenado. Revogar CRUD sem fornecer alternativa pode parar o app; fornecer
RPCs deixando caminhos inseguros ativos não conclui a correção. Restringir leitura
de usuarios precisa preservar acesso ao próprio papel pelas policies; usar helper
seguro sem recursão e projeções mínimas de candidatos/contribuintes/autores.

Gatilhos conhecidos: cadastro Auth; updated_at de usuarios/voluntarios/atividades/
ongs/metas/configuração; proteção de tipo_perfil; contagem de vagas; transição de
inscrição; arrecadação. Os triggers de histórico/revisão/check-in do MVP ainda não
estão presentes. Não desativar gatilhos remotos em bloco.

Nenhuma vulnerabilidade foi explorada. A ausência de INSERT/DELETE policies em
usuarios bloqueia esses caminhos normais apesar dos grants de tabela; não afirmar
que todo grant implica acesso irrestrito a linhas. O trigger financeiro ter retorno
trigger e EXECUTE revogado também não equivale a uma RPC financeira pública.

## 8. Storage

**FATO, reconferido nesta etapa:** storage.buckets vazio, storage.objects com zero
objetos, nenhuma policy em storage. RLS de objects/buckets habilitada na auditoria;
owners e triggers internos do serviço preservados. Não há imagem a importar ou
bucket financeiro observado. Revalidar esse estado imediatamente antes do deploy.

Modelo aprovado do Diário: bucket privado `diario-imagens`; um arquivo por post;
5.242.880 bytes; MIME image/jpeg, image/png e image/webp; caminho
`<uuid-gestor>/<uuid-arquivo>.<jpg|png|webp>` gerado pela RPC; upsert=false;
URL assinada 60 segundos. O app atualmente envia JPEG convertido.

| Operação | Policy a reutilizar/adaptar |
|---|---|
| SELECT | Gestão ou usuário autenticado consultando imagem vinculada a PUBLICADA |
| INSERT | Gestão, prefixo próprio, formato de caminho permitido |
| UPDATE | Proibido para objetos do bucket; substituição usa outro caminho |
| DELETE | Gestão somente se não houver vínculo com nenhuma publicação, inclusive OCULTA |
| Anon | Sem acesso a esse bucket |

Reutilizar helpers diario_gestao/diario_imagem_visivel/diario_imagem_livre e
policies restritivas específicas do bucket. Não mudar permissões de outros buckets.
Banco guarda imagem_caminho, com unicidade local; RPC verifica objeto existente
antes de vincular e exige prefixo do gestor para nova imagem. Não é FK física
para o arquivo; integridade depende da RPC e das policies de exclusão.

Upload precede gravação do post; conflito ou falha pode deixar objeto sem vínculo.
Não limpar automaticamente. Preservar referência anterior quando upload/salvamento
falhar. Ocultar impede novas leituras autorizadas; URL já assinada pode continuar
válida até expirar. Arquivo baixado não é revogado. Não importar url_imagem legada
nem excluir metadados por SQL para simular remoção física.

Riscos de implantação: bucket criado por outro processo com config diferente;
grants/policies amplas adicionais; URL temporária tratada como permanente; MIME
declarado não substitui validação do serviço. Bloquear deploy em configuração
inesperada e testar tamanho exato/acima, MIME, papel, conflito e rede via serviço real.

## 9. Legado financeiro

| Objeto | Estado ativo confirmado / uso local |
|---|---|
| ongs.chave_pix / nome_beneficiario_pix | Persistem e são lidos/escritos no perfil de gestão local e RPC planejada |
| metas_demandas | Tipo FINANCEIRA/MATERIAL, quantidade_meta/arrecadada numeric, unidade/status/imagem/prazo; SELECT autenticado e CRUD gestão pelas policies |
| contribuicoes | Quantidade numeric, url_comprovante opcional, status, validador/data/observação; SELECT próprio/gestão; INSERT pendente próprio e aprovado gestão; UPDATE/DELETE gestão |
| atualizar_arrecadacao_meta / trg_contribuicoes_arrecadacao | Ativos no modelo antigo; função SECURITY DEFINER; EXECUTE direto negado; trigger recalcula soma em INSERT/UPDATE/DELETE |
| Buckets financeiros | Nenhum bucket existe; campo URL não comprova local de armazenamento anterior |
| PilhaMetas/TelaMetas/TelaFormMeta/useOng | Código legado sem rota ativa no fluxo principal; preservar arquivos |
| expo-clipboard | Referenciado pelo fluxo antigo, sem remoção autorizada |
| TelaPerfilOng | Campos PIX ainda visíveis; não afirmar que o app inteiro já está sem referências financeiras |

A meta existente é MATERIAL e tem uma contribuição APROVADA: chamar todos esses
registros de “financeiros descartáveis” seria incorreto. Não transferir para tabelas
novas sem reconciliação de quantidades, autoria, estado e referência de origem.

INFERÊNCIA a considerar em manutenção futura: triggers de soma/contagem que usam
apenas coalesce(NEW.fk,OLD.fk) não recalculam necessariamente o antigo agregado
quando uma FK muda. Imutabilidade da identidade da inscrição resolve o caminho
novo de voluntariado; alteração de meta_id no legado merece teste separado. Nenhum
valor foi alterado ou inconsistência histórica financeira demonstrada nesta etapa.

## 10. Estratégia de reconciliação

### 10.1 Antes de escrever migrations

1. Preservar cópia recuperável e catálogo/ledger do remoto; este relatório não é
   backup nem dump completo. Não foi criado backup remoto nesta tarefa.
2. Incorporar o histórico remoto como evidência revisada, sem reaplicá-lo no remoto.
3. Aprovar contrato de endereço, reserva de vagas, cancelamento/recandidatura e
   exposição mínima de dados pessoais. Não escolher silenciosamente.
4. Definir sequência executável e destino das sete migrations pendentes locais.
   Adicionar somente arquivos novos com data maior não impede que um deploy padrão
   tente aplicar os antigos primeiro. Não usar repair do ledger para fingir execução.

**DECISÃO NECESSÁRIA — estratégia de histórico:** recomendação é preservar bytes e
rastreabilidade das sete versões locais como referência de implementação, fora
da sequência ativa dirigida a este remoto, e preparar sequência reconciliada
separada e verificável. Nenhum arquivo foi movido. Antes disso, identificar se as
sete versões já foram aplicadas em outros ambientes; esses ambientes precisam de
plano próprio. Qualquer arquivamento/reorganização futura requer aprovação e ensaio
do mecanismo de deploy. Não improvisar comando de CLI ou reordenar ledger.

### 10.2 Lotes propostos de migrations NOVAS, ainda não criadas

| Lote | Objetivo/alterações | Pré-condições e dependências | Dados afetados / risco / reversibilidade |
|---|---|---|---|
| R1 Identidade/perfis | Helpers seguros, elegibilidade unificada, RPCs atômicas no endereço aprovado, proteção de identidade | História reconciliada; contratos e finalidade de ongs/configuração aprovados | Sem backfill pessoal; futuras gravações. Alto risco de payload incompatível. Reverter acesso antes de uso, sem reabrir escalada |
| R2 Voluntariado completo | RPCs, check-in/tokens, colunas novas, regra de vagas escolhida, revisão dos triggers antigos, histórico e revokes de inscrições | R1; validar capacidade/dados; janela sem clientes antigos de escrita | Preservar inscrições e deixar evidências antigas nulas; recalcular só contador se aprovado. Alto risco; depois de uso preferir correção progressiva |
| R3 Segurança da base/caminhos antigos | Leitura mínima usuarios/ongs, grants mínimos, proteção de status/contador em atividades, compatibilização de áreas e caminho antigo de oficinas | RPCs/projeções disponíveis; consumidores conhecidos | Sem apagar dados. Alto risco de interrupção. R2/R3 no mesmo corte operacional, sem liberar estado intermediário |
| R4 Materiais | Tabelas/RPCs/RLS locais reaproveitadas | Gestão segura de R1/R3 | Novas tabelas vazias; nenhuma importação do legado. Risco médio; desativar escrita em vez de apagar registros após uso |
| R5 Diário e Storage | Evoluir tabela, revisão desde início, bucket/policies e RPCs revisadas | Gestão segura; Storage/configuração verificados; recontar publicações | Preservar campos antigos. Nenhuma importação automática. Risco médio/alto; não apagar objetos como rollback |
| R6 Oficinas | Propostas com revisão, isolamento e decisões | Elegibilidade R1 e controle do caminho antigo R3 | Não converter atividades. Risco médio; preservar novas propostas se precisar suspender |
| R7 Certificados | Snapshot, idempotência, FKs/RLS e RPCs | R2 aprovado, histórico protegido, configuração institucional conferida | Não emitir retroativamente. Risco médio/alto; não excluir snapshots após emissão |

A ordem R4/R5/R6 pode variar depois da base: não há dependência funcional entre
elas. Storage deve acompanhar ou preceder a liberação do Diário, não ficar para
depois de o usuário tentar upload. Certificados dependem do voluntariado, não de
materiais/oficinas. Revisão do Diário deve existir na primeira versão liberada.

Cada lote deve ter transação onde suportada, preflight explícito, concessões
finais revisadas, ordem de locks e verificação de pós-condições. Não tornar DDL
“idempotente” com IF NOT EXISTS que esconda schema incompatível. A aceitação do
lote depende da definição esperada, não apenas da existência do nome.

### 10.3 Portas de validação

**Banco isolado → validação → banco homologação → validação → app → Android → homologação.**

- Ensaiar sobre reprodução fiel do catálogo, preservando distinção entre dump,
  ledger e configuração Auth/Storage. Fixtures atuais não bastam. Não usar dados
  pessoais reais fora do ambiente aprovado; cópia pode ser sanitizada.
- Comparar contagens/IDs/status, endereços, vínculos, recebimentos e configuração
  antes/depois. Parar se houver transformação não aprovada.
- Testar última vaga, primeira candidatura versus edição, cancelar versus aprovar,
  duas confirmações de materiais, duas emissões e conflitos de Diário/oficinas com
  conexões independentes. PGlite em conexão única não aprova esses testes.
- Testar RLS com JWT de dois voluntários e gestão: dados cruzados, INSERT forjado,
  alteração de presença/status/identidade, token privado, funções antigas, perfil
  incompleto e expiração. Só executar escritas de teste em etapa autorizada.
- Conferir Auth real, schemas expostos, ownership, grants herdados e policies;
  verificar acesso ao próprio perfil após restrições para evitar recursão/bloqueio.
- Preparar app compatível: telas de perfil e tipos obrigatórios; textos de vagas
  e elegibilidade; não redesenhar nem adicionar funcionalidades.
- Android: troca de conta, login/logout, segundo plano, câmera, galeria, teclado,
  rede/timeout, duplo toque, recarga em conflito e compartilhamento de texto.
- Retirar clientes antigos incompatíveis durante o corte. Se isso não for
  possível, definir contrato transitório seguro antes de implantar, sem conceder
  de volta RPCs ou writes inseguros por conveniência.

### 10.4 Documentação e testes locais

Após futura implementação, atualizar documentos das prioridades para a sequência
real; manter relatórios antigos datados. Os testes atuais continuam úteis para as
regras locais, mas devem ganhar cenário com endereço estruturado, triggers remotos,
policies reais, dados legados e migração do contador. Typecheck/bundle não detectam
contrato de banco diferente se o tipo declarado estiver desatualizado.

Nesta análise não foram criados testes nem executadas operações funcionais remotas.
Ao finalizar: comparação SHA-256 dos 96 arquivos preexistentes monitorados (src,
tests, migrations, docs e arquivos principais), git diff --check e verificação do
novo Markdown. O resultado efetivo fica registrado na seção 12 após execução.

## 11. Bloqueios

**Bloqueadores de aplicação segura:**

1. Sete migrations antigas pendentes ainda estão na pasta executável, mas o remoto
   tem evolução posterior e oito versões fora do repositório.
2. usuarios.endereco não existe; telas/RPCs locais ainda dependem dela.
3. Reserva de vagas e recandidatura não têm decisão reconciliada.
4. SELECT amplo de usuarios/ongs e INSERT administrativo de inscrições continuam
   permitidos pela configuração; correção precisa acompanhar RPCs e clientes.
5. Infraestrutura de check-in, materiais, Diário, propostas, certificados e Storage
   ainda não está disponível no remoto; não liberar o app como se estivesse.
6. Não há ensaio da sequência nova sobre esse estado real nem concorrência/JWT
   funcional comprovados.
7. Processo de provisionamento de gestão e clientes externos antigos não inventariados.

**Riscos importantes:** modificar contador sem mudar consumidores; enfraquecer a
exigência de endereço sem decisão; bloquear perfis ao restringir RLS; perder os
dois vínculos de áreas; duplicar a meta MATERIAL antiga; fabricar histórico;
rollback destrutivo depois de novas emissões; confundir consulta postgres com JWT.

**Podem ficar para depois:** limpeza PIX/dependências/telas antigas; importação
assistida do legado; recomendações por área; busca CEP; limpeza de órfãos; PDF,
revogação ou validação pública de certificados. Nenhuma dessas extensões foi feita.

## 12. Próxima ação

**Primeira alteração recomendada depois desta análise:** incorporar localmente,
de forma revisada e rastreável, o histórico/schema remoto como referência de
reconciliação e aprovar a sequência ativa de deploy. Não alterar o banco primeiro.
O dump remote_schema deve ser tratado como histórico, não bootstrap executável
cego. Não modificar arquivos históricos nem marcar versões ficticiamente aplicadas.

Antes da primeira correção funcional, registrar:

- **DECISÃO NECESSÁRIA:** vaga reservada em PENDENTE ou somente APROVADA?
- **DECISÃO NECESSÁRIA:** manter endereço mínimo remoto na elegibilidade?
- **DECISÃO NECESSÁRIA:** cancelamento final e somente antes do início?
- **DECISÃO NECESSÁRIA:** escopo de leitura da gestão sobre dados pessoais e ongs?
- **DECISÃO NECESSÁRIA:** destino da sequência local pendente e clientes antigos?
- **DECISÃO NECESSÁRIA:** exibir ou editar endereço institucional no perfil da gestão?

Recomendações: somente APROVADA ocupa; preservar endereço estruturado e requisito
mínimo; preservar estados finais do MVP; leitura mínima por finalidade; endereço
institucional separado do perfil individual. Todas permanecem propostas.

Depois dessas decisões e do ensaio local, a primeira correção funcional deverá
compatibilizar contrato de perfil/endereço e autorização básica, seguida pelo
corte atômico de inscrições/vagas. Nenhuma migration deve ser aplicada nesta etapa.

### Verificação final desta entrega

- SHA-256: 96 arquivos preexistentes conferidos, nenhum alterado; inclui código,
  testes, dez migrations, documentação anterior e configurações principais.
- Único arquivo acrescentado: docs/reconciliacao/PLANO_RECONCILIACAO_SUPABASE.md.
- git diff --check: exit 0, sem erros; avisos de conversão LF/CRLF em arquivos
  que já estavam modificados antes desta tarefa.
- Markdown: 12 seções numeradas e ausência de whitespace ao fim das linhas.
- Nenhum teste de escrita remoto, nenhuma migration aplicada e nenhuma mudança
  em Auth, Storage ou dados. Não foram repetidos bundle/suíte funcional: esta
  entrega modifica somente documentação e verificou integridade local.

### RESUMO EXECUTIVO

- **Situação:** três migrations compartilhadas; sete locais pendentes; oito remotas
  exclusivas. Código local testado não significa backend compatível.
- **Principal conflito:** duas evoluções de contrato, especialmente endereço e
  momento de reserva das vagas, acompanhadas de histórico de deploy divergente.
- **Principais riscos:** leitura pessoal ampla, inscrição com campos administrativos
  livres, ausência de proteção histórica e implantação sobre triggers incompatíveis.
- **O que NÃO fazer:** aplicar toda a pasta, restaurar endereço livre automaticamente,
  reparar ledger para simular execução, apagar legado ou fabricar presença/certificado.
- **Próximo passo:** aprovar decisões e incorporar evidência remota ao plano executável
  local; depois preparar correções novas revisáveis e ensaiá-las antes do remoto.
