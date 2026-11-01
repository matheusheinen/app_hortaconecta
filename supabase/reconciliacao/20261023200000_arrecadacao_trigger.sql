-- B24: total arrecadado recalculado pelo banco. quantidade_arrecadada é a soma
-- das contribuições APROVADA da meta, recalculada em INSERT, UPDATE e DELETE.
-- O remoto já tem essa versão (origem: 20260928010000_gestao_lanca_contribuicao,
-- aplicada fora do repositório); esta migration a versiona e é idempotente.
-- Não usar db push.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.atualizar_arrecadacao_meta() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
begin
  -- Recalcula a meta de destino e, se a contribuição mudou de meta, a de origem.
  update public.metas_demandas m
     set quantidade_arrecadada = (
           select coalesce(sum(c.quantidade_oferecida), 0)
             from public.contribuicoes c
            where c.meta_id = m.id
              and c.status_validacao = 'APROVADA'
         )
   where m.id in (coalesce(new.meta_id, old.meta_id), old.meta_id);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.atualizar_arrecadacao_meta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_contribuicoes_arrecadacao ON public.contribuicoes;
CREATE TRIGGER trg_contribuicoes_arrecadacao
  AFTER INSERT OR UPDATE OR DELETE ON public.contribuicoes
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_arrecadacao_meta();

-- Corrige totais que tenham divergido da soma das aprovadas.
UPDATE public.metas_demandas m
   SET quantidade_arrecadada = (
         SELECT coalesce(sum(c.quantidade_oferecida), 0)
           FROM public.contribuicoes c
          WHERE c.meta_id = m.id AND c.status_validacao = 'APROVADA')
 WHERE quantidade_arrecadada IS DISTINCT FROM (
         SELECT coalesce(sum(c.quantidade_oferecida), 0)
           FROM public.contribuicoes c
          WHERE c.meta_id = m.id AND c.status_validacao = 'APROVADA');

COMMIT;
