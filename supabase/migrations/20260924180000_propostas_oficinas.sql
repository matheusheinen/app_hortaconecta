BEGIN;
-- Propostas independentes do calendário e das inscrições em atividades.
CREATE TABLE public.propostas_oficinas (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 autor_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
 titulo text NOT NULL CHECK(length(btrim(titulo)) BETWEEN 3 AND 120),
 descricao text NOT NULL CHECK(length(btrim(descricao)) BETWEEN 1 AND 5000),
 tema text NOT NULL CHECK(length(btrim(tema)) BETWEEN 1 AND 120),
 objetivo text NOT NULL CHECK(length(btrim(objetivo)) BETWEEN 1 AND 2000),
 duracao_minutos integer NOT NULL CHECK(duracao_minutos BETWEEN 1 AND 1440),
 conhecimentos text CHECK(conhecimentos IS NULL OR length(conhecimentos)<=2000),
 observacoes text CHECK(observacoes IS NULL OR length(observacoes)<=2000),
 status text NOT NULL DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE','APROVADA','REJEITADA','CANCELADA')),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 revisao integer NOT NULL DEFAULT 1 CHECK(revisao>0),
 decidido_em timestamptz,
 decidido_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
 observacao_decisao text CHECK(observacao_decisao IS NULL OR length(observacao_decisao)<=2000),
 cancelado_em timestamptz,
 CHECK (
  (status='PENDENTE' AND decidido_em IS NULL AND decidido_por IS NULL AND observacao_decisao IS NULL AND cancelado_em IS NULL)
  OR (status IN ('APROVADA','REJEITADA') AND decidido_em IS NOT NULL AND decidido_por IS NOT NULL AND decidido_por<>autor_id AND cancelado_em IS NULL)
  OR (status='CANCELADA' AND cancelado_em IS NOT NULL AND decidido_em IS NULL AND decidido_por IS NULL AND observacao_decisao IS NULL)
 ),
 CHECK(status<>'REJEITADA' OR coalesce(length(btrim(observacao_decisao)),0)>0)
);
CREATE INDEX oficinas_autor_data ON public.propostas_oficinas(autor_id,criado_em DESC,id DESC);
CREATE INDEX oficinas_status_data ON public.propostas_oficinas(status,criado_em DESC,id DESC);
ALTER TABLE public.propostas_oficinas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.propostas_oficinas FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.propostas_oficinas_id_seq FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.propostas_oficinas TO authenticated;
CREATE POLICY oficinas_leitura ON public.propostas_oficinas FOR SELECT TO authenticated
 USING(autor_id=auth.uid() OR EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND tipo_perfil='ONG'));
CREATE POLICY oficinas_leitura_limite ON public.propostas_oficinas AS RESTRICTIVE FOR SELECT TO authenticated
 USING(autor_id=auth.uid() OR EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND tipo_perfil='ONG'));
CREATE POLICY oficinas_sem_anon ON public.propostas_oficinas AS RESTRICTIVE FOR SELECT TO anon USING(false);
CREATE POLICY oficinas_sem_insert ON public.propostas_oficinas AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(false);
CREATE POLICY oficinas_sem_update ON public.propostas_oficinas AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(false) WITH CHECK(false);
CREATE POLICY oficinas_sem_delete ON public.propostas_oficinas AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(false);

CREATE FUNCTION public.oficinas_salvar(p_id bigint,p_revisao integer,p_titulo text,p_descricao text,p_tema text,
 p_objetivo text,p_duracao integer,p_conhecimentos text DEFAULT NULL,p_observacoes text DEFAULT NULL)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE proposta public.propostas_oficinas; resultado bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND tipo_perfil='VOLUNTARIO') THEN
  RAISE EXCEPTION 'Entre com um perfil de voluntário para propor oficinas.'; END IF;
 IF p_id IS NULL THEN
  IF NOT voluntariado_privado.elegivel(auth.uid()) THEN RAISE EXCEPTION 'Complete seu perfil, habilidades e disponibilidade antes de enviar uma proposta.'; END IF;
  INSERT INTO public.propostas_oficinas(autor_id,titulo,descricao,tema,objetivo,duracao_minutos,conhecimentos,observacoes)
  VALUES(auth.uid(),btrim(p_titulo),btrim(p_descricao),btrim(p_tema),btrim(p_objetivo),p_duracao,
    nullif(btrim(p_conhecimentos),''),nullif(btrim(p_observacoes),'')) RETURNING id INTO resultado;
 ELSE
  SELECT * INTO proposta FROM public.propostas_oficinas WHERE id=p_id AND autor_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada.'; END IF;
  IF proposta.status<>'PENDENTE' THEN RAISE EXCEPTION 'Somente propostas pendentes podem ser editadas.'; END IF;
  IF p_revisao IS DISTINCT FROM proposta.revisao THEN RAISE EXCEPTION 'A proposta foi atualizada. Recarregue antes de continuar.'; END IF;
  UPDATE public.propostas_oficinas SET titulo=btrim(p_titulo),descricao=btrim(p_descricao),tema=btrim(p_tema),
    objetivo=btrim(p_objetivo),duracao_minutos=p_duracao,conhecimentos=nullif(btrim(p_conhecimentos),''),
    observacoes=nullif(btrim(p_observacoes),''),revisao=revisao+1,atualizado_em=clock_timestamp()
    WHERE id=p_id RETURNING id INTO resultado;
 END IF;
 RETURN resultado;
END $$;

CREATE FUNCTION public.oficinas_cancelar(p_id bigint,p_revisao integer) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE proposta public.propostas_oficinas;
BEGIN
 SELECT * INTO proposta FROM public.propostas_oficinas WHERE id=p_id AND autor_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada.'; END IF;
 IF proposta.status<>'PENDENTE' THEN RAISE EXCEPTION 'Somente propostas pendentes podem ser canceladas.'; END IF;
 IF p_revisao IS DISTINCT FROM proposta.revisao THEN RAISE EXCEPTION 'A proposta foi atualizada. Recarregue antes de continuar.'; END IF;
 UPDATE public.propostas_oficinas SET status='CANCELADA',cancelado_em=clock_timestamp(),
   atualizado_em=clock_timestamp(),revisao=revisao+1 WHERE id=p_id;
END $$;

CREATE FUNCTION public.oficinas_decidir(p_id bigint,p_revisao integer,p_status text,p_observacao text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE proposta public.propostas_oficinas; nota text:=nullif(btrim(p_observacao),'');
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode analisar propostas.'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('APROVADA','REJEITADA') THEN RAISE EXCEPTION 'Decisão inválida.'; END IF;
 IF p_status='REJEITADA' AND nota IS NULL THEN RAISE EXCEPTION 'Informe a justificativa da rejeição.'; END IF;
 IF length(nota)>2000 THEN RAISE EXCEPTION 'A observação pode ter até 2.000 caracteres.'; END IF;
 SELECT * INTO proposta FROM public.propostas_oficinas WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada.'; END IF;
 IF proposta.autor_id=auth.uid() THEN RAISE EXCEPTION 'Não é permitido decidir a própria proposta.'; END IF;
 IF proposta.status<>'PENDENTE' THEN RAISE EXCEPTION 'Esta proposta já foi finalizada.'; END IF;
 IF p_revisao IS DISTINCT FROM proposta.revisao THEN RAISE EXCEPTION 'A proposta foi atualizada. Releia o conteúdo antes de decidir.'; END IF;
 UPDATE public.propostas_oficinas SET status=p_status,decidido_em=clock_timestamp(),decidido_por=auth.uid(),
   observacao_decisao=nota,atualizado_em=clock_timestamp(),revisao=revisao+1 WHERE id=p_id;
END $$;

CREATE FUNCTION public.oficinas_listar() RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.criado_em DESC,p.id DESC),'[]'::jsonb) FROM public.propostas_oficinas p;
$$;
-- Retorna nome do autor sem liberar acesso aos demais dados pessoais.
CREATE FUNCTION public.oficinas_detalhe(p_id bigint) RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE proposta public.propostas_oficinas; nome text;
BEGIN
 SELECT * INTO proposta FROM public.propostas_oficinas
 WHERE id=p_id AND (autor_id=auth.uid() OR voluntariado_privado.gestao());
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposta não encontrada ou indisponível para sua conta.'; END IF;
 SELECT u.nome INTO nome FROM public.usuarios u WHERE u.id=proposta.autor_id;
 RETURN to_jsonb(proposta)||jsonb_build_object('nome_autor',nome);
END $$;
REVOKE ALL ON FUNCTION public.oficinas_salvar(bigint,integer,text,text,text,text,integer,text,text),
 public.oficinas_cancelar(bigint,integer),public.oficinas_decidir(bigint,integer,text,text),
 public.oficinas_listar(),public.oficinas_detalhe(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.oficinas_salvar(bigint,integer,text,text,text,text,integer,text,text),
 public.oficinas_cancelar(bigint,integer),public.oficinas_decidir(bigint,integer,text,text),
 public.oficinas_listar(),public.oficinas_detalhe(bigint) TO authenticated;
COMMIT;
