# Reconciliação 1A — estrutura do banco

Data: 29/09/2026. Projeto remoto: HortaConecta (`hnawclapixopwjyrpxpq`).

> **Situação em 05/10/2026.**
> - **Desfecho:** o inventário serviu de base para a 1B e para as reconciliações aplicadas em 30/09.
>   As "dez migrations locais" comparadas aqui ficaram como histórico; não são aplicadas no remoto.
> - **Reversão de 05/10:** onde este relatório trata `metas_demandas`/`contribuicoes` como legado
>   financeiro e as tabelas de materiais como contrato do MVP, vale o contrário: metas em dinheiro e de
>   materiais são o modelo ativo, e `solicitacoes_materiais`/`contribuicoes_materiais` serão excluídas pela
>   reconciliação pendente `20261005150000` ([CONTRIBUICOES.md](../mvp/CONTRIBUICOES.md)).
> - Oficinas e certificados estão fora do MVP desde 05/10 ([ESCOPO_MVP.md](../mvp/ESCOPO_MVP.md)).
> - O estado atual do remoto está em [COMPATIBILIDADE_SUPABASE_20260930.md](COMPATIBILIDADE_SUPABASE_20260930.md).
>
> O texto abaixo preserva a análise de 29/09.

## 1. Estado remoto atual

Esta entrega compara o catálogo remoto consultado nesta etapa com as dez migrations locais, `src/lib/database.types.ts`, `CLAUDE.md`, `docs/auditoria/AUDITORIA_FINAL_MVP.md` e `docs/reconciliacao/PLANO_RECONCILIACAO_SUPABASE.md`. Foram feitas somente consultas SELECT de metadados: ledger de migrations, information_schema e pg_catalog. Nenhuma função de negócio foi executada.

**CONFIRMADO:** 12 tabelas ordinárias em public, todas pertencentes a postgres e com RLS habilitada; sete enums; 54 constraints catalogadas (PK, FK, UNIQUE e CHECK), todas validadas; 26 índices; nove funções em public; dez triggers não internos em public e um de cadastro em auth.users.

Schemas não internos encontrados: auth, extensions, graphql, graphql_public, public, realtime, storage, supabase_migrations e vault. **Ausente:** voluntariado_privado. Não existem views ou materialized views em public; o schema privado esperado tampouco existe. Não se conclui ausência de views nos schemas gerenciados do Supabase.

**DIVERGENTE:** o remoto não representa o estado final das cinco prioridades locais. Possui evolução própria de endereço, vagas e habilidades por atividade. **NÃO COMPROVADO nesta etapa:** comportamento por JWT, concorrência entre conexões, conteúdo histórico dos registros, integridade semântica dos dados e compatibilidade de implantação. RLS habilitada não comprova isolamento. Não foram repetidos testes funcionais nem feita auditoria de permissões nesta etapa estrutural.

As conclusões antigas de “schema não disponível” em AUDITORIA_FINAL_MVP devem ser lidas no contexto da auditoria local anterior: o catálogo agora foi observado. Isso não transforma os testes locais daquele documento em testes remotos.

## 2. Histórico de migrations

“Aplicada” significa presença da versão/nome no ledger remoto consultado; não comprova igualdade byte a byte com o arquivo local nem a data/ordem efetiva de execução. A ordenação abaixo é por versão. São 11 registros remotos: três compartilhados, oito exclusivos. Há sete arquivos locais sem registro remoto.

### Dez migrations locais

| Versão e nome | No ledger remoto | Estrutura e dependências |
|---|---|---|
| 20260914120000_completa_modelo_dados | Sim | Cria ongs, habilidades, vínculos, inscrições, metas, contribuições, Diário e configuração; enums auxiliares, índices e triggers. Depende da base usuarios/voluntarios/atividades e helpers anteriores, não criada nesta pasta. |
| 20260914121500_revoga_execucao_trigger_arrecadacao | Sim | Revoga execução da função financeira de trigger; depende da anterior. |
| 20260914140000_seed_habilidades | Sim | Dados de referência em habilidades; não cria modelo novo. |
| 20260923120000_fluxo_voluntariado | Não | Schema privado, tokens, cinco campos de inscrições, RPCs e proteções de identidade/atividade; depende da base e usa usuarios.endereco removido no remoto. |
| 20260924120000_valida_seguranca_voluntariado | Não | Policies restritivas de inscrições e revokes; depende da anterior, sem novas tabelas. |
| 20260924140000_contribuicao_materiais | Não | Duas tabelas novas, constraints, índices e sete RPCs; usa helper privado de gestão. |
| 20260924160000_diario_transparencia | Não | Amplia Diário, índices, oito funções, bucket e policies de Storage; depende da base, Storage e gestão privada. |
| 20260924180000_propostas_oficinas | Não | Tabela independente, constraints, índices e cinco RPCs; depende de usuarios e helper privado. |
| 20260924200000_certificados | Não | Snapshot com UUID, vínculo único à participação, índice e três RPCs; depende de inscrições ampliadas e configuração institucional. |
| 20260924210000_coerencia_mvp | Não | Revisão do Diário, wrappers, trigger histórico e RPC atômica de gestão; depende de Diário/voluntariado e ainda escreve usuarios.endereco. |

### Oito migrations somente remotas

| Versão e nome | Evolução registrada e objetos correspondentes |
|---|---|
| 20260914025837_remote_schema | Base original: usuarios, voluntarios, atividades, enums, helpers, cadastro e triggers. Seu arquivo não está em supabase/migrations local. |
| 20260927213000_controle_vagas_candidatura | vagas_ocupadas, CHECK de capacidade, atualizar_vagas_ocupadas, validar_transicao_inscricao e triggers/policies de inscrições. |
| 20260927220000_perfil_completo_exige_habilidades | Requisito de usuario_habilidades em perfil_completo. |
| 20260927230000_areas_da_atividade | atividade_habilidades, PK composta, duas FKs, índice por habilidade e policies. |
| 20260928010000_gestao_lanca_contribuicao | url_comprovante passa a nullable; trigger financeiro passa a INSERT/UPDATE/DELETE e função recalcula soma; policy administrativa. |
| 20260928020000_candidatura_so_para_atividade_futura | Condição temporal nas policies de candidatura/reabertura, sem tabela nova. |
| 20260929180000_endereco_em_campos | Sete campos de voluntarios, endereço institucional, checks CEP/UF; retirada de usuarios.endereco. O histórico registrado descreve transferência dos endereços; esta etapa não auditou registro a registro essa transferência. |
| 20260929193000_perfil_completo_exige_endereco | perfil_completo passa a exigir logradouro, numero e cidade. |

A correspondência foi confrontada com o plano anterior e com os objetos atuais. Uma função alterada várias vezes mostra apenas sua definição final no catálogo. O ledger não substitui um ensaio integral dos scripts. Não há classificação para execução, reparo de ledger ou proposta de migration nesta entrega.

## 3. Tabelas locais × remotas

| Tabela | Remoto | Comparação com o contrato local final |
|---|---|---|
| usuarios | Existe | Base não criada nas dez locais; endereço livre esperado pelo app está ausente. |
| voluntarios | Existe | Sete campos estruturados adicionais ao contrato local. |
| ongs | Existe | Estrutura complementar compartilhada, inclusive campos PIX. |
| atividades | Existe | Base externa à pasta local; possui vagas_ocupadas adicional. |
| habilidades | Existe | Estrutura compartilhada. |
| usuario_habilidades | Existe | Estrutura compartilhada. |
| atividade_habilidades | Existe | Evolução remota sem tabela equivalente nas dez locais/tipos atuais. |
| inscricoes_atividades | Existe | Estrutura antiga; faltam decisão, check-in e snapshot de horas do MVP. |
| configuracao_instituicao | Existe | Possui endereco adicional; singleton, não cadastro de múltiplas instituições. |
| diario_transparencia | Existe | Somente estrutura antiga. |
| metas_demandas | Existe | Legado preservado; não equivale às solicitações novas de materiais. |
| contribuicoes | Existe | Legado com comprovante opcional; não equivale às contribuições novas de materiais. |
| solicitacoes_materiais | Ausente | Prevista em 20260924140000. |
| contribuicoes_materiais | Ausente | Prevista em 20260924140000. |
| propostas_oficinas | Ausente | Prevista em 20260924180000; não é uma atividade OFICINA_AUTORAL. |
| certificados | Ausente | Prevista em 20260924200000. |
| voluntariado_privado.tokens_checkin | Ausente | Prevista em 20260923120000; schema também ausente. |

Não existe tabela autônoma de endereços no schema public remoto. Tipos TypeScript descrevem contratos, não definem constraints, precisão numérica, defaults ou permissões de produção.

## 4. Diferenças de colunas

| Objeto | Diferença estrutural relevante |
|---|---|
| usuarios | endereco não existe; ainda aparece em database.types.ts, CLAUDE.md, telas e SQL de salvamento local. |
| voluntarios | Remoto acrescenta cep, logradouro, numero, complemento, bairro, cidade, uf, todos text nullable. |
| configuracao_instituicao | Remoto acrescenta endereco text nullable. |
| atividades | vagas_ocupadas integer NOT NULL DEFAULT 0 existe apenas no remoto; carga_horaria é numeric(5,2), não horas medidas. Status default PENDENTE_APROVACAO. Tipagem number não captura essa precisão/default. |
| inscricoes_atividades | Faltam decidido_em timestamptz, decidido_por uuid, motivo_decisao text, checkin_em timestamptz e carga_horaria_registrada numeric. |
| diario_transparencia | Faltam texto, status, imagem_caminho, atualizado_em e revisao; permanecem descricao_curta e url_imagem. |
| contribuicoes | url_comprovante é nullable, embora a migration local original o criasse NOT NULL. |
| Novas tabelas ausentes | Todas as suas colunas, constraints, índices e funções dependentes estão ausentes; não é apenas divergência de tipagem. |

Seis IDs bigint são GENERATED ALWAYS AS IDENTITY no remoto: atividades, contribuicoes, diario_transparencia, habilidades, inscricoes_atividades e metas_demandas. usuarios usa UUID ligado ao Auth; ongs e voluntarios usam esse UUID como PK; configuração usa smallint com default 1. As novas tabelas locais de materiais/oficinas usam identidade bigint; certificados usa UUID gerado.

### Enums remotos

| Tipo | Valores na ordem catalogada |
|---|---|
| status_atividade | PENDENTE_APROVACAO, ABERTA, ENCERRADA, REALIZADA, CANCELADA, RECUSADA |
| status_inscricao | PENDENTE, APROVADA, RECUSADA, CANCELADA |
| status_meta | ABERTA, ENCERRADA, CANCELADA |
| status_validacao | PENDENTE, APROVADA, RECUSADA |
| tipo_atividade | TAREFA_ONG, OFICINA_AUTORAL |
| tipo_meta | FINANCEIRA, MATERIAL |
| tipo_perfil | VOLUNTARIO, ONG |

Os estados novos de materiais, Diário e propostas locais são text com CHECK, não novos enums PostgreSQL. REJEITADA em propostas é diferente de RECUSADA em inscrições. Não há indicação para normalizar esses nomes nesta análise.

### Inventário completo das colunas remotas

A listagem abaixo reproduz tipos, nulabilidade e defaults obtidos no catálogo. A notação int8(64,0)/int4(32,0) representa precisão binária reportada por information_schema para bigint/integer; não significa declaração SQL com tamanho. Ausência de NOT NULL significa nullable.

### atividade_habilidades

```text
atividade_id int8(64,0) NOT NULL
habilidade_id int8(64,0) NOT NULL
```

### atividades

```text
id int8(64,0) NOT NULL
titulo text NOT NULL
descricao text NOT NULL
tipo tipo_atividade NOT NULL
autor_id uuid NOT NULL
data_hora_prevista timestamptz NOT NULL
vagas_totais int4(32,0) NOT NULL
carga_horaria numeric(5,2) NOT NULL
status status_atividade NOT NULL DEFAULT 'PENDENTE_APROVACAO'::status_atividade
criado_em timestamptz NOT NULL DEFAULT now()
atualizado_em timestamptz NOT NULL DEFAULT now()
vagas_ocupadas int4(32,0) NOT NULL DEFAULT 0
```

### configuracao_instituicao

```text
id int2(16,0) NOT NULL DEFAULT 1
nome_curto text NOT NULL
nome_completo text NOT NULL
cidade text NOT NULL
uf text NOT NULL
chamada text
sobre text
cor_primaria text
cor_acento text
url_logo text
site text
telefone text
whatsapp text
email_contato text
atualizado_em timestamptz NOT NULL DEFAULT now()
endereco text
```

### contribuicoes

```text
id int8(64,0) NOT NULL
meta_id int8(64,0) NOT NULL
usuario_id uuid NOT NULL
quantidade_oferecida numeric(12,2) NOT NULL
url_comprovante text
data_envio timestamptz NOT NULL DEFAULT now()
status_validacao status_validacao NOT NULL DEFAULT 'PENDENTE'::status_validacao
validado_por uuid
validado_em timestamptz
observacao_validacao text
```

### diario_transparencia

```text
id int8(64,0) NOT NULL
titulo text NOT NULL
descricao_curta text
url_imagem text
atividade_id int8(64,0)
data_publicacao timestamptz NOT NULL DEFAULT now()
autor_id uuid NOT NULL
```

### habilidades

```text
id int8(64,0) NOT NULL
nome_habilidade text NOT NULL
categoria text
```

### inscricoes_atividades

```text
id int8(64,0) NOT NULL
atividade_id int8(64,0) NOT NULL
usuario_id uuid NOT NULL
data_inscricao timestamptz NOT NULL DEFAULT now()
status_inscricao status_inscricao NOT NULL DEFAULT 'PENDENTE'::status_inscricao
presenca_confirmada bool NOT NULL DEFAULT false
```

### metas_demandas

```text
id int8(64,0) NOT NULL
titulo text NOT NULL
descricao text NOT NULL
tipo tipo_meta NOT NULL
unidade_medida text
quantidade_meta numeric(12,2) NOT NULL
quantidade_arrecadada numeric(12,2) NOT NULL DEFAULT 0
url_imagem_capa text
data_limite date
status status_meta NOT NULL DEFAULT 'ABERTA'::status_meta
criado_em timestamptz NOT NULL DEFAULT now()
atualizado_em timestamptz NOT NULL DEFAULT now()
```

### ongs

```text
usuario_id uuid NOT NULL
cnpj text
razao_social text
data_criacao date
responsavel_legal text
chave_pix text
nome_beneficiario_pix text
whatsapp text
atualizado_em timestamptz NOT NULL DEFAULT now()
```

### usuario_habilidades

```text
usuario_id uuid NOT NULL
habilidade_id int8(64,0) NOT NULL
```

### usuarios

```text
id uuid NOT NULL
nome text NOT NULL
telefone text
descricao text
perfil_instagram text
tipo_perfil tipo_perfil NOT NULL DEFAULT 'VOLUNTARIO'::tipo_perfil
foto_perfil text
exclusao_solicitada_em timestamptz
criado_em timestamptz NOT NULL DEFAULT now()
atualizado_em timestamptz NOT NULL DEFAULT now()
```

### voluntarios

```text
usuario_id uuid NOT NULL
cpf text
data_nascimento date
profissao text
disponibilidade_horarios jsonb NOT NULL DEFAULT '[]'::jsonb
atualizado_em timestamptz NOT NULL DEFAULT now()
cep text
logradouro text
numero text
complemento text
bairro text
cidade text
uf text
```

## 5. Diferenças de constraints

As PKs e FKs do complemento original estão presentes. As diferenças principais são os checks remotos de vagas_ocupadas e CEP/UF, a PK/FKs de atividade_habilidades, e a ausência das constraints das estruturas locais ainda não implantadas.

No local pendente: tokens têm PK por atividade e FKs; decidido_por referencia usuarios com RESTRICT; materiais têm limites inteiros e coerência quantidade/status; propostas têm coerência da decisão, autor diferente do decisor e justificativa de rejeição; certificados têm participação UNIQUE e horas positivas finitas; Diário tem checks de texto, caminho/status e revisão positiva. Essas garantias não podem ser atribuídas ao remoto.

A presença confirmada remota é somente boolean com default false; default não obriga um INSERT a usar false. O estado inicial PENDENTE também é default, não uma constraint que proíba outro valor inicial. Restrições operacionais precisam ser avaliadas junto de policies/triggers/RPCs, fora do teste estrutural.

Todas as 54 constraints abaixo estão convalidated=true. Isso prova seu estado no catálogo, não que regras ausentes ou semântica histórica estejam satisfeitas.

| Tabela | Constraint | Definição remota |
|---|---|---|
| atividade_habilidades | `atividade_habilidades_atividade_id_fkey` | FOREIGN KEY (atividade_id) REFERENCES atividades(id) ON DELETE CASCADE |
| atividade_habilidades | `atividade_habilidades_habilidade_id_fkey` | FOREIGN KEY (habilidade_id) REFERENCES habilidades(id) ON DELETE CASCADE |
| atividade_habilidades | `atividade_habilidades_pkey` | PRIMARY KEY (atividade_id, habilidade_id) |
| atividades | `atividades_autor_id_fkey` | FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE RESTRICT |
| atividades | `atividades_carga_horaria_check` | CHECK ((carga_horaria > (0)::numeric)) |
| atividades | `atividades_pkey` | PRIMARY KEY (id) |
| atividades | `atividades_titulo_check` | CHECK (((length(TRIM(BOTH FROM titulo)) >= 3) AND (length(TRIM(BOTH FROM titulo)) <= 120))) |
| atividades | `atividades_vagas_ocupadas_check` | CHECK (((vagas_ocupadas >= 0) AND (vagas_ocupadas <= vagas_totais))) |
| atividades | `atividades_vagas_totais_check` | CHECK (((vagas_totais >= 1) AND (vagas_totais <= 500))) |
| configuracao_instituicao | `configuracao_instituicao_pkey` | PRIMARY KEY (id) |
| configuracao_instituicao | `configuracao_instituicao_singleton_check` | CHECK ((id = 1)) |
| configuracao_instituicao | `configuracao_instituicao_uf_check` | CHECK ((uf ~ '^[A-Z]{2}$'::text)) |
| contribuicoes | `contribuicoes_meta_id_fkey` | FOREIGN KEY (meta_id) REFERENCES metas_demandas(id) ON DELETE CASCADE |
| contribuicoes | `contribuicoes_pkey` | PRIMARY KEY (id) |
| contribuicoes | `contribuicoes_quantidade_check` | CHECK ((quantidade_oferecida > (0)::numeric)) |
| contribuicoes | `contribuicoes_usuario_id_fkey` | FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE |
| contribuicoes | `contribuicoes_validacao_coerente_check` | CHECK ((((status_validacao = 'PENDENTE'::status_validacao) AND (validado_por IS NULL) AND (validado_em IS NULL)) OR ((status_validacao <> 'PENDENTE'::status_validacao) AND (validado_por IS NOT NULL) AND (validado_em IS NOT NULL)))) |
| contribuicoes | `contribuicoes_validado_por_fkey` | FOREIGN KEY (validado_por) REFERENCES usuarios(id) ON DELETE SET NULL |
| diario_transparencia | `diario_transparencia_atividade_id_fkey` | FOREIGN KEY (atividade_id) REFERENCES atividades(id) ON DELETE SET NULL |
| diario_transparencia | `diario_transparencia_autor_id_fkey` | FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE RESTRICT |
| diario_transparencia | `diario_transparencia_pkey` | PRIMARY KEY (id) |
| diario_transparencia | `diario_transparencia_titulo_check` | CHECK (((length(TRIM(BOTH FROM titulo)) >= 3) AND (length(TRIM(BOTH FROM titulo)) <= 120))) |
| habilidades | `habilidades_nome_habilidade_check` | CHECK (((length(TRIM(BOTH FROM nome_habilidade)) >= 2) AND (length(TRIM(BOTH FROM nome_habilidade)) <= 80))) |
| habilidades | `habilidades_nome_habilidade_key` | UNIQUE (nome_habilidade) |
| habilidades | `habilidades_pkey` | PRIMARY KEY (id) |
| inscricoes_atividades | `inscricoes_atividades_atividade_id_fkey` | FOREIGN KEY (atividade_id) REFERENCES atividades(id) ON DELETE CASCADE |
| inscricoes_atividades | `inscricoes_atividades_pkey` | PRIMARY KEY (id) |
| inscricoes_atividades | `inscricoes_atividades_unica` | UNIQUE (atividade_id, usuario_id) |
| inscricoes_atividades | `inscricoes_atividades_usuario_id_fkey` | FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE |
| metas_demandas | `metas_demandas_pkey` | PRIMARY KEY (id) |
| metas_demandas | `metas_demandas_quantidade_arrecadada_check` | CHECK ((quantidade_arrecadada >= (0)::numeric)) |
| metas_demandas | `metas_demandas_quantidade_meta_check` | CHECK ((quantidade_meta > (0)::numeric)) |
| metas_demandas | `metas_demandas_titulo_check` | CHECK (((length(TRIM(BOTH FROM titulo)) >= 3) AND (length(TRIM(BOTH FROM titulo)) <= 120))) |
| ongs | `ongs_cnpj_check` | CHECK ((cnpj ~ '^[0-9]{14}$'::text)) |
| ongs | `ongs_cnpj_key` | UNIQUE (cnpj) |
| ongs | `ongs_pkey` | PRIMARY KEY (usuario_id) |
| ongs | `ongs_usuario_id_fkey` | FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE |
| ongs | `ongs_whatsapp_check` | CHECK ((whatsapp ~ '^[0-9]{10,11}$'::text)) |
| usuario_habilidades | `usuario_habilidades_habilidade_id_fkey` | FOREIGN KEY (habilidade_id) REFERENCES habilidades(id) ON DELETE CASCADE |
| usuario_habilidades | `usuario_habilidades_pkey` | PRIMARY KEY (usuario_id, habilidade_id) |
| usuario_habilidades | `usuario_habilidades_usuario_id_fkey` | FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE |
| usuarios | `usuarios_descricao_check` | CHECK ((length(descricao) <= 500)) |
| usuarios | `usuarios_id_fkey` | FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE |
| usuarios | `usuarios_nome_check` | CHECK (((length(TRIM(BOTH FROM nome)) >= 2) AND (length(TRIM(BOTH FROM nome)) <= 120))) |
| usuarios | `usuarios_perfil_instagram_check` | CHECK ((perfil_instagram ~ '^[A-Za-z0-9._]{1,30}$'::text)) |
| usuarios | `usuarios_pkey` | PRIMARY KEY (id) |
| usuarios | `usuarios_telefone_check` | CHECK ((telefone ~ '^[0-9]{10,11}$'::text)) |
| voluntarios | `voluntarios_cep_check` | CHECK (((cep IS NULL) OR (cep ~ '^[0-9]{8}$'::text))) |
| voluntarios | `voluntarios_cpf_check` | CHECK ((cpf ~ '^[0-9]{11}$'::text)) |
| voluntarios | `voluntarios_cpf_key` | UNIQUE (cpf) |
| voluntarios | `voluntarios_data_nascimento_check` | CHECK (((data_nascimento > '1900-01-01'::date) AND (data_nascimento < CURRENT_DATE))) |
| voluntarios | `voluntarios_pkey` | PRIMARY KEY (usuario_id) |
| voluntarios | `voluntarios_uf_check` | CHECK (((uf IS NULL) OR (uf ~ '^[A-Z]{2}$'::text))) |
| voluntarios | `voluntarios_usuario_id_fkey` | FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE |

Pontos de dependência: excluir atividade hoje pode propagar exclusão de inscrições e áreas; o vínculo opcional do Diário fica NULL. No modelo local de certificados a participação passa a ser referenciada com RESTRICT. A FK contribuicoes.validado_por usa SET NULL, enquanto o CHECK de validação exige responsável para estados decididos: a exclusão desse responsável pode ser impedida por essa combinação. Não foi executado teste de exclusão.

## 6. Diferenças de índices

Há 26 índices btree remotos: 12 de PK, quatro UNIQUE adicionais e dez secundários. Não foram encontrados índices parciais em public. O índice de atividade_habilidades por habilidade é evolução exclusiva remota. Os índices do complemento original permanecem.

Ausentes os índices locais materiais_uma_pendente (UNIQUE parcial), materiais_contrib_usuario, materiais_contrib_solicitacao, materiais_solic_status, diario_status_data, diario_imagem_unica (UNIQUE parcial), oficinas_autor_data, oficinas_status_data e certificados_usuario_data. A ausência acompanha a ausência das tabelas/colunas; não é recomendação isolada de criação.

Inventário remoto exato (DDL exibido somente como evidência, não executado):

- `CREATE INDEX atividade_habilidades_habilidade_idx ON public.atividade_habilidades USING btree (habilidade_id)`
- `CREATE UNIQUE INDEX atividade_habilidades_pkey ON public.atividade_habilidades USING btree (atividade_id, habilidade_id)`
- `CREATE INDEX atividades_agenda_idx ON public.atividades USING btree (status, data_hora_prevista DESC)`
- `CREATE INDEX atividades_autor_idx ON public.atividades USING btree (autor_id)`
- `CREATE UNIQUE INDEX atividades_pkey ON public.atividades USING btree (id)`
- `CREATE UNIQUE INDEX configuracao_instituicao_pkey ON public.configuracao_instituicao USING btree (id)`
- `CREATE INDEX contribuicoes_meta_idx ON public.contribuicoes USING btree (meta_id)`
- `CREATE UNIQUE INDEX contribuicoes_pkey ON public.contribuicoes USING btree (id)`
- `CREATE INDEX contribuicoes_usuario_idx ON public.contribuicoes USING btree (usuario_id)`
- `CREATE UNIQUE INDEX diario_transparencia_pkey ON public.diario_transparencia USING btree (id)`
- `CREATE INDEX diario_transparencia_publicacao_idx ON public.diario_transparencia USING btree (data_publicacao DESC)`
- `CREATE UNIQUE INDEX habilidades_nome_habilidade_key ON public.habilidades USING btree (nome_habilidade)`
- `CREATE UNIQUE INDEX habilidades_pkey ON public.habilidades USING btree (id)`
- `CREATE INDEX inscricoes_atividades_atividade_idx ON public.inscricoes_atividades USING btree (atividade_id)`
- `CREATE UNIQUE INDEX inscricoes_atividades_pkey ON public.inscricoes_atividades USING btree (id)`
- `CREATE UNIQUE INDEX inscricoes_atividades_unica ON public.inscricoes_atividades USING btree (atividade_id, usuario_id)`
- `CREATE INDEX inscricoes_atividades_usuario_idx ON public.inscricoes_atividades USING btree (usuario_id)`
- `CREATE UNIQUE INDEX metas_demandas_pkey ON public.metas_demandas USING btree (id)`
- `CREATE INDEX metas_demandas_status_idx ON public.metas_demandas USING btree (status, data_limite)`
- `CREATE UNIQUE INDEX ongs_cnpj_key ON public.ongs USING btree (cnpj)`
- `CREATE UNIQUE INDEX ongs_pkey ON public.ongs USING btree (usuario_id)`
- `CREATE INDEX usuario_habilidades_habilidade_idx ON public.usuario_habilidades USING btree (habilidade_id)`
- `CREATE UNIQUE INDEX usuario_habilidades_pkey ON public.usuario_habilidades USING btree (usuario_id, habilidade_id)`
- `CREATE UNIQUE INDEX usuarios_pkey ON public.usuarios USING btree (id)`
- `CREATE UNIQUE INDEX voluntarios_cpf_key ON public.voluntarios USING btree (cpf)`
- `CREATE UNIQUE INDEX voluntarios_pkey ON public.voluntarios USING btree (usuario_id)`

Não foram medidos planos de consulta ou desempenho. A existência de índice não prova eficiência/concorrência; o índice de participação UNIQUE impede pares repetidos, não implementa controle de vagas.

## 7. Diferenças de triggers

Todos os triggers não internos abaixo estão habilitados no modo normal (O). Foram inspecionados public e o trigger de cadastro em auth.users; triggers internos de FK e os gerenciados de Storage não fazem parte desta lista.

- `CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()`
- `CREATE TRIGGER trg_atividades_atualizado BEFORE UPDATE ON public.atividades FOR EACH ROW EXECUTE FUNCTION set_atualizado_em()`
- `CREATE TRIGGER trg_configuracao_instituicao_atualizado BEFORE UPDATE ON public.configuracao_instituicao FOR EACH ROW EXECUTE FUNCTION set_atualizado_em()`
- `CREATE TRIGGER trg_contribuicoes_arrecadacao AFTER INSERT OR DELETE OR UPDATE ON public.contribuicoes FOR EACH ROW EXECUTE FUNCTION atualizar_arrecadacao_meta()`
- `CREATE TRIGGER trg_inscricoes_vagas AFTER INSERT OR DELETE OR UPDATE ON public.inscricoes_atividades FOR EACH ROW EXECUTE FUNCTION atualizar_vagas_ocupadas()`
- `CREATE TRIGGER trg_validar_transicao_inscricao BEFORE UPDATE ON public.inscricoes_atividades FOR EACH ROW EXECUTE FUNCTION validar_transicao_inscricao()`
- `CREATE TRIGGER trg_metas_demandas_atualizado BEFORE UPDATE ON public.metas_demandas FOR EACH ROW EXECUTE FUNCTION set_atualizado_em()`
- `CREATE TRIGGER trg_ongs_atualizado BEFORE UPDATE ON public.ongs FOR EACH ROW EXECUTE FUNCTION set_atualizado_em()`
- `CREATE TRIGGER trg_proteger_campos_perfil BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION proteger_campos_perfil()`
- `CREATE TRIGGER trg_usuarios_atualizado BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION set_atualizado_em()`
- `CREATE TRIGGER trg_voluntarios_atualizado BEFORE UPDATE ON public.voluntarios FOR EACH ROW EXECUTE FUNCTION set_atualizado_em()`

Diferenças:
- O financeiro local original executava AFTER UPDATE; o remoto executa após INSERT, DELETE ou UPDATE. A alteração é evolução remota registrada.
- O remoto possui dois triggers próprios de inscrições, ausentes na sequência local.
- Não existem remotamente trg_voluntariado_identidade, trg_voluntariado_atividade, trg_atividade_historico ou trg_diario_revisao.
- proteger_campos_perfil remoto não é o mesmo helper/trigger que proteger_identidade local. Nomes diferentes permitem coexistência; não constituem substituição automática.
- O trigger de vagas atualiza atividades, acionando também seu trigger de atualizado_em. A interação com futuros triggers locais não foi executada.
- O trigger de cadastro cria usuarios como VOLUNTARIO e o registro voluntarios. Isso foi confirmado pela definição; não foi criado usuário nesta etapa.

## 8. Diferenças de funções/RPCs

### Nove funções remotas em public

| Assinatura | Retorno / execução | Papel estrutural atual |
|---|---|---|
| e_ong(uuid DEFAULT auth.uid()) | boolean, SECURITY DEFINER | Consulta usuarios.tipo_perfil. |
| perfil_completo(uuid DEFAULT auth.uid()) | boolean, SECURITY DEFINER | Combina usuarios, voluntarios, endereço e usuario_habilidades. |
| handle_new_user() | trigger, SECURITY DEFINER | Cria usuarios/voluntarios a partir de auth.users, com perfil VOLUNTARIO fixo. |
| proteger_campos_perfil() | trigger, invoker | Bloqueia alteração de tipo_perfil para current_user anon/authenticated; demais papéis passam. |
| set_atualizado_em() | trigger, invoker | Atualiza timestamp de várias tabelas. |
| solicitar_exclusao_conta() | void, SECURITY DEFINER | Marca exclusao_solicitada_em do próprio auth.uid(). |
| atualizar_arrecadacao_meta() | trigger, SECURITY DEFINER | Soma contribuições APROVADAS na meta identificada por COALESCE(NEW.meta_id, OLD.meta_id). |
| atualizar_vagas_ocupadas() | trigger, SECURITY DEFINER | Conta PENDENTE e APROVADA na atividade identificada por COALESCE(NEW.atividade_id, OLD.atividade_id). |
| validar_transicao_inscricao() | trigger, invoker | Restringe presença/transição no UPDATE; isenta gestão e papéis administrativos. |

Todas têm search_path public, pg_temp na definição consultada. Função que retorna trigger não é uma operação RPC de negócio utilizável como as funções do MVP. A existência de SECURITY DEFINER não basta para concluir vulnerabilidade ou segurança; grants/policies e JWT precisam de análise própria.

### Funções locais sem correspondente remoto

- Voluntariado: voluntariado_elegibilidade, voluntariado_salvar_perfil, voluntariado_detalhe, voluntariado_candidatar, voluntariado_cancelar, voluntariado_candidatos, voluntariado_decidir, voluntariado_status_atividade, voluntariado_gerar_checkin, voluntariado_checkin, voluntariado_minhas_inscricoes.
- Materiais: materiais_salvar, materiais_contribuir, materiais_decidir, materiais_status, materiais_listar, materiais_detalhe, materiais_minhas.
- Diário: diario_gestao, diario_imagem_visivel, diario_imagem_livre, diario_caminho, diario_salvar, diario_status, diario_listar, diario_detalhe; depois diario_salvar_revisao e diario_status_revisao.
- Oficinas: oficinas_salvar, oficinas_cancelar, oficinas_decidir, oficinas_listar, oficinas_detalhe.
- Certificados: certificados_emitir, certificados_listar, certificados_detalhe.
- Gestão: gestao_salvar_perfil.
- Privadas: gestao, disponibilidade_valida, elegivel, proteger_identidade, proteger_atividade, diario_revisao e atividade_historico.

Não existem remotamente nem as versões antigas do Diário local nem seus wrappers de revisão. A migration de coerência revoga acesso às primeiras, mas preserva-as como implementação chamada pelas wrappers. As assinaturas e retornos previstos estão nos arquivos locais; nenhuma dessas funções foi chamada nesta auditoria.

## 9. Conflito de endereço

**CONFIRMADO:** usuarios.endereco foi retirado; voluntarios possui endereço estruturado; configuracao_instituicao possui endereço institucional livre. ongs não recebeu coluna de endereço. Não há tabela de endereços separada.

O helper remoto perfil_completo exige logradouro, numero e cidade não vazios; cep/uf são opcionais com checks de formato. Os demais campos também são nullable. O requisito de completude está na função, não em NOT NULL dos campos.

Dependências locais incompatíveis identificadas:
- src/lib/database.types.ts: Row/Insert/Update de usuarios ainda contêm endereco; contratos não representam a evolução completa remota.
- src/telas/TelaPerfilVoluntario.tsx: SELECT explícito de usuarios.endereco, estado de formulário e payload de salvamento.
- src/telas/TelaPerfilOng.tsx: leitura de endereco do perfil/resultado e envio no payload.
- 20260923120000_fluxo_voluntariado.sql: voluntariado_salvar_perfil escreve usuarios.endereco; elegivel não reproduz a exigência remota de endereço estruturado.
- 20260924210000_coerencia_mvp.sql: gestao_salvar_perfil escreve usuarios.endereco.
- CLAUDE.md: descreve endereço no local antigo e omite endereço institucional.

Essas referências estão registradas, não foram adaptadas. O SELECT explícito do voluntário é estruturalmente incompatível com a coluna ausente. Uma função PL/pgSQL pode ser criada e falhar apenas ao executar o statement: presença no ledger não provaria funcionamento do salvamento.

usuarios.nome, ongs.razao_social e configuracao_instituicao.nome_completo têm finalidades distintas no contrato atual: pessoa/conta, razão social e identificação institucional, respectivamente. O certificado local usa a terceira. Não há FK ligando cada atividade ou publicação a uma linha de configuração: a relação é indireta pelo singleton, enquanto autor_id aponta para usuarios.

## 10. Conflito de vagas

| Aspecto | Local final | Remoto observado |
|---|---|---|
| Total | atividades.vagas_totais | Mesma coluna, CHECK 1..500. |
| Contador armazenado | Não definido pelas dez migrations/tipos | vagas_ocupadas NOT NULL DEFAULT 0. |
| Quem ocupa | APROVADA, contada na decisão RPC | PENDENTE e APROVADA, contadas pelo trigger. |
| Limite | RPC trava atividade e conta aprovadas; trigger protege capacidade | CHECK 0 <= vagas_ocupadas <= vagas_totais. |
| Entrada | RPC cria PENDENTE; não reserva vaga nessa contagem | Trigger conta imediatamente a pendente. |
| Mudanças | Decisão por RPC e proteção histórica prevista | Trigger AFTER INSERT/UPDATE/DELETE atualiza contador; sem proteção histórica local. |

A RPC local de aprovação não substitui nem desativa o trigger remoto. Sua combinação manteria duas regras distintas. Uma pendente além do total pode ser rejeitada pelo CHECK remoto mesmo que o contrato local aceite fila de candidatos. Essa conclusão decorre das definições; não foi inserida candidatura para reproduzi-la.

O recálculo usa somente COALESCE(NEW.atividade_id, OLD.atividade_id). Se algum caminho permitir mudar a atividade de uma inscrição, a origem não é recalculada por essa função. A permissibilidade por usuário e o estado real dos contadores não foram testados aqui. O comentário da função afirmando que o contador nunca se dessincroniza não é evidência de concorrência correta.

Não se escolheu entre reserva em PENDENTE e ocupação em APROVADA. Não foi proposta substituição de objetos.

## 11. Conflito de inscrições

Estrutura comum: PK bigint, FKs para atividade/usuário, UNIQUE(atividade_id, usuario_id), data_inscricao, enum de status e boolean de presença.

Diferenças:
- Remoto não registra decisor/data/motivo da decisão, checkin_em nem carga_horaria_registrada.
- Não possui tokens privados nem funções de check-in do MVP.
- Trigger remoto atua somente BEFORE UPDATE; não determina sozinho os valores permitidos em INSERT.
- Para usuários comuns, permite PENDENTE/APROVADA → CANCELADA e CANCELADA → PENDENTE. A RPC local de candidatura rejeita vínculo já existente, e não implementa esse retorno automático.
- A regra temporal remota de candidatura está em policies, não em CHECK.
- FKs de inscrição existentes são CASCADE; o certificado local acrescenta uma referência RESTRICT à participação.
- Presença booleana antiga não fornece por si só timestamp/horas exigidos pelo certificado local. Não se deve inferir ou preencher essas informações nesta análise.

As diferenças de transição são fatos do código SQL, não testes com contas reais. Não foi concluído aqui que um usuário específico consegue inserir valores administrativos.

## 12. Dependências entre estruturas

- auth.users → usuarios → voluntarios/ongs; cadastro usa handle_new_user. A PK da especialização é também FK.
- usuarios + habilidades → usuario_habilidades → perfil_completo remoto.
- atividades + habilidades → atividade_habilidades, relação independente das habilidades pessoais.
- usuarios → atividades.autor_id; atividades + usuarios → inscrições → contador remoto.
- inscrições ampliadas + tokens privados + atividades → check-in local; participação confirmada + usuarios + configuração → certificado local.
- usuarios → solicitações/contribuições de materiais; confirmação local usa transação/RPC, sem depender de metas_demandas.
- usuarios + atividade opcional → Diário; imagem_caminho local se relaciona por caminho/policies com Storage, não por FK para storage.objects.
- usuarios → propostas_oficinas; não há FK local que converta proposta aprovada em atividade.
- metas_demandas + usuarios → contribuicoes → trigger de arrecadação legado.
- Helpers privados locais exigem schema voluntariado_privado; várias prioridades não podem ser consideradas independentes de sua ausência.

A ordem do histórico não é uma cadeia única: a base remota precede os três arquivos comuns, enquanto as oito evoluções remotas não estão representadas na pasta local. Não é possível reconstruir fielmente o remoto somente executando as dez migrations locais.

## 13. Riscos de aplicar migrations locais

1. Reexecutar os três arquivos já registrados pode colidir com tabelas, enums, funções, policies ou dados de referência.
2. Executar os sete pendentes sem reconciliação manteria referências à coluna de endereço removida.
3. Vagas continuariam sujeitas ao trigger/constraint remotos mesmo com as RPCs locais.
4. As proteções locais são adicionadas; triggers remotos com nomes diferentes permanecem ativos.
5. Mudanças de revokes/policies/RPCs podem interromper clientes remotos que ainda escrevem diretamente. Não foi identificado um inventário de versões de clientes em uso nesta consulta.
6. O Diário local introduz default PUBLICADA em registros antigos e separa imagem legada de caminho privado; implicações para conteúdo existente precisam ser avaliadas antes de qualquer execução.
7. Certificados passam a restringir exclusão de participações referenciadas; não equivalem ao modelo atual com CASCADE.
8. CREATE/ADD COLUMN não são garantia de reexecução idempotente; a existência isolada de objetos não substitui histórico consistente.
9. A migration 20260924210000 exige contrato de cliente com revisão do Diário e RPC de perfil; sua execução isolada não é compatível com todas as versões antigas.
10. A evolução remota de contribuição sem comprovante e trigger ampliado seria perdida conceitualmente se a base antiga fosse tratada como definição final.

Nenhum risco foi “resolvido” e nenhuma aplicação/rollback foi ensaiada. A conclusão é incompatibilidade estrutural a examinar, não aprovação de implantação.

## 14. Estruturas que precisam ser preservadas

- Todas as tabelas e registros existentes, IDs, vínculos, FKs e histórico de migrations.
- Endereços estruturados e endereço institucional já incorporados ao remoto.
- atividade_habilidades e seus vínculos; não confundir com usuario_habilidades.
- Cadastro original, especializações de usuário, dados de habilidades e configuração.
- Inscrições antigas, boolean de presença e dados das atividades, sem fabricação de novos timestamps/horas.
- Diário antigo, descricao_curta/url_imagem e vínculo opcional à atividade.
- Metas/contribuições legadas, campos PIX de ongs e trigger financeiro.
- Schemas gerenciados pelo Supabase; ausência do schema privado local não autoriza alterar os demais.

Preservar a informação e rastreabilidade não significa aprovar todas as regras atuais. Não foram consultados dados pessoais para compor este documento.

## 15. Estruturas que precisam ser compatibilizadas

| Fronteira | Contratos hoje diferentes |
|---|---|
| Histórico de implantação | Dez arquivos locais × onze versões remotas, base original ausente localmente. |
| Perfil/endereço | Coluna removida × sete campos de voluntário e configuração institucional. |
| Elegibilidade | perfil_completo remoto × elegivel privado local. |
| Vagas | Contador de pendentes/aprovados × aprovação por capacidade. |
| Inscrições | Modelo antigo de presença/transições × decisão, check-in e snapshot. |
| Histórico | Atividade editável pela estrutura atual × triggers históricos locais. |
| Diário | Colunas antigas × texto/status/caminho/revisão/RPCs. |
| Materiais | Modelo legado numérico × novas tabelas de quantidades inteiras. |
| Oficinas | Enum OFICINA_AUTORAL existente × propostas independentes. |
| Certificados | Participações antigas sem metadados × snapshot exigido pelo contrato local. |
| Tipos/configuração | database.types.ts/CLAUDE.md × colunas e precisões reais. |

Esta tabela delimita análise futura, sem determinar alterações SQL/TS ou a sequência de uma correção.

## 16. DECISÕES NECESSÁRIAS

1. Qual comportamento de reserva de vaga será homologado: PENDENTE ou somente APROVADA?
2. Como o contrato do perfil representará o endereço estruturado e sua completude, preservando valores existentes?
3. Qual é a finalidade editável do endereço institucional e sua separação do perfil da pessoa/ONG?
4. A recandidatura CANCELADA → PENDENTE remota será mantida ou o encerramento local será adotado?
5. Como registrar e reconciliar os dois históricos sem fingir execução de arquivos ausentes nem reaplicar os comuns?
6. Quais versões de clientes estão em uso e quais contratos antigos precisam permanecer compatíveis durante a transição?
7. Qual tratamento administrativo será dado a presenças antigas sem data/horas, sem inventar evidência para certificados?
8. Como preservar visibilidade e imagens do Diário antigo ao avaliar seu novo contrato?
9. Como representar as áreas de atividade remotas no contrato versionado, sem eliminá-las nem criar funcionalidade nesta etapa?

As sugestões do plano anterior não são decisões aprovadas por esta nova análise. Nenhuma alternativa foi implementada ou adotada automaticamente.

## 17. Próximo passo recomendado

Validar as decisões estruturais acima e conferir a rastreabilidade do histórico remoto com os responsáveis pelo banco. Só depois delimitar uma etapa de compatibilização separada. Este documento não contém proposta de migration corretiva e não autoriza execução no remoto.

### Verificação da entrega

- Único arquivo criado nesta etapa: docs/reconciliacao/RECONCILIACAO_1A_ESTRUTURA.md.
- Conferência SHA-256 dos arquivos existentes e git diff --check executadas ao final; resultado informado na entrega.
- Consultas remotas restritas a SELECT de catálogo/histórico. Nenhuma migration, DDL, DML, função de negócio ou operação de escrita em Auth/Storage foi executada.
- Não houve alteração de código, migrations existentes ou dados; não foram executados testes de carga, concorrência ou JWT.
