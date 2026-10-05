# Reconciliação 01 — perfis e endereço

Data: 29/09/2026. **Implementação exclusivamente local; não aplicada no Supabase.**

> **Situação em 05/10/2026.**
> - **Desfecho:** "não aplicada no Supabase" valia em 29/09. A migration foi aplicada em 30/09
>   (versão `20260930142505`), junto com a reconciliação 02.
> - **Reversão de 05/10:** onde este relatório trata `metas_demandas`/`contribuicoes` como legado
>   financeiro e as tabelas de materiais como contrato do MVP, vale o contrário: metas em dinheiro e de
>   materiais são o modelo ativo, e `solicitacoes_materiais`/`contribuicoes_materiais` serão excluídas pela
>   reconciliação pendente `20261005150000` ([CONTRIBUICOES.md](../mvp/CONTRIBUICOES.md)).
> - Oficinas e certificados estão fora do MVP desde 05/10 ([ESCOPO_MVP.md](../mvp/ESCOPO_MVP.md)).
> - O estado atual do remoto está em [COMPATIBILIDADE_SUPABASE_20260930.md](COMPATIBILIDADE_SUPABASE_20260930.md).
>
> O texto abaixo preserva a análise de 29/09.

## Decisões aprovadas e escopo

Esta entrega sucede as pendências registradas em RECONCILIACAO_01_BLOQUEIOS.md e nas seções 4.5/4.6 da 1C. O usuário aprovou:

- Criar atomicamente o complemento de uma conta já provisionada como ONG, sem duplicidade;
- Adotar elegibilidade estrita com logradouro, número e cidade preenchidos, sem modificar ou apagar cadastros existentes.

Arquivo solicitado: `supabase/migrations/reconciliacao_01_base_perfis_endereco.sql`.

**O nome sem timestamp foi mantido por instrução explícita.** Ele não segue o padrão de migrations do CLI. Não usar db push nem aplicar por arrasto as sete migrations históricas ausentes. A sequência de implantação e seu registro no ledger precisam de preparação/autorização separada. Este arquivo é destinado primeiro a ensaio isolado.

## Conferência do remoto

Foram executadas três consultas SELECT de catálogo, sem executar funções de negócio ou modificar objetos/dados. Conferidos campos/tipos, PKs/FKs/UNIQUE/CHECK, ownership e RLS das cinco tabelas de perfil/habilidades, funções antigas, triggers, policies dependentes e histórico de migrations.

Confirmado: ausencia de usuarios.endereco, endereço estruturado em voluntarios, endereço institucional separado, schema/RPCs novos ausentes, 11 versões no histórico remoto. Tabelas relevantes pertencem a postgres e possuem RLS. Policies de atividades e inscricoes_atividades dependem de perfil_completo(). O trigger de proteção de tipo_perfil e os três triggers de atualizado_em permanecem.

O fixture novo é um **recorte das definições observadas**, com dados exclusivamente sintéticos. Não é um dump completo: auth.uid()/auth.users são simulados e os serviços Auth/Storage, cadastro Auth, configuração institucional, tabelas financeiras e atividades não estão reproduzidos integralmente. Não foi usado service_role para demonstrar isolamento.

## Alterações SQL

- Lote BEGIN/COMMIT com lock_timeout de 5 segundos, abortamento explícito em pré-condições incompatíveis.
- Guards para owner postgres, ausência de colisões com schema/RPCs, ausência do endereço antigo, tipos das colunas, constraints validadas e RLS das tabelas esperadas; presença/definição/estado dos quatro triggers de perfil.
- A definição anterior de perfil_completo é verificada por hash do corpo, assinatura e owner. O hash serve para detectar divergência do catálogo, não como mecanismo de autenticação. Divergência exige revisão; não contornar automaticamente.
- Schema voluntariado_privado fechado e helpers de gestão, validação de disponibilidade, elegibilidade e normalização de payload.
- voluntariado_salvar_perfil(jsonb,bigint[]): atualiza próprio usuário, complemento e seleção de habilidades na mesma transação; retorna a elegibilidade após salvar.
- voluntariado_elegibilidade(): avalia somente o usuário da sessão.
- gestao_salvar_perfil(jsonb): exige tipo ONG persistido; bloqueia usuario, cria complemento se ausente usando PK/ON CONFLICT, bloqueia complemento e salva atomicamente. Não promove usuários.
- perfil_completo(uuid DEFAULT auth.uid()): mantém OID, assinatura/default, ramo ONG e ACL existentes; passa a usar a mesma regra estrita do helper para voluntários.
- RPCs novas com SECURITY DEFINER, search_path vazio e campos explicitamente permitidos. EXECUTE apenas a authenticated, além do proprietário; revogados defaults de PUBLIC/anon/service_role. Helpers privados sem acesso cliente.

Não há backfill, nova tabela, coluna de endereço, policy, trigger ou alteração de constraint. INSERT/UPDATE/DELETE no arquivo existem apenas dentro dos corpos de salvamento; não executam durante a aplicação. DELETE limita-se a vínculos de habilidades que o próprio usuário retirou expressamente da seleção ao salvar.

## Contrato e preservação

Payload omitido preserva o valor existente; null ou string vazia remove campo opcional intencionalmente. Textos enviados são aparados. Nome enviado deve ter de 2 a 120 caracteres. Disponibilidade enviada deve ser array de pares dia/período válidos, sem extras ou duplicações. Dados cadastrais continuam sujeitos às constraints remotas.

Endereço pessoal usa cep, logradouro, numero, complemento, bairro, cidade, uf. Não há conversão de endereço livre nem atualização implícita da configuração institucional. Perfil parcial pode ser salvo; o retorno false indica salvamento com elegibilidade incompleta.

Habilidades: array obrigatório, IDs válidos, deduplicação; [] limpa explicitamente a seleção, null é recusado. Mantém vínculos já selecionados. Ausência do complemento VOLUNTARIO gera erro, preservando o fluxo de provisionamento existente.

Gestão: criação de ongs ocorre somente ao salvar uma conta já ONG, não na implantação. PK garante uma linha por usuário. Erro em qualquer parte reverte tudo, inclusive criação do complemento e timestamps disparados pelos triggers.

PIX e beneficiário omitidos permanecem intactos. Campos explicitamente enviados conservam o contrato legado, sem nova funcionalidade financeira. Não há operação sobre metas/contribuições, trigger financeiro ou configuração institucional.

## Mudança de elegibilidade

Voluntário precisa de CPF, nascimento válido anterior à data atual, profissão não vazia, disponibilidade válida/não vazia, habilidade selecionada e logradouro/número/cidade não vazios.

Perfis antes aceitos podem passar a retornar false. Seus dados não são corrigidos, completados ou excluídos automaticamente. Essa mudança também afeta a autorização das policies antigas que chamam perfil_completo(); seus textos não são alterados.

## Compatibilidade e limites de segurança

As assinaturas das RPCs correspondem às usadas pelo app, mas **o payload e a leitura de endereço do app ainda precisam ser adaptados**. TelaPerfilVoluntario.tsx ainda seleciona usuarios.endereco; ambas as telas de perfil enviam endereco. O novo contrato rejeita essa chave com erro controlado, inclusive quando null. database.types.ts e os formulários devem ser ajustados em etapa própria. Nenhuma tela foi alterada.

As policies/grants antigos continuam permitindo caminhos diretos; esta migration garante atomicidade/autorização das novas RPCs, não exclusividade do caminho. Leitura ampla de usuarios/ongs e a assinatura antiga que aceita UUID arbitrário em perfil_completo permanecem para o lote de segurança. Não liberar homologação integrada como se esses riscos estivessem resolvidos.

Locks serializam chamadas de salvamento pelo mesmo usuário. Não implementam controle otimista de versão de formulário. Concorrência real entre conexões independentes ainda precisa de ensaio.

## Testes e arquivos auxiliares

- tests/fixtures/reconciliacao-perfis-remoto.sql: recorte do catálogo consultado, sem dados pessoais.
- tests/reconciliacao-perfis.test.cjs: aplica o SQL integral em PGlite e exercita RPCs, constraints, grants, atomicidade, preservação de dados e falhas de preflight.
- Ajustados somente os filtros de carregamento de SQL em cinco testes antigos (materiais, Diário, oficinas, certificados e coerência): continuam aplicando as dez migrations históricas com timestamp. A reconciliação é aplicada explicitamente apenas sobre seu fixture dedicado.

Comandos executados:

~~~text
node --test tests/reconciliacao-perfis.test.cjs
node --test tests/*.test.cjs
git diff --check
~~~

Teste dedicado: 13 testes aprovados. Suíte completa: 78 testes aprovados, zero falhas. A execução integral do SQL e das RPCs em PostgreSQL/PGlite valida sintaxe e comportamento local; não equivale a validação do Supabase remoto. Os dez arquivos históricos foram conferidos por SHA-256.

## Ensaio e retorno

Pronta para iniciar ensaio controlado em cópia integral do remoto, **não para aplicação direta em homologação**.

1. Restaurar cópia isolada sem expor dados pessoais; guardar definições/ACL e backup restaurável.
2. Conferir catálogo/ledger e executar somente este lote na cópia. Guard divergente deve parar o ensaio para análise.
3. Comparar dados, constraints, triggers, policies e configuração/legado antes/depois; nenhuma linha deve mudar pela implantação.
4. Testar com JWT reais fictícios de dois voluntários e gestão: acesso, mudança de elegibilidade, endereço omitido/parcial, erros e rollback.
5. Testar duas conexões concorrentes salvando gestão sem complemento: uma única linha, nenhuma mistura parcial. Repetir perfil/habilidades e falhas de constraints.
6. Testar consumidores antigos de perfil_completo e cadastro Auth. Validar salvamento quando existem constraints/triggers adicionais no ambiente completo.
7. Planejar separadamente atualização do app, lote de segurança, sequência/ledger e autorização de implantação.

Falha antes do COMMIT reverte o lote. Após aplicação sem uso, retorno exige restaurar a definição e ACL antigas de perfil_completo a partir da captura aprovada e suspender as RPCs novas, sem remover tabelas/dados. Após uso, não restaurar cadastros antigos automaticamente: escritas legítimas exigem análise e preferencialmente correção progressiva. Nenhum rollback, backup ou restauração remota foi executado.
