-- B29: tokens de push dos aparelhos. Um usuário pode ter vários aparelhos, e o
-- mesmo aparelho pode trocar de conta, então o token é único e passa para quem o
-- registrou por último. A tabela fica no schema privado: o app só escreve pelas RPCs,
-- que derivam o usuário da sessão. O envio (Edge Function com service_role) fica
-- para uma etapa posterior e exigirá um GRANT SELECT próprio.
-- Aplicar sobre o remoto já reconciliado, depois da reconciliação 02. Não usar
-- db push sobre o histórico.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regclass('public.usuarios') IS NULL OR to_regnamespace('voluntariado_privado') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: usuarios ou voluntariado_privado (reconciliação 02) ausente.'; END IF;
 IF to_regclass('voluntariado_privado.dispositivos_push') IS NOT NULL
  OR to_regprocedure('public.push_registrar_token(text,text)') IS NOT NULL THEN
  RAISE EXCEPTION 'Pré-condição: dispositivos de push já instalados; não reaplicar.'; END IF;
END $preflight$;

CREATE TABLE voluntariado_privado.dispositivos_push (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
 token text NOT NULL UNIQUE CHECK (token ~ '^Expo(nent)?PushToken\[[^\]]{1,200}\]$'),
 plataforma text NOT NULL CHECK (plataforma IN ('ios','android')),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dispositivos_push_usuario_idx ON voluntariado_privado.dispositivos_push(usuario_id);
ALTER TABLE voluntariado_privado.dispositivos_push ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON voluntariado_privado.dispositivos_push FROM PUBLIC, anon, authenticated, service_role;

-- Registra (ou move para a sessão atual) o token do aparelho. Convidado não recebe push.
CREATE FUNCTION public.push_registrar_token(p_token text, p_plataforma text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501'; END IF;
 IF coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'is_anonymous')::boolean, false) THEN
  RAISE EXCEPTION 'Convidado não recebe notificações. Crie uma conta para participar.' USING ERRCODE='42501';
 END IF;
 IF p_token IS NULL OR p_token !~ '^Expo(nent)?PushToken\[[^\]]{1,200}\]$' THEN
  RAISE EXCEPTION 'Token de notificação inválido.' USING ERRCODE='22023'; END IF;
 IF p_plataforma IS NULL OR p_plataforma NOT IN ('ios','android') THEN
  RAISE EXCEPTION 'Plataforma inválida.' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=uid) THEN
  RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501'; END IF;
 INSERT INTO voluntariado_privado.dispositivos_push(usuario_id, token, plataforma)
 VALUES(uid, p_token, p_plataforma)
 ON CONFLICT (token) DO UPDATE
   SET usuario_id=EXCLUDED.usuario_id, plataforma=EXCLUDED.plataforma, atualizado_em=now();
END $$;
REVOKE ALL ON FUNCTION public.push_registrar_token(text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.push_registrar_token(text,text) TO authenticated;

-- Remove o token deste aparelho ao sair da conta. Só apaga o que pertence ao usuário.
CREATE FUNCTION public.push_remover_token(p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501'; END IF;
 DELETE FROM voluntariado_privado.dispositivos_push WHERE token=p_token AND usuario_id=uid;
END $$;
REVOKE ALL ON FUNCTION public.push_remover_token(text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.push_remover_token(text) TO authenticated;

COMMIT;
