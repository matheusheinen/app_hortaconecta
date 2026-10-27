-- B29: atividade cancelada passa a avisar também quem estava com a candidatura aguardando
-- análise (PENDENTE), não só os aprovados. Só troca o corpo da função do gatilho criado em
-- 20261026130000_notificacoes.sql; nada de tabela ou dado muda. Aplicar depois dela.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regprocedure('voluntariado_privado.notificar_atividade_cancelada()') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: 20261026130000_notificacoes.sql ainda não foi aplicada.'; END IF;
END $preflight$;

CREATE OR REPLACE FUNCTION voluntariado_privado.notificar_atividade_cancelada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM voluntariado_privado.notificar(
  ARRAY(SELECT usuario_id FROM public.inscricoes_atividades
         WHERE atividade_id=NEW.id AND status_inscricao IN ('PENDENTE','APROVADA')),
  'ATIVIDADE_CANCELADA','Atividade cancelada',
  format('A atividade "%s" foi cancelada pela gestão.',NEW.titulo),NEW.id);
 RETURN NEW;
END $$;

COMMIT;
