# Segurança da base original: limites de comprovação

> **Situação em 05/10/2026.** O catálogo PUBLIC do remoto foi lido em 29/09 (consultas só de
> leitura, como `postgres`) e registrado em [1A](../reconciliacao/RECONCILIACAO_1A_ESTRUTURA.md) e
> [1B](../reconciliacao/RECONCILIACAO_1B_DIAGNOSTICO.md). Em 30/09 as reconciliações 01 e 02 fecharam
> grants administrativos, restringiram a leitura de `usuarios` e `ongs` e foram exercitadas no remoto
> com `SET ROLE` e claims de sessão ([compatibilidade](../reconciliacao/COMPATIBILIDADE_SUPABASE_20260930.md)).
> **Ainda não houve teste com JWT real de usuário final**, que é o que comprova isolamento.
> O checklist abaixo marca o estado de cada item; os que dependem de JWT continuam abertos.

## Evidências disponíveis

`database.types.ts` descreve colunas e funções do retrato anterior do banco.
Migrations conhecidas criam tabelas complementares e as proteções das cinco
prioridades. A primeira migration depende de usuarios, voluntarios, atividades,
enums e helpers anteriores. O app cadastra apenas nome em metadados e espera
que o trigger remoto crie usuário/voluntário. Cadastro ONG é administrativo.

O trigger `trg_voluntariado_identidade` impede alterar id/tipo_perfil por UPDATE
com sessão autenticada. As RPCs novas verificam perfil e identidade. Inscrições,
materiais, Diário, oficinas e certificados têm políticas/grants locais conhecidos.
Todas essas proteções foram preservadas.

## O que NÃO está integralmente disponível

- DDL inicial, grants e RLS de usuarios, voluntarios e atividades.
- Código/segurança do trigger de Auth `handle_new_user` e rotinas associadas.
- Garantia de que metadados não escolhem tipo_perfil ou atributos administrativos.
- Permissões de INSERT em usuarios e de provisionamento de ONG.
- Definições reais de e_ong, perfil_completo e solicitar_exclusao_conta.
- Catálogo completo de RPCs SECURITY DEFINER, owners, FORCE RLS e grants remotos.
- Políticas e triggers adicionais, buckets e dados legados existentes no servidor.

Tipos TypeScript não comprovam RLS. Os helpers/roles da fixture PGlite não são
uma reconstrução do Supabase. **A segurança da base original não está comprovada
nem foi declarada corrigida nesta etapa.** Não foi aplicada migration remota.

## Checklist obrigatório no Supabase de homologação

- [x] Obter DDL real das três tabelas, enums, constraints, índices e triggers. *(29/09, catálogo em 1A/1B)*
- [x] Inventariar pg_policies, grants de tabelas/colunas/sequências e funções. *(29/09; grants amplos fechados em 30/09)*
- [x] Conferir owners, search_path, SECURITY DEFINER, FORCE RLS e schema exposto. *(29/09; schemas expostos na Data API não comprovados)*
- [ ] Inspecionar trigger auth.users e criação de usuarios/voluntarios/ongs. *(Trigger existe; criação efetiva por ele não foi rastreada)*
- [ ] Criar conta pública com metadados tipo_perfil=ONG: não pode criar gestão.
- [ ] Tentar INSERT/UPSERT direto em usuarios com papel ONG: deve ser recusado.
- [ ] Tentar UPDATE de tipo_perfil/id: confirmar a proteção existente.
- [ ] Com dois voluntários, tentar ler/editar dados pessoais um do outro. *(Coberto por SET ROLE em 30/09; falta JWT real)*
- [ ] Conferir todas as permissões de atividades, inclusive status/tipo/autor.
- [ ] Inventariar RPCs antigas capazes de escrever inscrições/perfis/atividades.
- [ ] Confirmar que nenhuma RPC antiga contorna os novos triggers ou autorizações.
- [x] Confirmar EXECUTE das RPCs antigas do Diário revogado dos papéis do app. *(30/09)*
- [x] Confirmar assinatura e funcionamento das RPCs de revisão e perfil gestão. *(30/09, ensaio SQL remoto revertido)*
- [ ] Testar primeiro cadastro, confirmação de e-mail, JWT expirado e logout.
- [ ] Testar duas conexões: primeira candidatura versus edição de atividade;
  ocultação versus edição; duas alterações de perfil; emissão repetida.
- [ ] Inventariar divergências históricas existentes sem corrigir automaticamente.
- [ ] Confirmar finalidade e valor do nome oficial da configuração institucional.
- [ ] *(05/10)* Após aplicar `20261005150000`: confirmar que só a gestão altera `chave_pix`/`whatsapp` em
  `configuracao_instituicao` e que o voluntário não declara contribuição em meta encerrada.
- [ ] *(05/10)* Avaliar a policy de UPDATE de `contribuicoes`, que permite à gestão alterar a quantidade
  de uma contribuição já aprovada.

Executar com JWTs reais de anon, dois voluntários e gestão. Testes com postgres
ou service role não comprovam isolamento dos usuários finais. Corrigir achados
remotos somente após conhecer o contrato real, por migrations incrementais.
