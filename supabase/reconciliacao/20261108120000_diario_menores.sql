-- B26 (RF0013): imagens com crianças e adolescentes no Diário.
-- Regra definida pela equipe em 07/11/2026: ao publicar uma imagem, a gestão
-- informa se ela mostra crianças ou adolescentes; nesse caso, só pode salvar se
-- declarar que tem a autorização dos responsáveis (ECA, art. 17; LGPD, art. 14).
-- Sem autorização, a imagem não é salva. Publicação sem imagem não guarda a marcação.
--
-- A RPC antiga de 6 parâmetros deixa de ser chamável pelo app: a nova, de 8,
-- valida a regra, reaproveita a antiga (checagem de gestão e de revisão) e grava
-- as duas colunas. Aplicar sobre o remoto já reconciliado, depois da
-- reconciliação 02. Não usar db push sobre o histórico.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regprocedure('public.diario_salvar_revisao(bigint,text,text,text,text,integer)') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: diario_salvar_revisao (reconciliação 02) ausente.'; END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'diario_transparencia'
    AND column_name = 'imagem_com_menores') THEN
  RAISE EXCEPTION 'Pré-condição: imagem_com_menores já existe; não reaplicar.'; END IF;
END $preflight$;

ALTER TABLE public.diario_transparencia
 ADD COLUMN imagem_com_menores boolean NOT NULL DEFAULT false,
 ADD COLUMN autorizacao_responsaveis boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT diario_menores_com_autorizacao
  CHECK (NOT imagem_com_menores OR autorizacao_responsaveis);

COMMENT ON COLUMN public.diario_transparencia.imagem_com_menores IS
 'B26: a imagem mostra crianças ou adolescentes (informado pela gestão).';
COMMENT ON COLUMN public.diario_transparencia.autorizacao_responsaveis IS
 'B26: a gestão declarou ter a autorização dos responsáveis para a imagem.';

CREATE FUNCTION public.diario_salvar_revisao(
 p_id bigint, p_titulo text, p_texto text, p_status text, p_imagem text, p_revisao integer,
 p_imagem_com_menores boolean, p_autorizacao_responsaveis boolean
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 menores boolean := p_imagem IS NOT NULL AND coalesce(p_imagem_com_menores, false);
 autorizada boolean := menores AND coalesce(p_autorizacao_responsaveis, false);
 salvo bigint;
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode publicar.'; END IF;
 IF menores AND NOT autorizada THEN
  RAISE EXCEPTION 'Imagem com crianças ou adolescentes só pode ser publicada com a autorização dos responsáveis.';
 END IF;
 salvo := public.diario_salvar_revisao(p_id, p_titulo, p_texto, p_status, p_imagem, p_revisao);
 -- Só atualiza quando muda, para não somar outra revisão à toa.
 UPDATE public.diario_transparencia
    SET imagem_com_menores = menores, autorizacao_responsaveis = autorizada
  WHERE id = salvo
    AND (imagem_com_menores, autorizacao_responsaveis) IS DISTINCT FROM (menores, autorizada);
 RETURN salvo;
END $$;

REVOKE ALL ON FUNCTION public.diario_salvar_revisao(bigint,text,text,text,text,integer)
 FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.diario_salvar_revisao(bigint,text,text,text,text,integer,boolean,boolean)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.diario_salvar_revisao(bigint,text,text,text,text,integer,boolean,boolean)
 TO authenticated;
COMMIT;
