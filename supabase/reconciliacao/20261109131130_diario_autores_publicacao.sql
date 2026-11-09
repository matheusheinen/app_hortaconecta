-- Mostra a autoria das publicações públicas sem abrir a leitura dos perfis.
-- O nome e o caminho da foto só são retornados para autores com relato publicado;
-- o bucket continua privado e sua política libera apenas essas fotos no Diário.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regclass('public.diario_transparencia') IS NULL OR to_regclass('public.usuarios') IS NULL
    OR to_regnamespace('voluntariado_privado') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: reconciliação 02 do Diário e usuários ausentes.';
 END IF;
 IF to_regclass('storage.objects') IS NULL
    OR to_regprocedure('public.perfil_foto_propria(text)') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: bucket privado de fotos de perfil ausente.';
 END IF;
 IF to_regprocedure('public.diario_autores(uuid[])') IS NOT NULL
    OR to_regprocedure('voluntariado_privado.diario_autores(uuid[])') IS NOT NULL
    OR to_regprocedure('voluntariado_privado.diario_autor_foto_visivel(text)') IS NOT NULL THEN
  RAISE EXCEPTION 'Pré-condição: RPCs de autoria do Diário já existem; não reaplicar.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'perfil_foto_read')
    OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'perfil_foto_read_limite') THEN
  RAISE EXCEPTION 'Pré-condição: políticas de leitura de foto de perfil não encontradas.';
 END IF;
END $preflight$;

CREATE FUNCTION voluntariado_privado.diario_autores(p_autores uuid[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id', u.id, 'nome', u.nome, 'foto_perfil', u.foto_perfil
 ) ORDER BY u.id), '[]'::jsonb)
 FROM public.usuarios u
 WHERE u.id = ANY(coalesce(p_autores, ARRAY[]::uuid[]))
   AND auth.uid() IS NOT NULL
   AND NOT coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb
     ->> 'is_anonymous')::boolean, false)
   AND cardinality(coalesce(p_autores, ARRAY[]::uuid[])) <= 50
   AND EXISTS (
     SELECT 1 FROM public.diario_transparencia d
     WHERE d.autor_id = u.id AND d.status = 'PUBLICADA'
   );
$$;

CREATE FUNCTION public.diario_autores(p_autores uuid[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT voluntariado_privado.diario_autores(p_autores);
$$;

CREATE FUNCTION voluntariado_privado.diario_autor_foto_visivel(p_caminho text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(
   auth.uid() IS NOT NULL
   AND NOT coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb
     ->> 'is_anonymous')::boolean, false)
   AND EXISTS (
     SELECT 1
     FROM public.usuarios u
     JOIN public.diario_transparencia d ON d.autor_id = u.id
     WHERE u.foto_perfil = p_caminho AND d.status = 'PUBLICADA'
   ), false
 );
$$;

REVOKE ALL ON FUNCTION voluntariado_privado.diario_autores(uuid[]),
 voluntariado_privado.diario_autor_foto_visivel(text), public.diario_autores(uuid[])
 FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA voluntariado_privado TO authenticated;
GRANT EXECUTE ON FUNCTION voluntariado_privado.diario_autores(uuid[]),
 voluntariado_privado.diario_autor_foto_visivel(text), public.diario_autores(uuid[])
 TO authenticated;

-- Mantém o acesso à própria foto e acrescenta somente fotos dos autores do Diário.
DROP POLICY perfil_foto_read ON storage.objects;
CREATE POLICY perfil_foto_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id = 'perfil-fotos' AND (
   public.perfil_foto_propria(name) OR voluntariado_privado.diario_autor_foto_visivel(name)
 ));
DROP POLICY perfil_foto_read_limite ON storage.objects;
CREATE POLICY perfil_foto_read_limite ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id <> 'perfil-fotos' OR (
   public.perfil_foto_propria(name) OR voluntariado_privado.diario_autor_foto_visivel(name)
 ));

COMMIT;
