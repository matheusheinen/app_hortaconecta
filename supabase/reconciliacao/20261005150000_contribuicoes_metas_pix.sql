-- Contribuições voltam ao modelo de metas (decisão da equipe de 05/10/2026).
-- metas_demandas (FINANCEIRA | MATERIAL) e contribuicoes já existiam e estão em
-- uso no remoto; as tabelas de materiais criadas pela reconciliação 02
-- duplicavam esse papel e são removidas, com dados e funções.
-- A chave PIX passa para configuracao_instituicao: voluntários não leem `ongs`
-- (policy ongs_privacidade_mvp) e precisam ver a chave para doar.
-- Aplicar sobre o remoto já reconciliado, depois da reconciliação 02. Não usar
-- db push sobre o histórico.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regclass('public.metas_demandas') IS NULL OR to_regclass('public.contribuicoes') IS NULL
  OR to_regclass('public.configuracao_instituicao') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: metas_demandas, contribuicoes e configuracao_instituicao precisam existir.'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND table_name='configuracao_instituicao' AND column_name IN ('chave_pix','nome_beneficiario_pix')) THEN
  RAISE EXCEPTION 'Pré-condição: PIX já está em configuracao_instituicao; não reaplicar.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND table_name='contribuicoes' AND column_name='url_comprovante' AND is_nullable='YES') THEN
  RAISE EXCEPTION 'Pré-condição: comprovante opcional (migration gestao_lanca_contribuicao) ausente.'; END IF;
END $preflight$;

-- PIX público da instituição. ongs.chave_pix fica como legado, sem uso no app.
ALTER TABLE public.configuracao_instituicao
 ADD COLUMN chave_pix text CHECK (chave_pix IS NULL OR length(btrim(chave_pix)) BETWEEN 1 AND 140),
 ADD COLUMN nome_beneficiario_pix text CHECK (nome_beneficiario_pix IS NULL OR length(btrim(nome_beneficiario_pix)) BETWEEN 2 AND 120);

-- Copia somente quando há exatamente uma chave cadastrada pela gestão; com
-- mais de uma, a gestão escolhe pelo app, sem palpite da migration.
UPDATE public.configuracao_instituicao c SET
 chave_pix = o.chave_pix, nome_beneficiario_pix = nullif(btrim(o.nome_beneficiario_pix),'')
FROM (SELECT btrim(chave_pix) AS chave_pix, nome_beneficiario_pix FROM public.ongs
      WHERE nullif(btrim(chave_pix),'') IS NOT NULL) o
WHERE (SELECT count(*) FROM public.ongs WHERE nullif(btrim(chave_pix),'') IS NOT NULL) = 1;

-- Voluntário só declara contribuição em meta aberta. A gestão pode registrar
-- uma doação recebida depois do encerramento.
CREATE POLICY contribuicoes_meta_aberta ON public.contribuicoes AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (public.e_ong() OR EXISTS(SELECT 1 FROM public.metas_demandas m WHERE m.id = meta_id AND m.status = 'ABERTA'));

-- Remove o fluxo paralelo de materiais (decisão: excluir mesmo com dados).
DROP FUNCTION IF EXISTS public.materiais_salvar(bigint,text,text,integer),
 public.materiais_contribuir(bigint,integer), public.materiais_decidir(bigint,text),
 public.materiais_status(bigint,text), public.materiais_listar(),
 public.materiais_detalhe(bigint), public.materiais_minhas();
-- A leitura de solicitações consulta contribuicoes_materiais; sem CASCADE,
-- para que qualquer outra dependência inesperada interrompa a migration.
DROP POLICY IF EXISTS materiais_solic_leitura ON public.solicitacoes_materiais;
DROP TABLE IF EXISTS public.contribuicoes_materiais;
DROP TABLE IF EXISTS public.solicitacoes_materiais;
COMMIT;
