# Compatibilidade do aplicativo com o Supabase

Data: 30/09/2026. Projeto remoto: HortaConecta (`hnawclapixopwjyrpxpq`).

> **Situação em 05/10/2026.** Este continua sendo o retrato do que foi aplicado no remoto.
> Mudanças decididas depois:
> - **Reconciliação pendente** `supabase/reconciliacao/20261005150000_contribuicoes_metas_pix.sql`:
>   move o PIX para `configuracao_instituicao`, exige meta ABERTA para a contribuição do
>   voluntário e **exclui** `solicitacoes_materiais`, `contribuicoes_materiais` e as funções
>   `materiais_*` instaladas pela reconciliação 02. Ver [CONTRIBUICOES.md](../mvp/CONTRIBUICOES.md).
> - **Fluxos do MVP:** voluntariado, contribuições por metas (dinheiro e materiais) e Diário.
>   Oficinas e certificados continuam no banco, mas ocultos no app ([ESCOPO_MVP.md](../mvp/ESCOPO_MVP.md)).
>   O "PIX legado" citado abaixo voltou a ser usado.
> - **Tipos:** até a reconciliação pendente ser aplicada, `DatabaseAplicativo` tem de novo uma
>   extensão provisória (`ColunasPix`) para as colunas de PIX. Remover ao regenerar `database.types.ts`.
> - **Testes locais:** 117 aprovados em 05/10 (eram 91 nesta data).
> - O projeto ficou fora do ar em 05/10 (DNS inexistente, provável pausa) e foi restaurado no mesmo dia.

## Resultado

O aplicativo e o banco remoto agora compartilham o contrato de endereço estruturado e as funções dos cinco fluxos do MVP. As duas reconciliações foram aplicadas ao projeto remoto nesta tarefa, após ensaio local sobre o catálogo PUBLIC capturado por consultas de leitura. As migrations históricas não foram reaplicadas nem editadas.

| Histórico remoto | Fonte local aplicada |
| --- | --- |
| `20260930142505_reconciliacao_01_base_perfis_endereco` | `supabase/migrations/reconciliacao_01_base_perfis_endereco.sql` |
| `20260930142520_reconciliacao_02_fluxos_mvp` | `supabase/reconciliacao/20260930141047_reconciliacao_02_fluxos_mvp.sql` |

O segundo nome local foi criado pelo CLI antes da aplicação; o MCP registrou outra versão no ledger. O primeiro mantém o nome sem timestamp solicitado na etapa anterior. Estes arquivos não compõem um baseline completo para criar um banco vazio. Não usar `db push` sobre o conjunto histórico para reproduzir este ambiente.

## Aplicativo

- Perfil voluntário lê e salva CEP, logradouro, número, complemento, bairro, cidade e UF em `voluntarios`. CEP é normalizado para oito dígitos e UF para duas letras maiúsculas. Perfil parcial continua salvável; rua/número/cidade são exigidos para elegibilidade.
- Perfil da gestão deixa de ler/enviar o campo inexistente `usuarios.endereco`. Endereço institucional permanece em `configuracao_instituicao`, sem alteração implícita pelo perfil. Dados legais e PIX legado são preservados.
- `database.types.ts` foi regenerado do banco após a aplicação. O cliente usa `DatabaseAplicativo`, derivado desses tipos; a única adaptação é a nulabilidade dos parâmetros de RPC que aceitam `null`. As antigas extensões que simulavam funções ainda inexistentes foram removidas.
- O aviso de cadastro incompleto inclui o endereço mínimo. Salvamentos continuam atômicos, com bloqueio após falha de carregamento.

## Banco e regras

Reconciliação 01 instala as RPCs de perfil e a elegibilidade sobre o endereço remoto, preservando campos omitidos, constraints, cadastro Auth e registros existentes.

Reconciliação 02 instala candidaturas/triagem/check-in/histórico, materiais, Diário com revisão e Storage privado, propostas de oficinas e certificados. Preserva os complementos de perfil da primeira reconciliação.

Somente **APROVADA ocupa vaga**. PENDENTE permanece na fila de análise, que pode exceder a capacidade. A coluna `vagas_ocupadas` e seu trigger foram preservados; o contador passou a derivar das aprovações. No momento da aplicação os dois contadores existentes já eram zero e não houve alteração de seus valores.

Contas autenticadas consultam o próprio cadastro pessoal/legal; gestão mantém o acesso de administração da instituição. Foram retirados TRUNCATE, REFERENCES e TRIGGER dos papéis do app. Inscrições não aceitam escrita direta. Alterações diretas de status/contador de atividade e identidade de inscrição são bloqueadas; as operações autorizadas passam pelas funções apropriadas.

O bucket `diario-imagens` foi criado privado, com limite de 5 MiB e JPEG/PNG/WebP. Novas presenças usam check-in; presenças antigas não recebem datas/horas retroativas. Certificados preservam a carga prevista, sem medição de horas reais. Proposta de oficina aprovada continua independente de um evento.

## Verificação

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado |
| `npm test` | 91 testes/subtestes aprovados, zero falhas |
| Export Android, sem bytecode, dois workers | Aprovado, 1.274 módulos; `.expo/compatibilidade-supabase` |
| `git diff --check` | Aprovado |
| Ensaio SQL local sobre catálogo PUBLIC capturado | Cinco fluxos, grants/RLS, legado e formulários aprovados |
| Ensaio SQL no Supabase remoto | Perfis, privacidade, fila/capacidade, check-in, materiais, ocultação do Diário, oficinas e emissão idempotente de certificado aprovados |
| Data API com chave pública sem sessão | Seis RPCs de consulta reconhecidas e negadas com HTTP 401 / `42501` |
| Comparação antes/depois dos registros originais | Contagens e hashes agregados idênticos nas 12 tabelas originais, excluindo somente novas colunas na comparação de inscrições/Diário |
| Contas fictícias remanescentes | Zero; ensaio encerrado com ROLLBACK |

O roteiro executado está em [VALIDACAO_COMPATIBILIDADE_REMOTA.sql](VALIDACAO_COMPATIBILIDADE_REMOTA.sql). Os três usuários e os registros fictícios foram revertidos; sequências de identidade podem ter avançado normalmente durante o ensaio. Não houve persistência desses dados nem mensagens de e-mail.

Os testes locais de Auth/Storage usam simulações. No remoto, SET ROLE e claims de sessão exercitam as funções e RLS do PostgreSQL, mas não representam login com JWT real. A exportação gera um bundle JavaScript, sem APK ou teste em aparelho. Permanecem pendentes a homologação Android, login/refresh reais, upload/URLs assinadas pelo serviço Storage e concorrência entre conexões independentes.

## Advisors

Não foram retornados avisos de nível ERROR. O advisor informa RLS sem policies na tabela privada de tokens: seu acesso cliente está revogado e ela é usada somente por funções autorizadas ([referência](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).

Há 33 avisos de funções SECURITY DEFINER executáveis por autenticados. As novas RPCs expostas exigem esse acesso, verificam titularidade/gestão e têm grants explícitos; helpers privados e RPCs antigas do Diário permanecem fechados ([referência](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)). Isso não substitui uma auditoria de toda a plataforma.

O aviso preexistente de proteção contra senhas vazadas desativada permanece; a configuração de Auth não foi alterada ([referência](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

Documentação consultada: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [tipos Supabase](https://supabase.com/docs/reference/javascript/typescript-support) e changelog Supabase. Não houve alteração de dependências, commit, push ou publicação do aplicativo.
