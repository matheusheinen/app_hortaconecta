# Reconciliação 1C — definição da primeira migration

Data: 29/09/2026. Projeto: HortaConecta (`hnawclapixopwjyrpxpq`).
**Somente análise. Nenhuma migration SQL foi criada ou aplicada.**

## 1. Primeiro conflito escolhido

**RECOMENDAÇÃO TÉCNICA:** começar pelo contrato de **identidade, perfil e endereço**, com nome conceitual `reconciliacao_01_base_perfis_endereco`. Não há timestamp/arquivo SQL definido nesta entrega.

O aplicativo lê/escreve endereço livre em usuarios, enquanto o remoto o transferiu para sete campos em voluntarios e para a configuração institucional. Além disso, as RPCs de perfil usadas pelo app não existem remotamente. Esse conflito impede carregar/salvar corretamente o perfil e antecede elegibilidade, candidaturas e propostas.

Isso é a primeira unidade de compatibilização, **não a afirmação de que endereço é mais grave que as falhas de segurança**. INSERT administrativo de inscrições, leitura pessoal ampla e grants excessivos permanecem bloqueadores de liberação. A migration de perfis deve ser preparada primeiro, mas não autoriza disponibilizar o MVP sem o lote de segurança.

Não começar por materiais/Diário/certificados, que dependem de identidade/gestão consistente. Não começar por recalcular vagas, cuja regra ainda exige decisão. Não restaurar usuarios.endereco para executar o SQL antigo.

## 2. Evidências e limites da conferência

Fontes: relatórios 1A/1B/PLANO_RECONCILIACAO_SUPABASE, todas as dez migrations locais, tipos/serviços de perfil e definições remotas. Foram executadas **duas consultas SELECT**, sem chamar função de negócio, alterar dados ou avançar sequences. A captura principal ocorreu em 29/09/2026 às 18:54:39 UTC.

**CONFIRMADO novamente:**
- usuarios.endereco ausente;
- voluntarios possui cep, logradouro, numero, complemento, bairro, cidade e uf;
- configuracao_instituicao.endereco existe; ongs não tem endereço;
- voluntariado_privado ausente;
- voluntariado_salvar_perfil, voluntariado_elegibilidade e gestao_salvar_perfil ausentes;
- perfil_completo(uuid) exige endereço mínimo, habilidade e demais dados;
- ledger permanece com 11 versões: três compartilhadas, sete locais ausentes e oito remotas exclusivas;
- cinco usuarios, cinco voluntarios, uma linha ongs; uma conta ONG sem complemento;
- um complemento com rua/número/cidade preenchidos;
- duas metas e duas contribuições legadas; função/trigger financeiro presentes;
- policies e triggers de perfil consultados correspondem à 1B.

Não encontrei mudança nesses objetos desde a 1B. Não repeti inventário completo de Storage, atividades ou dados nesta etapa restrita. Consultas administrativas não comprovam JWT/RLS funcional, origem do provisionamento ou necessidade de clientes antigos.

## 3. Objetos envolvidos e fronteira do primeiro lote

| Objeto | Estado/uso | Tratamento proposto |
|---|---|---|
| usuarios | id, tipo_perfil, nome, telefone, descricao, perfil_instagram e demais campos; sem endereco | Preservar estrutura e dados; RPC escreve somente campos pessoais permitidos. |
| voluntarios | Dados pessoais, disponibilidade e sete campos de endereço | Usar como fonte do endereço pessoal; não adicionar campo duplicado. |
| ongs | Dados legais/institucionais da conta e PIX legado | Salvamento transacional junto de usuarios; preservar campos omitidos. |
| configuracao_instituicao | Nome oficial, endereço institucional, cidade/UF | Preservar; primeira RPC de perfil não deve alterá-la implicitamente. |
| habilidades | Catálogo existente | Somente validar IDs recebidos; não modificar catálogo. |
| usuario_habilidades | PK composta e FKs CASCADE | Atualização atômica dos vínculos próprios quando usuário salvar; nenhum backfill na implantação. |
| auth.users / handle_new_user / on_auth_user_created | Cadastro fixo VOLUNTARIO e complemento | Preservar; não implementar provisionamento de gestão nessa migration. |
| proteger_campos_perfil / trg_proteger_campos_perfil | Protege tipo_perfil sob papéis de cliente | Preservar; nova RPC nunca aceita papel/identidade no payload. |
| set_atualizado_em e triggers de usuarios/voluntarios/ongs | Atualizam timestamp | Preservar e testar disparo/rollback transacional. |
| e_ong(uuid) | Usado por policies antigas, inclusive legado | Não remover nem mudar a semântica nesta primeira unidade. |
| perfil_completo(uuid) | Elegibilidade remota, usada por policies antigas | Unificação proposta abaixo depende de aprovação e testes de impacto. |
| voluntariado_privado | Ausente | Criar futuramente schema fechado e helpers estritamente necessários a perfis. |
| Triggers históricos de atividades | Ausentes | Fora deste primeiro lote; dependem da reconciliação de voluntariado. |

**Constraints a manter:** usuarios PK/FK auth.users, checks de nome/telefone/descrição/Instagram; voluntarios PK/FK usuarios, UNIQUE cpf, checks CPF/nascimento/CEP/UF; ongs PK/FK usuarios, UNIQUE cnpj e checks CNPJ/WhatsApp; usuario_habilidades PK e FKs de usuário/habilidade. Não ampliar NOT NULL sobre endereços existentes incompletos. A completude é regra de elegibilidade, não condição para conseguir salvar um perfil parcial.

Não é necessária nova tabela, coluna de endereço, índice ou alteração dessas constraints para resolver o conflito escolhido.

## 4. Especificação proposta da migration

### 4.1 Preflight e transação

Antes de escrever qualquer objeto, conferir assinaturas, tipos/constraints essenciais, ausência das novas RPCs/schema ou sua definição exata se houver drift, owner/grants e ledger aprovado. Abortamento explícito em divergência, não IF NOT EXISTS mascarando incompatibilidade.

Preparar um lote transacional de DDL, sem UPDATE/INSERT de dados cadastrais durante sua aplicação. O DML existirá somente no corpo das futuras RPCs, executado após requisição autorizada do usuário. Não confundir definição de função com execução de seus comandos.

### 4.2 Helpers privados

Proposta:
- gestao(): verificar auth.uid() e tipo_perfil persistido, não metadata fornecida pelo cliente;
- disponibilidade_valida(jsonb): reutilizar validação local de array, dias/períodos, formato e duplicidade;
- elegivel(uuid): predicado interno de voluntário, dados pessoais, disponibilidade válida/não vazia, habilidades e endereço mínimo aprovado.

Schema sem USAGE/CREATE para papéis clientes; funções privadas sem EXECUTE para PUBLIC/anon/authenticated. Serão chamadas pelas RPCs privilegiadas com owner explicitamente revisado. Nenhuma consulta pública de UUID arbitrário será criada. Qualificar objetos e usar search_path seguro; não conceder privilégios adicionais de tabelas para fazer o helper funcionar.

O helper gestao local é INVOKER e, quando chamado por RPC DEFINER, usa o contexto privilegiado da RPC. Não usá-lo indiscriminadamente em policies de usuarios, evitando desenho recursivo. Política de privacidade global é outro lote.

### 4.3 RPCs públicas

Manter nomes/assinaturas de transporte esperados, mas adaptar o contrato JSON:

| RPC | Assinatura/retorno proposto | Regra |
|---|---|---|
| voluntariado_salvar_perfil | p_dados jsonb, p_habilidades bigint[] → boolean | Salvar próprio perfil e vínculos numa transação; retornar elegibilidade atual, inclusive false quando salvo incompleto. |
| voluntariado_elegibilidade | Sem argumentos → boolean | Avaliar somente auth.uid(); sem parâmetro público de outro usuário. |
| gestao_salvar_perfil | p_dados jsonb → boolean | Conta deve ser ONG; atualizar próprio usuario/complemento; true somente após sucesso completo. |

Rejeitar sessão ausente/conta de perfil inadequado nas operações de salvamento. Na consulta de elegibilidade, conta ausente não pode resultar true; manter false ou erro controlado conforme contrato local documentado, sem confundir com salvamento.

RPCs de escrita: SECURITY DEFINER apenas pelo motivo de atomicidade/acesso controlado, owner revisado, search_path vazio e nomes qualificados; EXECUTE negado a PUBLIC/anon e concedido somente a authenticated. Os privilégios padrão remotos são amplos: revokes e grants devem ocorrer dentro da mesma transação antes da liberação.

Nunca montar SQL dinâmico a partir do JSON. Lista explícita de campos aceitos; rejeitar id, usuario_id, tipo_perfil e atributos administrativos. Não atualizar foto_perfil, exclusao_solicitada_em ou datas de criação se não fizerem parte do formulário.

### 4.4 Semântica de atualização sem perda

**RECOMENDAÇÃO TÉCNICA:**
- Campo omitido: preservar valor existente.
- Null explícito em campo opcional: remoção intencional, validada.
- String vazia em campo opcional: normalização documentada para null; obrigatórios vazios geram erro.
- JSON de tipo errado ou chave antiga endereco: erro controlado de contrato desatualizado, não sucesso silencioso nem tentativa de repartir o texto.
- Endereço do voluntário: sete chaves explícitas no p_dados, sem inferir número/bairro/cidade.
- p_habilidades: array obrigatório de IDs válidos; [] significa limpar seleção explicitamente, null não significa apagar. Deduplicar IDs; conferir catálogo antes da atualização.
- Conservar relações não enviadas e evitar apagar/reinserir vínculos idênticos desnecessariamente. Alteração de seleção pelo próprio usuário pode remover vínculos, dentro da RPC, após autorização; a implantação não remove nenhum.
- Permitir salvar incompleto; elegibilidade pode ficar false.
- Locks em ordem única: usuarios → complemento correspondente → vínculos. Confirmar linhas afetadas e propagar falha para rollback integral.
- Não copiar automaticamente nome/razão social/endereço entre usuários e configuração.

Locks serializam chamadas, mas não resolvem sozinho formulário antigo sobrescrevendo valor alterado por outro cliente. Atualização parcial reduz perda por omissão, não é controle de versão. Testar duas gravações; não prometer conflito otimista de perfil que o MVP ainda não implementa.

### 4.5 Complemento ausente da gestão

O local atual faz UPSERT de ongs, mas há uma conta ONG remota sem complemento.

**DECISÃO PENDENTE:** permitir que conta já provisionada como ONG crie seu próprio complemento no salvamento, ou exigir regularização administrativa?

Recomendação conservadora para o primeiro corte: erro controlado e rollback integral quando complemento obrigatório estiver ausente, até aprovação da alternativa. Isso é mudança em relação ao UPSERT local e precisa ser aprovada; não será adotada silenciosamente. Não inserir uma linha vazia durante a migration e não promover usuário comum.

### 4.6 Elegibilidade antiga e nova

Não manter dois predicados de “perfil completo” divergentes indefinidamente.

**Proposta sujeita à aprovação:** preservar assinatura/default de perfil_completo(uuid DEFAULT auth.uid()) e seu ramo ONG, mas reutilizar o helper interno para o ramo VOLUNTARIO. voluntariado_elegibilidade usa o mesmo helper somente para o usuário atual.

Impacto: validação local é mais estrita que a remota quanto a profissão não vazia e slots de disponibilidade. Isso pode tornar contas antes elegíveis inelegíveis **sem alterar seus dados**, afetando policies antigas de candidaturas e OFICINA_AUTORAL. A exigência rua/número/cidade também depende da decisão registrada na 1B. Deve haver comparação agregada do predicado antigo/novo em reprodução fiel antes de aprovar substituição.

Se essa unificação não for aprovada, não declarar a primeira migration concluída com contrato reconciliado; redefinir seu escopo explicitamente. Não substituir perfil_completo de forma silenciosa. O retorno ONG do helper antigo não transforma gestão em voluntário elegível nas RPCs novas.

### 4.7 Policies e grants existentes

Policies envolvidas: leitura/edição própria de usuarios; leitura própria/gestão e INSERT/UPDATE próprios de voluntarios; leitura ampla e INSERT/UPDATE próprios de ongs; leitura própria/gestão e INSERT/DELETE próprios em usuario_habilidades. Indiretamente, policies de atividades/inscrições dependem de perfil_completo.

**Escopo delimitado recomendado:** primeira migration controla acesso aos objetos novos, mas não altera globalmente essas policies nem e_ong. O lote de segurança posterior tratará SELECT amplo, escrita direta e grants excessivos. A atualização de perfil_completo pode alterar o resultado de policies sem alterar seu texto: registrar isso como impacto de autorização.

Assim, “RPC atômica” significa atomicidade daquela operação, não garantia de que todos os clientes remotos só consigam usar esse caminho. As escritas diretas antigas continuam até o corte autorizado de segurança. Não liberar homologação integrada antes desse corte. Não revogar writes antigos agora sem conhecer consumidores e oferecer a substituição coordenada.

## 5. Preservação do legado financeiro

Preservar integralmente:
- ongs.chave_pix, nome_beneficiario_pix e demais campos;
- metas_demandas e contribuicoes, IDs, quantidades, estados e comprovante opcional;
- atualizar_arrecadacao_meta, trg_contribuicoes_arrecadacao, policies, enums e grants existentes desse fluxo;
- e_ong e sua semântica usada pelo legado.

A futura RPC de gestão deve manter valor de PIX omitido do payload; alteração explícita desses campos pelo próprio perfil segue o contrato legado autorizado, sem remoção implícita. Não limpar campos por não fazerem parte da versão física do MVP. Não reenviar automaticamente null porque uma tela não os carregou.

Teste de regressão precisa provar que salvar nome/endereço pessoal não toca metas/contribuições, configuração institucional ou PIX omitido. A unificação de perfil_completo preserva o ramo ONG, mas também requer testar consumidores antigos. Não afirmar que nenhuma função compartilhada tem impacto só porque tabelas financeiras não foram alteradas.

## 6. Dependências antes de preparar/aplicar

1. Aprovar propriedade dos endereços e elegibilidade, política para complemento ONG e contrato de payload.
2. Definir estratégia de deploy/ledger: sete migrations pendentes contêm CREATE SCHEMA/CREATE FUNCTION e referências antigas. A nova migration cria alguns desses mesmos nomes; executá-las depois causaria colisões. Preservar arquivos históricos, mas definir sequência ativa verificável. Nenhum repair fictício.
3. Inventariar ambientes onde as sete possam ter sido aplicadas; não assumir um único histórico universal.
4. Obter backup recuperável, catálogo/ACL/funções anteriores e ensaio de restauração em ambiente isolado.
5. Reproduzir base remota: fixtures atuais têm endereco antigo, helpers falsos/simplificados e não bastam.
6. Preparar adaptação mínima do app em trabalho posterior e janela de corte com consumidores antigos conhecidos.
7. Revisar o lote de segurança dependente antes de liberar clientes; resolver INSERT de inscrições/privacidade no corte apropriado.
8. Autorizar separadamente implantação e testes JWT que gravem dados fictícios.

A decisão de vagas não bloqueia escrever o desenho dos perfis, mas bloqueia a reconciliação completa de voluntariado. Materiais, Diário, oficinas, certificados e Storage não precisam ser criados nessa primeira migration.

## 7. Arquivos envolvidos

### Entrega atual

Somente docs/reconciliacao/RECONCILIACAO_1C_PRIMEIRA_MIGRATION.md.

### Referências SQL, sem editar migrations históricas

- 20260914120000_completa_modelo_dados.sql: tabelas de perfis/vínculos, constraints e legado.
- 20260923120000_fluxo_voluntariado.sql: helpers, RPC voluntário e elegibilidade.
- 20260924210000_coerencia_mvp.sql: RPC de gestão atômica.
- Demais sete arquivos locais: dependências, nomes futuros e ordem; não aplicar por arrasto.

Futuro arquivo novo: nome conceitual reconciliacao_01_base_perfis_endereco; timestamp e posição só após estratégia do histórico. Nenhum SQL criado aqui.

### Arquivos que exigirão adaptação posterior

| Arquivo | Motivo |
|---|---|
| src/lib/database.types.ts | Retirar contrato fictício usuarios.endereco e representar endereço remoto/configuração. Não alterar dados ao alterar tipos. |
| src/telas/TelaPerfilVoluntario.tsx | SELECT/payload/formulário para sete campos; distinguir incompletude de falha. |
| src/telas/TelaPerfilOng.tsx | Remover uso do endereço pessoal inexistente; não redirecionar silenciosamente campo à configuração; tratar complemento ausente conforme decisão. |
| src/lib/perfilGestao.ts | Contrato tipado/validação do payload e tratamento de retorno/erro. |
| src/lib/voluntariado.types.ts | Documentar payload/retorno de perfil e elegibilidade; contratos derivados devem continuar compilando. |
| src/lib/regrasVoluntariado.ts | Conferir alinhamento de validação com servidor, sem inventar regras novas. |
| tests/fixtures/base-voluntariado.sql ou futura fixture de reconciliação separada | Reprodução fiel do estado remoto, preservando testes antigos. |
| tests/auth-perfil.test.cjs, tests/banco-voluntariado.test.cjs, tests/coerencia-mvp.test.cjs | Cobrir novo contrato e atomicidade, além de testes específicos da reconciliação. |
| docs/mvp/VOLUNTARIADO.md, docs/mvp/CORRECOES_MVP.md, docs/auditoria/SEGURANCA_BASE.md e CLAUDE.md | Atualizar somente depois da implementação/validação real. |

Revisar consumidores src/lib/tipos.ts, contratos derivados e src/lib/useSessao.ts; não presumir que todos precisarão de mudança. Nenhum desses arquivos foi alterado.

## 8. Validação e critérios de aceite

### Antes, em ambiente isolado fiel

- Comparar catálogo com remoto e registrar contagens/valores sintéticos representativos.
- Ensaiar migration integral e abortamento com precondição incompatível; não aplicar as sete antigas para montar um banco diferente.
- Garantir zero alterações de dados na aplicação, incluindo endereços/PIX/vínculos/status e timestamps cadastrais.
- Conferir ACL de todas as assinaturas novas, ausência de EXECUTE PUBLIC/anon e schema privado inacessível.
- Verificar que nenhuma RPC faz referência a usuarios.endereco e que todos os helpers resolvem com search_path vazio.
- Comparar perfil_completo antigo/novo em casos completos/incompletos/slots inválidos, incluindo ramo ONG.
- Testar colisão de CPF/CNPJ, skill inexistente e erro no segundo UPDATE: tudo deve reverter, inclusive primeiro UPDATE e vínculos.

### Depois, no remoto somente com autorização

Usar JWT real de dois voluntários e gestão, não postgres/service_role para provar isolamento:
- sessão inválida/expirada e perfil errado negados;
- payload com id/tipo_perfil/usuario_id negado;
- autor não escolhe outra conta;
- endereço completo, parcial, omitido, null e formato inválido;
- salvamento parcial válido retorna false de elegibilidade, sem aparentar erro;
- habilidade duplicada, vazia, inválida e falha intermediária;
- ONG sem complemento conforme decisão, sem usuário atualizado parcialmente;
- valores PIX omitidos preservados; configuração e metas intocadas;
- duas gravações concorrentes: sem combinação parcial de perfil/habilidades;
- clientes antigos/perfil_completo e cadastro Auth continuam com comportamento aprovado.

Typecheck/suíte e teste Android de carga/salvar/recarregar/erro após a futura adaptação. Bundle não prova banco nem dispositivo.

**Critério de sucesso limitado:** contrato de perfil funciona sem perda e com autorização/atomicidade das RPCs. Não significa que inscrições, vagas ou todo o MVP estão reconciliados. Testes que não forem executados devem permanecer pendentes.

## 9. Recuperação e reversão

**NÃO COMPROVADO:** backup/PITR e restore deste projeto. Conferir antes da implantação; o relatório não é backup.

- Falha antes do commit do lote SQL: abortar transação, mantendo estado anterior; conferir catálogo e ledger da ferramenta.
- Após implantação, antes de uso: restaurar definição anterior de perfil_completo/ACL a partir de cópia revisada, mediante nova autorização. Suspender acesso às RPCs novas se necessário; manter schema/objetos inativos em vez de apagar tabelas/dados.
- Após uso: não restaurar indiscriminadamente dados antigos. RPCs transacionais previnem estado parcial, mas entradas válidas já salvas são dados novos legítimos. Preferir correção progressiva e suspensão da operação afetada.
- Não há rollback automático de salvamentos legítimos nem de escolhas de negócio. Retornar ao app atual também não recupera o perfil, pois ele já é incompatível com o remoto anterior.
- Restore de banco é último recurso, com risco de perder escritas posteriores, janela/RPO aprovados e reconciliação dos dados recentes.
- Não reabrir vulnerabilidades de policies/grants como mecanismo de retorno. Não modificar ledger manualmente para esconder lote.
- Guardar evidência de schemas/funções/ACL, versão de app e configuração necessárias ao retorno em local restrito, sem segredos ou dados pessoais no Git.

Nenhum mecanismo de recuperação foi executado ou certificado nesta análise.

## 10. Riscos e decisões para aprovação

| Decisão | Recomendação, ainda não aprovada | Impacto |
|---|---|---|
| Endereço pessoal | Preservar sete campos em voluntarios, adaptar app | App atual precisa mudar; migration isolada não basta. |
| Institucional | Permanecer no singleton, fora da RPC de perfil | Campo antigo da tela ONG não pode ser migrado automaticamente. |
| Elegibilidade | Rua/número/cidade + validação local consistente | Pode restringir contas antes elegíveis; testar e aprovar. |
| ONG sem complemento | Bloquear salvamento integral até regularização, ou aprovar UPSERT próprio de conta já ONG | Uma conta afetada; não é provisionamento de papel. |
| Payload antigo | Rejeitar endereco/chaves administrativas e preservar omitidos | Cliente antigo deve receber erro controlado/ser atualizado. |
| Primeira unidade | Perfis + helpers + unificação aprovada, sem alteração global de RLS | Riscos antigos persistem até lote de segurança; sem liberação geral. |
| Sequência de deploy | Plano ativo separado/reconciliado, histórico preservado | Evitar sete pendentes executadas antes/depois e colisões. |
| Corte/retorno | Backup testado e clientes inventariados | Necessário antes de autorização de escrita. |

As decisões de vagas/recandidatura continuam pendentes para o próximo lote, sem resolução implícita nesta proposta.

## 11. Conclusão e verificação desta entrega

A primeira migration deve fornecer **perfil atômico no modelo de endereço já existente**, preservando identidade, dados e legado. Não deve tentar transformar o remoto no schema antigo.

Duas consultas remotas READ-ONLY; nenhuma alteração remota, migration SQL, backfill ou código novo. Única criação local: este relatório. Conferência SHA-256 dos arquivos preexistentes, git diff --check e git status ao final. Sem staging, commit ou push.
