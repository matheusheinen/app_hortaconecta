-- Convidado: sessão anônima do Supabase Auth (signInAnonymously) com acesso só de leitura.
-- A sessão anônima tem o papel `authenticated`, então as leituras atuais funcionam sem
-- abrir nada ao papel `anon`. O que impede a escrita é o claim `is_anonymous` do JWT:
--   1. um gatilho por instrução em toda tabela com escrita barra INSERT/UPDATE/DELETE,
--      inclusive as feitas por RPCs SECURITY DEFINER (o claim continua valendo lá dentro);
--   2. o Diário (tabela e imagens) fica ilegível para convidado, pelo banco e não só pela tela;
--   3. handle_new_user passa a aceitar usuário sem e-mail e sem nome.
-- Pré-requisito fora do SQL: ligar "Allow anonymous sign-ins" em Authentication > Sign In / Providers.
-- Aplicar sobre o remoto já reconciliado. Não usar db push sobre o histórico.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
DECLARE def text;
BEGIN
 IF to_regprocedure('voluntariado_privado.proteger_identidade()') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: reconciliação 02 ausente.'; END IF;
 IF to_regprocedure('public.e_convidado()') IS NOT NULL THEN
  RAISE EXCEPTION 'Pré-condição: convidado já instalado; não reaplicar.'; END IF;
 SELECT prosrc INTO def FROM pg_proc WHERE oid = to_regprocedure('public.handle_new_user()');
 IF def IS NULL OR position('insert into public.voluntarios' IN def) = 0
    OR position('split_part(new.email' IN def) = 0 THEN
  RAISE EXCEPTION 'Pré-condição: handle_new_user difere do esperado; revisar antes de aplicar.'; END IF;
END $preflight$;

-- Lê o claim do JWT da requisição. Fora do PostgREST (sem claims) devolve false.
CREATE FUNCTION public.e_convidado() RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'is_anonymous')::boolean, false);
$$;
REVOKE ALL ON FUNCTION public.e_convidado() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.e_convidado() TO authenticated;

CREATE FUNCTION voluntariado_privado.bloquear_convidado() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'is_anonymous')::boolean, false) THEN
  RAISE EXCEPTION 'Convidado não pode alterar dados. Crie uma conta para participar.' USING ERRCODE = '42501';
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION voluntariado_privado.bloquear_convidado() FROM PUBLIC, anon, authenticated, service_role;

DO $gatilhos$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'public.atividade_habilidades','public.atividades','public.certificados',
  'public.configuracao_instituicao','public.contribuicoes','public.contribuicoes_materiais',
  'public.diario_transparencia','public.habilidades','public.inscricoes_atividades',
  'public.metas_demandas','public.ongs','public.propostas_oficinas',
  'public.solicitacoes_materiais','public.usuario_habilidades','public.usuarios',
  'public.voluntarios','voluntariado_privado.gestores','voluntariado_privado.tokens_checkin']
 LOOP
  IF to_regclass(t) IS NULL THEN RAISE EXCEPTION 'Pré-condição: tabela % ausente.', t; END IF;
  EXECUTE format('CREATE TRIGGER bloquear_convidado BEFORE INSERT OR UPDATE OR DELETE ON %s FOR EACH STATEMENT EXECUTE FUNCTION voluntariado_privado.bloquear_convidado()', t);
 END LOOP;
END $gatilhos$;

-- Diário: nem a tabela nem as RPCs de leitura (INVOKER) mostram nada a convidado.
CREATE POLICY diario_sem_convidado ON public.diario_transparencia AS RESTRICTIVE
 FOR SELECT TO authenticated USING (NOT public.e_convidado());

-- Imagens do Diário: leitura e escrita fechadas a convidado; outros buckets não mudam.
DO $storage$
BEGIN
 IF to_regclass('storage.objects') IS NOT NULL THEN
  EXECUTE $p$CREATE POLICY diario_storage_sem_convidado ON storage.objects AS RESTRICTIVE
   FOR ALL TO authenticated
   USING (bucket_id <> 'diario-imagens' OR NOT public.e_convidado())
   WITH CHECK (bucket_id <> 'diario-imagens' OR NOT public.e_convidado())$p$;
 END IF;
END $storage$;

-- Mesma função de antes, com nome de reserva para quem não tem e-mail nem nome (convidado).
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
begin
  insert into public.usuarios (id, nome, tipo_perfil)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), nullif(split_part(new.email, '@', 1), ''), 'Convidado'),
    'VOLUNTARIO'
  );

  insert into public.voluntarios (usuario_id) values (new.id);

  return new;
end;
$$;
COMMIT;
