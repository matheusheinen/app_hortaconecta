-- Foto pessoal de voluntários e gestores. Aplicar depois das reconciliações 01 e 02.
-- Independente das demais reconciliações: não depende da função e_convidado().
-- Preserva fotos legadas; novos valores são caminhos privados, nunca URLs públicas.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regprocedure('voluntariado_privado.proteger_identidade()') IS NULL
    OR to_regclass('storage.objects') IS NULL OR to_regclass('storage.buckets') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: reconciliações 01/02 e Storage precisam existir.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='usuarios' AND column_name='foto_perfil' AND data_type='text') THEN
  RAISE EXCEPTION 'Pré-condição: usuarios.foto_perfil precisa existir como text.'; END IF;
 IF to_regprocedure('public.perfil_foto_salvar(text,text,uuid)') IS NOT NULL
    OR to_regprocedure('public.perfil_foto_caminho()') IS NOT NULL THEN
  RAISE EXCEPTION 'Pré-condição: foto do perfil já instalada; não reaplicar.'; END IF;
END $preflight$;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('perfil-fotos','perfil-fotos',false,2097152,ARRAY['image/jpeg'])
 ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='perfil-fotos' AND name='perfil-fotos'
   AND public=false AND file_size_limit=2097152 AND allowed_mime_types=ARRAY['image/jpeg']) THEN
  RAISE EXCEPTION 'Bucket perfil-fotos existente tem configuração diferente. Conferir antes de aplicar.';
 END IF;
END $$;

-- O prefixo é a identidade autenticada. A flag é lida diretamente do JWT,
-- inclusive quando a chamada parte de uma função SECURITY DEFINER.
CREATE FUNCTION public.perfil_foto_propria(p_caminho text) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(auth.uid() IS NOT NULL
  AND NOT coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'is_anonymous')::boolean,false)
  AND split_part(p_caminho,'/',1)=auth.uid()::text
  AND p_caminho ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$',false);
$$;

-- Serializa a exclusão com a troca da foto, sempre bloqueando usuário antes
-- do objeto. Assim uma limpeza de upload sem resposta não apaga a foto atual.
CREATE FUNCTION public.perfil_foto_livre(p_caminho text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE atual text;
BEGIN
 IF NOT public.perfil_foto_propria(p_caminho) THEN RETURN false; END IF;
 SELECT foto_perfil INTO atual FROM public.usuarios WHERE id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 RETURN atual IS DISTINCT FROM p_caminho;
END $$;

CREATE FUNCTION public.perfil_foto_caminho() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'is_anonymous')::boolean,false)
    OR NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid()) THEN
  RAISE EXCEPTION 'Entre com sua conta para alterar a foto do perfil.' USING ERRCODE='42501'; END IF;
 RETURN auth.uid()::text || '/' || gen_random_uuid()::text || '.jpg';
END $$;

CREATE FUNCTION public.perfil_foto_salvar(p_caminho text,p_anterior text,p_usuario_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE atual text;
BEGIN
 IF auth.uid() IS NULL OR p_usuario_id IS DISTINCT FROM auth.uid()
    OR coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'is_anonymous')::boolean,false) THEN
  RAISE EXCEPTION 'Entre com sua conta para alterar a foto do perfil.' USING ERRCODE='42501'; END IF;
 SELECT foto_perfil INTO atual FROM public.usuarios WHERE id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado.' USING ERRCODE='42501'; END IF;
 IF atual IS DISTINCT FROM p_anterior THEN
  RAISE EXCEPTION 'Sua foto foi alterada em outra operação. Recarregue o perfil antes de continuar.' USING ERRCODE='40001'; END IF;
 IF p_caminho IS NOT NULL THEN
  IF NOT public.perfil_foto_propria(p_caminho) THEN
   RAISE EXCEPTION 'Escolha uma foto enviada pela sua conta.' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM storage.objects WHERE bucket_id='perfil-fotos' AND name=p_caminho FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Envie a foto antes de salvar o perfil.'; END IF;
 END IF;
 UPDATE public.usuarios SET foto_perfil=p_caminho WHERE id=auth.uid();
 RETURN true;
END $$;

-- SECURITY INVOKER é intencional: o papel efetivo da RPC é seu proprietário,
-- enquanto uma alteração direta da API continua sendo authenticated/anon.
CREATE FUNCTION voluntariado_privado.proteger_foto_perfil() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF (TG_OP='INSERT' AND NEW.foto_perfil IS NULL)
    OR (TG_OP='UPDATE' AND NEW.foto_perfil IS NOT DISTINCT FROM OLD.foto_perfil) THEN
  RETURN NEW; END IF;
 IF current_user::regrole::oid <> (SELECT proowner FROM pg_proc WHERE oid='public.perfil_foto_salvar(text,text,uuid)'::regprocedure) THEN
  RAISE EXCEPTION 'Altere a foto pelas opções do perfil.' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER proteger_foto_perfil BEFORE INSERT OR UPDATE OF foto_perfil ON public.usuarios
 FOR EACH ROW EXECUTE FUNCTION voluntariado_privado.proteger_foto_perfil();

-- Policies restritivas continuam fechando este bucket mesmo que exista uma
-- policy permissiva antiga. Os demais buckets mantêm suas regras existentes.
CREATE POLICY perfil_foto_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='perfil-fotos' AND public.perfil_foto_propria(name));
CREATE POLICY perfil_foto_read_limite ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'perfil-fotos' OR public.perfil_foto_propria(name));
CREATE POLICY perfil_foto_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='perfil-fotos' AND public.perfil_foto_propria(name));
CREATE POLICY perfil_foto_insert_limite ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'perfil-fotos' OR public.perfil_foto_propria(name));
CREATE POLICY perfil_foto_sem_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'perfil-fotos') WITH CHECK(bucket_id<>'perfil-fotos');
CREATE POLICY perfil_foto_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='perfil-fotos' AND public.perfil_foto_livre(name));
CREATE POLICY perfil_foto_delete_limite ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'perfil-fotos' OR public.perfil_foto_livre(name));
CREATE POLICY perfil_foto_sem_anon ON storage.objects AS RESTRICTIVE FOR ALL TO anon
 USING(bucket_id<>'perfil-fotos') WITH CHECK(bucket_id<>'perfil-fotos');

REVOKE ALL ON FUNCTION public.perfil_foto_propria(text),public.perfil_foto_livre(text),
 public.perfil_foto_caminho(),public.perfil_foto_salvar(text,text,uuid),
 voluntariado_privado.proteger_foto_perfil() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.perfil_foto_propria(text),public.perfil_foto_livre(text),
 public.perfil_foto_caminho(),public.perfil_foto_salvar(text,text,uuid) TO authenticated;
COMMIT;
