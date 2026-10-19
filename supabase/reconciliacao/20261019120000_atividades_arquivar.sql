-- Arquivar atividades (card "ARQUIVADAS" do quadro Horta Conecta, 19/10/2026).
-- A gestão arquiva atividades finalizadas (REALIZADA, CANCELADA ou RECUSADA)
-- para tirá-las da lista; nada é apagado e o histórico de candidaturas e
-- presenças continua intacto. A escrita passa por RPC porque o gatilho
-- atividade_fluxo_rpc e o RLS não deixam o cliente alterar a linha direto.
-- Aplicar sobre o remoto já reconciliado, depois da reconciliação 02. Não usar
-- db push sobre o histórico.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regprocedure('public.voluntariado_status_atividade(bigint,text)') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: voluntariado_status_atividade (reconciliação 02) ausente.'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='atividades' AND column_name='arquivada_em') THEN
  RAISE EXCEPTION 'Pré-condição: atividades.arquivada_em já existe; não reaplicar.'; END IF;
END $preflight$;

ALTER TABLE public.atividades ADD COLUMN arquivada_em timestamptz;

CREATE FUNCTION public.voluntariado_arquivar_atividade(p_atividade bigint, p_arquivar boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_atividade public.atividades;
BEGIN
  IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode arquivar atividades.'; END IF;
  IF p_arquivar IS NULL THEN RAISE EXCEPTION 'Informe se a atividade deve ser arquivada ou restaurada.'; END IF;
  SELECT * INTO v_atividade FROM public.atividades WHERE id = p_atividade FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  IF p_arquivar THEN
    IF v_atividade.status NOT IN ('REALIZADA','CANCELADA','RECUSADA') THEN
      RAISE EXCEPTION 'Só é possível arquivar atividades realizadas, canceladas ou recusadas.';
    END IF;
    IF v_atividade.arquivada_em IS NOT NULL THEN RAISE EXCEPTION 'A atividade já está arquivada.'; END IF;
    UPDATE public.atividades SET arquivada_em = clock_timestamp() WHERE id = p_atividade;
  ELSE
    IF v_atividade.arquivada_em IS NULL THEN RAISE EXCEPTION 'A atividade não está arquivada.'; END IF;
    UPDATE public.atividades SET arquivada_em = NULL WHERE id = p_atividade;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.voluntariado_arquivar_atividade(bigint,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.voluntariado_arquivar_atividade(bigint,boolean) TO authenticated;
COMMIT;
