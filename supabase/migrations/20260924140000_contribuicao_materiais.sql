BEGIN;
-- Depende do schema inicial e da Prioridade 1. Nenhum dado legado é convertido.
CREATE TABLE public.solicitacoes_materiais (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 3 AND 120),
 descricao text NOT NULL CHECK (length(btrim(descricao)) BETWEEN 1 AND 4000),
 quantidade_necessaria integer NOT NULL CHECK (quantidade_necessaria BETWEEN 1 AND 1000000),
 quantidade_recebida integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA','EM_ANDAMENTO','CONCLUIDA','CANCELADA')),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 criado_por uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
 CHECK (quantidade_recebida BETWEEN 0 AND quantidade_necessaria),
 CHECK ((status = 'CONCLUIDA') = (quantidade_recebida = quantidade_necessaria))
);
CREATE TABLE public.contribuicoes_materiais (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 solicitacao_id bigint NOT NULL REFERENCES public.solicitacoes_materiais(id) ON DELETE RESTRICT,
 usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
 quantidade integer NOT NULL CHECK (quantidade BETWEEN 1 AND 1000000),
 status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','CONFIRMADA','CANCELADA')),
 criado_em timestamptz NOT NULL DEFAULT now(),
 decidido_em timestamptz,
 decidido_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
 observacao text,
 CHECK ((status = 'PENDENTE' AND decidido_em IS NULL AND decidido_por IS NULL)
   OR (status <> 'PENDENTE' AND decidido_em IS NOT NULL AND decidido_por IS NOT NULL))
);
CREATE UNIQUE INDEX materiais_uma_pendente ON public.contribuicoes_materiais(solicitacao_id,usuario_id) WHERE status='PENDENTE';
CREATE INDEX materiais_contrib_usuario ON public.contribuicoes_materiais(usuario_id,criado_em DESC);
CREATE INDEX materiais_contrib_solicitacao ON public.contribuicoes_materiais(solicitacao_id,criado_em);
CREATE INDEX materiais_solic_status ON public.solicitacoes_materiais(status,criado_em DESC);
ALTER TABLE public.solicitacoes_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribuicoes_materiais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.solicitacoes_materiais, public.contribuicoes_materiais FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.solicitacoes_materiais_id_seq, public.contribuicoes_materiais_id_seq FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.solicitacoes_materiais, public.contribuicoes_materiais TO authenticated;
CREATE POLICY materiais_contrib_leitura ON public.contribuicoes_materiais FOR SELECT TO authenticated USING (
 usuario_id=auth.uid() OR EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND tipo_perfil='ONG')
);
CREATE POLICY materiais_solic_leitura ON public.solicitacoes_materiais FOR SELECT TO authenticated USING (
 status IN ('ABERTA','EM_ANDAMENTO')
 OR EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND tipo_perfil='ONG')
 OR EXISTS(SELECT 1 FROM public.contribuicoes_materiais WHERE solicitacao_id=solicitacoes_materiais.id AND usuario_id=auth.uid())
);
-- Mesmo um grant/policy permissiva posterior não permite writes diretos.
CREATE POLICY materiais_solic_sem_write ON public.solicitacoes_materiais AS RESTRICTIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK(false);
CREATE POLICY materiais_contrib_sem_write ON public.contribuicoes_materiais AS RESTRICTIVE FOR ALL TO anon,authenticated USING (true) WITH CHECK(false);
CREATE POLICY materiais_solic_sem_delete ON public.solicitacoes_materiais AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(false);
CREATE POLICY materiais_contrib_sem_delete ON public.contribuicoes_materiais AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(false);

CREATE FUNCTION public.materiais_salvar(p_id bigint,p_nome text,p_descricao text,p_quantidade integer) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.solicitacoes_materiais; resultado bigint;
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode salvar solicitações.'; END IF;
 IF p_id IS NULL THEN
   INSERT INTO public.solicitacoes_materiais(nome,descricao,quantidade_necessaria,criado_por)
   VALUES(btrim(p_nome),btrim(p_descricao),p_quantidade,auth.uid()) RETURNING id INTO resultado;
 ELSE
   SELECT * INTO s FROM public.solicitacoes_materiais WHERE id=p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
   IF s.status NOT IN ('ABERTA','EM_ANDAMENTO') THEN RAISE EXCEPTION 'Solicitação finalizada não pode ser editada.'; END IF;
   IF p_quantidade <= s.quantidade_recebida THEN RAISE EXCEPTION 'A quantidade necessária deve ser maior que a recebida durante a edição.'; END IF;
   UPDATE public.solicitacoes_materiais SET nome=btrim(p_nome),descricao=btrim(p_descricao),
     quantidade_necessaria=p_quantidade,atualizado_em=clock_timestamp() WHERE id=p_id RETURNING id INTO resultado;
 END IF;
 RETURN resultado;
END $$;

CREATE FUNCTION public.materiais_contribuir(p_solicitacao bigint,p_quantidade integer) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.solicitacoes_materiais; resultado bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND tipo_perfil='VOLUNTARIO') THEN
   RAISE EXCEPTION 'Entre com um perfil de voluntário para contribuir.'; END IF;
 SELECT * INTO s FROM public.solicitacoes_materiais WHERE id=p_solicitacao FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
 IF s.status NOT IN ('ABERTA','EM_ANDAMENTO') THEN RAISE EXCEPTION 'Esta solicitação não recebe contribuições.'; END IF;
 IF p_quantidade IS NULL OR p_quantidade<1 OR p_quantidade>s.quantidade_necessaria-s.quantidade_recebida THEN
   RAISE EXCEPTION 'Informe uma quantidade positiva que não ultrapasse o restante.'; END IF;
 IF EXISTS(SELECT 1 FROM public.contribuicoes_materiais WHERE solicitacao_id=p_solicitacao AND usuario_id=auth.uid() AND status='PENDENTE') THEN
   RAISE EXCEPTION 'Você já possui uma contribuição pendente para este material.'; END IF;
 INSERT INTO public.contribuicoes_materiais(solicitacao_id,usuario_id,quantidade)
 VALUES(p_solicitacao,auth.uid(),p_quantidade) RETURNING id INTO resultado;
 RETURN resultado;
END $$;

CREATE FUNCTION public.materiais_decidir(p_contribuicao bigint,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.solicitacoes_materiais; c public.contribuicoes_materiais; sid bigint; gestao boolean:=voluntariado_privado.gestao();
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('CONFIRMADA','CANCELADA') THEN RAISE EXCEPTION 'Decisão inválida.'; END IF;
 SELECT solicitacao_id INTO sid FROM public.contribuicoes_materiais
 WHERE id=p_contribuicao AND (usuario_id=auth.uid() OR gestao);
 IF NOT FOUND THEN RAISE EXCEPTION 'Contribuição não encontrada.'; END IF;
 SELECT * INTO s FROM public.solicitacoes_materiais WHERE id=sid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
 SELECT * INTO c FROM public.contribuicoes_materiais WHERE id=p_contribuicao FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Contribuição não encontrada.'; END IF;
 IF c.status<>'PENDENTE' THEN RAISE EXCEPTION 'Esta contribuição já foi finalizada.'; END IF;
 IF p_status='CONFIRMADA' THEN
   IF NOT gestao OR c.usuario_id=auth.uid() THEN RAISE EXCEPTION 'Somente a gestão pode confirmar a entrega de outro usuário.'; END IF;
   IF s.status NOT IN ('ABERTA','EM_ANDAMENTO') THEN RAISE EXCEPTION 'Solicitação finalizada.'; END IF;
   IF c.quantidade>s.quantidade_necessaria-s.quantidade_recebida THEN
     RAISE EXCEPTION 'Quantidade maior que o restante. Cancele a intenção e solicite uma nova quantidade.'; END IF;
   -- Lock + UPDATE da mesma linha: concorrentes serializam ou falham com 40001.
   UPDATE public.solicitacoes_materiais SET quantidade_recebida=quantidade_recebida+c.quantidade,
     status=CASE WHEN quantidade_recebida+c.quantidade=quantidade_necessaria THEN 'CONCLUIDA' ELSE 'EM_ANDAMENTO' END,
     atualizado_em=clock_timestamp() WHERE id=sid;
 END IF;
 UPDATE public.contribuicoes_materiais SET status=p_status,decidido_por=auth.uid(),decidido_em=clock_timestamp(),
   observacao=CASE WHEN p_status='CONFIRMADA' THEN 'Entrega confirmada pela gestão.' ELSE 'Contribuição cancelada.' END WHERE id=p_contribuicao;
 IF EXISTS(SELECT 1 FROM public.solicitacoes_materiais WHERE id=sid AND status='CONCLUIDA') THEN
   UPDATE public.contribuicoes_materiais SET status='CANCELADA',decidido_por=auth.uid(),decidido_em=clock_timestamp(),
     observacao='Necessidade atendida antes da confirmação desta entrega.' WHERE solicitacao_id=sid AND status='PENDENTE';
 END IF;
END $$;

CREATE FUNCTION public.materiais_status(p_solicitacao bigint,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.solicitacoes_materiais;
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode atualizar a solicitação.'; END IF;
 SELECT * INTO s FROM public.solicitacoes_materiais WHERE id=p_solicitacao FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
 IF s.status NOT IN ('ABERTA','EM_ANDAMENTO') OR p_status IS NULL OR p_status NOT IN ('EM_ANDAMENTO','CANCELADA') OR s.status=p_status THEN
   RAISE EXCEPTION 'Transição de status inválida. A conclusão ocorre ao receber toda a quantidade.'; END IF;
 UPDATE public.solicitacoes_materiais SET status=p_status,atualizado_em=clock_timestamp() WHERE id=p_solicitacao;
 IF p_status='CANCELADA' THEN
   UPDATE public.contribuicoes_materiais SET status='CANCELADA',decidido_por=auth.uid(),decidido_em=clock_timestamp(),
     observacao='Solicitação cancelada pela gestão.' WHERE solicitacao_id=p_solicitacao AND status='PENDENTE';
 END IF;
END $$;

-- SECURITY INVOKER preserva as políticas de leitura inclusive nas consultas agregadas.
CREATE FUNCTION public.materiais_listar() RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.criado_em DESC,s.id DESC),'[]'::jsonb) FROM public.solicitacoes_materiais s;
$$;
-- Detalhe autoriza explicitamente e revela à gestão somente o nome do contribuinte.
CREATE FUNCTION public.materiais_detalhe(p_solicitacao bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.solicitacoes_materiais; gestao boolean:=voluntariado_privado.gestao();
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
 SELECT * INTO s FROM public.solicitacoes_materiais WHERE id=p_solicitacao;
 IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
 IF NOT gestao AND s.status NOT IN ('ABERTA','EM_ANDAMENTO')
   AND NOT EXISTS(SELECT 1 FROM public.contribuicoes_materiais WHERE solicitacao_id=s.id AND usuario_id=auth.uid()) THEN
   RAISE EXCEPTION 'Solicitação indisponível para sua conta.'; END IF;
 RETURN jsonb_build_object('solicitacao',to_jsonb(s),'contribuicoes',
   coalesce((SELECT jsonb_agg(to_jsonb(c) || jsonb_build_object('nome_usuario',u.nome) ORDER BY c.criado_em DESC,c.id DESC)
   FROM public.contribuicoes_materiais c JOIN public.usuarios u ON u.id=c.usuario_id
   WHERE c.solicitacao_id=s.id AND (gestao OR c.usuario_id=auth.uid())),'[]'::jsonb));
END $$;
CREATE FUNCTION public.materiais_minhas() RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('contribuicao',to_jsonb(c),'solicitacao',to_jsonb(s))
 ORDER BY c.criado_em DESC,c.id DESC),'[]'::jsonb)
 FROM public.contribuicoes_materiais c JOIN public.solicitacoes_materiais s ON s.id=c.solicitacao_id WHERE c.usuario_id=auth.uid();
$$;
REVOKE ALL ON FUNCTION public.materiais_salvar(bigint,text,text,integer),public.materiais_contribuir(bigint,integer),
 public.materiais_decidir(bigint,text),public.materiais_status(bigint,text),public.materiais_listar(),
 public.materiais_detalhe(bigint),public.materiais_minhas() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.materiais_salvar(bigint,text,text,integer),public.materiais_contribuir(bigint,integer),
 public.materiais_decidir(bigint,text),public.materiais_status(bigint,text),public.materiais_listar(),
 public.materiais_detalhe(bigint),public.materiais_minhas() TO authenticated;
COMMIT;
