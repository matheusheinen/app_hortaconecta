-- Auditoria manual, somente leitura. NÃO é migration. Não executada no remoto.
-- Execute cada bloco separadamente no SQL Editor administrativo de homologação.
-- Resultados de catálogo não substituem testes HTTP com JWT de usuários reais.
-- Guarde os resultados em ambiente restrito; definições podem conter informação interna.

-- 1. Ambiente e disponibilidade das estruturas antes de executar os demais blocos.
SELECT current_database(), current_user, version(),
       current_setting('transaction_isolation') AS isolamento;
SELECT nome, to_regclass(nome) AS objeto
FROM unnest(ARRAY['supabase_migrations.schema_migrations','auth.users',
 'public.usuarios','public.voluntarios','public.ongs','public.atividades',
 'public.inscricoes_atividades','public.solicitacoes_materiais',
 'public.contribuicoes_materiais','public.diario_transparencia',
 'public.propostas_oficinas','public.certificados','storage.buckets','storage.objects']) AS t(nome);

-- 2. Execute somente se schema_migrations existir. Compare as dez versões com o relatório.
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
-- A presença da versão não comprova igualdade do SQL: compare também o catálogo abaixo.

-- 3. Schema real: colunas, defaults, nulabilidade, constraints e índices.
SELECT table_schema,table_name,column_name,data_type,udt_name,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema IN ('public','voluntariado_privado')
ORDER BY table_schema,table_name,ordinal_position;
SELECT n.nspname,c.relname,k.conname,k.convalidated,pg_get_constraintdef(k.oid) AS definicao
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','voluntariado_privado') ORDER BY 1,2,3;
SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes
WHERE schemaname IN ('public','voluntariado_privado') ORDER BY 1,2,3;

-- 4. Ownership, RLS/FORCE RLS, ACL e privilégios efetivos, inclusive herdados.
SELECT n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner,
 c.relrowsecurity,c.relforcerowsecurity,c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','voluntariado_privado','storage') AND c.relkind IN ('r','p','v','m','S') ORDER BY 1,2;
SELECT r.rolname,r.rolsuper,r.rolinherit,r.rolbypassrls FROM pg_roles r ORDER BY r.rolname;
SELECT pg_get_userbyid(roleid) AS papel,pg_get_userbyid(member) AS membro,admin_option FROM pg_auth_members;
SELECT n.nspname,c.relname,r.rolname,
 has_table_privilege(r.oid,c.oid,'SELECT') AS ler,
 has_table_privilege(r.oid,c.oid,'INSERT') AS inserir,
 has_table_privilege(r.oid,c.oid,'UPDATE') AS atualizar,
 has_table_privilege(r.oid,c.oid,'DELETE') AS excluir,
 has_table_privilege(r.oid,c.oid,'TRUNCATE') AS truncar,
 has_table_privilege(r.oid,c.oid,'TRIGGER') AS criar_trigger
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname IN ('public','voluntariado_privado','storage') AND c.relkind IN ('r','p','v')
AND r.rolname IN ('anon','authenticated','service_role') ORDER BY 1,2,3;
SELECT table_schema,table_name,column_name,grantee,privilege_type
FROM information_schema.column_privileges WHERE table_schema IN ('public','storage') ORDER BY 1,2,3,4;
SELECT n.nspname,c.relname,r.rolname,
 has_sequence_privilege(r.oid,c.oid,'USAGE') AS uso,
 has_sequence_privilege(r.oid,c.oid,'SELECT') AS ler,
 has_sequence_privilege(r.oid,c.oid,'UPDATE') AS atualizar
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
WHERE c.relkind='S' AND n.nspname IN ('public','voluntariado_privado')
AND r.rolname IN ('anon','authenticated') ORDER BY 1,2,3;
SELECT n.nspname,pg_get_userbyid(n.nspowner) AS owner,n.nspacl,r.rolname,
 has_schema_privilege(r.oid,n.oid,'USAGE') AS uso,has_schema_privilege(r.oid,n.oid,'CREATE') AS criar
FROM pg_namespace n CROSS JOIN pg_roles r
WHERE n.nspname IN ('public','voluntariado_privado','storage') AND r.rolname IN ('anon','authenticated');
SELECT pg_get_userbyid(d.defaclrole) AS owner,n.nspname,d.defaclobjtype,d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace;

-- 5. Todas as policies, não apenas as criadas pelo MVP. Permissivas combinam por OR.
SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname IN ('public','voluntariado_privado','storage','auth') ORDER BY 1,2,3;

-- 6. Triggers reais e estado habilitado, incluindo cadastro em auth.users.
SELECT n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definicao,
 t.tgfoid::regprocedure AS funcao
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE NOT t.tgisinternal AND n.nspname IN ('public','voluntariado_privado','auth','storage') ORDER BY 1,2,3;

-- 7. Funções e TODAS as sobrecargas. Inclui funções fora de public chamadas pelos triggers de Auth.
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS argumentos,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS security_definer,p.proconfig,p.proacl,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_executa,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS autenticado_executa
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prokind='f' AND (n.nspname IN ('public','voluntariado_privado') OR
 p.oid IN (SELECT tgfoid FROM pg_trigger WHERE tgrelid=to_regclass('auth.users')))
ORDER BY 1,2,3;
SELECT p.oid::regprocedure AS assinatura,pg_get_functiondef(p.oid) AS definicao
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.prokind='f' AND (n.nspname IN ('public','voluntariado_privado') OR
 p.oid IN (SELECT tgfoid FROM pg_trigger WHERE tgrelid=to_regclass('auth.users')))
ORDER BY 1;
-- Inspecionar e_ong, perfil_completo, solicitar_exclusao_conta, cadastro e quaisquer
-- RPCs legadas de escrita. diario_salvar/diario_status antigos: EXECUTE false para ambos os papéis.
-- Conferir também schemas expostos e configurações JWT/API no Dashboard (fora deste SQL).

-- 8. Storage: privado, 5242880 bytes, image/jpeg + image/png + image/webp.
SELECT id,name,public,file_size_limit,allowed_mime_types FROM storage.buckets ORDER BY id;

-- 9. Executar abaixo somente depois de confirmar schema/colunas e migrations.
-- Contagens sem nomes, e-mails ou documentos pessoais. Não altera dados históricos.
SELECT tipo_perfil,count(*) FROM public.usuarios GROUP BY tipo_perfil;
SELECT count(*) AS usuarios_sem_auth FROM public.usuarios u LEFT JOIN auth.users a ON a.id=u.id WHERE a.id IS NULL;
SELECT count(*) AS voluntarios_sem_usuario FROM public.voluntarios v LEFT JOIN public.usuarios u ON u.id=v.usuario_id WHERE u.id IS NULL;
SELECT count(*) AS ongs_com_perfil_incompativel FROM public.ongs o JOIN public.usuarios u ON u.id=o.usuario_id WHERE u.tipo_perfil::text<>'ONG';
SELECT count(*) AS gestoes_sem_complemento FROM public.usuarios u LEFT JOIN public.ongs o ON o.usuario_id=u.id WHERE u.tipo_perfil::text='ONG' AND o.usuario_id IS NULL;
SELECT count(*) AS presencas_inconsistentes FROM public.inscricoes_atividades
WHERE presenca_confirmada AND (status_inscricao::text<>'APROVADA' OR checkin_em IS NULL
 OR checkin_em>now() OR carga_horaria_registrada IS NULL OR carga_horaria_registrada<=0 OR carga_horaria_registrada>='Infinity'::numeric);
SELECT count(*) AS atividades_acima_da_capacidade FROM public.atividades a
WHERE (SELECT count(*) FROM public.inscricoes_atividades i WHERE i.atividade_id=a.id AND i.status_inscricao::text='APROVADA')>a.vagas_totais;
SELECT count(*) AS certificados_divergentes FROM public.certificados c
JOIN public.inscricoes_atividades i ON i.id=c.participacao_id JOIN public.atividades a ON a.id=i.atividade_id
WHERE c.usuario_id IS DISTINCT FROM i.usuario_id OR c.atividade IS DISTINCT FROM a.titulo
 OR c.data_atividade IS DISTINCT FROM a.data_hora_prevista OR c.carga_horaria_prevista IS DISTINCT FROM i.carga_horaria_registrada;
-- Divergências são sinais para análise administrativa, nunca autorização de reemissão/correção automática.
SELECT count(*) AS referencias_imagem_ausentes FROM public.diario_transparencia d
LEFT JOIN storage.objects o ON o.bucket_id='diario-imagens' AND o.name=d.imagem_caminho
WHERE d.imagem_caminho IS NOT NULL AND o.id IS NULL;
SELECT count(*) AS imagens_sem_vinculo FROM storage.objects o
WHERE o.bucket_id='diario-imagens' AND NOT EXISTS(SELECT 1 FROM public.diario_transparencia d WHERE d.imagem_caminho=o.name);
-- Arquivos sem vínculo podem resultar de operações interrompidas: inventariar, não excluir.
