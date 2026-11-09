-- RF0013 e RNF0005: feed do Diário paginado. A RPC devolve uma página de
-- publicações, da mais nova para a mais antiga, a partir de um cursor
-- (data_publicacao e id da última publicação já carregada). Assim o app não
-- baixa o Diário inteiro a cada abertura.
--
-- Mesmas regras de leitura de diario_listar: a função roda com os direitos de
-- quem chama, então a RLS (diario_visibilidade) continua decidindo o que cada
-- perfil vê. O índice diario_status_data, da reconciliação 02, atende a ordem.
-- diario_listar é mantida, porque o resumo do Início ainda a usa.
-- Aplicar sobre o remoto já reconciliado, depois da reconciliação 02. Não usar
-- db push sobre o histórico.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regprocedure('public.diario_listar()') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: diario_listar (reconciliação 02) ausente.'; END IF;
 IF to_regprocedure('public.diario_listar_pagina(timestamptz,bigint,integer)') IS NOT NULL THEN
  RAISE EXCEPTION 'Pré-condição: diario_listar_pagina já existe; não reaplicar.'; END IF;
END $preflight$;

CREATE FUNCTION public.diario_listar_pagina(
 p_antes_data timestamptz DEFAULT NULL,
 p_antes_id bigint DEFAULT NULL,
 p_limite integer DEFAULT 20
) RETURNS jsonb LANGUAGE sql STABLE SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.data_publicacao DESC, d.id DESC), '[]'::jsonb)
 FROM (
  SELECT * FROM public.diario_transparencia t
   WHERE p_antes_data IS NULL
      OR (t.data_publicacao, t.id) < (p_antes_data, coalesce(p_antes_id, 9223372036854775807))
   ORDER BY t.data_publicacao DESC, t.id DESC
   LIMIT least(greatest(coalesce(p_limite, 20), 1), 50)
 ) d;
$$;

REVOKE ALL ON FUNCTION public.diario_listar_pagina(timestamptz,bigint,integer)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.diario_listar_pagina(timestamptz,bigint,integer) TO authenticated;
COMMIT;
