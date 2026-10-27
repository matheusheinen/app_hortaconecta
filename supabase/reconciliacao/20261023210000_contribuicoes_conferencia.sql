-- B23: conferência manual de contribuições. A policy de UPDATE deixa a gestão
-- alterar qualquer coluna de qualquer contribuição; este gatilho fecha o fluxo:
--   * só contribuição PENDENTE pode ser conferida (decisão tomada não se desfaz,
--     o que também impede mexer no total arrecadado por fora da fila);
--   * a conferência não troca meta, doador, valor, comprovante nem data de envio;
--   * recusar exige o motivo, que o voluntário lê em "Minhas contribuições".
-- Depende do trigger de total arrecadado (20261023200000). Não usar db push.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.contribuicoes_conferencia() RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $$
begin
  if old.status_validacao <> 'PENDENTE' then
    raise exception 'Esta contribuição já foi conferida e não pode ser alterada.'
      using errcode = 'check_violation';
  end if;

  if new.meta_id is distinct from old.meta_id
     or new.usuario_id is distinct from old.usuario_id
     or new.quantidade_oferecida is distinct from old.quantidade_oferecida
     or new.url_comprovante is distinct from old.url_comprovante
     or new.data_envio is distinct from old.data_envio then
    raise exception 'A conferência só registra a decisão; os dados enviados não mudam.'
      using errcode = 'check_violation';
  end if;

  if new.status_validacao = 'RECUSADA'
     and length(btrim(coalesce(new.observacao_validacao, ''))) < 3 then
    raise exception 'Informe o motivo da recusa.' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.contribuicoes_conferencia() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_contribuicoes_conferencia ON public.contribuicoes;
CREATE TRIGGER trg_contribuicoes_conferencia
  BEFORE UPDATE ON public.contribuicoes
  FOR EACH ROW EXECUTE FUNCTION public.contribuicoes_conferencia();

COMMIT;
