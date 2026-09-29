# Segurança da base original: limites de comprovação

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

- [ ] Obter DDL real das três tabelas, enums, constraints, índices e triggers.
- [ ] Inventariar pg_policies, grants de tabelas/colunas/sequências e funções.
- [ ] Conferir owners, search_path, SECURITY DEFINER, FORCE RLS e schema exposto.
- [ ] Inspecionar trigger auth.users e criação de usuarios/voluntarios/ongs.
- [ ] Criar conta pública com metadados tipo_perfil=ONG: não pode criar gestão.
- [ ] Tentar INSERT/UPSERT direto em usuarios com papel ONG: deve ser recusado.
- [ ] Tentar UPDATE de tipo_perfil/id: confirmar a proteção existente.
- [ ] Com dois voluntários, tentar ler/editar dados pessoais um do outro.
- [ ] Conferir todas as permissões de atividades, inclusive status/tipo/autor.
- [ ] Inventariar RPCs antigas capazes de escrever inscrições/perfis/atividades.
- [ ] Confirmar que nenhuma RPC antiga contorna os novos triggers ou autorizações.
- [ ] Confirmar EXECUTE das RPCs antigas do Diário revogado dos papéis do app.
- [ ] Confirmar assinatura e funcionamento das RPCs de revisão e perfil gestão.
- [ ] Testar primeiro cadastro, confirmação de e-mail, JWT expirado e logout.
- [ ] Testar duas conexões: primeira candidatura versus edição de atividade;
  ocultação versus edição; duas alterações de perfil; emissão repetida.
- [ ] Inventariar divergências históricas existentes sem corrigir automaticamente.
- [ ] Confirmar finalidade e valor do nome oficial da configuração institucional.

Executar com JWTs reais de anon, dois voluntários e gestão. Testes com postgres
ou service role não comprovam isolamento dos usuários finais. Corrigir achados
remotos somente após conhecer o contrato real, por migrations incrementais.
