-- Reconciliação 02: catálogo remoto auditado em 30/09/2026 + reconciliação 01.
-- Arquivo criado pelo Supabase CLI e mantido fora do runner histórico porque
-- o remoto já possui o schema-base e não pode receber as migrations antigas.
-- Incorpora os cinco fluxos MVP sem recriar perfis/endereço nem converter legado.
-- Contador passa a contar APROVADA; PENDENTE é fila de triagem sem ocupar vaga.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
DECLARE item record;
BEGIN
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Pré-condição: executar como postgres.'; END IF;
 IF to_regprocedure('public.voluntariado_salvar_perfil(jsonb,bigint[])') IS NULL
 OR to_regprocedure('public.gestao_salvar_perfil(jsonb)') IS NULL
 OR to_regprocedure('voluntariado_privado.elegivel(uuid)') IS NULL
 THEN RAISE EXCEPTION 'Aplicar reconciliação 01 de perfis/endereço antes dos fluxos MVP.'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='endereco')
 THEN RAISE EXCEPTION 'Modelo de endereço diverge do remoto auditado.'; END IF;
 IF to_regprocedure('public.atualizar_vagas_ocupadas()') IS NULL
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.atualizar_vagas_ocupadas()'::regprocedure)<>'2110915cffc49e7234f0ede16d9cef42'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.validar_transicao_inscricao()'::regprocedure)<>'af7cc98efbb3a1482e00ac37dab7c800'
 THEN RAISE EXCEPTION 'Contador ou validação de inscrição diverge do catálogo auditado.'; END IF;
 FOR item IN SELECT * FROM (VALUES
 ('atividades','id','int8'),('atividades','titulo','text'),('atividades','descricao','text'),
 ('atividades','tipo','tipo_atividade'),('atividades','autor_id','uuid'),
 ('atividades','data_hora_prevista','timestamptz'),('atividades','vagas_totais','int4'),
 ('atividades','vagas_ocupadas','int4'),('atividades','carga_horaria','numeric'),
 ('atividades','status','status_atividade'),('atividades','atualizado_em','timestamptz'),
 ('inscricoes_atividades','id','int8'),('inscricoes_atividades','atividade_id','int8'),
 ('inscricoes_atividades','usuario_id','uuid'),('inscricoes_atividades','data_inscricao','timestamptz'),
 ('inscricoes_atividades','status_inscricao','status_inscricao'),('inscricoes_atividades','presenca_confirmada','bool'),
 ('diario_transparencia','id','int8'),('diario_transparencia','titulo','text'),
 ('diario_transparencia','descricao_curta','text'),('diario_transparencia','url_imagem','text'),
 ('diario_transparencia','atividade_id','int8'),('diario_transparencia','data_publicacao','timestamptz'),
 ('diario_transparencia','autor_id','uuid'),('configuracao_instituicao','nome_completo','text')
 ) AS expected(t,c,typ) LOOP
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=item.t AND column_name=item.c AND udt_name=item.typ)
 THEN RAISE EXCEPTION 'Pré-condição: coluna incompatível %.%',item.t,item.c; END IF;
 END LOOP;
 FOR item IN SELECT unnest(ARRAY['atividades','inscricoes_atividades','diario_transparencia','configuracao_instituicao']) AS t LOOP
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.'||item.t) AND relkind='r' AND pg_get_userbyid(relowner)='postgres' AND relrowsecurity)
 THEN RAISE EXCEPTION 'Pré-condição: tabela, proprietário ou RLS divergente: %',item.t; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgenabled='O'
 AND pg_get_triggerdef(oid)='CREATE TRIGGER trg_inscricoes_vagas AFTER INSERT OR DELETE OR UPDATE ON public.inscricoes_atividades FOR EACH ROW EXECUTE FUNCTION atualizar_vagas_ocupadas()')
 THEN RAISE EXCEPTION 'Trigger de vagas diverge do catálogo auditado.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.atividades'::regclass
 AND conname='atividades_vagas_ocupadas_check' AND convalidated
 AND pg_get_constraintdef(oid)='CHECK (((vagas_ocupadas >= 0) AND (vagas_ocupadas <= vagas_totais)))')
 THEN RAISE EXCEPTION 'Constraint de capacidade diverge do catálogo auditado.'; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.inscricoes_atividades'::regclass
 AND conname='inscricoes_atividades_unica' AND NOT convalidated)
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.inscricoes_atividades'::regclass
 AND conname='inscricoes_atividades_unica' AND pg_get_constraintdef(oid)='UNIQUE (atividade_id, usuario_id)')
 THEN RAISE EXCEPTION 'Unicidade de candidaturas diverge do catálogo auditado.'; END IF;
 IF to_regclass('public.solicitacoes_materiais') IS NOT NULL OR to_regclass('public.propostas_oficinas') IS NOT NULL
 OR to_regclass('public.certificados') IS NOT NULL OR to_regclass('voluntariado_privado.tokens_checkin') IS NOT NULL
 OR to_regprocedure('public.voluntariado_candidatar(bigint)') IS NOT NULL
 THEN RAISE EXCEPTION 'Objetos MVP já existem. Revisar histórico em vez de reaplicar.'; END IF;
END $preflight$;

-- Atividade antes de inscrição, mesma ordem usada pelas RPCs. A troca da regra e
-- o recálculo não deixam janela com dois contratos de capacidade.
LOCK TABLE public.atividades,public.inscricoes_atividades IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.atividades a WHERE
 (SELECT count(*) FROM public.inscricoes_atividades i WHERE i.atividade_id=a.id AND i.status_inscricao='APROVADA')>a.vagas_totais)
 THEN RAISE EXCEPTION 'Existem atividades com aprovações acima da capacidade. Revisar antes de aplicar.'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.atualizar_vagas_ocupadas() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Também mantém ambos os contadores coerentes em manutenção administrativa.
 PERFORM a.id FROM public.atividades a
 WHERE a.id IN (NEW.atividade_id,OLD.atividade_id) ORDER BY a.id FOR UPDATE;
 UPDATE public.atividades a SET vagas_ocupadas=(
 SELECT count(*) FROM public.inscricoes_atividades i
 WHERE i.atividade_id=a.id AND i.status_inscricao='APROVADA')
 WHERE a.id IN (NEW.atividade_id,OLD.atividade_id);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
UPDATE public.atividades a SET vagas_ocupadas=(
 SELECT count(*) FROM public.inscricoes_atividades i
 WHERE i.atividade_id=a.id AND i.status_inscricao='APROVADA')
WHERE a.vagas_ocupadas IS DISTINCT FROM (
 SELECT count(*) FROM public.inscricoes_atividades i
 WHERE i.atividade_id=a.id AND i.status_inscricao='APROVADA');

-- RLS não se aplica a TRUNCATE. Sem privilégios administrativos no app.
REVOKE TRUNCATE,REFERENCES,TRIGGER ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
CREATE POLICY usuarios_privacidade_mvp ON public.usuarios AS RESTRICTIVE FOR SELECT TO authenticated
 USING(id=(SELECT auth.uid()) OR (SELECT public.e_ong()));
CREATE POLICY ongs_privacidade_mvp ON public.ongs AS RESTRICTIVE FOR SELECT TO authenticated
 USING(usuario_id=(SELECT auth.uid()) OR (SELECT public.e_ong()));

-- Contrato derivado de 20260923120000_fluxo_voluntariado.sql; histórico original preservado.
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
REVOKE ALL ON voluntariado_privado.tokens_checkin FROM PUBLIC, anon, authenticated, service_role;




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

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA voluntariado_privado FROM PUBLIC, anon, authenticated, service_role;
-- Nunca deixar as RPCs SECURITY DEFINER acessíveis anonimamente por default.
REVOKE ALL ON FUNCTION public.voluntariado_elegibilidade(), public.voluntariado_salvar_perfil(jsonb,bigint[]),
  public.voluntariado_detalhe(bigint), public.voluntariado_candidatar(bigint), public.voluntariado_cancelar(bigint),
  public.voluntariado_candidatos(bigint), public.voluntariado_decidir(bigint,text,text),
  public.voluntariado_status_atividade(bigint,text), public.voluntariado_gerar_checkin(bigint),
  public.voluntariado_checkin(bigint,text), public.voluntariado_minhas_inscricoes() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.voluntariado_elegibilidade(), public.voluntariado_salvar_perfil(jsonb,bigint[]),
  public.voluntariado_detalhe(bigint), public.voluntariado_candidatar(bigint), public.voluntariado_cancelar(bigint),
  public.voluntariado_candidatos(bigint), public.voluntariado_decidir(bigint,text,text),
  public.voluntariado_status_atividade(bigint,text), public.voluntariado_gerar_checkin(bigint),
  public.voluntariado_checkin(bigint,text), public.voluntariado_minhas_inscricoes() TO authenticated;

-- Contrato derivado de 20260924120000_valida_seguranca_voluntariado.sql; histórico original preservado.
-- A policy histórica também permitia ao autor voluntário ler inscrições alheias.
-- Restritiva: continua limitando a leitura mesmo com policies permissivas legadas.
CREATE POLICY "voluntariado: leitura propria ou gestao"
ON public.inscricoes_atividades AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  usuario_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = (SELECT auth.uid()) AND u.tipo_perfil = 'ONG'
  )
);

CREATE POLICY "voluntariado: sem leitura anonima"
ON public.inscricoes_atividades AS RESTRICTIVE FOR SELECT TO anon
USING (false);

-- RLS não protege TRUNCATE. Não manter grants administrativos nos papéis do app.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON public.inscricoes_atividades FROM PUBLIC, anon, authenticated, service_role;

-- Contrato derivado de 20260924140000_contribuicao_materiais.sql; histórico original preservado.
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
REVOKE ALL ON public.solicitacoes_materiais, public.contribuicoes_materiais FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE public.solicitacoes_materiais_id_seq, public.contribuicoes_materiais_id_seq FROM PUBLIC,anon,authenticated,service_role;
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
 public.materiais_detalhe(bigint),public.materiais_minhas() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.materiais_salvar(bigint,text,text,integer),public.materiais_contribuir(bigint,integer),
 public.materiais_decidir(bigint,text),public.materiais_status(bigint,text),public.materiais_listar(),
 public.materiais_detalhe(bigint),public.materiais_minhas() TO authenticated;

-- Contrato derivado de 20260924160000_diario_transparencia.sql; histórico original preservado.
-- Reutiliza o Diário existente. Storage deve ser provisionado pelo Supabase.
DO $$ BEGIN
 IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
  RAISE EXCEPTION 'Supabase Storage ausente. Conferir docs/DIARIO.md antes de aplicar.';
 END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) THEN
  RAISE EXCEPTION 'RLS do Storage desabilitado. Conferir a configuração do Supabase antes de aplicar.';
 END IF;
END $$;
ALTER TABLE public.diario_transparencia
 ADD COLUMN texto text,
 ADD COLUMN status text NOT NULL DEFAULT 'PUBLICADA' CHECK(status IN ('PUBLICADA','OCULTA')),
 ADD COLUMN imagem_caminho text,
 ADD COLUMN atualizado_em timestamptz NOT NULL DEFAULT now(),
 ADD CONSTRAINT diario_texto_limite CHECK(texto IS NULL OR length(btrim(texto)) BETWEEN 1 AND 20000),
 ADD CONSTRAINT diario_imagem_caminho CHECK(imagem_caminho IS NULL OR imagem_caminho ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
CREATE INDEX diario_status_data ON public.diario_transparencia(status,data_publicacao DESC,id DESC);
CREATE UNIQUE INDEX diario_imagem_unica ON public.diario_transparencia(imagem_caminho) WHERE imagem_caminho IS NOT NULL;
ALTER TABLE public.diario_transparencia ENABLE ROW LEVEL SECURITY;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON public.diario_transparencia FROM PUBLIC,anon,authenticated,service_role;
REVOKE SELECT ON public.diario_transparencia FROM PUBLIC,anon;
GRANT SELECT ON public.diario_transparencia TO authenticated;
CREATE POLICY diario_visibilidade ON public.diario_transparencia AS RESTRICTIVE FOR SELECT TO authenticated
 USING(status='PUBLICADA' OR EXISTS(SELECT 1 FROM public.usuarios WHERE id=auth.uid() AND tipo_perfil='ONG'));
CREATE POLICY diario_sem_anon ON public.diario_transparencia AS RESTRICTIVE FOR SELECT TO anon USING(false);
CREATE POLICY diario_sem_insert ON public.diario_transparencia AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK(false);
CREATE POLICY diario_sem_update ON public.diario_transparencia AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING(false) WITH CHECK(false);
CREATE POLICY diario_sem_delete ON public.diario_transparencia AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(false);

-- Não reconfigura silenciosamente um bucket remoto que tenha outro propósito.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('diario-imagens','diario-imagens',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
 ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='diario-imagens' AND name='diario-imagens' AND public=false
   AND file_size_limit=5242880 AND allowed_mime_types @> ARRAY['image/jpeg','image/png','image/webp']
   AND allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp']) THEN
  RAISE EXCEPTION 'Bucket diario-imagens existente tem configuração diferente. Conferir antes de aplicar.';
 END IF;
END $$;

CREATE FUNCTION public.diario_gestao() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT voluntariado_privado.gestao(); $$;
CREATE FUNCTION public.diario_imagem_visivel(p_caminho text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (voluntariado_privado.gestao() OR EXISTS(
 SELECT 1 FROM public.diario_transparencia WHERE imagem_caminho=p_caminho AND status='PUBLICADA'));
$$;
CREATE FUNCTION public.diario_imagem_livre(p_caminho text) RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT voluntariado_privado.gestao() AND NOT EXISTS(SELECT 1 FROM public.diario_transparencia WHERE imagem_caminho=p_caminho);
$$;
CREATE POLICY diario_storage_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='diario-imagens' AND public.diario_imagem_visivel(name));
CREATE POLICY diario_storage_read_limite ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'diario-imagens' OR public.diario_imagem_visivel(name));
CREATE POLICY diario_storage_anon ON storage.objects AS RESTRICTIVE FOR ALL TO anon
 USING(bucket_id<>'diario-imagens') WITH CHECK(bucket_id<>'diario-imagens');
CREATE POLICY diario_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='diario-imagens' AND public.diario_gestao() AND split_part(name,'/',1)=auth.uid()::text
 AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');
CREATE POLICY diario_storage_insert_limite ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'diario-imagens' OR (public.diario_gestao() AND split_part(name,'/',1)=auth.uid()::text
 AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'));
-- Imagens são imutáveis: substituir significa enviar outro arquivo, sem upsert.
CREATE POLICY diario_storage_sem_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
 USING(bucket_id<>'diario-imagens') WITH CHECK(bucket_id<>'diario-imagens');
CREATE POLICY diario_storage_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='diario-imagens' AND public.diario_imagem_livre(name));
CREATE POLICY diario_storage_delete_limite ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'diario-imagens' OR public.diario_imagem_livre(name));

CREATE FUNCTION public.diario_caminho(p_ext text) RETURNS text
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode enviar imagens.'; END IF;
 IF p_ext IS NULL OR p_ext NOT IN ('jpg','png','webp') THEN RAISE EXCEPTION 'Formato de imagem não permitido.'; END IF;
 RETURN auth.uid()::text || '/' || gen_random_uuid()::text || '.' || p_ext;
END $$;
CREATE FUNCTION public.diario_salvar(p_id bigint,p_titulo text,p_texto text,p_status text,p_imagem text) RETURNS bigint
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.diario_transparencia; resultado bigint;
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode publicar.'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('PUBLICADA','OCULTA') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
 IF p_titulo IS NULL OR length(btrim(p_titulo)) NOT BETWEEN 3 AND 120
 OR p_texto IS NULL OR length(btrim(p_texto)) NOT BETWEEN 1 AND 20000 THEN RAISE EXCEPTION 'Informe título de 3 a 120 caracteres e texto de 1 a 20.000 caracteres.'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO d FROM public.diario_transparencia WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Publicação não encontrada.'; END IF;
 END IF;
 IF p_imagem IS NOT NULL THEN
  IF (p_id IS NULL OR p_imagem IS DISTINCT FROM d.imagem_caminho) AND split_part(p_imagem,'/',1)<>auth.uid()::text THEN
    RAISE EXCEPTION 'A imagem deve ter sido enviada pela sua conta.'; END IF;
  PERFORM 1 FROM storage.objects WHERE bucket_id='diario-imagens' AND name=p_imagem FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Imagem não encontrada no Storage. Envie novamente.'; END IF;
 END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.diario_transparencia(titulo,texto,descricao_curta,status,imagem_caminho,autor_id)
  VALUES(btrim(p_titulo),btrim(p_texto),left(btrim(p_texto),280),p_status,p_imagem,auth.uid()) RETURNING id INTO resultado;
 ELSE
  UPDATE public.diario_transparencia SET titulo=btrim(p_titulo),texto=btrim(p_texto),descricao_curta=left(btrim(p_texto),280),
   status=p_status,imagem_caminho=p_imagem,atualizado_em=clock_timestamp()
   WHERE id=p_id RETURNING id INTO resultado;
 END IF;
 RETURN resultado;
END $$;
CREATE FUNCTION public.diario_status(p_id bigint,p_status text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode alterar a publicação.'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('PUBLICADA','OCULTA') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
 UPDATE public.diario_transparencia SET status=p_status,atualizado_em=clock_timestamp() WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Publicação não encontrada.'; END IF;
END $$;
CREATE FUNCTION public.diario_listar() RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.data_publicacao DESC,d.id DESC),'[]'::jsonb)
 FROM public.diario_transparencia d;
$$;
CREATE FUNCTION public.diario_detalhe(p_id bigint) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT to_jsonb(d) FROM public.diario_transparencia d WHERE id=p_id;
$$;
REVOKE ALL ON FUNCTION public.diario_gestao(),public.diario_imagem_visivel(text),public.diario_imagem_livre(text),
 public.diario_caminho(text),public.diario_salvar(bigint,text,text,text,text),public.diario_status(bigint,text),
 public.diario_listar(),public.diario_detalhe(bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.diario_gestao(),public.diario_imagem_visivel(text),public.diario_imagem_livre(text),
 public.diario_caminho(text),public.diario_salvar(bigint,text,text,text,text),public.diario_status(bigint,text),
 public.diario_listar(),public.diario_detalhe(bigint) TO authenticated;

-- Contrato derivado de 20260924180000_propostas_oficinas.sql; histórico original preservado.
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
REVOKE ALL ON public.propostas_oficinas FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE public.propostas_oficinas_id_seq FROM PUBLIC,anon,authenticated,service_role;
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
 public.oficinas_listar(),public.oficinas_detalhe(bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.oficinas_salvar(bigint,integer,text,text,text,text,integer,text,text),
 public.oficinas_cancelar(bigint,integer),public.oficinas_decidir(bigint,integer,text,text),
 public.oficinas_listar(),public.oficinas_detalhe(bigint) TO authenticated;

-- Contrato derivado de 20260924200000_certificados.sql; histórico original preservado.
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
REVOKE ALL ON public.certificados FROM PUBLIC,anon,authenticated,service_role;
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
REVOKE ALL ON FUNCTION public.certificados_emitir(bigint),public.certificados_listar(),public.certificados_detalhe(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.certificados_emitir(bigint),public.certificados_listar(),public.certificados_detalhe(uuid) TO authenticated;

-- Contrato derivado de 20260924210000_coerencia_mvp.sql; histórico original preservado.
ALTER TABLE public.diario_transparencia ADD COLUMN revisao integer NOT NULL DEFAULT 1 CHECK(revisao>0);
CREATE FUNCTION voluntariado_privado.diario_revisao() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.revisao:=OLD.revisao+1; RETURN NEW; END $$;
CREATE TRIGGER trg_diario_revisao BEFORE UPDATE ON public.diario_transparencia FOR EACH ROW EXECUTE FUNCTION voluntariado_privado.diario_revisao();
-- RPCs antigas ficam inacessíveis ao cliente, mas são reutilizadas pelas wrappers validadas.
REVOKE ALL ON FUNCTION public.diario_salvar(bigint,text,text,text,text),public.diario_status(bigint,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.diario_salvar_revisao(p_id bigint,p_titulo text,p_texto text,p_status text,p_imagem text,p_revisao integer) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE atual integer;
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode publicar.'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT revisao INTO atual FROM public.diario_transparencia WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Publicação não encontrada.'; END IF;
  IF p_revisao IS DISTINCT FROM atual THEN RAISE EXCEPTION 'Esta publicação foi alterada por outra operação. Recarregue os dados antes de salvar.'; END IF;
 END IF;
 RETURN public.diario_salvar(p_id,p_titulo,p_texto,p_status,p_imagem);
END $$;
CREATE FUNCTION public.diario_status_revisao(p_id bigint,p_status text,p_revisao integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE atual integer;
BEGIN
 IF NOT voluntariado_privado.gestao() THEN RAISE EXCEPTION 'Somente a gestão pode alterar a publicação.'; END IF;
 SELECT revisao INTO atual FROM public.diario_transparencia WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Publicação não encontrada.'; END IF;
 IF p_revisao IS DISTINCT FROM atual THEN RAISE EXCEPTION 'Esta publicação foi alterada por outra operação. Recarregue os dados antes de continuar.'; END IF;
 PERFORM public.diario_status(p_id,p_status);
END $$;
CREATE FUNCTION voluntariado_privado.atividade_historico() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.inscricoes_atividades WHERE atividade_id=OLD.id)
 AND (NEW.titulo IS DISTINCT FROM OLD.titulo OR NEW.data_hora_prevista IS DISTINCT FROM OLD.data_hora_prevista
 OR NEW.carga_horaria IS DISTINCT FROM OLD.carga_horaria OR NEW.tipo IS DISTINCT FROM OLD.tipo OR NEW.autor_id IS DISTINCT FROM OLD.autor_id) THEN
  RAISE EXCEPTION 'Atividade com candidaturas: título, data, horário, carga horária, tipo e autoria são históricos e não podem ser alterados.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_atividade_historico BEFORE UPDATE ON public.atividades FOR EACH ROW EXECUTE FUNCTION voluntariado_privado.atividade_historico();

REVOKE ALL ON FUNCTION public.diario_salvar_revisao(bigint,text,text,text,text,integer),public.diario_status_revisao(bigint,text,integer),public.gestao_salvar_perfil(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.diario_salvar_revisao(bigint,text,text,text,text,integer),public.diario_status_revisao(bigint,text,integer),public.gestao_salvar_perfil(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION voluntariado_privado.diario_revisao(),voluntariado_privado.atividade_historico() FROM PUBLIC,anon,authenticated,service_role;

-- O papel do cliente não pode alterar contador/estado para contornar a RPC.
-- SECURITY INVOKER preserva current_user; funções RPC/contador rodam como postgres.
CREATE FUNCTION voluntariado_privado.atividade_fluxo_rpc() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF current_user IN ('authenticated','anon') THEN
  IF TG_OP='INSERT' AND NEW.vagas_ocupadas<>0 THEN
   RAISE EXCEPTION 'O contador de vagas é mantido automaticamente.';
  ELSIF TG_OP='UPDATE' THEN
   IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Altere o status da atividade pela operação de gestão.';
   END IF;
   IF NEW.vagas_ocupadas IS DISTINCT FROM OLD.vagas_ocupadas THEN
    RAISE EXCEPTION 'O contador de vagas é mantido automaticamente.';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_atividade_fluxo_rpc BEFORE INSERT OR UPDATE ON public.atividades
FOR EACH ROW EXECUTE FUNCTION voluntariado_privado.atividade_fluxo_rpc();
CREATE FUNCTION voluntariado_privado.inscricao_identidade() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.atividade_id IS DISTINCT FROM OLD.atividade_id
 OR NEW.usuario_id IS DISTINCT FROM OLD.usuario_id THEN
  RAISE EXCEPTION 'Identidade e vínculos da candidatura não podem ser alterados.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_inscricao_identidade BEFORE UPDATE ON public.inscricoes_atividades
FOR EACH ROW EXECUTE FUNCTION voluntariado_privado.inscricao_identidade();
-- Fechar também os grants do default remoto em novas funções/tabelas/sequências.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA voluntariado_privado FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.solicitacoes_materiais,public.contribuicoes_materiais,public.propostas_oficinas,public.certificados FROM service_role;
REVOKE ALL ON SEQUENCE public.solicitacoes_materiais_id_seq,public.contribuicoes_materiais_id_seq,public.propostas_oficinas_id_seq FROM service_role;
REVOKE TRUNCATE,REFERENCES,TRIGGER ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
COMMIT;
