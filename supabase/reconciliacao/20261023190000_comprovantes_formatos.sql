-- B22, continuação: o comprovante passa a aceitar JPEG, PNG e WebP (SVG fica de
-- fora: é código, não imagem), e a gestão pode anexar comprovante ao registrar
-- uma doação recebida em nome do doador. O doador enxerga o arquivo que a gestão
-- anexou à contribuição dele.
-- Aplicar depois de 20261023170000_comprovantes_storage.sql. Não usar db push.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'comprovantes' AND public = false
   AND allowed_mime_types = ARRAY['image/jpeg']) THEN
  RAISE EXCEPTION 'Pré-condição: bucket comprovantes ausente ou já alterado; não reaplicar.'; END IF;
 IF to_regprocedure('public.comprovante_caminho()') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: aplique antes 20261023170000_comprovantes_storage.sql.'; END IF;
END $preflight$;

UPDATE storage.buckets SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'comprovantes';

-- A extensão agora vem do cliente, restrita aos formatos aceitos.
DROP FUNCTION public.comprovante_caminho();
CREATE FUNCTION public.comprovante_caminho(p_ext text) RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para enviar o comprovante.'; END IF;
 IF p_ext IS NULL OR p_ext NOT IN ('jpg', 'png', 'webp') THEN
  RAISE EXCEPTION 'Formato de imagem não permitido.'; END IF;
 RETURN auth.uid()::text || '/' || gen_random_uuid()::text || '.' || p_ext;
END $$;

-- Arquivo ligado a uma contribuição do próprio usuário, mesmo que a gestão o tenha enviado.
CREATE FUNCTION public.comprovante_do_usuario(p_caminho text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.contribuicoes
  WHERE url_comprovante = p_caminho AND usuario_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.comprovante_caminho(text), public.comprovante_do_usuario(text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comprovante_caminho(text), public.comprovante_do_usuario(text)
 TO authenticated;

DROP POLICY comprovantes_storage_read ON storage.objects;
DROP POLICY comprovantes_storage_read_limite ON storage.objects;
CREATE POLICY comprovantes_storage_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id = 'comprovantes' AND (split_part(name, '/', 1) = auth.uid()::text
  OR public.e_ong() OR public.comprovante_do_usuario(name)));
CREATE POLICY comprovantes_storage_read_limite ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id <> 'comprovantes' OR split_part(name, '/', 1) = auth.uid()::text
  OR public.e_ong() OR public.comprovante_do_usuario(name));

DROP POLICY comprovantes_storage_insert ON storage.objects;
DROP POLICY comprovantes_storage_insert_limite ON storage.objects;
CREATE POLICY comprovantes_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id = 'comprovantes' AND split_part(name, '/', 1) = auth.uid()::text
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
CREATE POLICY comprovantes_storage_insert_limite ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id <> 'comprovantes' OR (split_part(name, '/', 1) = auth.uid()::text
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'));

-- O doador aponta para arquivo da própria pasta; a gestão, ao registrar em nome
-- dele, aponta para arquivo da pasta dela.
DROP POLICY contribuicoes_comprovante_proprio ON public.contribuicoes;
CREATE POLICY contribuicoes_comprovante_proprio ON public.contribuicoes AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(url_comprovante IS NULL OR (
  url_comprovante ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  AND (split_part(url_comprovante, '/', 1) = usuario_id::text
   OR (public.e_ong() AND split_part(url_comprovante, '/', 1) = auth.uid()::text))));
COMMIT;
