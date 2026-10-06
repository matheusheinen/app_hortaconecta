-- Modo gestor: a gestão (ONG) alterna entre a visão de gestão e a de voluntário
-- com as permissões reais de cada papel, sem trocar de conta nem editar a base.
-- A RPC troca usuarios.tipo_perfil (ONG <-> VOLUNTARIO), então as RLS e RPCs
-- existentes valem sem mudança. Só entra em voluntário quem está em
-- voluntariado_privado.gestores, que só é preenchida por quem já é ONG; assim um
-- voluntário não consegue se promover. Os dados de ongs e voluntarios são mantidos.
-- Aplicar sobre o remoto já reconciliado, depois da reconciliação 02. Não usar
-- db push sobre o histórico.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regprocedure('voluntariado_privado.proteger_identidade()') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: proteger_identidade (reconciliação 02) ausente.'; END IF;
 IF to_regclass('voluntariado_privado.gestores') IS NOT NULL
  OR to_regprocedure('public.gestor_alternar_modo(boolean)') IS NOT NULL THEN
  RAISE EXCEPTION 'Pré-condição: modo gestor já instalado; não reaplicar.'; END IF;
END $preflight$;

CREATE TABLE voluntariado_privado.gestores (
 usuario_id uuid PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE
);
ALTER TABLE voluntariado_privado.gestores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON voluntariado_privado.gestores FROM PUBLIC, anon, authenticated, service_role;

-- Mesma proteção de antes para chamadas diretas da API. Só as RPCs SECURITY
-- DEFINER (current_user = dono da função) podem trocar o tipo de perfil.
CREATE OR REPLACE FUNCTION voluntariado_privado.proteger_identidade() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND current_user IN ('anon','authenticated')
     AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.tipo_perfil IS DISTINCT FROM OLD.tipo_perfil) THEN
    RAISE EXCEPTION 'Não é permitido alterar a identidade ou o tipo de perfil pelo aplicativo.';
  END IF;
  RETURN NEW;
END $$;

-- p_gestor=true volta à gestão; false entra como voluntário. Devolve o tipo atual.
CREATE FUNCTION public.gestor_alternar_modo(p_gestor boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); atual public.tipo_perfil;
BEGIN
 IF uid IS NULL OR p_gestor IS NULL THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501'; END IF;
 SELECT tipo_perfil INTO atual FROM public.usuarios WHERE id=uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501'; END IF;
 IF atual='ONG' THEN
  INSERT INTO voluntariado_privado.gestores(usuario_id) VALUES(uid) ON CONFLICT DO NOTHING;
 ELSIF NOT EXISTS(SELECT 1 FROM voluntariado_privado.gestores WHERE usuario_id=uid) THEN
  RAISE EXCEPTION 'Somente a gestão pode alternar o modo.' USING ERRCODE='42501';
 END IF;
 IF p_gestor AND atual<>'ONG' THEN
  UPDATE public.usuarios SET tipo_perfil='ONG' WHERE id=uid;
  atual:='ONG';
 ELSIF NOT p_gestor AND atual<>'VOLUNTARIO' THEN
  UPDATE public.usuarios SET tipo_perfil='VOLUNTARIO' WHERE id=uid;
  INSERT INTO public.voluntarios(usuario_id) VALUES(uid) ON CONFLICT DO NOTHING;
  atual:='VOLUNTARIO';
 END IF;
 RETURN atual::text;
END $$;
REVOKE ALL ON FUNCTION public.gestor_alternar_modo(boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gestor_alternar_modo(boolean) TO authenticated;

-- A tela precisa saber se mostra o interruptor também quando já está em voluntário.
CREATE FUNCTION public.gestor_pode_alternar_modo() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT voluntariado_privado.gestao()
  OR EXISTS(SELECT 1 FROM voluntariado_privado.gestores WHERE usuario_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.gestor_pode_alternar_modo() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gestor_pode_alternar_modo() TO authenticated;
COMMIT;
