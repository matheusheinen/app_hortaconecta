# Reconciliação 1B — diagnóstico técnico

Data: 29/09/2026. Projeto: HortaConecta, `hnawclapixopwjyrpxpq`.
Captura de dados: 18:32–18:33 UTC (15:32–15:33 em São Paulo).

> **Situação em 05/10/2026.**
> - **Desfecho:** as divergências daqui foram tratadas pelas reconciliações 01 e 02 (30/09). Decisões D
>   adotadas: endereço mínimo rua/número/cidade e só APROVADA ocupa vaga. O `voluntariado_privado`
>   apontado como ausente passou a existir.
> - **Reversão de 05/10:** onde este relatório trata `metas_demandas`/`contribuicoes` como legado
>   financeiro e as tabelas de materiais como contrato do MVP, vale o contrário: metas em dinheiro e de
>   materiais são o modelo ativo, e `solicitacoes_materiais`/`contribuicoes_materiais` serão excluídas pela
>   reconciliação pendente `20261005150000` ([CONTRIBUICOES.md](../mvp/CONTRIBUICOES.md)).
> - Oficinas e certificados estão fora do MVP desde 05/10 ([ESCOPO_MVP.md](../mvp/ESCOPO_MVP.md)).
> - O estado atual do remoto está em [COMPATIBILIDADE_SUPABASE_20260930.md](COMPATIBILIDADE_SUPABASE_20260930.md).
>
> O texto abaixo preserva a análise de 29/09.

## 1. Objetivo

Preparar a compatibilização incremental do Supabase de homologação com o MVP local, preservando dados e evolução remota válida. **Não é uma autorização de implantação.** Foram executadas sete consultas SQL, todas SELECT: catálogo, segurança, histórico, contagens, privilégios complementares, verificações agregadas e conferência final. O SQL histórico foi lido como texto, nunca executado. Não foram chamadas funções de negócio, nextval/setval ou executadas escritas de teste.

Única escrita autorizada nesta tarefa: criação deste documento. Nenhum outro arquivo, migration, grant, policy, trigger, função, bucket ou dado foi alterado.

Fontes locais: PLANO_RECONCILIACAO_SUPABASE, RECONCILIACAO_1A_ESTRUTURA, AUDITORIA_FINAL_MVP, SEGURANCA_BASE, ../auditoria/AUDITORIA_SUPABASE_LEITURA.sql, as dez migrations, tipos, telas de perfil, serviços e fixtures. O SQL de auditoria foi usado como referência; blocos que exigem colunas/tabelas ausentes não foram executados indiscriminadamente.

Legenda:
- **CONFIRMADO:** observado em catálogo, agregados remotos ou código identificado.
- **NÃO COMPROVADO:** exige execução funcional/JWT, evidência operacional ou dados não consultados.
- **RECOMENDAÇÃO TÉCNICA:** proposta, não mudança aprovada.
- **DECISÃO DE NEGÓCIO:** escolha que precisa de aprovação antes da escrita.

As consultas rodaram como postgres, com BYPASSRLS. Não representam testes de isolamento nem uso de service_role como prova de segurança. As consultas foram separadas, não uma fotografia transacional única de todo o projeto.

## 2. Estado remoto atual

**CONFIRMADO:** PostgreSQL 17.6; 12 tabelas public, 102 colunas, 54 constraints validadas, 26 índices btree, sete enums, seis sequences identity, nove funções public e 41 policies public, todas permissivas. Dez triggers não internos em public e um de cadastro em auth.users, habilitados no modo normal.

Tabelas public: usuarios, voluntarios, ongs, atividades, habilidades, usuario_habilidades, atividade_habilidades, inscricoes_atividades, metas_demandas, contribuicoes, diario_transparencia e configuracao_instituicao. Todas owner postgres, RLS ligada, FORCE RLS desligada. PKs, FKs, UNIQUE, CHECK e índices correspondem ao inventário 1A; não identifiquei alteração estrutural nesses objetos.

Schemas não sistêmicos encontrados: public, auth, storage, extensions, vault, graphql, graphql_public, realtime, supabase_migrations e **pgbouncer**. voluntariado_privado está ausente. Não há views/materialized views de aplicação em public ou no schema privado esperado.

**Correção de cobertura da 1A:** o filtro anterior excluía nomes iniciados por pg_, omitindo pgbouncer. A consulta atual mais específica confirma pgbouncer e pgbouncer.get_auth(text). Isso não demonstra criação recente nem novo RPC de negócio; é infraestrutura de conexão. Não foi auditado internamente como parte das funcionalidades do MVP.

As seis sequences são atividades_id_seq, habilidades_id_seq, inscricoes_atividades_id_seq, metas_demandas_id_seq, contribuicoes_id_seq e diario_transparencia_id_seq: bigint, owner postgres, incremento/start/min 1, cache 1, sem ciclo. Nenhuma sequence foi avançada. Não se verificou last_value versus maior ID.

Schemas auth/storage têm owner supabase_admin; public tem owner pg_database_owner. anon/authenticated têm USAGE, não CREATE nesses três schemas. As tabelas storage.buckets/objects pertencem a supabase_storage_admin, RLS ligada e FORCE desligada. Zero buckets, zero objetos e zero policies de Storage. Extensões observadas: plpgsql, pg_stat_statements, uuid-ossp, pgcrypto e supabase_vault.

### Inventário atualizado de colunas

Nullable quando NOT NULL não aparece. As constraints detalhadas permanecem registradas na seção 5 da 1A; foram novamente consultadas, incluindo ações ON DELETE.

| Tabela | Colunas, tipos e defaults |
|---|---|
| usuarios | `id: uuid NOT NULL`; `nome: text NOT NULL`; `telefone: text`; `descricao: text`; `perfil_instagram: text`; `tipo_perfil: tipo_perfil NOT NULL DEFAULT 'VOLUNTARIO'::tipo_perfil`; `foto_perfil: text`; `exclusao_solicitada_em: timestamp with time zone`; `criado_em: timestamp with time zone NOT NULL DEFAULT now()`; `atualizado_em: timestamp with time zone NOT NULL DEFAULT now()` |
| atividades | `id: bigint NOT NULL IDENTITY ALWAYS`; `titulo: text NOT NULL`; `descricao: text NOT NULL`; `tipo: tipo_atividade NOT NULL`; `autor_id: uuid NOT NULL`; `data_hora_prevista: timestamp with time zone NOT NULL`; `vagas_totais: integer NOT NULL`; `carga_horaria: numeric(5,2) NOT NULL`; `status: status_atividade NOT NULL DEFAULT 'PENDENTE_APROVACAO'::status_atividade`; `criado_em: timestamp with time zone NOT NULL DEFAULT now()`; `atualizado_em: timestamp with time zone NOT NULL DEFAULT now()`; `vagas_ocupadas: integer NOT NULL DEFAULT 0` |
| habilidades | `id: bigint NOT NULL IDENTITY ALWAYS`; `nome_habilidade: text NOT NULL`; `categoria: text` |
| ongs | `usuario_id: uuid NOT NULL`; `cnpj: text`; `razao_social: text`; `data_criacao: date`; `responsavel_legal: text`; `chave_pix: text`; `nome_beneficiario_pix: text`; `whatsapp: text`; `atualizado_em: timestamp with time zone NOT NULL DEFAULT now()` |
| usuario_habilidades | `usuario_id: uuid NOT NULL`; `habilidade_id: bigint NOT NULL` |
| inscricoes_atividades | `id: bigint NOT NULL IDENTITY ALWAYS`; `atividade_id: bigint NOT NULL`; `usuario_id: uuid NOT NULL`; `data_inscricao: timestamp with time zone NOT NULL DEFAULT now()`; `status_inscricao: status_inscricao NOT NULL DEFAULT 'PENDENTE'::status_inscricao`; `presenca_confirmada: boolean NOT NULL DEFAULT false` |
| metas_demandas | `id: bigint NOT NULL IDENTITY ALWAYS`; `titulo: text NOT NULL`; `descricao: text NOT NULL`; `tipo: tipo_meta NOT NULL`; `unidade_medida: text`; `quantidade_meta: numeric(12,2) NOT NULL`; `quantidade_arrecadada: numeric(12,2) NOT NULL DEFAULT 0`; `url_imagem_capa: text`; `data_limite: date`; `status: status_meta NOT NULL DEFAULT 'ABERTA'::status_meta`; `criado_em: timestamp with time zone NOT NULL DEFAULT now()`; `atualizado_em: timestamp with time zone NOT NULL DEFAULT now()` |
| contribuicoes | `id: bigint NOT NULL IDENTITY ALWAYS`; `meta_id: bigint NOT NULL`; `usuario_id: uuid NOT NULL`; `quantidade_oferecida: numeric(12,2) NOT NULL`; `url_comprovante: text`; `data_envio: timestamp with time zone NOT NULL DEFAULT now()`; `status_validacao: status_validacao NOT NULL DEFAULT 'PENDENTE'::status_validacao`; `validado_por: uuid`; `validado_em: timestamp with time zone`; `observacao_validacao: text` |
| diario_transparencia | `id: bigint NOT NULL IDENTITY ALWAYS`; `titulo: text NOT NULL`; `descricao_curta: text`; `url_imagem: text`; `atividade_id: bigint`; `data_publicacao: timestamp with time zone NOT NULL DEFAULT now()`; `autor_id: uuid NOT NULL` |
| configuracao_instituicao | `id: smallint NOT NULL DEFAULT 1`; `nome_curto: text NOT NULL`; `nome_completo: text NOT NULL`; `cidade: text NOT NULL`; `uf: text NOT NULL`; `chamada: text`; `sobre: text`; `cor_primaria: text`; `cor_acento: text`; `url_logo: text`; `site: text`; `telefone: text`; `whatsapp: text`; `email_contato: text`; `atualizado_em: timestamp with time zone NOT NULL DEFAULT now()`; `endereco: text` |
| atividade_habilidades | `atividade_id: bigint NOT NULL`; `habilidade_id: bigint NOT NULL` |
| voluntarios | `usuario_id: uuid NOT NULL`; `cpf: text`; `data_nascimento: date`; `profissao: text`; `disponibilidade_horarios: jsonb NOT NULL DEFAULT '[]'::jsonb`; `atualizado_em: timestamp with time zone NOT NULL DEFAULT now()`; `cep: text`; `logradouro: text`; `numero: text`; `complemento: text`; `bairro: text`; `cidade: text`; `uf: text` |

**NÃO COMPROVADO:** configurações efetivas de schemas expostos na Data API, hooks externos, Edge Functions, secrets, política de backup, versões de clientes conectados, alterações históricas não refletidas no ledger e atividade de outros operadores durante a captura. Não se inventou equivalência entre configurações gerenciadas e schema public.

## 3. Estado local esperado

As cinco prioridades esperam:
- Voluntariado: perfil atômico, elegibilidade, candidatura/triagem por RPC, presença com token, histórico e campos protegidos.
- Materiais: solicitacoes_materiais e contribuicoes_materiais, quantidades inteiras e recebimento confirmado pela gestão.
- Diário: mesma tabela ampliada com texto/status/imagem_caminho/atualizado_em/revisao; RPCs com conflito; bucket privado.
- Oficinas: propostas_oficinas, autor, decisão, revisão e estados finais, sem evento automático.
- Certificados: snapshot imutável, UUID, participação única, aprovação + check-in + horas previstas registradas.

O local ainda espera usuarios.endereco. Não modela os sete campos de endereço remoto nem vagas_ocupadas/atividade_habilidades no contrato original. A pasta de migrations não cria a base inicial completa. Fixtures não são baseline de produção.

O plano anterior menciona “12 RPCs” na migration de voluntariado: a definição local contém **11 funções públicas voluntariado_***, além dos helpers privados. Esta contagem foi conferida no SQL; não é mudança funcional.

## 4. Diferenças confirmadas

Classificação de fonte de verdade proposta: A contrato MVP; B preservar evolução remota; C compatibilizar; D decisão de negócio; E legado temporário. As letras são recomendações de tratamento, não autorização.

| Divergência | Classe | Direção proposta / limite |
|---|---|---|
| Endereço estruturado | B + C | Preservar colunas/valores e adaptar contrato local. |
| Endereço obrigatório na elegibilidade | D | Confirmar mínimo rua/número/cidade; não enfraquecer silenciosamente. |
| Momento de ocupar vaga | D + C | Escolher regra única, com impacto no contador/trigger/policies/RPC. |
| Escrita administrativa de inscrição | A + C | Operações pelo backend; fechar INSERT forjado e identidade mutável. |
| Histórico de atividade | A + C | Congelar campos históricos desde inscrições existentes, sem reescrever registros. |
| Recandidatura e prazo de cancelamento | D | Remoto e local divergem; existem cancelamentos a preservar. |
| Áreas de atividade | B | Preservar tabela e dois vínculos; não adicionar sugestões ao app agora. |
| Diário/Storage | A + C | Ampliar estrutura existente; parâmetros do MVP já aprovados. |
| Materiais/oficinas/certificados/check-in | A | Novas estruturas ausentes; implantar somente após base segura. |
| Metas/contribuições/PIX | E + B | Preservar inclusive registros materiais no legado. |
| Exposição usuarios/ongs | A + D | Mínimo necessário; definir projeção/finalidade administrativa. |
| Provisionamento ONG | C + D | Processo administrativo explícito, nunca escolha pelo cadastro público. |
| Histórico de migrations | C | Conciliar evidência/deploy; não falsificar ledger ou reaplicar tudo. |

### Mudanças desde o plano anterior

**CONFIRMADO:** ledger e estrutura principal permanecem equivalentes à 1A. Os agregados mudaram:
- usuarios e voluntarios: 4 → 5;
- metas e contribuições: 1 → 2;
- inscrições: antes uma PENDENTE e uma APROVADA; agora duas CANCELADAS;
- meta material agora ENCERRADA; existe também meta FINANCEIRA ABERTA;
- contribuições: uma APROVADA material e uma PENDENTE financeira, ambas sem comprovante;
- contador atual das atividades é zero, coerente com as inscrições canceladas.

Não foram atribuídas essas mudanças a uma pessoa, aplicativo ou migration: **origem NÃO COMPROVADA**. São diferenças de dados observadas, não novas migrations identificadas. A classificação de período passado/futuro depende do relógio da captura.

## 5. Migrations locais ausentes

Compartilhadas: 20260914120000_completa_modelo_dados, 20260914121500_revoga_execucao_trigger_arrecadacao e 20260914140000_seed_habilidades.

| Somente local | Conteúdo a reconciliar | Bloqueio/dependência |
|---|---|---|
| 20260923120000_fluxo_voluntariado | Privado/tokens, campos de decisão/check-in, 11 RPCs, proteção atividade/identidade | Endereço incompatível, contador/trigger remoto e base original. |
| 20260924120000_valida_seguranca_voluntariado | Leitura restritiva, revokes de inscrições | Disponibilidade simultânea das RPCs e corte de clientes antigos. |
| 20260924140000_contribuicao_materiais | Duas tabelas, checks, índices e sete RPCs | Helper de gestão seguro; nenhuma importação automática. |
| 20260924160000_diario_transparencia | Tabela ampliada, oito funções, bucket/policies | Helper privado, Storage; integrar revisão antes de liberar escrita. |
| 20260924180000_propostas_oficinas | Tabela, cinco RPCs, revisão/isolamento | Identidade/elegibilidade; convivência com atividades legadas. |
| 20260924200000_certificados | Snapshot, três RPCs, UNIQUE participação | Check-in, histórico protegido e configuração institucional. |
| 20260924210000_coerencia_mvp | Revisão Diário, histórico atividade, perfil gestão | Endereço incompatível; depende de estruturas anteriores. |

**RECOMENDAÇÃO TÉCNICA:** aproveitar o desenho e testes, não aplicar cegamente os sete arquivos. Seus bytes permanecem preservados. Antes de criar sequência nova, decidir como a ferramenta de deploy tratará as versões pendentes antigas; uma migration mais recente não impede sua execução anterior automática. Não usar migration repair para fingir execução.

## 6. Migrations remotas exclusivas

### Histórico remoto completo, ordenado por versão

| Versão | Nome | Classificação |
|---|---|---|
| 20260914025837 | remote_schema | Somente remota |
| 20260914120000 | completa_modelo_dados | Compartilhada |
| 20260914121500 | revoga_execucao_trigger_arrecadacao | Compartilhada |
| 20260914140000 | seed_habilidades | Compartilhada |
| 20260927213000 | controle_vagas_candidatura | Somente remota |
| 20260927220000 | perfil_completo_exige_habilidades | Somente remota |
| 20260927230000 | areas_da_atividade | Somente remota |
| 20260928010000 | gestao_lanca_contribuicao | Somente remota |
| 20260928020000 | candidatura_so_para_atividade_futura | Somente remota |
| 20260929180000 | endereco_em_campos | Somente remota |
| 20260929193000 | perfil_completo_exige_endereco | Somente remota |

O ledger contém 11 entradas. Presença da versão não prova igualdade byte a byte do arquivo local nem ordem real de execução. Foram lidos os statements armazenados de todas as entradas; nenhuma cópia foi criada no repositório.

| Exclusiva remota | Objetos/efeito confirmado no SQL histórico e catálogo atual | Dados/uso e dependências |
|---|---|---|
| 20260914025837_remote_schema | Base usuarios/voluntarios/atividades, três enums, checks/FKs/índices, e_ong, perfil_completo, handle_new_user, proteger_campos_perfil, set_atualizado_em, solicitar_exclusao_conta; triggers e policies iniciais | Base usada por 5 usuários, 5 complementos e 2 atividades. Trigger de Auth existe; criação efetiva por ele não foi rastreada. Depende de auth.users/roles. |
| 20260927213000_controle_vagas_candidatura | vagas_ocupadas, CHECK 0..total, função/trigger de contagem; validar_transicao_inscricao e trigger UPDATE; policies de inscrições posteriormente substituídas | Duas inscrições canceladas; contadores zero. Ativa, mas comportamento PENDENTE/APROVADA e concorrência não exercitados nesta etapa. Depende de atividades/inscrições/helpers. |
| 20260927220000_perfil_completo_exige_habilidades | Substitui perfil_completo para exigir usuario_habilidades | Função posteriormente ampliada por endereço; requisito permanece. Existem 2 vínculos pessoais. Dependência de habilidades. |
| 20260927230000_areas_da_atividade | atividade_habilidades, PK composta, FKs CASCADE, índice por habilidade, três policies | Dois vínculos existentes. Não há consumo no app local identificado. Preservar; depende de atividades/habilidades/e_ong. |
| 20260928010000_gestao_lanca_contribuicao | Comprovante nullable; função/trigger financeiro em INSERT/UPDATE/DELETE; policy “gestão lança o que recebeu” | Duas contribuições sem comprovante, uma aprovada material. Evidência do contrato em uso, não prova de qual policy criou cada linha. Depende de metas/usuários/helpers. |
| 20260928020000_candidatura_so_para_atividade_futura | Policies de INSERT e UPDATE exigem atividade futura ao candidatar/recandidatar; cancelamento sem esse prazo | Policies existem; duas inscrições canceladas, uma em atividade passada. Não se conhece momento do cancelamento. Depende da contagem e perfil. |
| 20260929180000_endereco_em_campos | Sete colunas voluntarios, checks CEP/UF, config.endereco; transferência histórica de texto e retirada de usuarios.endereco | Um complemento com mínimo rua/número/cidade; configuração sem endereço preenchido. Não é possível reconstruir o texto antigo ou atestar a qualidade da separação por essa consulta. |
| 20260929193000_perfil_completo_exige_endereco | Versão final de perfil_completo exige logradouro/numero/cidade | Um voluntário satisfaz o predicado remoto reproduzido como SELECT, sem chamar RPC. Depende dos campos anteriores e habilidades. |

Não se deve copiar/reexecutar o dump remote_schema: contém pressupostos de ambiente e não captura sozinho todos os grants efetivos. Tampouco transformar comentários das migrations em comprovação de funcionamento de cliente ou concorrência.

## 7. Endereço

**CONFIRMADO:** usuarios.endereco inexiste; voluntarios tem cep/logradouro/numero/complemento/bairro/cidade/uf; configuracao_instituicao.endereco existe. Não há tabela de endereços separada nem endereço em ongs.

**RECOMENDAÇÃO TÉCNICA — propriedade:**
- usuarios: identidade/nome de exibição/contatos pessoais gerais;
- voluntarios: endereço pessoal estruturado e dados de voluntariado;
- ongs: razão social, dados legais e campos legados;
- configuracao_instituicao: nome e endereço institucional singleton.
Não transformar usuarios.nome ou ongs.razao_social em nome oficial de certificado automaticamente.

A adaptação do app ao remoto pode preservar os dados sem coluna duplicada: leitura dos sete campos, payload explícito, validação compatível e RPC transacional. Campos omitidos não devem ser apagados; diferenciar ausência de campo de remoção solicitada. Não dividir automaticamente texto legado copiado para logradouro.

Arquivos a adaptar futuramente: src/lib/database.types.ts e contratos derivados; TelaPerfilVoluntario.tsx (SELECT explícito inválido), TelaPerfilOng.tsx (campo/payload antigo), perfilGestao.ts (contrato RPC), serviço/tipos de voluntariado e novas definições SQL de voluntariado_salvar_perfil/gestao_salvar_perfil. As migrations históricas que contêm endereco são referências, não arquivos a editar.

**DECISÃO DE NEGÓCIO:** endereço mínimo continua requisito? A gestão poderá editar endereço institucional no perfil, ou somente a configuração o administra? Como tratar a conta ONG sem complemento?

Uma camada temporária de compatibilidade só faz sentido se houver cliente antigo identificado que não possa ser retirado. Não recomendar restaurar usuarios.endereco nem dual-write sem necessidade demonstrada. O local pode ser adaptado; a necessidade operacional de compatibilidade com outros clientes é **NÃO COMPROVADA**.

## 8. Vagas

Remoto: CHECK vagas_totais 1..500; vagas_ocupadas 0..total; trigger conta PENDENTE + APROVADA. Local: candidaturas pendentes não ocupam; aprovação trava atividade, conta APROVADA e toca a linha para concorrência; redução de vagas não pode ficar abaixo de aprovados.

**DECISÃO DE NEGÓCIO:** escolher momento único de ocupação.
**RECOMENDAÇÃO TÉCNICA:** somente APROVADA ocupa, conforme triagem MVP. Impacto: permite fila de pendentes; contador, comentários, policies, UI/consumidores e trigger remoto precisam concordar. Se for escolhida reserva em PENDENTE, RPC de candidatura também precisará impor capacidade; não basta reaproveitar a aprovação local.

Preservar vagas_ocupadas como coluna pode evitar quebra de clientes, mas ela deve ser derivada e não editável pelo usuário. Não remover só para igualar o modelo local. Objetos a revisar: atualizar_vagas_ocupadas, trg_inscricoes_vagas, atividades_vagas_ocupadas_check, policies de inscrições/atividades, RPCs de candidatura/decisão/cancelamento e proteção de capacidade. Recalcular contador seria escrita/backfill separadamente autorizada.

Na fotografia atual: capacidade total 6, ocupadas 0, nenhuma aprovação. Trocar a fórmula não alteraria numericamente esses dois contadores agora; isso não autoriza presumir que permanecerão assim até o deploy.

A função remota usa COALESCE(NEW.atividade_id,OLD.atividade_id); uma troca de atividade não recalcula a origem. Fixar identidade da inscrição é necessário. Concorrência de última vaga permanece **NÃO COMPROVADA**; comentários no SQL não substituem duas conexões independentes.

## 9. Inscrições

**CONFIRMADO:** SELECT permite próprio usuário, gestão ou autor da atividade; autor voluntário pode assim ler candidaturas de terceiros. INSERT verifica usuário próprio, perfil completo, atividade aberta/futura e vaga, mas **não fixa status_inscricao nem presenca_confirmada**. UPDATE permite próprio/gestão; trigger bloqueia mudança de presença do usuário comum e restringe transições, mas não imutabilidade de atividade_id/id/data_inscricao. DELETE é permitido à gestão. Grants incluem operações administrativas.

Isso confirma lacunas nas regras SQL, não uma exploração com JWT. O trigger é BEFORE UPDATE, portanto não fecha o INSERT administrativo. O UNIQUE impede duplicar par atividade/usuário, não autoaprovação inicial.

**RECOMENDAÇÃO TÉCNICA:** preservar as duas linhas e IDs; acrescentar campos de decisão/check-in nullable; retirar escrita direta em inscrições dos papéis clientes e fornecer RPCs completas no mesmo corte. Identidade, status inicial PENDENTE e presença false definidos no servidor. Decisão só por gestão, sem autoaprovação; check-in separado; cancelamento autenticado e limitado. Restrição de leitura própria/gestão deve coexistir corretamente com policies permissivas antigas ou substituí-las explicitamente, com inventário antes/depois.

**DECISÃO DE NEGÓCIO:** CANCELADA pode voltar a PENDENTE? Qual prazo de cancelamento? O remoto aceita recandidatura e cancelamento após início; local não. As duas linhas atuais CANCELADAS deixariam de poder se recandidatar pelo fluxo local. Não “corrigir” essas linhas para outro status. Gestão não deverá apagar histórico; qualquer exceção administrativa futura fica fora do MVP.

## 10. Atividades

**CONFIRMADO:** gestão pode fazer CRUD direto; voluntário pode criar OFICINA_AUTORAL/PENDENTE_APROVACAO com perfil completo e editar a própria pendente. Não há trigger remoto equivalente ao congelamento histórico local. A policy de UPDATE não limita colunas; contador/status/tipo precisam de proteção além da tela.

**RECOMENDAÇÃO TÉCNICA:** após qualquer inscrição, inclusive cancelada, preservar título, data/hora, carga horária, tipo e autoria. Proteger ID sempre; impedir exclusão com inscrições. Não alterar os valores já existentes. Duas inscrições existem; verificar por atividade no preflight e congelar as respectivas linhas. Descrição pode continuar editável porque não é copiada no certificado; vagas podem mudar respeitando a regra de ocupação escolhida. Status só por transições administrativas autorizadas, sem alterar presença.

O formulário local ainda escreve atividades diretamente. A solução de segurança precisa preservar esse CRUD permitido com restrições de coluna/trigger ou oferecer contrato equivalente; revogar tudo sem adaptar o app interromperia o fluxo. Qualquer nova assinatura exige implantação coordenada.

**DECISÃO DE NEGÓCIO:** manter acessível a entrada legada OFICINA_AUTORAL ou impedir novas propostas por esse caminho? Hoje não há atividade desse tipo, mas consumidores desconhecidos não autorizam remoção. Não converter propostas automaticamente em eventos.

## 11. Diário

Tabela existe e está vazia nesta captura. Leitura atual para authenticated; gestão insere/edita/exclui diretamente. Sem texto/status/revisão/caminho, funções novas ou bucket.

**RECOMENDAÇÃO TÉCNICA:** ampliar a mesma tabela e integrar revisão desde a primeira versão liberada. Preservar descricao_curta/url_imagem/atividade_id e IDs. Definir leitura PUBLICADA para usuários autenticados, OCULTA somente gestão; writes administrativos via RPC com revisão esperada. Revogar assinaturas sem versão para clientes; wrappers podem reutilizar implementação interna sem reexpor endpoint antigo.

Não é necessário backfill de publicações nesta fotografia vazia. Preflight deve recontar; se houver novas linhas, interromper para avaliar texto/status de cada conjunto, sem publicar tudo automaticamente por default. Não importar imagens legadas, conforme decisão MVP. Preservar URLs antigas não exige exibi-las como imagens novas seguras.

Upload e gravação SQL não são uma transação única: publicar referência somente após upload confirmado; troca deve primeiro vincular novo arquivo, depois tentar remover antigo sem vínculo. Falha de limpeza pode deixar órfão, não referência quebrada. Nenhuma limpeza automática proposta.

Decisões MVP já aprovadas: autenticado, uma imagem, 5 MiB, bucket privado diario-imagens, URLs assinadas de 60 segundos, sem importação legada. URL já assinada pode permanecer utilizável até expirar após ocultação; testar e comunicar esse limite.

## 12. Materiais

solicitacoes_materiais/contribuicoes_materiais e sete RPCs estão ausentes. A meta MATERIAL legada não é tabela equivalente.

**RECOMENDAÇÃO TÉCNICA:** preservar legado separado e usar modelo local de inteiros: solicitação ABERTA/EM_ANDAMENTO/CONCLUIDA/CANCELADA; contribuição PENDENTE/CONFIRMADA/CANCELADA. Recebimento só por gestão; sem autoconfirmação; lock da solicitação antes da contribuição, CHECK recebido<=necessário e unicidade parcial de pendência por usuário/material.

Intenções não reservam estoque: várias intenções podem somar mais que o restante, mas nenhuma confirmação pode ultrapassá-lo. Ao concluir/cancelar solicitação, RPC local cancela pendências; isso é comportamento já implementado a preservar/testar, não importação de contribuições antigas.

Dependências: usuarios, helper de gestão, privilégios mínimos, sequences protegidas e RLS. Não requer Diário/oficinas. Não importar as duas contribuições legadas: uma é financeira e outra material já recebida; importação cega duplicaria efeitos.

## 13. Oficinas

propostas_oficinas está ausente. As atividades existentes são TAREFA_ONG; enum OFICINA_AUTORAL é legado.

**RECOMENDAÇÃO TÉCNICA:** usar tabela local independente, autor/decisor por FK, revisão, estados PENDENTE/APROVADA/REJEITADA/CANCELADA, justificativa obrigatória na rejeição e bloqueio de autoaprovação. Edição e decisão competem sobre mesma linha/revisão; estados finais não reabrem.

Dependências: usuarios, elegibilidade reconciliada, helper de gestão e RLS de autor/gestão. Não depende de inscrições, calendário, check-in ou certificados. Preservar atividade_habilidades; não criar integração nova por existir essa tabela.

## 14. Certificados

certificados e RPCs ausentes; nenhuma inscrição está aprovada/presente na fotografia atual.

**RECOMENDAÇÃO TÉCNICA:** emissão futura por backend a partir de aprovação, presença true, checkin_em válido, carga_horaria_registrada positiva finita, atividade iniciada em estado permitido, nome oficial e configuração singleton. Snapshot usa horas **previstas**, não medidas; UUID e UNIQUE(participacao_id); leituras próprias/gestão, sem escrita direta.

Reemissão retorna o mesmo certificado existente; alterações posteriores de nome/configuração não atualizam snapshots. Preservar FKs RESTRICT de novas emissões. Não emitir para registros antigos sem evidência nem criar check-in retroativo.

Dependências: histórico de atividades protegido, inscrições imutáveis e check-in seguro; não liberar emissão antes dessas garantias. Configuração tem uma linha com nome não vazio; legitimidade institucional do texto precisa de confirmação administrativa, não de renomeação automática. Sem PDF/revogação pública nesta etapa.

## 15. Check-in

Schema voluntariado_privado, tokens_checkin e RPCs ausentes. Zero presenças antigas.

**RECOMENDAÇÃO TÉCNICA:** reutilizar desenho local de token aleatório, hash bytea, uma credencial ativa por atividade, gestão emissora, expiração até cinco minutos limitada pelo fim previsto; janela de 30 minutos antes até fim previsto. Troca de token invalida anterior. Tabela privada sem leitura/escrita pelos clientes.

RPC de check-in usa auth.uid(), aprovação existente, atividade/janela e hash válidos; bloqueia duplicidade e registra timestamp/horas previstas. Lock atividade → inscrição. Não usar ID da atividade como segredo. Papel de gestão não pode registrar presença arbitrária por UPDATE direto.

O token é credencial compartilhada da atividade: não prova localização física nem impede repasse de fotografia durante a validade. Essa limitação não justifica aumentar escopo com geolocalização. Testar no Android e servidor em etapa autorizada.

## 16. Segurança

### Matriz efetiva observada da base

| Tabela | SELECT por policy | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| usuarios | Todos authenticated, todas as colunas permitidas pelo grant | Sem policy, bloqueado por RLS normal | Próprio ID; trigger bloqueia tipo_perfil para anon/authenticated | Sem policy |
| voluntarios | Próprio ou gestão | Próprio usuario_id | Próprio usuario_id | Sem policy |
| ongs | Todos authenticated | Próprio + e_ong() | Próprio usuario_id | Sem policy |
| atividades | Publicadas, próprio autor ou gestão | Gestão própria ou oficina pendente do autor elegível | Autor pendente ou gestão | Gestão |
| inscrições | Próprio, gestão ou autor da atividade | Próprio elegível, aberta/futura/vaga, sem fixar status/presença | Próprio/gestão, transição parcial por trigger | Gestão |

**CONFIRMADO:** todas as 12 tabelas public concedem a anon/authenticated SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES e TRIGGER. Ausência de policy bloqueia DML normal, mas não torna esses grants mínimos. Não há ACL de coluna específica. Todas as policies são permissivas e combinam por OR; nenhuma restritiva MVP foi implantada.

TRUNCATE não é protegido por RLS. Grant TRIGGER também não equivale a endpoint REST disponível nem comprova execução arbitrária: depende de caminho SQL/função e privilégios adicionais. Não executar demonstração destrutiva. Sequences concedem USAGE/SELECT/UPDATE a anon/authenticated; isso é superfície excessiva, embora não seja prova de acesso direto por HTTP. Revogar permissões administrativas e limitar sequences é recomendação de defesa.

Default privileges em public de postgres e supabase_admin concedem acesso amplo a novas tabelas/sequences/funções. Novas migrations precisam revokes/grants explícitos antes de disponibilizar objetos; revisar defaults para o schema de aplicação com cuidado, sem mudar defaults de schemas gerenciados indiscriminadamente.

### Funções e execução

| Função public | Modo | Owner | anon EXECUTE | authenticated EXECUTE |
|---|---|---|---|---|
| atualizar_arrecadacao_meta() | DEFINER | postgres | false | false |
| atualizar_vagas_ocupadas() | DEFINER | postgres | false | false |
| e_ong(uuid) | DEFINER | postgres | false | true |
| handle_new_user() | DEFINER | postgres | false | false |
| perfil_completo(uuid) | DEFINER | postgres | false | true |
| proteger_campos_perfil() | INVOKER | postgres | true | true |
| set_atualizado_em() | INVOKER | postgres | false | false |
| solicitar_exclusao_conta() | DEFINER | postgres | false | true |
| validar_transicao_inscricao() | INVOKER | postgres | false | false |

Todas as nove têm search_path public, pg_temp. anon/authenticated não têm CREATE em public, mitigando substituição de objetos nesse schema; não é prova suficiente de segurança de todas as funções. Novas privilegiadas devem qualificar objetos, definir search_path seguro e verificar sessão/autorização. FORCE RLS desligada não é defeito isolado: owners/BYPASSRLS e funções privilegiadas precisam ser considerados; ligar FORCE indiscriminadamente pode quebrar helpers e não neutraliza BYPASSRLS.

e_ong(uuid) e perfil_completo(uuid) aceitam UUID arbitrário, são DEFINER e executáveis por authenticated sem restringir alvo na definição. **CONFIRMADO:** superfície de consulta de atributos booleanos de terceiros; não devolvem diretamente toda a ficha. Recomendação: manter avaliação interna necessária às policies/triagem e limitar exposição externa ao mínimo, sem remover função usada por policies antes de substituí-las.

handle_new_user fixa VOLUNTARIO, ignorando pedido de tipo_perfil em metadata. usuarios não tem policy INSERT; o trigger de perfil bloqueia alteração direta de tipo por papel cliente. **Não identifiquei no catálogo um caminho simples comprovado de autoelevação**, mas cadastro/JWT/provisionamento externo não foram testados. Existem duas contas ONG; a origem administrativa de sua promoção é desconhecida. Complemento ongs não deve ser a autoridade para papel; e_ong usa usuarios.tipo_perfil.

SELECT amplo usuarios/ongs e INSERT de inscrição sem estado inicial obrigatório são **lacunas confirmadas na configuração**, não incidentes comprovados. Falta de proteção histórica e escrita ampla de atividades são também confirmadas. Tokens/RPCs novas ausentes não podem proteger o app remoto.

### Policies atuais, para registrar futuras diferenças

Nenhuma foi alterada. A tabela abaixo conserva nomes reais, inclusive truncamento do nome da policy de UPDATE de inscrições no PostgreSQL. Futuras mudanças devem registrar exatamente quais expressões substituem, restringem ou preservam cada policy.

| Tabela | Policy | Operação | Roles | USING | WITH CHECK |
|---|---|---|---|---|---|
| usuarios | usuarios: leitura por autenticados | SELECT | authenticated | `true` | `—` |
| atividades | atividades: só a gestão exclui | DELETE | authenticated | `e_ong()` | `—` |
| usuarios | usuarios: edita o próprio perfil | UPDATE | authenticated | `(id = ( SELECT auth.uid() AS uid))` | `(id = ( SELECT auth.uid() AS uid))` |
| voluntarios | voluntarios: o próprio ou a gestão | SELECT | authenticated | `((usuario_id = ( SELECT auth.uid() AS uid)) OR e_ong())` | `—` |
| voluntarios | voluntarios: edita os próprios dados | UPDATE | authenticated | `(usuario_id = ( SELECT auth.uid() AS uid))` | `(usuario_id = ( SELECT auth.uid() AS uid))` |
| diario_transparencia | diario: gestão edita | UPDATE | authenticated | `e_ong()` | `e_ong()` |
| diario_transparencia | diario: gestão exclui | DELETE | authenticated | `e_ong()` | `—` |
| configuracao_instituicao | configuracao: leitura pública | SELECT | anon, authenticated | `true` | `—` |
| configuracao_instituicao | configuracao: só a gestão atualiza | UPDATE | authenticated | `e_ong()` | `e_ong()` |
| voluntarios | voluntarios: cria a própria linha | INSERT | authenticated | `—` | `(usuario_id = ( SELECT auth.uid() AS uid))` |
| atividades | atividades: publicadas para todos, rascunhos para o autor | SELECT | authenticated | `((status = ANY (ARRAY['ABERTA'::status_atividade, 'ENCERRADA'::status_atividade, 'REALIZADA'::status_atividade])) OR (autor_id = ( SELECT auth.uid() AS uid)) OR e_ong())` | `—` |
| atividades | atividades: insere tarefa ou propõe oficina | INSERT | authenticated | `—` | `((e_ong() AND (autor_id = ( SELECT auth.uid() AS uid))) OR ((autor_id = ( SELECT auth.uid() AS uid)) AND (tipo = 'OFICINA_AUTORAL'::tipo_atividade) AND (status = 'PENDENTE_APROVACAO'::status_atividade) AND perfil_completo()))` |
| atividades | atividades: autor ou gestão atualiza | UPDATE | authenticated | `(((autor_id = ( SELECT auth.uid() AS uid)) AND (status = 'PENDENTE_APROVACAO'::status_atividade)) OR e_ong())` | `(((autor_id = ( SELECT auth.uid() AS uid)) AND (status = 'PENDENTE_APROVACAO'::status_atividade)) OR e_ong())` |
| habilidades | habilidades: leitura por autenticados | SELECT | authenticated | `true` | `—` |
| habilidades | habilidades: gestão insere | INSERT | authenticated | `—` | `e_ong()` |
| habilidades | habilidades: gestão atualiza | UPDATE | authenticated | `e_ong()` | `e_ong()` |
| habilidades | habilidades: gestão exclui | DELETE | authenticated | `e_ong()` | `—` |
| ongs | ongs: leitura por autenticados | SELECT | authenticated | `true` | `—` |
| ongs | ongs: cria a própria linha | INSERT | authenticated | `—` | `((usuario_id = ( SELECT auth.uid() AS uid)) AND e_ong())` |
| ongs | ongs: edita os próprios dados | UPDATE | authenticated | `(usuario_id = ( SELECT auth.uid() AS uid))` | `(usuario_id = ( SELECT auth.uid() AS uid))` |
| usuario_habilidades | usuario_habilidades: o próprio ou a gestão lê | SELECT | authenticated | `((usuario_id = ( SELECT auth.uid() AS uid)) OR e_ong())` | `—` |
| usuario_habilidades | usuario_habilidades: usuário adiciona as próprias | INSERT | authenticated | `—` | `(usuario_id = ( SELECT auth.uid() AS uid))` |
| usuario_habilidades | usuario_habilidades: usuário remove as próprias | DELETE | authenticated | `(usuario_id = ( SELECT auth.uid() AS uid))` | `—` |
| inscricoes_atividades | inscricoes: interessados leem | SELECT | authenticated | `((usuario_id = ( SELECT auth.uid() AS uid)) OR e_ong() OR (EXISTS ( SELECT 1    FROM atividades a   WHERE ((a.id = inscricoes_atividades.atividade_id) AND (a.autor_id = ( SELECT auth.uid() AS uid))))))` | `—` |
| inscricoes_atividades | inscricoes: só a gestão exclui | DELETE | authenticated | `e_ong()` | `—` |
| metas_demandas | metas_demandas: leitura por autenticados | SELECT | authenticated | `true` | `—` |
| metas_demandas | metas_demandas: gestão insere | INSERT | authenticated | `—` | `e_ong()` |
| metas_demandas | metas_demandas: gestão atualiza | UPDATE | authenticated | `e_ong()` | `e_ong()` |
| metas_demandas | metas_demandas: gestão exclui | DELETE | authenticated | `e_ong()` | `—` |
| contribuicoes | contribuicoes: o próprio ou a gestão lê | SELECT | authenticated | `((usuario_id = ( SELECT auth.uid() AS uid)) OR e_ong())` | `—` |
| contribuicoes | contribuicoes: usuário envia comprovante | INSERT | authenticated | `—` | `((usuario_id = ( SELECT auth.uid() AS uid)) AND (status_validacao = 'PENDENTE'::status_validacao))` |
| contribuicoes | contribuicoes: só a gestão valida | UPDATE | authenticated | `e_ong()` | `(e_ong() AND (validado_por = ( SELECT auth.uid() AS uid)))` |
| contribuicoes | contribuicoes: só a gestão exclui | DELETE | authenticated | `e_ong()` | `—` |
| diario_transparencia | diario: leitura por autenticados | SELECT | authenticated | `true` | `—` |
| diario_transparencia | diario: gestão publica | INSERT | authenticated | `—` | `(e_ong() AND (autor_id = ( SELECT auth.uid() AS uid)))` |
| atividade_habilidades | atividade_habilidades: leitura por autenticados | SELECT | authenticated | `true` | `—` |
| atividade_habilidades | atividade_habilidades: quem edita a atividade marca | INSERT | authenticated | `—` | `(EXISTS ( SELECT 1    FROM atividades a   WHERE ((a.id = atividade_habilidades.atividade_id) AND (e_ong() OR ((a.autor_id = ( SELECT auth.uid() AS uid)) AND (a.status = 'PENDENTE_APROVACAO'::status_atividade))))))` |
| atividade_habilidades | atividade_habilidades: quem edita a atividade desmarca | DELETE | authenticated | `(EXISTS ( SELECT 1    FROM atividades a   WHERE ((a.id = atividade_habilidades.atividade_id) AND (e_ong() OR ((a.autor_id = ( SELECT auth.uid() AS uid)) AND (a.status = 'PENDENTE_APROVACAO'::status_atividade))))))` | `—` |
| contribuicoes | contribuicoes: gestão lança o que recebeu | INSERT | authenticated | `—` | `(e_ong() AND (status_validacao = 'APROVADA'::status_validacao) AND (validado_por = ( SELECT auth.uid() AS uid)))` |
| inscricoes_atividades | inscricoes: voluntário se candidata | INSERT | authenticated | `—` | `((usuario_id = ( SELECT auth.uid() AS uid)) AND perfil_completo() AND (EXISTS ( SELECT 1    FROM atividades a   WHERE ((a.id = inscricoes_atividades.atividade_id) AND (a.status = 'ABERTA'::status_atividade) AND (a.data_hora_prevista > now()) AND (a.vagas_ocupadas < a.vagas_totais)))))` |
| inscricoes_atividades | inscricoes: usuário cancela ou recandidata, gestão faz triage | UPDATE | authenticated | `((usuario_id = ( SELECT auth.uid() AS uid)) OR e_ong())` | `(e_ong() OR ((usuario_id = ( SELECT auth.uid() AS uid)) AND ((status_inscricao = 'CANCELADA'::status_inscricao) OR ((status_inscricao = 'PENDENTE'::status_inscricao) AND (EXISTS ( SELECT 1    FROM atividades a   WHERE ((a.id = inscricoes_atividades.atividade_id) AND (a.status = 'ABERTA'::status_atividade) AND (a.data_hora_prevista > now()))))))))` |

Storage tem grants amplos em buckets/objects, mas RLS ligada e nenhuma policy: não inferir upload público dos grants. Não foram auditadas todas as funções internas gerenciadas de auth/storage como código de aplicação. A API real/JWT continua pendente.

## 17. Dados existentes

Somente agregados; nenhum nome, telefone, CPF, endereço completo ou UUID pessoal exposto.

| Estrutura | Antes, no plano anterior | Agora |
|---|---:|---:|
| usuarios | 4 | 5 (3 VOLUNTARIO, 2 ONG) |
| voluntarios | 4 | 5 |
| ongs | 1 | 1 |
| atividades | 2 | 2 |
| inscrições | 2 | 2 CANCELADAS, sem presença |
| metas_demandas | 1 | 2 |
| contribuições legadas | 1 | 2 |
| Diário | 0 | 0 |
| atividade_habilidades | 2 | 2 |
| configuração | 1 | 1 |
| habilidades | Não quantificado nessa tabela anterior | 12 |
| usuario_habilidades | Não quantificado nessa tabela anterior | 2 |
| buckets/objetos | 0/0 | 0/0 |

Atividades: uma passada e uma futura, ambas ABERTA/TAREFA_ONG, capacidades 4 e 2 respectivamente, contadores zero. Há uma inscrição cancelada em cada período. Estado ABERTA após a data não é automaticamente inconsistência: não há job observado de mudança de status.

Meta MATERIAL está ENCERRADA e tem contribuição APROVADA; meta FINANCEIRA está ABERTA e tem contribuição PENDENTE. Ambas contribuições têm comprovante NULL. Totais de arrecadação coincidem com soma APROVADA; contador de vagas coincide com PENDENTE+APROVADA. Não se mediu histórico de alterações ou simultaneidade.

Verificações com resultado zero: usuários sem Auth, Auth sem usuarios, voluntário de perfil VOLUNTARIO sem complemento, inscrições órfãs, atividades sem autor, contribuições sem meta/usuário, vínculos de habilidades órfãos, voluntarios/ongs sem usuario, áreas órfãs, Diário com vínculo inválido, validadores inexistentes, aprovados acima da capacidade, presença em estado não aprovado e disponibilidade de tipo JSON diferente de array.

Exceções/limites:
- Uma conta ONG sem linha ongs, como antes. Não criar automaticamente complemento.
- As duas contas ONG têm linha voluntarios, compatível com cadastro original seguido de promoção; não apagar.
- Um dos cinco complementos possui mínimo de endereço; um voluntário satisfaz o predicado remoto completo. Isso não valida CPF, formato interno dos slots ou qualidade do endereço.
- Configuração com nome não vazio, mas endereço institucional não preenchido.
- Nenhum certificado/tabela nova: não equivale a “zero linhas elegíveis” em uma estrutura implantada.
- Estado atual não prova como os registros foram criados nem que constraints temporais continuarão semanticamente válidas.

## 18. Dependências

Auth → usuarios → perfis/habilidades → elegibilidade/gestão → voluntariado → check-in/histórico → certificados.

Materiais e oficinas dependem da identidade/gestão; oficinas também da elegibilidade. Diário depende de gestão, revisão e Storage. Nenhuma das três depende de geração de certificados. Áreas dependem de atividades/habilidades e permanecem separadas.

Dependências de deploy: base remota/catalogo completo → plano ativo de migrations → backup restaurável → ensaio isolado → corte coordenado de writes antigos → validação de banco → JWT → app. Mudanças de segurança não devem ser liberadas parcialmente com RPCs ausentes; tampouco liberar RPCs inseguras temporariamente.

Dependências do app: tipos e telas de endereço; perfilGestao/voluntariado; contratos de revisão Diário; mensagem/regra de vagas; leitura de autores deve funcionar com projeção mínima após restringir usuarios/ongs. Nome institucional vem do singleton, não do nome da conta. Não alterar dados por divergência de rótulos.

## 19. Plano de migração

**RECOMENDAÇÃO TÉCNICA.** Nomes conceituais, sem timestamp e sem arquivos criados. Não são comandos nem substituem revisão do SQL. Todas exigem autorização posterior. Fases são portas lógicas; fases 1–5 não devem ficar expostas a clientes em estado intermediário inseguro.

### FASE 0 — captura, backup, estratégia de histórico

Sem migration corretiva: obter snapshot verificável/restore isolado, schema e ACL completos, ledger/statements, configuração Auth/API/Storage e inventário de clientes. Definir destino executável das sete pendentes, preservando história; identificar se foram aplicadas em outro ambiente. Parar até restore ensaiado e contratos aprovados.

### FASE 1 — compatibilização estrutural

| Nome proposto | Objetivo e objetos | Dados/risco/reversibilidade | Dependências e validação |
|---|---|---|---|
| reconciliacao_01_base_perfis_endereco | Schema privado/helper de gestão; contrato de perfis atômicos adaptado ao endereço remoto; elegibilidade unificada; manter campos atuais | 5 usuários/complementos, 1 ONG, singleton; sem backfill. Alto risco de payload/privacidade. Reversão de funções somente antes de novos clientes e sem reabrir brechas; não apagar colunas | Decisões de endereço/complemento/leitura e contrato legado. Validar perfil próprio, campos omitidos, atomicidade e erro de carga. |
| reconciliacao_02_inscricoes_estrutura | Adicionar campos nullable de decisão/check-in/horas, FKs necessárias e helpers privados; sem fabricar evidência | 2 inscrições; aditivo. Médio. Manter colunas mesmo se suspender uso; rollback não depende de DROP | Base anterior, inspeção de status/órfãos. Comparar IDs/valores antigos e nulidade dos novos. |

### FASE 2 — segurança e corte operacional

| Nome proposto | Objetivo e objetos | Dados/risco/reversibilidade | Dependências e validação |
|---|---|---|---|
| reconciliacao_03_privacidade_e_grants | Leitura mínima usuarios/ongs, perfis e helpers de UUID; proteção de papel; grants/sequences/defaults de aplicação; registro antes/depois das policies | Sem alterar valores; alto risco de bloquear perfil/joins. Reverter somente permissões seguras, nunca repor acesso vulnerável por conveniência | RPCs/projeções prontas, clientes inventariados, evitar recursão RLS. Validar matriz de roles e próprio perfil. |
| reconciliacao_04_voluntariado_vagas_historico | RPCs de candidatura/decisão/cancelamento/status, proteção de campos de atividades/inscrições, substituir regra operacional de vagas aprovada; revogar writes diretos indevidos e restringir leitura | 2 atividades/2 inscrições preservadas. Alto risco; transação/corte coordenado. Contador pode exigir backfill autorizado. Depois de uso, preferir correção progressiva | Regra de vagas/cancelamento aprovada e estruturas anteriores. Testar última vaga, cancelamento×decisão, edição×candidatura e API direta em ambiente isolado. |

As quatro primeiras propostas podem precisar compor um único lote de liberação sem clientes escritores entre os passos. O recálculo de fase 4 deve integrar o mesmo corte da mudança de fórmula, não ocorrer dias depois.

### FASE 3 — estruturas das prioridades

| Nome proposto | Objetivo e objetos | Dados/risco/reversibilidade | Dependências e validação |
|---|---|---|---|
| reconciliacao_05_checkin | tokens privados e RPCs de emissão/check-in com timestamp/horas | Sem backfill; médio/alto. Suspender emissão sem apagar evidência; tokens temporários não justificam perder presença | Voluntariado seguro. Testar expiração/substituição/duplicidade/período e bloqueio de leitura. |
| reconciliacao_06_materiais | Duas tabelas, checks, índices, RPCs/RLS/sequences | Tabelas novas vazias; legado intacto. Médio. Suspender writes preservando entregas após uso | Gestão segura. Testar inteiros, confirmação concorrente e cancelamento. |
| reconciliacao_07_diario_revisao | Ampliar tabela existente com texto/status/caminho/revisão; RPCs revisadas e RLS | Hoje 0 registros; recontar. Médio/alto. Não remover colunas/URLs; suspender publicação se falhar | Gestão segura; liberação só após Storage fase 5. Conflito editar×ocultar/republicar e fallback legado. |
| reconciliacao_08_oficinas | Tabela propostas, revisões, decisão/RLS | Nova, sem converter atividades. Médio. Preservar propostas e decisões após uso | Elegibilidade/gestão e decisão sobre entrada antiga. Testar isolamento/autoaprovação/revisão. |
| reconciliacao_09_certificados | Snapshot/UUID/UNIQUE participação/FKs/RPCs/RLS | Nova, sem emitir automaticamente. Médio/alto. Sem rollback automático de documentos já emitidos; não revogar/apagar | Check-in e histórico validados; configuração legítima. Testar emissão idempotente concorrente e imutabilidade. |

### FASE 4 — dados/backfill, somente se aprovado

| Nome proposto | Objetivo e objetos | Dados/risco/reversibilidade | Dependências e validação |
|---|---|---|---|
| reconciliacao_10_backfill_controlado (condicional) | Somente contador derivado conforme regra aprovada; eventualmente texto/status legado do Diário após inventário específico | Atualmente contador não mudaria e Diário vazio. Não criar migration vazia por obrigação. Alto se houver novos dados. Reversão exige snapshot por registro e ausência de novas escritas; caso contrário correção progressiva | Preflight atualizado, aprovação do mapeamento e janela de corte. Comparar somas/IDs/valores, abortar em divergência não prevista. |

Não preencher checkin_em, decidido_por ou horas antigas por suposição. Não migrar metas/contribuições automaticamente. Não modificar endereços antigos nem criar ONG ausente sem plano administrativo explícito.

### FASE 5 — Storage

| Nome proposto | Objetivo e objetos | Dados/risco/reversibilidade | Dependências e validação |
|---|---|---|---|
| reconciliacao_11_diario_storage | Bucket privado diario-imagens, 5242880 bytes, MIME image/jpeg,image/png,image/webp; policies e helpers vinculados à publicação | Hoje sem objetos. Médio/alto. Reverter acesso/suspender upload, nunca apagar arquivos como rollback | Diário/gestão prontos; recatalogar bucket antes. Testar Storage real, 5 MiB exatos/maior, MIME, assinaturas, substituição/remover. |

Caminho: UUID da gestão/UUID do arquivo.extensão. Upload só gestão com prefixo próprio; UPDATE de objeto bloqueado (substituição usa novo caminho); DELETE gestão apenas sem vínculo; SELECT autenticado para imagem de publicação PUBLICADA ou gestão. URL assinada dura 60 segundos. Não importar URLs legadas nem limpar órfãos. Não editar bytes do Storage por SQL.

### FASE 6 — validação com JWT

Somente após autorização para criar contas/dados fictícios. Anon, dois voluntários e gestão, HTTP real, tokens válidos/expirados, RLS/RPC/Storage. Não usar postgres/service_role como teste de isolamento. Falha fecha a porta de liberação.

### FASE 7 — aplicativo coordenado

Adaptar contratos/telas de perfil, tipos e consumidores das regras aprovadas; manter arquitetura e escopo. Validar imports/typecheck/suíte/bundle, depois Android. A versão nova só deve ser liberada após backend compatível. Se clientes antigos não puderem ser retirados, definir ponte segura antes; não reabrir escrita direta insegura para evitar interrupção.

## 20. Backup e rollback

**NÃO COMPROVADO:** plano contratado, retenção disponível, PITR habilitado, último ponto recuperável e restauração ensaiada deste projeto. Não foi realizado backup nesta tarefa. Este documento não é backup.

**RECOMENDAÇÃO TÉCNICA:** antes da implantação preservar, em local restrito:
- dados e schema/owners/ACL/default privileges/roles/sequences/constraints/índices;
- todas as definições de funções/triggers/policies, ledger e statements;
- Auth e configurações de provedores/redirects/JWT/hooks, schemas expostos e integrações;
- configuração de buckets, policies, metadados e cópia dos arquivos se existirem no momento do corte;
- versão do app, manifestos/lockfile e evidência do preflight.
Não guardar segredos ou dados pessoais no Git; usar cópia sanitizada para testes.

Backups de banco não incluem os arquivos armazenados pela API Storage; disponibilidade/retensão e restauração dependem da configuração do projeto. Confirmar antes de assumir recuperação. Fonte: [documentação oficial de backups do Supabase](https://supabase.com/docs/guides/platform/backups).

Plano de retorno: ensaiar restore em ambiente isolado; definir RPO/RTO e janela sem escrita; guardar definições anteriores revisadas para reversão de objetos; testar uma versão do app compatível com o estado de retorno. Uma transação SQL que falha pode abortar seu lote, mas não desfaz uploads nem alterações já confirmadas em outros lotes.

Depois de novas inscrições/entregas/certificados, não existe rollback automático sem risco de perda. Preferir suspender a operação afetada e corrigir progressivamente, preservando dados. Restaurar backup antigo pode perder escritas posteriores e exige autorização própria. Não propor DROP de tabelas, DELETE de histórico ou reposição de policies vulneráveis.

## 21. Estratégia de testes

Nada foi executado funcionalmente nesta etapa. Os testes atuais exercitam o modelo local, não esta reconciliação.

A fixture base-voluntariado.sql tem usuarios.endereco, helpers simplificados (perfil_completo sempre true, e_ong sem parâmetro), Auth simulado sem users/cadastro, tipos/defaults/constraints diferentes e não reproduz ACL/policies originais. Faltam endereço remoto, atividade_habilidades, contador e triggers de inscrições, versões reais de helpers, grants/defaults/sequences/owners, trigger Auth e dados legados representativos.

storage-diario.sql só emula duas tabelas e grants: não é serviço Storage, não impõe upload/tamanho/MIME/assinatura como a API real. PGlite não comprova JWT/GoTrue/PostgREST nem concorrência de conexões independentes.

**RECOMENDAÇÃO TÉCNICA:** construir posteriormente ambiente isolado a partir de DDL/catalogo remoto verificado e configuração Supabase compatível, não de fixture inventada. Usar dados sintéticos que representem perfis, endereços parciais, conta ONG sem complemento, atividades passadas/futuras, inscrições canceladas e legado material/financeiro. Validar igualdade do catálogo relevante antes de ensaiar migrations novas; preservar distinção entre cópia fiel do schema e dados sanitizados.

| Área | Testes necessários depois da autorização |
|---|---|
| Endereço/perfil | Leitura e escrita de campos estruturados, omitido vs nulo, atomicidade, ausência ONG, sessão inválida, elegibilidade. |
| Vagas/inscrições | Última vaga em duas conexões, pendentes conforme regra, rejeição/cancelamento/recandidatura, identidade imutável, INSERT aprovado/presente bloqueado. |
| Atividades | Antes/depois de candidatura, inclusive cancelada; edição simultânea à primeira inscrição; status/contador/autor protegidos; exclusão impedida. |
| Diário | Criar sem imagem, conflito de revisão, ocultar/republicar, falha de upload e troca sem referência quebrada. |
| Materiais | Quantidade inteira, maior que restante, duas confirmações concorrentes, pendência única, cancelamento e conclusão. |
| Oficinas | Autor vs terceiros, estados finais, justificativa, autoaprovação, editar simultâneo à decisão. |
| Certificados | Aprovado sem presença negado, check-in elegível, duas emissões mesmo UUID, dados oficiais/horas previstas, writes negados. |
| RLS/funções | Anon e JWTs reais; SELECT pessoal cruzado, UUID arbitrário, cadastro com tipo_perfil forjado, provisionamento gestão; grants antigos e RPCs revogadas. |
| Storage | Usuário comum sem upload, prefixo de outro gestor, 5 MiB exatos/acima, MIME permitido/proibido, leitura PUBLICADA, OCULTA, assinatura expirada, DELETE vinculado negado. |

Concorrência deve usar PostgreSQL com conexões independentes, incluindo edição de perfil, candidatura×decisão e isolamento mais forte quando aplicável. Sem isso, resultado é pendente, não aprovado.

Android posterior: login/logout/troca de conta, retorno do segundo plano, câmera/QR, galeria/upload, permissões negadas, teclado, falha de rede/timeout, duplo toque, conflito/recarregar e compartilhamento textual do certificado. Bundle não é teste de dispositivo.

## 22. Riscos

Bloqueadores atuais: histórias de migrations divergentes; app escreve coluna removida; sem regra única de vagas; INSERT administrativo de inscrições; leitura pessoal ampla; backend MVP ausente; fixture insuficiente; provisionamento/backup/clientes não comprovados.

Riscos adicionais: defaults amplos de grants em novos objetos; cascatas antigas versus histórico; exposição de estados intermediários; importação duplicando entregas; backfill inventando presença; edição de FK não recalculando agregado de origem; alteração de disponibilidade sem validação completa; uso incorreto de conta sem complemento.

Os contadores hoje coerentes não comprovam segurança concorrente. Ausência de publicações/buckets agora não permite dispensar preflight. Não houve demonstração destrutiva ou incidente atribuído nesta tarefa.

## 23. Decisões necessárias

Antes de escrever no Supabase, aprovar:
1. Somente APROVADA ocupa ou PENDENTE reserva? Qual destino compatível de vagas_ocupadas?
2. Endereço mínimo e propriedade/edição do endereço institucional.
3. Recandidatura, prazo de cancelamento e tratamento das duas CANCELADAS sem alterar seu passado.
4. Escopo de leitura de gestão e dados institucionais publicáveis; manter exposição mínima de dados pessoais.
5. Provisionamento de gestão e correção administrativa da conta ONG sem complemento.
6. Caminho legado de oficinas e clientes antigos que escrevem diretamente.
7. Estratégia de sequência ativa e preservação das sete migrations locais pendentes, sem falsificar ledger.
8. Janela de corte, plano de backup/restore, RPO/RTO, responsáveis e autorização explícita por lote.
9. Qualquer backfill futuro, com mapeamento e efeito por conjunto de dados.
10. Contas/dados fictícios e permissão para testes JWT que gravem registros.

Parâmetros do Diário já aprovados não exigem nova escolha de produto. Preservar legado/dados é requisito, não alternativa.

## 24. Ordem recomendada de implementação

1. Revisar e aprovar decisões; nenhum deploy agora.
2. Preparar referência verificável do remoto, estratégia do ledger e ensaio de restauração. Parar se faltar backup recuperável.
3. Preparar somente depois as migrations novas e alterações mínimas de contrato local; revisar diff/ACL/efeitos.
4. Ensaiar fases 1–5 sobre estado reproduzido e rodar concorrência real. Parar em perda de dados ou comportamento divergente.
5. Solicitar autorização explícita para corte no Supabase; recontar dados e verificar drift.
6. Aplicar sequência autorizada com clientes incompatíveis suspensos; validar catálogo/contagens antes de continuar.
7. Autorizar e executar JWT/Storage real; somente depois app compatível.
8. Android e homologação funcional integrada; não declarar produção aprovada.

Primeira migration corretiva que faz sentido preparar futuramente: **reconciliacao_01_base_perfis_endereco**, com helpers seguros e perfil atômico no endereço estruturado. Exige antes estratégia de histórico, dados/contratos de perfil, leitura mínima e provisionamento definidos. Sua liberação deve ser coordenada com os lotes de segurança; não resolve sozinha vagas/inscrições.

## 25. O que NÃO deve ser feito

Não aplicar as sete pendentes em bloco; não resetar projeto; não db push indiscriminado; não reparar ledger para simular execução; não editar migrations históricas; não remover colunas para acomodar SQL antigo; não apagar tabela/dado; não importar legado automaticamente; não converter aprovação em presença; não emitir certificado retroativo sem evidência; não criar buckets/policies nesta etapa; não explorar TRUNCATE/UPDATE/INSERT em contas reais; não interpretar consulta postgres como teste JWT.

Não foi criado script corretivo, feito deploy, backup, backfill ou escrita remota. Nenhuma policy/função/trigger foi alterada. O trabalho termina no diagnóstico.

### Validação da entrega

Sete consultas remotas de leitura concluídas. Somente este relatório foi criado. Conferência SHA-256 dos arquivos preexistentes, git diff --check e git status executados ao final; resultados apresentados na entrega. Sem staging, commit ou push.
