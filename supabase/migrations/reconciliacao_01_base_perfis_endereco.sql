-- Reconciliação 01: aplicar SOMENTE em cópia do remoto auditado, após revisão.
-- Nome sem timestamp solicitado explicitamente: não integra o runner padrão do CLI.
-- Não executar as sete migrations históricas pendentes antes/depois deste arquivo.
-- Zero backfill: o DML abaixo só é executado quando uma RPC autorizada é chamada.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
DECLARE r record;
BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Pré-condição: executar como postgres, proprietário auditado.'; END IF;
 IF to_regnamespace('voluntariado_privado') IS NOT NULL OR EXISTS (
 SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('voluntariado_salvar_perfil','voluntariado_elegibilidade','gestao_salvar_perfil'))
 THEN RAISE EXCEPTION 'Pré-condição: objetos de perfil já existem; revisar histórico, não reaplicar.'; END IF;
 IF to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('public.perfil_completo(uuid)') IS NULL THEN
 RAISE EXCEPTION 'Pré-condição: funções originais ausentes.'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.perfil_completo(uuid)'::regprocedure) <> 'fee0e0fcef0a5ad6f397e9849f06e705'
 OR (SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname='perfil_completo') <> 1
 OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.perfil_completo(uuid)'::regprocedure) <> 'postgres'
 THEN RAISE EXCEPTION 'Pré-condição: perfil_completo diverge do catálogo auditado; revisar antes de substituir.'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='endereco') THEN
 RAISE EXCEPTION 'Pré-condição: esta migration exige o modelo remoto de endereço estruturado.'; END IF;
 FOR r IN SELECT * FROM (VALUES
 ('habilidades','id','int8'),
 ('habilidades','nome_habilidade','text'),
 ('habilidades','categoria','text'),
 ('ongs','usuario_id','uuid'),
 ('ongs','cnpj','text'),
 ('ongs','razao_social','text'),
 ('ongs','data_criacao','date'),
 ('ongs','responsavel_legal','text'),
 ('ongs','chave_pix','text'),
 ('ongs','nome_beneficiario_pix','text'),
 ('ongs','whatsapp','text'),
 ('ongs','atualizado_em','timestamptz'),
 ('usuario_habilidades','usuario_id','uuid'),
 ('usuario_habilidades','habilidade_id','int8'),
 ('usuarios','id','uuid'),
 ('usuarios','nome','text'),
 ('usuarios','telefone','text'),
 ('usuarios','descricao','text'),
 ('usuarios','perfil_instagram','text'),
 ('usuarios','tipo_perfil','tipo_perfil'),
 ('usuarios','foto_perfil','text'),
 ('usuarios','exclusao_solicitada_em','timestamptz'),
 ('usuarios','criado_em','timestamptz'),
 ('usuarios','atualizado_em','timestamptz'),
 ('voluntarios','usuario_id','uuid'),
 ('voluntarios','cpf','text'),
 ('voluntarios','data_nascimento','date'),
 ('voluntarios','profissao','text'),
 ('voluntarios','disponibilidade_horarios','jsonb'),
 ('voluntarios','atualizado_em','timestamptz'),
 ('voluntarios','cep','text'),
 ('voluntarios','logradouro','text'),
 ('voluntarios','numero','text'),
 ('voluntarios','complemento','text'),
 ('voluntarios','bairro','text'),
 ('voluntarios','cidade','text'),
 ('voluntarios','uf','text')) AS expected(t,c,typ) LOOP
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=r.t AND column_name=r.c AND udt_name=r.typ) THEN
 RAISE EXCEPTION 'Pré-condição: coluna incompatível %.%',r.t,r.c; END IF;
 END LOOP;
 FOR r IN SELECT unnest(ARRAY['usuarios','voluntarios','ongs','habilidades','usuario_habilidades']) AS t LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||r.t) AND relkind='r' AND pg_get_userbyid(relowner)='postgres' AND relrowsecurity) THEN
 RAISE EXCEPTION 'Pré-condição: tabela, owner ou RLS incompatível: %',r.t; END IF;
 END LOOP;
 FOR r IN SELECT * FROM (VALUES
 ('usuarios','usuarios_descricao_check','CHECK ((length(descricao) <= 500))'),
 ('usuarios','usuarios_id_fkey','FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE'),
 ('usuarios','usuarios_nome_check','CHECK (((length(TRIM(BOTH FROM nome)) >= 2) AND (length(TRIM(BOTH FROM nome)) <= 120)))'),
 ('usuarios','usuarios_perfil_instagram_check','CHECK ((perfil_instagram ~ ''^[A-Za-z0-9._]{1,30}$''::text))'),
 ('usuarios','usuarios_pkey','PRIMARY KEY (id)'),
 ('usuarios','usuarios_telefone_check','CHECK ((telefone ~ ''^[0-9]{10,11}$''::text))'),
 ('voluntarios','voluntarios_cep_check','CHECK (((cep IS NULL) OR (cep ~ ''^[0-9]{8}$''::text)))'),
 ('voluntarios','voluntarios_cpf_check','CHECK ((cpf ~ ''^[0-9]{11}$''::text))'),
 ('voluntarios','voluntarios_cpf_key','UNIQUE (cpf)'),
 ('voluntarios','voluntarios_data_nascimento_check','CHECK (((data_nascimento > ''1900-01-01''::date) AND (data_nascimento < CURRENT_DATE)))'),
 ('voluntarios','voluntarios_pkey','PRIMARY KEY (usuario_id)'),
 ('voluntarios','voluntarios_uf_check','CHECK (((uf IS NULL) OR (uf ~ ''^[A-Z]{2}$''::text)))'),
 ('voluntarios','voluntarios_usuario_id_fkey','FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE'),
 ('habilidades','habilidades_nome_habilidade_check','CHECK (((length(TRIM(BOTH FROM nome_habilidade)) >= 2) AND (length(TRIM(BOTH FROM nome_habilidade)) <= 80)))'),
 ('habilidades','habilidades_nome_habilidade_key','UNIQUE (nome_habilidade)'),
 ('habilidades','habilidades_pkey','PRIMARY KEY (id)'),
 ('ongs','ongs_cnpj_check','CHECK ((cnpj ~ ''^[0-9]{14}$''::text))'),
 ('ongs','ongs_cnpj_key','UNIQUE (cnpj)'),
 ('ongs','ongs_pkey','PRIMARY KEY (usuario_id)'),
 ('ongs','ongs_usuario_id_fkey','FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE'),
 ('ongs','ongs_whatsapp_check','CHECK ((whatsapp ~ ''^[0-9]{10,11}$''::text))'),
 ('usuario_habilidades','usuario_habilidades_habilidade_id_fkey','FOREIGN KEY (habilidade_id) REFERENCES habilidades(id) ON DELETE CASCADE'),
 ('usuario_habilidades','usuario_habilidades_pkey','PRIMARY KEY (usuario_id, habilidade_id)'),
 ('usuario_habilidades','usuario_habilidades_usuario_id_fkey','FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE')) AS expected(t,n,d) LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('public.'||r.t) AND conname=r.n AND convalidated AND pg_get_constraintdef(oid)=r.d) THEN
 RAISE EXCEPTION 'Pré-condição: constraint incompatível %.%',r.t,r.n; END IF;
 END LOOP;
 FOR r IN SELECT d FROM (VALUES
 ('CREATE TRIGGER trg_proteger_campos_perfil BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION proteger_campos_perfil()'),
 ('CREATE TRIGGER trg_usuarios_atualizado BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION set_atualizado_em()'),
 ('CREATE TRIGGER trg_voluntarios_atualizado BEFORE UPDATE ON public.voluntarios FOR EACH ROW EXECUTE FUNCTION set_atualizado_em()'),
 ('CREATE TRIGGER trg_ongs_atualizado BEFORE UPDATE ON public.ongs FOR EACH ROW EXECUTE FUNCTION set_atualizado_em()')) AS expected(d) LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O' AND pg_get_triggerdef(oid)=r.d) THEN
 RAISE EXCEPTION 'Pré-condição: trigger de perfil ausente, desabilitado ou divergente.'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('public.usuarios'::regclass,'public.voluntarios'::regclass,'public.ongs'::regclass))<>4 THEN
 RAISE EXCEPTION 'Pré-condição: triggers adicionais de perfil exigem revisão.'; END IF;
END $preflight$;

CREATE SCHEMA voluntariado_privado AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA voluntariado_privado FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION voluntariado_privado.gestao() RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND tipo_perfil='ONG');
$$;

CREATE FUNCTION voluntariado_privado.disponibilidade_valida(p_valor jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
BEGIN
 IF p_valor IS NULL OR jsonb_typeof(p_valor)<>'array' THEN RETURN false; END IF;
 RETURN NOT EXISTS (
 SELECT 1 FROM jsonb_array_elements(p_valor) s
 WHERE jsonb_typeof(s)<>'object'
 OR coalesce(s->>'dia','') NOT IN ('dom','seg','ter','qua','qui','sex','sab')
 OR coalesce(s->>'periodo','') NOT IN ('manha','tarde','noite')
 OR (s-'dia'-'periodo')<>'{}'::jsonb
 ) AND (SELECT count(*)=count(DISTINCT(s->>'dia',s->>'periodo')) FROM jsonb_array_elements(p_valor) s);
END $$;

CREATE FUNCTION voluntariado_privado.elegivel(p_usuario uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(
 SELECT 1 FROM public.usuarios u JOIN public.voluntarios v ON v.usuario_id=u.id
 WHERE u.id=p_usuario AND u.tipo_perfil='VOLUNTARIO'
 AND nullif(btrim(v.cpf),'') IS NOT NULL
 AND v.data_nascimento > DATE '1900-01-01' AND v.data_nascimento < current_date
 AND nullif(btrim(v.profissao),'') IS NOT NULL
 AND nullif(btrim(v.logradouro),'') IS NOT NULL
 AND nullif(btrim(v.numero),'') IS NOT NULL
 AND nullif(btrim(v.cidade),'') IS NOT NULL
 AND voluntariado_privado.disponibilidade_valida(v.disponibilidade_horarios)
 AND v.disponibilidade_horarios<>'[]'::jsonb
 AND EXISTS(SELECT 1 FROM public.usuario_habilidades h WHERE h.usuario_id=u.id));
$$;

-- CREATE OR REPLACE preserva OID, dependências de policies, owner e ACL existentes.
-- Nenhuma linha é alterada; perfis incompletos precisam completar o cadastro.
CREATE OR REPLACE FUNCTION public.perfil_completo(uid uuid DEFAULT auth.uid()) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.usuarios WHERE id=uid AND tipo_perfil='ONG')
 OR voluntariado_privado.elegivel(uid);
$$;

-- Normaliza somente chaves enviadas. Omissão preserva; null/vazio limpa opcionais.
-- Não há SQL dinâmico. Campos de identidade e payload legado são rejeitados.
CREATE FUNCTION voluntariado_privado.perfil_payload(p_dados jsonb,p_campos text[]) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE item record; resultado jsonb:='{}';
BEGIN
 IF p_dados IS NULL OR jsonb_typeof(p_dados)<>'object' THEN
 RAISE EXCEPTION 'Dados do perfil devem ser um objeto.' USING ERRCODE='22023'; END IF;
 IF p_dados ? 'endereco' THEN
 RAISE EXCEPTION 'Contrato de endereço desatualizado. Atualize o aplicativo para usar endereço estruturado.' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT key,value FROM jsonb_each(p_dados) LOOP
 IF NOT (item.key=ANY(p_campos)) THEN
 RAISE EXCEPTION 'Campo não permitido no perfil: %',item.key USING ERRCODE='22023'; END IF;
 IF item.key='disponibilidade_horarios' THEN
 IF NOT voluntariado_privado.disponibilidade_valida(item.value) THEN
 RAISE EXCEPTION 'Disponibilidade inválida. Selecione dias e períodos válidos, sem repetição.' USING ERRCODE='22023'; END IF;
 resultado:=resultado||jsonb_build_object(item.key,item.value);
 ELSE
 IF jsonb_typeof(item.value) NOT IN ('string','null') THEN
 RAISE EXCEPTION 'Formato inválido para o campo %.',item.key USING ERRCODE='22023'; END IF;
 resultado:=resultado||jsonb_build_object(item.key,nullif(btrim(item.value #>> '{}'),''));
 END IF;
 END LOOP;
 IF resultado ? 'nome' AND coalesce(length(resultado->>'nome'),0) NOT BETWEEN 2 AND 120 THEN
 RAISE EXCEPTION 'Nome deve conter entre 2 e 120 caracteres.' USING ERRCODE='22023'; END IF;
 RETURN resultado;
END $$;

CREATE FUNCTION public.voluntariado_elegibilidade() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT voluntariado_privado.elegivel(auth.uid());
$$;

CREATE FUNCTION public.voluntariado_salvar_perfil(p_dados jsonb,p_habilidades bigint[]) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); dados jsonb; u public.usuarios; v public.voluntarios;
BEGIN
 SELECT * INTO u FROM public.usuarios WHERE id=uid AND tipo_perfil='VOLUNTARIO' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sessão de voluntário inválida.' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.voluntarios WHERE usuario_id=uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro complementar ausente. Solicite suporte à gestão.'; END IF;
 dados:=voluntariado_privado.perfil_payload(p_dados,ARRAY[
 'nome','telefone','descricao','perfil_instagram','cpf','data_nascimento','profissao',
 'disponibilidade_horarios','cep','logradouro','numero','complemento','bairro','cidade','uf']);
 IF p_habilidades IS NULL OR EXISTS(SELECT 1 FROM unnest(p_habilidades) h
 WHERE h IS NULL OR NOT EXISTS(SELECT 1 FROM public.habilidades WHERE id=h)) THEN
 RAISE EXCEPTION 'Habilidades inválidas. Recarregue o perfil.' USING ERRCODE='22023'; END IF;
 -- Populate sobre as linhas bloqueadas preserva valores omitidos, inclusive null.
 u:=jsonb_populate_record(u,dados);
 v:=jsonb_populate_record(v,dados);
 UPDATE public.usuarios SET nome=u.nome,telefone=u.telefone,descricao=u.descricao,
 perfil_instagram=u.perfil_instagram WHERE id=uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não foi atualizado.'; END IF;
 UPDATE public.voluntarios SET cpf=v.cpf,data_nascimento=v.data_nascimento,profissao=v.profissao,
 disponibilidade_horarios=v.disponibilidade_horarios,cep=v.cep,logradouro=v.logradouro,
 numero=v.numero,complemento=v.complemento,bairro=v.bairro,cidade=v.cidade,uf=v.uf
 WHERE usuario_id=uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro complementar não foi atualizado.'; END IF;
 -- Retira apenas vínculos não selecionados; preserva os que continuam selecionados.
 DELETE FROM public.usuario_habilidades WHERE usuario_id=uid AND NOT (habilidade_id=ANY(p_habilidades));
 INSERT INTO public.usuario_habilidades(usuario_id,habilidade_id)
 SELECT uid,h FROM (SELECT DISTINCT unnest(p_habilidades) AS h) escolhidas
 ON CONFLICT(usuario_id,habilidade_id) DO NOTHING;
 RETURN voluntariado_privado.elegivel(uid);
END $$;

CREATE FUNCTION public.gestao_salvar_perfil(p_dados jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); dados jsonb; u public.usuarios; o public.ongs;
BEGIN
 SELECT * INTO u FROM public.usuarios WHERE id=uid AND tipo_perfil='ONG' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sessão de gestão inválida.' USING ERRCODE='42501'; END IF;
 dados:=voluntariado_privado.perfil_payload(p_dados,ARRAY[
 'nome','telefone','descricao','perfil_instagram','cnpj','razao_social','data_criacao',
 'responsavel_legal','whatsapp','chave_pix','nome_beneficiario_pix']);
 -- Somente conta JÁ provisionada como ONG; PK evita duplicidade inclusive sob disputa.
 -- A criação ocorre na chamada, nunca na aplicação da migration.
 INSERT INTO public.ongs(usuario_id) VALUES(uid) ON CONFLICT(usuario_id) DO NOTHING;
 SELECT * INTO o FROM public.ongs WHERE usuario_id=uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Não foi possível carregar o complemento da gestão.'; END IF;
 u:=jsonb_populate_record(u,dados);
 o:=jsonb_populate_record(o,dados);
 IF dados ? 'data_criacao' AND o.data_criacao>current_date THEN
 RAISE EXCEPTION 'Data de criação não pode estar no futuro.' USING ERRCODE='22023'; END IF;
 UPDATE public.usuarios SET nome=u.nome,telefone=u.telefone,descricao=u.descricao,
 perfil_instagram=u.perfil_instagram WHERE id=uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não foi atualizado.'; END IF;
 UPDATE public.ongs SET cnpj=o.cnpj,razao_social=o.razao_social,data_criacao=o.data_criacao,
 responsavel_legal=o.responsavel_legal,whatsapp=o.whatsapp,
 chave_pix=o.chave_pix,nome_beneficiario_pix=o.nome_beneficiario_pix WHERE usuario_id=uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Complemento da gestão não foi atualizado.'; END IF;
 RETURN true;
END $$;

-- Fechar inclusive grants originados por ALTER DEFAULT PRIVILEGES no remoto.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA voluntariado_privado FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.voluntariado_elegibilidade(),
 public.voluntariado_salvar_perfil(jsonb,bigint[]),public.gestao_salvar_perfil(jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.voluntariado_elegibilidade(),
 public.voluntariado_salvar_perfil(jsonb,bigint[]),public.gestao_salvar_perfil(jsonb)
 TO authenticated;
COMMIT;
