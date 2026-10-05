-- Exclusão de publicações do Diário pela gestão (pedido da equipe de 05/10/2026).
-- Antes, desativar era só ocultar; DELETE direto continua bloqueado por RLS e
-- grants, e a exclusão passa por esta RPC, com a mesma checagem de revisão das
-- demais escritas. A função devolve o caminho da imagem: o app remove o arquivo
-- pela API Storage, que só aceita apagar objetos sem vínculo (diario_imagem_livre).
-- Aplicar sobre o remoto já reconciliado, depois da reconciliação 02. Não usar
-- db push sobre o histórico.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regprocedure('public.diario_status_revisao(bigint,text,integer)') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: diario_status_revisao (reconciliação 02) ausente.'; END IF;
 IF to_regprocedure('public.diario_excluir_revisao(bigint,integer)') IS NOT NULL THEN
  RAISE EXCEPTION 'Pré-condição: diario_excluir_revisao já existe; não reaplicar.'; END IF;
END $preflight$;

CREATE FUNCTION public.diario_excluir_revisao(p_id bigint,p_revisao integer) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE atual integer; imagem text;
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode excluir a publicação.'; END IF;
 SELECT revisao,imagem_caminho INTO atual,imagem FROM public.diario_transparencia WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Publicação não encontrada.'; END IF;
 IF p_revisao IS DISTINCT FROM atual THEN RAISE EXCEPTION 'Esta publicação foi alterada por outra operação. Recarregue os dados antes de continuar.'; END IF;
 DELETE FROM public.diario_transparencia WHERE id=p_id;
 RETURN imagem;
END $$;
REVOKE ALL ON FUNCTION public.diario_excluir_revisao(bigint,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.diario_excluir_revisao(bigint,integer) TO authenticated;
COMMIT;
