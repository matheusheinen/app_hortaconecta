-- Ensaio funcional com dados fictícios, sem persistir contas ou registros.
-- Executar somente após a reconciliação completa. A sequência de IDs pode avançar.
-- SET ROLE + claims exercita funções e RLS reais, mas não substitui JWT/API/Android.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';

DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM auth.users WHERE id IN
 ('a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003'))
 THEN RAISE EXCEPTION 'IDs do ensaio já existem; não alterar contas existentes.'; END IF;
END $$;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('a0000000-0000-4000-8000-000000000001','compat-voluntario-a@example.invalid','{"nome":"Ensaio voluntário A","tipo_perfil":"ONG"}'),
 ('a0000000-0000-4000-8000-000000000002','compat-voluntario-b@example.invalid','{"nome":"Ensaio voluntário B"}'),
 ('a0000000-0000-4000-8000-000000000003','compat-gestao@example.invalid','{"nome":"Ensaio gestão"}');
DO $$ BEGIN
 IF (SELECT tipo_perfil FROM public.usuarios WHERE id='a0000000-0000-4000-8000-000000000001') <> 'VOLUNTARIO'
 THEN RAISE EXCEPTION 'Metadados do cadastro promoveram conta indevidamente.'; END IF;
END $$;
UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id='a0000000-0000-4000-8000-000000000003';
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.gestao_salvar_perfil('{"nome":"Ensaio gestão","razao_social":"Instituição fictícia"}') IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Perfil gestão não confirmado.'; END IF;
END $$;
RESET ROLE;
-- Catálogo existente, sem modificar habilidades reais.
SELECT set_config('horta.ensaio.habilidade',(SELECT min(id)::text FROM public.habilidades),true);
DO $$ BEGIN
 IF nullif(current_setting('horta.ensaio.habilidade',true),'') IS NULL THEN RAISE EXCEPTION 'Catálogo de habilidades vazio.'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.voluntariado_salvar_perfil('{"cpf":"99999999001","data_nascimento":"1990-01-02","profissao":"Educador","logradouro":"Rua fictícia","numero":"1","cidade":"Cidade fictícia","disponibilidade_horarios":[{"dia":"seg","periodo":"manha"}]}',ARRAY[current_setting('horta.ensaio.habilidade')::bigint]) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Voluntário A não elegível após perfil completo.'; END IF;
 IF EXISTS(SELECT 1 FROM public.usuarios WHERE id='a0000000-0000-4000-8000-000000000002')
 THEN RAISE EXCEPTION 'Perfil alheio exposto.'; END IF;
 IF EXISTS(SELECT 1 FROM public.ongs WHERE usuario_id='a0000000-0000-4000-8000-000000000003')
 THEN RAISE EXCEPTION 'Cadastro legal da gestão exposto ao voluntário.'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.voluntariado_salvar_perfil('{"cpf":"99999999002","data_nascimento":"1990-01-02","profissao":"Educador","logradouro":"Rua fictícia","numero":"2","cidade":"Cidade fictícia","disponibilidade_horarios":[{"dia":"ter","periodo":"tarde"}]}',ARRAY[current_setting('horta.ensaio.habilidade')::bigint]) IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Voluntário B não elegível.'; END IF;
END $$;
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
WITH nova AS (
 INSERT INTO public.atividades(titulo,descricao,tipo,autor_id,data_hora_prevista,vagas_totais,carga_horaria,status)
 VALUES('Ensaio compatibilidade','Atividade fictícia','TAREFA_ONG',auth.uid(),clock_timestamp()+interval '5 seconds',1,1,'ABERTA') RETURNING id
) SELECT set_config('horta.ensaio.atividade',id::text,true) FROM nova;
SELECT set_config('horta.ensaio.material',public.materiais_salvar(NULL,'Ensaio material','Item fictício',2)::text,true);
SELECT set_config('horta.ensaio.diario',public.diario_salvar_revisao(NULL,'Ensaio Diário','Relato fictício','PUBLICADA',NULL,NULL)::text,true);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT set_config('horta.ensaio.inscricao_a',public.voluntariado_candidatar(current_setting('horta.ensaio.atividade')::bigint)::text,true);
SELECT set_config('horta.ensaio.contribuicao',public.materiais_contribuir(current_setting('horta.ensaio.material')::bigint,2)::text,true);
SELECT set_config('horta.ensaio.oficina',public.oficinas_salvar(NULL,NULL,'Ensaio oficina','Descrição fictícia','Cultivo','Aprender',60,NULL,NULL)::text,true);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT set_config('horta.ensaio.inscricao_b',public.voluntariado_candidatar(current_setting('horta.ensaio.atividade')::bigint)::text,true);
DO $$ BEGIN
 IF (SELECT vagas_ocupadas FROM public.atividades WHERE id=current_setting('horta.ensaio.atividade')::bigint) <> 0
 THEN RAISE EXCEPTION 'Candidatura pendente ocupou vaga.'; END IF;
 IF EXISTS(SELECT 1 FROM public.propostas_oficinas WHERE id=current_setting('horta.ensaio.oficina')::bigint)
 THEN RAISE EXCEPTION 'Proposta privada exposta a outro autor.'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT public.voluntariado_decidir(current_setting('horta.ensaio.inscricao_a')::bigint,'APROVADA',NULL);
DO $$ DECLARE negada boolean:=false; BEGIN
 BEGIN PERFORM public.voluntariado_decidir(current_setting('horta.ensaio.inscricao_b')::bigint,'APROVADA',NULL);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%vagas%' THEN RAISE; END IF; negada:=true;
 END;
 IF NOT negada THEN RAISE EXCEPTION 'Capacidade foi excedida.'; END IF;
 IF (SELECT vagas_ocupadas FROM public.atividades WHERE id=current_setting('horta.ensaio.atividade')::bigint) <> 1
 THEN RAISE EXCEPTION 'Contador não reflete aprovação.'; END IF;
END $$;
SELECT set_config('horta.ensaio.token',public.voluntariado_gerar_checkin(current_setting('horta.ensaio.atividade')::bigint)->>'token',true);
SELECT public.materiais_decidir(current_setting('horta.ensaio.contribuicao')::bigint,'CONFIRMADA');
SELECT public.oficinas_decidir(current_setting('horta.ensaio.oficina')::bigint,1,'APROVADA',NULL);
SELECT public.diario_status_revisao(current_setting('horta.ensaio.diario')::bigint,'OCULTA',1);
RESET ROLE;
SELECT pg_sleep(5.1);
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT public.voluntariado_checkin(current_setting('horta.ensaio.atividade')::bigint,current_setting('horta.ensaio.token'));
SELECT set_config('horta.ensaio.certificado',public.certificados_emitir(current_setting('horta.ensaio.inscricao_a')::bigint)::text,true);
DO $$ BEGIN
 IF public.certificados_emitir(current_setting('horta.ensaio.inscricao_a')::bigint)::text <> current_setting('horta.ensaio.certificado')
 THEN RAISE EXCEPTION 'Certificado duplicado.'; END IF;
 IF EXISTS(SELECT 1 FROM public.diario_transparencia WHERE id=current_setting('horta.ensaio.diario')::bigint)
 THEN RAISE EXCEPTION 'Diário oculto exposto.'; END IF;
 IF (SELECT quantidade_recebida FROM public.solicitacoes_materiais WHERE id=current_setting('horta.ensaio.material')::bigint) <> 2
 THEN RAISE EXCEPTION 'Recebimento não confirmado.'; END IF;
 IF has_table_privilege('authenticated','public.usuarios','TRUNCATE') OR has_table_privilege('anon','public.usuarios','TRUNCATE')
 THEN RAISE EXCEPTION 'Permissão de truncar tabelas permaneceu.'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Perfis, privacidade, candidatura, vagas, check-in, materiais, Diário, oficinas e certificados verificados; dados de ensaio revertidos.' AS resultado;
