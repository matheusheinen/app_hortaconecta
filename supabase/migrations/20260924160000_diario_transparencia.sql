BEGIN;
-- Reutiliza o Diário existente. Storage deve ser provisionado pelo Supabase.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
  RAISE EXCEPTION 'Supabase Storage ausente. Conferir docs/DIARIO.md antes de aplicar.';
 END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
  RAISE EXCEPTION 'RLS do Storage desabilitado. Conferir a configuração do Supabase antes de aplicar.';
 END IF;
END $$;
ALTER TABLE public.diario_transparencia
 ADD COLUMN texto text,
 ADD COLUMN status text NOT NULL DEFAULT 'PUBLICADA' CHECK(status IN ('PUBLICADA','OCULTA')),
 ADD COLUMN imagem_caminho text,
 ADD COLUMN atualizado_em timestamptz NOT NULL DEFAULT now(),
 ADD CONSTRAINT diario_texto_limite CHECK(texto IS NULL OR length(btrim(texto)) BETWEEN 1 AND 20000),
 ADD CONSTRAINT diario_imagem_caminho CHECK(imagem_caminho IS NULL OR imagem_caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
CREATE INDEX diario_status_data ON public.diario_transparencia(status,data_publicacao DESC,id DESC);
CREATE UNIQUE INDEX diario_imagem_unica ON public.diario_transparencia(imagem_caminho) WHERE imagem_caminho IS NOT NULL;
ALTER TABLE public.diario_transparencia ENABLE ROW LEVEL SECURITY;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.diario_transparencia FROM PUBLIC,anon,authenticated;
REVOKE SELECT ON public.diario_transparencia FROM PUBLIC,anon;
GRANT SELECT ON public.diario_transparencia TO authenticated;
CREATE POLICY diario_visibilidade ON public.diario_transparencia AS RESTRICTIVE FOR SELECT TO authenticated
 USING(status='PUBLICADA' OR EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND tipo_perfil='ONG'));
CREATE POLICY diario_sem_anon ON public.diario_transparencia AS RESTRICTIVE FOR SELECT TO anon USING(false);
CREATE POLICY diario_sem_insert ON public.diario_transparencia AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(false);
CREATE POLICY diario_sem_update ON public.diario_transparencia AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(false) WITH CHECK(false);
CREATE POLICY diario_sem_delete ON public.diario_transparencia AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(false);

-- Não reconfigura silenciosamente um bucket remoto que tenha outro propósito.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('diario-imagens','diario-imagens',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
 ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='diario-imagens' AND name='diario-imagens' AND public=false
   AND file_size_limit=5242880 AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']
   AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']) THEN
  RAISE EXCEPTION 'Bucket diario-imagens existente tem configuração diferente. Conferir antes de aplicar.';
 END IF;
END $$;

CREATE FUNCTION public.diario_gestao() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT voluntariado_privado.gestao(); $$;
CREATE FUNCTION public.diario_imagem_visivel(p_caminho text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (voluntariado_privado.gestao() OR EXISTS(
 SELECT 1 FROM public.diario_transparencia WHERE imagem_caminho=p_caminho AND status='PUBLICADA'));
$$;
CREATE FUNCTION public.diario_imagem_livre(p_caminho text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT voluntariado_privado.gestao() AND NOT EXISTS(SELECT 1 FROM public.diario_transparencia WHERE imagem_caminho=p_caminho);
$$;
CREATE POLICY diario_storage_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='diario-imagens' AND public.diario_imagem_visivel(name));
CREATE POLICY diario_storage_read_limite ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'diario-imagens' OR public.diario_imagem_visivel(name));
CREATE POLICY diario_storage_anon ON storage.objects AS RESTRICTIVE FOR ALL TO anon
 USING(bucket_id<>'diario-imagens') WITH CHECK(bucket_id<>'diario-imagens');
CREATE POLICY diario_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='diario-imagens' AND public.diario_gestao() AND split_part(name,'/',1)=auth.uid()::text
 AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
CREATE POLICY diario_storage_insert_limite ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'diario-imagens' OR (public.diario_gestao() AND split_part(name,'/',1)=auth.uid()::text
 AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'));
-- Imagens são imutáveis: substituir significa enviar outro arquivo, sem upsert.
CREATE POLICY diario_storage_sem_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'diario-imagens') WITH CHECK(bucket_id<>'diario-imagens');
CREATE POLICY diario_storage_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='diario-imagens' AND public.diario_imagem_livre(name));
CREATE POLICY diario_storage_delete_limite ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'diario-imagens' OR public.diario_imagem_livre(name));

CREATE FUNCTION public.diario_caminho(p_ext text) RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode enviar imagens.'; END IF;
 IF p_ext IS NULL OR p_ext NOT IN ('jpg','png','webp') THEN RAISE EXCEPTION 'Formato de imagem não permitido.'; END IF;
 RETURN auth.uid()::text || '/' || gen_random_uuid()::text || '.' || p_ext;
END $$;
CREATE FUNCTION public.diario_salvar(p_id bigint,p_titulo text,p_texto text,p_status text,p_imagem text) RETURNS bigint
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.diario_transparencia; resultado bigint;
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode publicar.'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('PUBLICADA','OCULTA') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
 IF p_titulo IS NULL OR length(btrim(p_titulo)) NOT BETWEEN 3 AND 120
 OR p_texto IS NULL OR length(btrim(p_texto)) NOT BETWEEN 1 AND 20000 THEN RAISE EXCEPTION 'Informe título de 3 a 120 caracteres e texto de 1 a 20.000 caracteres.'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO d FROM public.diario_transparencia WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Publicação não encontrada.'; END IF;
 END IF;
 IF p_imagem IS NOT NULL THEN
  IF (p_id IS NULL OR p_imagem IS DISTINCT FROM d.imagem_caminho) AND split_part(p_imagem,'/',1)<>auth.uid()::text THEN
    RAISE EXCEPTION 'A imagem deve ter sido enviada pela sua conta.'; END IF;
  PERFORM 1 FROM storage.objects WHERE bucket_id='diario-imagens' AND name=p_imagem FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Imagem não encontrada no Storage. Envie novamente.'; END IF;
 END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.diario_transparencia(titulo,texto,descricao_curta,status,imagem_caminho,autor_id)
  VALUES(btrim(p_titulo),btrim(p_texto),left(btrim(p_texto),280),p_status,p_imagem,auth.uid()) RETURNING id INTO resultado;
 ELSE
  UPDATE public.diario_transparencia SET titulo=btrim(p_titulo),texto=btrim(p_texto),descricao_curta=left(btrim(p_texto),280),
   status=p_status,imagem_caminho=p_imagem,atualizado_em=clock_timestamp()
   WHERE id=p_id RETURNING id INTO resultado;
 END IF;
 RETURN resultado;
END $$;
CREATE FUNCTION public.diario_status(p_id bigint,p_status text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode alterar a publicação.'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('PUBLICADA','OCULTA') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
 UPDATE public.diario_transparencia SET status=p_status,atualizado_em=clock_timestamp() WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Publicação não encontrada.'; END IF;
END $$;
CREATE FUNCTION public.diario_listar() RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.data_publicacao DESC,d.id DESC),'[]'::jsonb)
 FROM public.diario_transparencia d;
$$;
CREATE FUNCTION public.diario_detalhe(p_id bigint) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT to_jsonb(d) FROM public.diario_transparencia d WHERE id=p_id;
$$;
REVOKE ALL ON FUNCTION public.diario_gestao(),public.diario_imagem_visivel(text),public.diario_imagem_livre(text),
 public.diario_caminho(text),public.diario_salvar(bigint,text,text,text,text),public.diario_status(bigint,text),
 public.diario_listar(),public.diario_detalhe(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.diario_gestao(),public.diario_imagem_visivel(text),public.diario_imagem_livre(text),
 public.diario_caminho(text),public.diario_salvar(bigint,text,text,text,text),public.diario_status(bigint,text),
 public.diario_listar(),public.diario_detalhe(bigint) TO authenticated;
COMMIT;
