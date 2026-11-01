-- B22: comprovante opcional da contribuição, em bucket privado do Storage.
-- O voluntário envia o arquivo na própria pasta ({uid}/{uuid}.jpg) e a gestão lê
-- todos para conferir. Arquivos são imutáveis: não há update, e o voluntário só
-- apaga um arquivo que ainda não está ligado a nenhuma contribuição (envio que
-- falhou no banco). contribuicoes.url_comprovante guarda o caminho no bucket.
-- Aplicar sobre o remoto que já tem Storage e a coluna url_comprovante opcional.
-- Não usar db push sobre o histórico.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: Supabase Storage ausente.'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'storage.objects'::regclass) THEN
  RAISE EXCEPTION 'Pré-condição: RLS do Storage desabilitado.'; END IF;
 IF to_regclass('public.contribuicoes') IS NULL OR to_regprocedure('public.e_ong(uuid)') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: contribuicoes e public.e_ong() precisam existir.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND table_name='contribuicoes' AND column_name='url_comprovante' AND is_nullable='YES') THEN
  RAISE EXCEPTION 'Pré-condição: url_comprovante opcional (migration gestao_lanca_contribuicao) ausente.'; END IF;
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'comprovantes') THEN
  RAISE EXCEPTION 'Pré-condição: bucket comprovantes já existe; não reaplicar.'; END IF;
END $preflight$;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
 VALUES('comprovantes', 'comprovantes', false, 5242880, ARRAY['image/jpeg']);

-- Caminho novo para cada envio; o cliente nunca escolhe a pasta.
CREATE FUNCTION public.comprovante_caminho() RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para enviar o comprovante.'; END IF;
 RETURN auth.uid()::text || '/' || gen_random_uuid()::text || '.jpg';
END $$;

-- Arquivo sem contribuição ligada: só ele pode ser apagado pelo dono.
CREATE FUNCTION public.comprovante_livre(p_caminho text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.contribuicoes WHERE url_comprovante = p_caminho);
$$;

REVOKE ALL ON FUNCTION public.comprovante_caminho(), public.comprovante_livre(text)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comprovante_caminho(), public.comprovante_livre(text)
 TO authenticated;

-- Dono lê a própria pasta; a gestão lê todas. Restritivas fecham qualquer outra
-- policy ampla que alguém crie no mesmo bucket.
CREATE POLICY comprovantes_storage_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id = 'comprovantes'
  AND (split_part(name, '/', 1) = auth.uid()::text OR public.e_ong()));
CREATE POLICY comprovantes_storage_read_limite ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id <> 'comprovantes'
  OR split_part(name, '/', 1) = auth.uid()::text OR public.e_ong());
CREATE POLICY comprovantes_storage_anon ON storage.objects AS RESTRICTIVE FOR ALL TO anon
 USING(bucket_id <> 'comprovantes') WITH CHECK(bucket_id <> 'comprovantes');
CREATE POLICY comprovantes_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id = 'comprovantes' AND split_part(name, '/', 1) = auth.uid()::text
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
CREATE POLICY comprovantes_storage_insert_limite ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id <> 'comprovantes' OR (split_part(name, '/', 1) = auth.uid()::text
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'));
-- Comprovantes são imutáveis: trocar significa enviar outro arquivo.
CREATE POLICY comprovantes_storage_sem_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id <> 'comprovantes') WITH CHECK(bucket_id <> 'comprovantes');
CREATE POLICY comprovantes_storage_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id = 'comprovantes' AND split_part(name, '/', 1) = auth.uid()::text
  AND public.comprovante_livre(name));
CREATE POLICY comprovantes_storage_delete_limite ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id <> 'comprovantes' OR (split_part(name, '/', 1) = auth.uid()::text
  AND public.comprovante_livre(name)));

-- Quem declara só aponta para um arquivo da própria pasta (ou não anexa nada).
-- A gestão, ao registrar doação recebida, não anexa comprovante.
CREATE POLICY contribuicoes_comprovante_proprio ON public.contribuicoes AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(url_comprovante IS NULL OR (split_part(url_comprovante, '/', 1) = usuario_id::text
  AND url_comprovante ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'));
COMMIT;
