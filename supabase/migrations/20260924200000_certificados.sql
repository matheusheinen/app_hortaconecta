BEGIN;
-- Snapshot de emissão: não mede horas efetivamente realizadas.
CREATE TABLE public.certificados (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 participacao_id bigint NOT NULL UNIQUE REFERENCES public.inscricoes_atividades(id) ON DELETE RESTRICT,
 usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
 emitido_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 nome_voluntario text NOT NULL CHECK(length(btrim(nome_voluntario))>0),
 instituicao text NOT NULL CHECK(length(btrim(instituicao))>0),
 atividade text NOT NULL CHECK(length(btrim(atividade))>0),
 data_atividade timestamptz NOT NULL,
 carga_horaria_prevista numeric NOT NULL CHECK(carga_horaria_prevista>0 AND carga_horaria_prevista<'Infinity'::numeric)
);
CREATE INDEX certificados_usuario_data ON public.certificados(usuario_id,emitido_em DESC);
ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.certificados FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.certificados TO authenticated;
CREATE POLICY certificados_leitura ON public.certificados FOR SELECT TO authenticated
 USING(usuario_id=auth.uid() OR EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND tipo_perfil='ONG'));
CREATE POLICY certificados_limite ON public.certificados AS RESTRICTIVE FOR SELECT TO authenticated
 USING(usuario_id=auth.uid() OR EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND tipo_perfil='ONG'));
CREATE POLICY certificados_sem_anon ON public.certificados AS RESTRICTIVE FOR SELECT TO anon USING(false);
CREATE POLICY certificados_sem_insert ON public.certificados AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(false);
CREATE POLICY certificados_sem_update ON public.certificados AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(false) WITH CHECK(false);
CREATE POLICY certificados_sem_delete ON public.certificados AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(false);

CREATE FUNCTION public.certificados_emitir(p_participacao bigint) RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.inscricoes_atividades; a public.atividades; identificador uuid; nome text; instituicao_nome text; quantidade bigint;
BEGIN
 -- Ordem de locks igual ao fluxo de voluntariado: atividade antes de inscrição.
 SELECT at.* INTO a FROM public.atividades at JOIN public.inscricoes_atividades ins ON ins.atividade_id=at.id
 WHERE ins.id=p_participacao AND ins.usuario_id=auth.uid() FOR UPDATE OF at;
 IF NOT FOUND THEN RAISE EXCEPTION 'Participação indisponível para sua conta.'; END IF;
 SELECT * INTO i FROM public.inscricoes_atividades WHERE id=p_participacao AND usuario_id=auth.uid() FOR UPDATE;
 SELECT id INTO identificador FROM public.certificados WHERE participacao_id=i.id;
 IF identificador IS NOT NULL THEN RETURN identificador; END IF;
 IF i.status_inscricao<>'APROVADA' OR NOT i.presenca_confirmada OR i.checkin_em IS NULL
   OR i.checkin_em>clock_timestamp() OR i.carga_horaria_registrada IS NULL
   OR i.carga_horaria_registrada<=0 OR i.carga_horaria_registrada>='Infinity'::numeric
   OR a.status NOT IN ('ABERTA','ENCERRADA','REALIZADA') OR a.data_hora_prevista>clock_timestamp() THEN
  RAISE EXCEPTION 'Certificado indisponível: é necessária aprovação, check-in confirmado e carga horária prevista registrada.';
 END IF;
 SELECT u.nome INTO nome FROM public.usuarios u WHERE u.id=i.usuario_id;
 SELECT count(*),min(nome_completo) INTO quantidade,instituicao_nome FROM public.configuracao_instituicao;
 IF quantidade<>1 OR coalesce(length(btrim(instituicao_nome)),0)=0 THEN
  RAISE EXCEPTION 'A gestão precisa conferir o nome e o registro único da instituição antes da emissão.';
 END IF;
 IF coalesce(length(btrim(nome)),0)=0 OR coalesce(length(btrim(a.titulo)),0)=0 THEN
  RAISE EXCEPTION 'Nome do voluntário ou título da atividade indisponível.';
 END IF;
 INSERT INTO public.certificados(participacao_id,usuario_id,nome_voluntario,instituicao,atividade,data_atividade,carga_horaria_prevista)
 VALUES(i.id,i.usuario_id,nome,instituicao_nome,a.titulo,a.data_hora_prevista,i.carga_horaria_registrada)
 RETURNING id INTO identificador;
 RETURN identificador;
END $$;

CREATE FUNCTION public.certificados_listar() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
 'emitidos',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.emitido_em DESC,c.id) FROM public.certificados c
 WHERE c.usuario_id=auth.uid() OR voluntariado_privado.gestao()),'[]'::jsonb),
 'disponiveis',coalesce((SELECT jsonb_agg(jsonb_build_object('participacao_id',i.id,'atividade',a.titulo,
 'data_atividade',a.data_hora_prevista,'carga_horaria_prevista',i.carga_horaria_registrada) ORDER BY a.data_hora_prevista DESC)
 FROM public.inscricoes_atividades i JOIN public.atividades a ON a.id=i.atividade_id
 WHERE i.usuario_id=auth.uid() AND i.status_inscricao='APROVADA' AND i.presenca_confirmada
 AND i.checkin_em IS NOT NULL AND i.checkin_em<=now() AND i.carga_horaria_registrada>0 AND i.carga_horaria_registrada<'Infinity'::numeric
 AND a.status IN ('ABERTA','ENCERRADA','REALIZADA') AND a.data_hora_prevista<=now()
 AND NOT EXISTS(SELECT 1 FROM public.certificados c WHERE c.participacao_id=i.id)),'[]'::jsonb));
$$;
CREATE FUNCTION public.certificados_detalhe(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE resultado jsonb;
BEGIN
 SELECT to_jsonb(c) INTO resultado FROM public.certificados c WHERE c.id=p_id AND (c.usuario_id=auth.uid() OR voluntariado_privado.gestao());
 IF resultado IS NULL THEN RAISE EXCEPTION 'Certificado não encontrado ou indisponível para sua conta.'; END IF;
 RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public.certificados_emitir(bigint),public.certificados_listar(),public.certificados_detalhe(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.certificados_emitir(bigint),public.certificados_listar(),public.certificados_detalhe(uuid) TO authenticated;
COMMIT;
