-- B29: notificações dentro do app. Gatilhos nas tabelas de voluntariado e contribuições
-- gravam uma linha por destinatário em public.notificacoes; o app lê as próprias linhas
-- (RLS) e recebe as novas em tempo real pelo Supabase Realtime. Quem age não é notificado
-- do que ele mesmo fez. "Gestão" inclui quem está em modo voluntário (tabela
-- voluntariado_privado.gestores, quando existir).
-- Eventos: candidatura nova/cancelada e presença confirmada e contribuição nova (gestão);
-- candidatura aprovada/recusada, atividade cancelada e contribuição conferida (voluntário).
-- Aplicar sobre o remoto já reconciliado, depois da reconciliação 02. Não usar db push
-- sobre o histórico.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regclass('public.usuarios') IS NULL OR to_regclass('public.atividades') IS NULL
  OR to_regclass('public.inscricoes_atividades') IS NULL OR to_regclass('public.contribuicoes') IS NULL
  OR to_regclass('public.metas_demandas') IS NULL OR to_regnamespace('voluntariado_privado') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: tabelas do voluntariado ou contribuições (reconciliação 02) ausentes.'; END IF;
 IF to_regclass('public.notificacoes') IS NOT NULL THEN
  RAISE EXCEPTION 'Pré-condição: notificações já instaladas; não reaplicar.'; END IF;
END $preflight$;

CREATE TABLE public.notificacoes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
 tipo text NOT NULL CHECK (tipo IN (
  'CANDIDATURA_NOVA','CANDIDATURA_CANCELADA','PRESENCA_CONFIRMADA','CONTRIBUICAO_NOVA',
  'CANDIDATURA_APROVADA','CANDIDATURA_RECUSADA','ATIVIDADE_CANCELADA',
  'CONTRIBUICAO_APROVADA','CONTRIBUICAO_RECUSADA')),
 titulo text NOT NULL,
 corpo text NOT NULL,
 atividade_id bigint REFERENCES public.atividades(id) ON DELETE SET NULL,
 meta_id bigint REFERENCES public.metas_demandas(id) ON DELETE SET NULL,
 lida_em timestamptz,
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notificacoes_usuario_idx ON public.notificacoes(usuario_id, criado_em DESC);
CREATE INDEX notificacoes_nao_lidas_idx ON public.notificacoes(usuario_id) WHERE lida_em IS NULL;

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notificacoes FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.notificacoes TO authenticated;
CREATE POLICY notificacoes_leitura_propria ON public.notificacoes FOR SELECT TO authenticated
 USING (usuario_id = (SELECT auth.uid()));

-- Realtime só existe no Supabase; fora dele (testes locais) a publicação não existe.
DO $realtime$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
 END IF;
END $realtime$;

-- Marcar como lida é a única escrita do app, e só nas próprias linhas.
CREATE FUNCTION public.notificacoes_marcar_lida(p_id bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501'; END IF;
 UPDATE public.notificacoes SET lida_em=now() WHERE id=p_id AND usuario_id=auth.uid() AND lida_em IS NULL;
END $$;
CREATE FUNCTION public.notificacoes_marcar_todas_lidas() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501'; END IF;
 UPDATE public.notificacoes SET lida_em=now() WHERE usuario_id=auth.uid() AND lida_em IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.notificacoes_marcar_lida(bigint), public.notificacoes_marcar_todas_lidas()
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notificacoes_marcar_lida(bigint), public.notificacoes_marcar_todas_lidas()
 TO authenticated;

-- Quem faz parte da gestão: perfil ONG e, se o modo gestor estiver instalado, quem alterna.
CREATE FUNCTION voluntariado_privado.destinatarios_gestao() RETURNS SETOF uuid
LANGUAGE plpgsql STABLE SET search_path='' AS $$
BEGIN
 RETURN QUERY SELECT id FROM public.usuarios WHERE tipo_perfil='ONG';
 IF to_regclass('voluntariado_privado.gestores') IS NOT NULL THEN
  RETURN QUERY EXECUTE 'SELECT usuario_id FROM voluntariado_privado.gestores';
 END IF;
END $$;

-- Grava uma notificação por destinatário, sem repetir e sem avisar quem executou a ação.
CREATE FUNCTION voluntariado_privado.notificar(
 p_destinatarios uuid[], p_tipo text, p_titulo text, p_corpo text,
 p_atividade bigint DEFAULT NULL, p_meta bigint DEFAULT NULL) RETURNS void
LANGUAGE sql SET search_path='' AS $$
 INSERT INTO public.notificacoes(usuario_id,tipo,titulo,corpo,atividade_id,meta_id)
 SELECT DISTINCT d, p_tipo, p_titulo, p_corpo, p_atividade, p_meta
   FROM unnest(p_destinatarios) AS d
  WHERE d IS NOT NULL AND d IS DISTINCT FROM auth.uid();
$$;
REVOKE ALL ON FUNCTION voluntariado_privado.destinatarios_gestao(),
 voluntariado_privado.notificar(uuid[],text,text,text,bigint,bigint)
 FROM PUBLIC, anon, authenticated, service_role;

-- Inscrições: candidatura nova, decisão, cancelamento e presença.
CREATE FUNCTION voluntariado_privado.notificar_inscricao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_titulo text; v_nome text; v_gestao uuid[];
BEGIN
 SELECT titulo INTO v_titulo FROM public.atividades WHERE id=NEW.atividade_id;
 SELECT nome INTO v_nome FROM public.usuarios WHERE id=NEW.usuario_id;
 v_titulo:=coalesce(v_titulo,'atividade'); v_nome:=coalesce(v_nome,'Um voluntário');
 SELECT array_agg(g) INTO v_gestao FROM voluntariado_privado.destinatarios_gestao() AS g;

 IF TG_OP='INSERT' THEN
  PERFORM voluntariado_privado.notificar(v_gestao,'CANDIDATURA_NOVA','Nova candidatura',
   format('%s se candidatou a "%s".',v_nome,v_titulo),NEW.atividade_id);
  RETURN NEW;
 END IF;

 IF OLD.status_inscricao IS DISTINCT FROM NEW.status_inscricao THEN
  IF NEW.status_inscricao='APROVADA' THEN
   PERFORM voluntariado_privado.notificar(ARRAY[NEW.usuario_id],'CANDIDATURA_APROVADA','Candidatura aprovada',
    format('Sua candidatura a "%s" foi aprovada.',v_titulo),NEW.atividade_id);
  ELSIF NEW.status_inscricao='RECUSADA' THEN
   PERFORM voluntariado_privado.notificar(ARRAY[NEW.usuario_id],'CANDIDATURA_RECUSADA','Candidatura recusada',
    format('Sua candidatura a "%s" foi recusada.%s',v_titulo,
     CASE WHEN nullif(btrim(NEW.motivo_decisao),'') IS NOT NULL THEN ' Motivo: '||btrim(NEW.motivo_decisao) ELSE '' END),
    NEW.atividade_id);
  ELSIF NEW.status_inscricao='CANCELADA' AND OLD.status_inscricao IN ('PENDENTE','APROVADA') THEN
   PERFORM voluntariado_privado.notificar(v_gestao,'CANDIDATURA_CANCELADA','Candidatura cancelada',
    format('%s cancelou a candidatura em "%s".',v_nome,v_titulo),NEW.atividade_id);
  END IF;
 END IF;

 IF NOT OLD.presenca_confirmada AND NEW.presenca_confirmada THEN
  PERFORM voluntariado_privado.notificar(v_gestao,'PRESENCA_CONFIRMADA','Presença confirmada',
   format('%s confirmou presença em "%s".',v_nome,v_titulo),NEW.atividade_id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION voluntariado_privado.notificar_inscricao() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER trg_notificar_inscricao_nova AFTER INSERT ON public.inscricoes_atividades
 FOR EACH ROW EXECUTE FUNCTION voluntariado_privado.notificar_inscricao();
CREATE TRIGGER trg_notificar_inscricao_mudou AFTER UPDATE ON public.inscricoes_atividades
 FOR EACH ROW WHEN (OLD.status_inscricao IS DISTINCT FROM NEW.status_inscricao
  OR OLD.presenca_confirmada IS DISTINCT FROM NEW.presenca_confirmada)
 EXECUTE FUNCTION voluntariado_privado.notificar_inscricao();

-- Atividade cancelada: avisa quem estava aprovado.
CREATE FUNCTION voluntariado_privado.notificar_atividade_cancelada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM voluntariado_privado.notificar(
  ARRAY(SELECT usuario_id FROM public.inscricoes_atividades
         WHERE atividade_id=NEW.id AND status_inscricao='APROVADA'),
  'ATIVIDADE_CANCELADA','Atividade cancelada',
  format('A atividade "%s" foi cancelada pela gestão.',NEW.titulo),NEW.id);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION voluntariado_privado.notificar_atividade_cancelada() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER trg_notificar_atividade_cancelada AFTER UPDATE OF status ON public.atividades
 FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status='CANCELADA')
 EXECUTE FUNCTION voluntariado_privado.notificar_atividade_cancelada();

-- Contribuições: nova (gestão) e conferida (voluntário).
CREATE FUNCTION voluntariado_privado.notificar_contribuicao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_meta text; v_nome text;
BEGIN
 SELECT titulo INTO v_meta FROM public.metas_demandas WHERE id=NEW.meta_id;
 v_meta:=coalesce(v_meta,'meta');
 IF TG_OP='INSERT' THEN
  SELECT nome INTO v_nome FROM public.usuarios WHERE id=NEW.usuario_id;
  PERFORM voluntariado_privado.notificar(
   ARRAY(SELECT voluntariado_privado.destinatarios_gestao()),'CONTRIBUICAO_NOVA','Nova contribuição',
   format('%s enviou uma contribuição para "%s".',coalesce(v_nome,'Um voluntário'),v_meta),NULL,NEW.meta_id);
  RETURN NEW;
 END IF;
 IF NEW.status_validacao='APROVADA' THEN
  PERFORM voluntariado_privado.notificar(ARRAY[NEW.usuario_id],'CONTRIBUICAO_APROVADA','Contribuição aprovada',
   format('Sua contribuição para "%s" foi aprovada. Obrigado!',v_meta),NULL,NEW.meta_id);
 ELSIF NEW.status_validacao='RECUSADA' THEN
  PERFORM voluntariado_privado.notificar(ARRAY[NEW.usuario_id],'CONTRIBUICAO_RECUSADA','Contribuição recusada',
   format('Sua contribuição para "%s" foi recusada.%s',v_meta,
    CASE WHEN nullif(btrim(NEW.observacao_validacao),'') IS NOT NULL THEN ' Motivo: '||btrim(NEW.observacao_validacao) ELSE '' END),
   NULL,NEW.meta_id);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION voluntariado_privado.notificar_contribuicao() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER trg_notificar_contribuicao_nova AFTER INSERT ON public.contribuicoes
 FOR EACH ROW EXECUTE FUNCTION voluntariado_privado.notificar_contribuicao();
CREATE TRIGGER trg_notificar_contribuicao_conferida AFTER UPDATE OF status_validacao ON public.contribuicoes
 FOR EACH ROW WHEN (OLD.status_validacao IS DISTINCT FROM NEW.status_validacao
  AND NEW.status_validacao IN ('APROVADA','RECUSADA'))
 EXECUTE FUNCTION voluntariado_privado.notificar_contribuicao();

COMMIT;
