-- Prioridade 1. Não recria o schema inicial nem altera dados existentes.
-- Pré-requisitos: tabelas/colunas do database.types.ts e migrations anteriores.
-- Aplicar primeiro em homologação, como proprietário das tabelas (Supabase postgres).
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.usuarios') IS NULL OR to_regclass('public.voluntarios') IS NULL
     OR to_regclass('public.atividades') IS NULL OR to_regclass('public.inscricoes_atividades') IS NULL THEN
    RAISE EXCEPTION 'Schema inicial ausente. Conferir dependências em docs/VOLUNTARIADO.md.';
  END IF;
END $$;

CREATE SCHEMA voluntariado_privado;
REVOKE ALL ON SCHEMA voluntariado_privado FROM PUBLIC, anon, authenticated;

ALTER TABLE public.inscricoes_atividades
  ADD COLUMN decidido_em timestamptz,
  ADD COLUMN decidido_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD COLUMN motivo_decisao text,
  ADD COLUMN checkin_em timestamptz,
  ADD COLUMN carga_horaria_registrada numeric;

-- Uma credencial ativa por atividade. Não exposta pela Data API.
CREATE TABLE voluntariado_privado.tokens_checkin (
  atividade_id bigint PRIMARY KEY REFERENCES public.atividades(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL,
  expira_em timestamptz NOT NULL,
  criado_por uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT
);
ALTER TABLE voluntariado_privado.tokens_checkin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON voluntariado_privado.tokens_checkin FROM PUBLIC, anon, authenticated;

CREATE FUNCTION voluntariado_privado.gestao() RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND tipo_perfil = 'ONG');
$$;

CREATE FUNCTION voluntariado_privado.disponibilidade_valida(p_valor jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_valor IS NULL OR jsonb_typeof(p_valor) <> 'array' THEN RETURN false; END IF;
  RETURN NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_valor) s
    WHERE jsonb_typeof(s) <> 'object'
      OR coalesce(s->>'dia', '') NOT IN ('dom','seg','ter','qua','qui','sex','sab')
      OR coalesce(s->>'periodo', '') NOT IN ('manha','tarde','noite')
      OR (s - 'dia' - 'periodo') <> '{}'::jsonb
  ) AND (SELECT count(*) = count(DISTINCT (s->>'dia', s->>'periodo')) FROM jsonb_array_elements(p_valor) s);
END $$;

CREATE FUNCTION voluntariado_privado.elegivel(p_usuario uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u JOIN public.voluntarios v ON v.usuario_id = u.id
    WHERE u.id = p_usuario AND u.tipo_perfil = 'VOLUNTARIO'
      AND nullif(btrim(v.cpf), '') IS NOT NULL
      AND v.data_nascimento < current_date
      AND nullif(btrim(v.profissao), '') IS NOT NULL
      AND voluntariado_privado.disponibilidade_valida(v.disponibilidade_horarios)
      AND v.disponibilidade_horarios <> '[]'::jsonb
      AND EXISTS (SELECT 1 FROM public.usuario_habilidades h WHERE h.usuario_id = u.id)
  );
$$;

-- A API não pode promover usuários ou trocar sua identidade, mesmo se uma
-- política antiga de UPDATE de usuarios for permissiva. Provisionamento é administrativo.
CREATE FUNCTION voluntariado_privado.proteger_identidade() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.tipo_perfil IS DISTINCT FROM OLD.tipo_perfil) THEN
    RAISE EXCEPTION 'Não é permitido alterar a identidade ou o tipo de perfil pelo aplicativo.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_voluntariado_identidade BEFORE UPDATE ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION voluntariado_privado.proteger_identidade();

-- Defesa adicional às políticas históricas: writes apenas pelas RPCs abaixo.
-- RESTRICTIVE continua bloqueando mesmo se houver outra policy permissiva.
ALTER TABLE public.inscricoes_atividades ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.inscricoes_atividades FROM anon, authenticated;
CREATE POLICY "voluntariado: sem insercao direta" ON public.inscricoes_atividades
AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "voluntariado: sem alteracao direta" ON public.inscricoes_atividades
AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "voluntariado: sem exclusao direta" ON public.inscricoes_atividades
AS RESTRICTIVE FOR DELETE TO anon, authenticated USING (false);

CREATE FUNCTION public.voluntariado_elegibilidade() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT voluntariado_privado.elegivel(auth.uid());
$$;

CREATE FUNCTION public.voluntariado_salvar_perfil(p_dados jsonb, p_habilidades bigint[]) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_disponibilidade jsonb := p_dados->'disponibilidade_horarios';
BEGIN
  PERFORM 1 FROM public.usuarios WHERE id = v_uid AND tipo_perfil = 'VOLUNTARIO' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Perfil de voluntário não encontrado.'; END IF;
  IF NOT voluntariado_privado.disponibilidade_valida(v_disponibilidade) THEN
    RAISE EXCEPTION 'Disponibilidade inválida. Selecione dias e períodos válidos, sem repetição.';
  END IF;
  IF p_habilidades IS NULL OR EXISTS (
    SELECT 1 FROM unnest(p_habilidades) h WHERE h IS NULL OR NOT EXISTS (SELECT 1 FROM public.habilidades WHERE id = h)
  ) THEN RAISE EXCEPTION 'Uma das habilidades não está disponível. Recarregue o perfil.'; END IF;
  IF coalesce(length(btrim(p_dados->>'nome')), 0) NOT BETWEEN 2 AND 120
    OR length(coalesce(p_dados->>'descricao', '')) > 500
    OR (nullif(p_dados->>'telefone', '') IS NOT NULL AND p_dados->>'telefone' !~ '^[0-9]{10,11}$')
    OR (nullif(p_dados->>'cpf', '') IS NOT NULL AND p_dados->>'cpf' !~ '^[0-9]{11}$')
    OR (nullif(p_dados->>'perfil_instagram', '') IS NOT NULL AND p_dados->>'perfil_instagram' !~ '^[A-Za-z0-9._]{1,30}$') THEN
    RAISE EXCEPTION 'Dados do perfil inválidos.';
  END IF;
  IF nullif(p_dados->>'data_nascimento','')::date >= current_date THEN
    RAISE EXCEPTION 'A data de nascimento precisa ser no passado.';
  END IF;
  UPDATE public.usuarios SET nome = btrim(p_dados->>'nome'), telefone = nullif(p_dados->>'telefone',''),
    endereco = nullif(btrim(p_dados->>'endereco'),''), descricao = nullif(btrim(p_dados->>'descricao'),''),
    perfil_instagram = nullif(p_dados->>'perfil_instagram','') WHERE id = v_uid;
  UPDATE public.voluntarios SET cpf = nullif(p_dados->>'cpf',''),
    data_nascimento = nullif(p_dados->>'data_nascimento','')::date,
    profissao = nullif(btrim(p_dados->>'profissao'),''), disponibilidade_horarios = v_disponibilidade
    WHERE usuario_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cadastro complementar ausente. Solicite suporte à gestão.'; END IF;
  DELETE FROM public.usuario_habilidades WHERE usuario_id = v_uid;
  INSERT INTO public.usuario_habilidades(usuario_id, habilidade_id)
    SELECT v_uid, h FROM (SELECT DISTINCT unnest(p_habilidades) h) habilidades;
  RETURN voluntariado_privado.elegivel(v_uid);
END $$;

CREATE FUNCTION public.voluntariado_detalhe(p_atividade bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_atividade public.atividades; v_inscricao public.inscricoes_atividades; v_aprovados bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
  SELECT * INTO v_atividade FROM public.atividades WHERE id = p_atividade;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  SELECT * INTO v_inscricao FROM public.inscricoes_atividades WHERE atividade_id = p_atividade AND usuario_id = auth.uid();
  IF NOT voluntariado_privado.gestao() AND v_atividade.status <> 'ABERTA' AND v_inscricao.id IS NULL THEN
    RAISE EXCEPTION 'Atividade indisponível para este perfil.';
  END IF;
  SELECT count(*) INTO v_aprovados FROM public.inscricoes_atividades WHERE atividade_id = p_atividade AND status_inscricao = 'APROVADA';
  RETURN jsonb_build_object('atividade', to_jsonb(v_atividade), 'inscricao',
    CASE WHEN v_inscricao.id IS NULL THEN NULL ELSE to_jsonb(v_inscricao) END,
    'aprovados', v_aprovados, 'elegivel', voluntariado_privado.elegivel(auth.uid()),
    'agora', clock_timestamp());
END $$;

CREATE FUNCTION public.voluntariado_candidatar(p_atividade bigint) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_atividade public.atividades; v_id bigint;
BEGIN
  IF NOT voluntariado_privado.elegivel(auth.uid()) THEN RAISE EXCEPTION 'Complete seu perfil, habilidades e disponibilidade para se candidatar.'; END IF;
  SELECT * INTO v_atividade FROM public.atividades WHERE id = p_atividade FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  IF v_atividade.status <> 'ABERTA' OR v_atividade.data_hora_prevista <= clock_timestamp() THEN
    RAISE EXCEPTION 'O período de candidaturas desta atividade terminou.';
  END IF;
  IF v_atividade.autor_id = auth.uid() THEN RAISE EXCEPTION 'O autor não pode se candidatar à própria atividade.'; END IF;
  IF EXISTS (SELECT 1 FROM public.inscricoes_atividades WHERE atividade_id = p_atividade AND usuario_id = auth.uid()) THEN
    RAISE EXCEPTION 'Você já tem uma candidatura nesta atividade. Consulte seu status.';
  END IF;
  INSERT INTO public.inscricoes_atividades(atividade_id, usuario_id, status_inscricao, presenca_confirmada)
    VALUES(p_atividade, auth.uid(), 'PENDENTE', false) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE FUNCTION public.voluntariado_cancelar(p_inscricao bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_atividade public.atividades; v_inscricao public.inscricoes_atividades; v_atividade_id bigint;
BEGIN
  SELECT atividade_id INTO v_atividade_id FROM public.inscricoes_atividades WHERE id = p_inscricao AND usuario_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidatura não encontrada.'; END IF;
  SELECT * INTO v_atividade FROM public.atividades WHERE id = v_atividade_id FOR UPDATE;
  SELECT * INTO v_inscricao FROM public.inscricoes_atividades WHERE id = p_inscricao AND usuario_id = auth.uid() FOR UPDATE;
  IF v_inscricao.status_inscricao NOT IN ('PENDENTE','APROVADA') OR v_inscricao.presenca_confirmada
    OR v_atividade.status NOT IN ('ABERTA','ENCERRADA') OR v_atividade.data_hora_prevista <= clock_timestamp() THEN
    RAISE EXCEPTION 'Esta candidatura não pode mais ser cancelada.';
  END IF;
  UPDATE public.inscricoes_atividades SET status_inscricao = 'CANCELADA' WHERE id = p_inscricao;
END $$;

CREATE FUNCTION public.voluntariado_candidatos(p_atividade bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode consultar candidatos.'; END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.data_inscricao) FROM (
    SELECT i.*, u.nome, u.descricao, v.profissao, v.disponibilidade_horarios,
      ARRAY(SELECT h.nome_habilidade FROM public.usuario_habilidades uh JOIN public.habilidades h ON h.id = uh.habilidade_id
        WHERE uh.usuario_id = u.id ORDER BY h.nome_habilidade) AS habilidades
    FROM public.inscricoes_atividades i JOIN public.usuarios u ON u.id = i.usuario_id
      LEFT JOIN public.voluntarios v ON v.usuario_id = u.id WHERE i.atividade_id = p_atividade
  ) c), '[]'::jsonb);
END $$;

CREATE FUNCTION public.voluntariado_decidir(p_inscricao bigint, p_decisao text, p_motivo text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_atividade public.atividades; v_inscricao public.inscricoes_atividades; v_atividade_id bigint; v_total bigint;
BEGIN
  IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode decidir candidaturas.'; END IF;
  IF p_decisao IS NULL OR p_decisao NOT IN ('APROVADA','RECUSADA') THEN RAISE EXCEPTION 'Decisão inválida.'; END IF;
  SELECT atividade_id INTO v_atividade_id FROM public.inscricoes_atividades WHERE id = p_inscricao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidatura não encontrada.'; END IF;
  -- Todas as decisões/cancelamentos/check-ins usam a mesma ordem de locks.
  SELECT * INTO v_atividade FROM public.atividades WHERE id = v_atividade_id FOR UPDATE;
  SELECT * INTO v_inscricao FROM public.inscricoes_atividades WHERE id = p_inscricao FOR UPDATE;
  IF v_inscricao.usuario_id = auth.uid() THEN RAISE EXCEPTION 'Não é permitido decidir a própria candidatura.'; END IF;
  IF v_inscricao.status_inscricao <> 'PENDENTE' OR v_inscricao.presenca_confirmada THEN RAISE EXCEPTION 'Esta candidatura já foi decidida.'; END IF;
  IF v_atividade.status NOT IN ('ABERTA','ENCERRADA') OR v_atividade.data_hora_prevista <= clock_timestamp() THEN
    RAISE EXCEPTION 'O período de triagem desta atividade terminou.';
  END IF;
  IF p_decisao = 'APROVADA' THEN
    -- Além do lock, cria uma nova versão da linha. Em isolamento mais forte
    -- que READ COMMITTED, um concorrente com snapshot antigo aborta em vez
    -- de contar vagas em um snapshot defasado.
    UPDATE public.atividades SET atualizado_em = clock_timestamp() WHERE id = v_atividade_id;
    IF NOT voluntariado_privado.elegivel(v_inscricao.usuario_id) THEN RAISE EXCEPTION 'O candidato precisa completar o perfil antes da aprovação.'; END IF;
    SELECT count(*) INTO v_total FROM public.inscricoes_atividades WHERE atividade_id = v_atividade_id AND status_inscricao = 'APROVADA';
    IF v_total >= v_atividade.vagas_totais THEN RAISE EXCEPTION 'Todas as vagas já estão preenchidas.'; END IF;
  END IF;
  UPDATE public.inscricoes_atividades SET status_inscricao = p_decisao::public.status_inscricao,
    decidido_em = clock_timestamp(), decidido_por = auth.uid(), motivo_decisao = nullif(btrim(p_motivo),'') WHERE id = p_inscricao;
END $$;

-- Mantém a capacidade mesmo quando vagas são editadas pelo formulário existente;
-- preserva histórico, sem apagar nem converter inscrições antigas.
CREATE FUNCTION voluntariado_privado.proteger_atividade() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.inscricoes_atividades WHERE atividade_id = OLD.id) THEN
      RAISE EXCEPTION 'Atividade com candidaturas não pode ser excluída. Cancele a atividade para preservar o histórico.';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'Não é permitido alterar o identificador da atividade.'; END IF;
  IF NEW.vagas_totais < (SELECT count(*) FROM public.inscricoes_atividades WHERE atividade_id = OLD.id AND status_inscricao = 'APROVADA') THEN
    RAISE EXCEPTION 'O número de vagas não pode ser menor que o de participantes aprovados.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_voluntariado_atividade BEFORE UPDATE OR DELETE ON public.atividades
FOR EACH ROW EXECUTE FUNCTION voluntariado_privado.proteger_atividade();

CREATE FUNCTION public.voluntariado_status_atividade(p_atividade bigint, p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_atividade public.atividades;
BEGIN
  IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode alterar o status.'; END IF;
  SELECT * INTO v_atividade FROM public.atividades WHERE id = p_atividade FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  IF v_atividade.tipo <> 'TAREFA_ONG' OR v_atividade.status NOT IN ('ABERTA','ENCERRADA')
    OR p_status IS NULL OR p_status NOT IN ('ENCERRADA','CANCELADA','REALIZADA') OR p_status = v_atividade.status::text THEN
    RAISE EXCEPTION 'Transição de atividade inválida.';
  END IF;
  IF p_status = 'REALIZADA' AND clock_timestamp() < v_atividade.data_hora_prevista + v_atividade.carga_horaria * interval '1 hour' THEN
    RAISE EXCEPTION 'Aguarde o fim previsto da atividade para marcá-la como realizada.';
  END IF;
  UPDATE public.atividades SET status = p_status::public.status_atividade WHERE id = p_atividade;
  DELETE FROM voluntariado_privado.tokens_checkin WHERE atividade_id = p_atividade;
END $$;

CREATE FUNCTION public.voluntariado_gerar_checkin(p_atividade bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_atividade public.atividades; v_token text; v_expira timestamptz;
BEGIN
  IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode abrir o check-in.'; END IF;
  SELECT * INTO v_atividade FROM public.atividades WHERE id = p_atividade FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  IF v_atividade.status NOT IN ('ABERTA','ENCERRADA') OR clock_timestamp() < v_atividade.data_hora_prevista - interval '30 minutes'
    OR clock_timestamp() >= v_atividade.data_hora_prevista + v_atividade.carga_horaria * interval '1 hour' THEN
    RAISE EXCEPTION 'Check-in disponível de 30 minutos antes do início até o fim previsto da atividade.';
  END IF;
  v_token := gen_random_uuid()::text;
  v_expira := least(clock_timestamp() + interval '5 minutes', v_atividade.data_hora_prevista + v_atividade.carga_horaria * interval '1 hour');
  INSERT INTO voluntariado_privado.tokens_checkin(atividade_id, token_hash, expira_em, criado_por)
    VALUES(p_atividade, sha256(convert_to(v_token, 'UTF8')), v_expira, auth.uid())
    ON CONFLICT (atividade_id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expira_em = EXCLUDED.expira_em, criado_por = EXCLUDED.criado_por;
  RETURN jsonb_build_object('token', v_token, 'expira_em', v_expira, 'atividade_id', p_atividade);
END $$;

CREATE FUNCTION public.voluntariado_checkin(p_atividade bigint, p_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_atividade public.atividades; v_inscricao public.inscricoes_atividades;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND tipo_perfil = 'VOLUNTARIO') THEN
    RAISE EXCEPTION 'Entre com um perfil de voluntário para confirmar presença.';
  END IF;
  SELECT * INTO v_atividade FROM public.atividades WHERE id = p_atividade FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Atividade não encontrada.'; END IF;
  SELECT * INTO v_inscricao FROM public.inscricoes_atividades WHERE atividade_id = p_atividade AND usuario_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR v_inscricao.status_inscricao <> 'APROVADA' THEN RAISE EXCEPTION 'Somente participantes aprovados podem confirmar presença.'; END IF;
  IF v_inscricao.presenca_confirmada THEN RAISE EXCEPTION 'Sua presença já foi confirmada.'; END IF;
  IF v_atividade.status NOT IN ('ABERTA','ENCERRADA') OR clock_timestamp() < v_atividade.data_hora_prevista - interval '30 minutes'
    OR clock_timestamp() >= v_atividade.data_hora_prevista + v_atividade.carga_horaria * interval '1 hour' THEN
    RAISE EXCEPTION 'O check-in não está aberto para esta atividade.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM voluntariado_privado.tokens_checkin WHERE atividade_id = p_atividade
    AND token_hash = sha256(convert_to(p_token, 'UTF8')) AND expira_em > clock_timestamp()) THEN
    RAISE EXCEPTION 'QR Code inválido ou expirado. Solicite o código atual à gestão.';
  END IF;
  UPDATE public.inscricoes_atividades SET presenca_confirmada = true, checkin_em = clock_timestamp(),
    carga_horaria_registrada = v_atividade.carga_horaria WHERE id = v_inscricao.id;
END $$;

CREATE FUNCTION public.voluntariado_minhas_inscricoes() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta.'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('inscricao', to_jsonb(i), 'atividade', to_jsonb(a)) ORDER BY a.data_hora_prevista DESC)
    FROM public.inscricoes_atividades i JOIN public.atividades a ON a.id = i.atividade_id WHERE i.usuario_id = auth.uid()), '[]'::jsonb);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA voluntariado_privado FROM PUBLIC, anon, authenticated;
-- Nunca deixar as RPCs SECURITY DEFINER acessíveis anonimamente por default.
REVOKE ALL ON FUNCTION public.voluntariado_elegibilidade(), public.voluntariado_salvar_perfil(jsonb,bigint[]),
  public.voluntariado_detalhe(bigint), public.voluntariado_candidatar(bigint), public.voluntariado_cancelar(bigint),
  public.voluntariado_candidatos(bigint), public.voluntariado_decidir(bigint,text,text),
  public.voluntariado_status_atividade(bigint,text), public.voluntariado_gerar_checkin(bigint),
  public.voluntariado_checkin(bigint,text), public.voluntariado_minhas_inscricoes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voluntariado_elegibilidade(), public.voluntariado_salvar_perfil(jsonb,bigint[]),
  public.voluntariado_detalhe(bigint), public.voluntariado_candidatar(bigint), public.voluntariado_cancelar(bigint),
  public.voluntariado_candidatos(bigint), public.voluntariado_decidir(bigint,text,text),
  public.voluntariado_status_atividade(bigint,text), public.voluntariado_gerar_checkin(bigint),
  public.voluntariado_checkin(bigint,text), public.voluntariado_minhas_inscricoes() TO authenticated;

COMMIT;
