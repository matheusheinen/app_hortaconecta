-- B29: entrega das notificações por canal (push agora; e-mail e WhatsApp depois).
-- public.notificacoes continua sendo a fonte única (o sino lê dela). Cada notificação nova
-- gera, por gatilho, uma linha em notificacoes_entregues para cada canal ligado e cada
-- destino do usuário (no push, cada aparelho). A Edge Function notificacoes-despachar
-- reserva um lote, envia pelo adaptador do canal e devolve o resultado; falha temporária
-- volta para a fila com espera crescente. notificacoes-recibos confere os recibos do Expo
-- e apaga tokens de aparelhos que desinstalaram o app.
--   * Catálogo (notificacoes_tipos/notificacoes_canais): ligar e-mail para um tipo é dado,
--     não código. O CHECK de tipo de public.notificacoes vira chave estrangeira.
--   * Preferências por categoria e canal; tipo crítico ignora o "desligado".
--   * pg_net + Vault acordam a function logo após o INSERT; pg_cron cuida de retentativas,
--     recibos e limpeza. Fora do Supabase (testes locais) essas partes são puladas.
-- Pré-requisitos fora do SQL (ver docs/mvp/NOTIFICACOES.md): extensões pg_net e pg_cron
-- ligadas; segredos notificacoes_url_base e notificacoes_segredo no Vault.
-- Aplicar depois de 20261026120000_dispositivos_push.sql e 20261026140000. Não usar db push.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
 IF to_regclass('public.notificacoes') IS NULL OR to_regclass('voluntariado_privado.dispositivos_push') IS NULL THEN
  RAISE EXCEPTION 'Pré-condição: notificações (20261026130000) ou dispositivos de push (20261026120000) ausentes.'; END IF;
 IF to_regclass('voluntariado_privado.notificacoes_entregues') IS NOT NULL THEN
  RAISE EXCEPTION 'Pré-condição: entregas de notificações já instaladas; não reaplicar.'; END IF;
END $preflight$;

-- ---------------------------------------------------------------- catálogo
CREATE TABLE voluntariado_privado.notificacoes_canais (
 canal text PRIMARY KEY CHECK (canal IN ('push','email','whatsapp')),
 ativo boolean NOT NULL DEFAULT false
);
-- Só o push tem adaptador hoje. Ligar outro canal: UPDATE ativo=true depois do adaptador.
INSERT INTO voluntariado_privado.notificacoes_canais(canal, ativo)
VALUES ('push', true), ('email', false), ('whatsapp', false);

CREATE TABLE voluntariado_privado.notificacoes_tipos (
 tipo text PRIMARY KEY CHECK (tipo ~ '^[A-Z_]{3,60}$'),
 categoria text NOT NULL CHECK (categoria IN ('VOLUNTARIADO','CONTRIBUICOES')),
 canais_padrao text[] NOT NULL DEFAULT '{push}',
 critico boolean NOT NULL DEFAULT false
);
INSERT INTO voluntariado_privado.notificacoes_tipos(tipo, categoria, canais_padrao, critico) VALUES
 ('CANDIDATURA_NOVA','VOLUNTARIADO','{push}',false),
 ('CANDIDATURA_CANCELADA','VOLUNTARIADO','{push}',false),
 ('PRESENCA_CONFIRMADA','VOLUNTARIADO','{push}',false),
 ('CANDIDATURA_APROVADA','VOLUNTARIADO','{push,email}',false),
 ('CANDIDATURA_RECUSADA','VOLUNTARIADO','{push,email}',false),
 ('ATIVIDADE_CANCELADA','VOLUNTARIADO','{push,email,whatsapp}',true),
 ('CONTRIBUICAO_NOVA','CONTRIBUICOES','{push}',false),
 ('CONTRIBUICAO_APROVADA','CONTRIBUICOES','{push}',false),
 ('CONTRIBUICAO_RECUSADA','CONTRIBUICOES','{push}',false);

-- O tipo da notificação passa a ser validado pelo catálogo.
ALTER TABLE public.notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_tipo_fk
 FOREIGN KEY (tipo) REFERENCES voluntariado_privado.notificacoes_tipos(tipo);

-- ---------------------------------------------------------------- preferências
CREATE TABLE voluntariado_privado.notificacoes_preferencias (
 usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
 categoria text NOT NULL,
 canal text NOT NULL REFERENCES voluntariado_privado.notificacoes_canais(canal),
 ativo boolean NOT NULL,
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (usuario_id, categoria, canal)
);

-- ---------------------------------------------------------------- fila de entregas
CREATE TABLE voluntariado_privado.notificacoes_entregues (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 notificacao_id bigint NOT NULL REFERENCES public.notificacoes(id) ON DELETE CASCADE,
 usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
 canal text NOT NULL REFERENCES voluntariado_privado.notificacoes_canais(canal),
 destino text NOT NULL,             -- token Expo, e-mail ou telefone
 status text NOT NULL DEFAULT 'PENDENTE'
  CHECK (status IN ('PENDENTE','ENVIANDO','ENVIADA','ENTREGUE','FALHOU')),
 tentativas int NOT NULL DEFAULT 0,
 proximo_em timestamptz NOT NULL DEFAULT now(),
 reservado_em timestamptz,
 enviado_em timestamptz,
 id_externo text,                    -- ticket do Expo, id do provedor de e-mail etc.
 erro text,
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE (notificacao_id, canal, destino)
);
CREATE INDEX notificacoes_entregues_fila_idx ON voluntariado_privado.notificacoes_entregues(proximo_em)
 WHERE status IN ('PENDENTE','ENVIANDO');
CREATE INDEX notificacoes_entregues_recibo_idx ON voluntariado_privado.notificacoes_entregues(enviado_em)
 WHERE status = 'ENVIADA';

ALTER TABLE voluntariado_privado.notificacoes_canais ENABLE ROW LEVEL SECURITY;
ALTER TABLE voluntariado_privado.notificacoes_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE voluntariado_privado.notificacoes_preferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE voluntariado_privado.notificacoes_entregues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON voluntariado_privado.notificacoes_canais, voluntariado_privado.notificacoes_tipos,
 voluntariado_privado.notificacoes_preferencias, voluntariado_privado.notificacoes_entregues
 FROM PUBLIC, anon, authenticated, service_role;

-- Para onde cada canal entrega. WhatsApp ainda não tem destino (B18).
CREATE FUNCTION voluntariado_privado.notificacoes_destinos(p_usuario uuid, p_canal text)
RETURNS SETOF text LANGUAGE plpgsql STABLE SET search_path='' AS $$
BEGIN
 IF p_canal='push' THEN
  RETURN QUERY SELECT token FROM voluntariado_privado.dispositivos_push WHERE usuario_id=p_usuario;
 ELSIF p_canal='email' THEN
  RETURN QUERY SELECT u.email::text FROM auth.users u
   WHERE u.id=p_usuario AND nullif(btrim(u.email),'') IS NOT NULL;
 END IF;
END $$;

-- Canal entra se estiver ligado e (tipo crítico e canal padrão) ou a preferência permitir.
CREATE FUNCTION voluntariado_privado.notificacoes_enfileirar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO voluntariado_privado.notificacoes_entregues(notificacao_id, usuario_id, canal, destino)
 SELECT NEW.id, NEW.usuario_id, c.canal, d.destino
   FROM voluntariado_privado.notificacoes_canais c
   JOIN voluntariado_privado.notificacoes_tipos t ON t.tipo=NEW.tipo
   LEFT JOIN voluntariado_privado.notificacoes_preferencias p
     ON p.usuario_id=NEW.usuario_id AND p.categoria=t.categoria AND p.canal=c.canal
   CROSS JOIN LATERAL voluntariado_privado.notificacoes_destinos(NEW.usuario_id, c.canal) AS d(destino)
  WHERE c.ativo
    AND ((t.critico AND c.canal=ANY(t.canais_padrao)) OR coalesce(p.ativo, c.canal=ANY(t.canais_padrao)))
 ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;

-- Chama uma Edge Function pelo pg_net (assíncrono: sai depois do COMMIT). Sem pg_net ou sem
-- os segredos no Vault não faz nada; nunca derruba a transação de quem gerou a notificação.
CREATE FUNCTION voluntariado_privado.notificacoes_chamar_funcao(p_nome text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_base text; v_segredo text;
BEGIN
 IF to_regnamespace('net') IS NULL OR to_regclass('vault.decrypted_secrets') IS NULL THEN RETURN; END IF;
 EXECUTE $q$SELECT max(decrypted_secret) FILTER (WHERE name='notificacoes_url_base'),
                   max(decrypted_secret) FILTER (WHERE name='notificacoes_segredo')
              FROM vault.decrypted_secrets$q$ INTO v_base, v_segredo;
 IF v_base IS NULL OR v_segredo IS NULL THEN RETURN; END IF;
 EXECUTE 'SELECT net.http_post(url:=$1, headers:=$2, body:=$3, timeout_milliseconds:=5000)'
  USING rtrim(v_base,'/')||'/functions/v1/'||p_nome,
        jsonb_build_object('Content-Type','application/json','x-notificacoes-segredo',v_segredo),
        '{}'::jsonb;
EXCEPTION WHEN OTHERS THEN
 RAISE WARNING 'Notificações: não foi possível chamar %: %', p_nome, SQLERRM;
END $$;

CREATE FUNCTION voluntariado_privado.notificacoes_acordar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM voluntariado_privado.notificacoes_entregues
            WHERE status='PENDENTE' AND proximo_em<=now()) THEN
  PERFORM voluntariado_privado.notificacoes_chamar_funcao('notificacoes-despachar');
 END IF;
 RETURN NULL;
END $$;

CREATE TRIGGER trg_notificacoes_enfileirar AFTER INSERT ON public.notificacoes
 FOR EACH ROW EXECUTE FUNCTION voluntariado_privado.notificacoes_enfileirar();
-- Uma chamada por instrução, mesmo quando a gestão inteira é notificada de uma vez.
CREATE TRIGGER trg_notificacoes_acordar AFTER INSERT ON public.notificacoes
 FOR EACH STATEMENT EXECUTE FUNCTION voluntariado_privado.notificacoes_acordar();

-- ---------------------------------------------------------------- RPCs do app
CREATE FUNCTION public.notificacoes_preferencias()
RETURNS TABLE(categoria text, canal text, ativo boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT k.categoria, c.canal,
        coalesce(p.ativo, bool_or(c.canal=ANY(t.canais_padrao)))
   FROM (SELECT DISTINCT t2.categoria FROM voluntariado_privado.notificacoes_tipos t2) k
   CROSS JOIN voluntariado_privado.notificacoes_canais c
   JOIN voluntariado_privado.notificacoes_tipos t ON t.categoria=k.categoria
   LEFT JOIN voluntariado_privado.notificacoes_preferencias p
     ON p.usuario_id=auth.uid() AND p.categoria=k.categoria AND p.canal=c.canal
  WHERE c.ativo
  GROUP BY k.categoria, c.canal, p.ativo
  ORDER BY k.categoria, c.canal;
END $$;

CREATE FUNCTION public.notificacoes_salvar_preferencia(p_categoria text, p_canal text, p_ativo boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.usuarios WHERE id=uid) THEN
  RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501'; END IF;
 IF coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'is_anonymous')::boolean, false) THEN
  RAISE EXCEPTION 'Convidado não recebe notificações. Crie uma conta para participar.' USING ERRCODE='42501';
 END IF;
 IF p_ativo IS NULL OR NOT EXISTS(SELECT 1 FROM voluntariado_privado.notificacoes_tipos WHERE categoria=p_categoria)
  OR NOT EXISTS(SELECT 1 FROM voluntariado_privado.notificacoes_canais WHERE canal=p_canal AND ativo) THEN
  RAISE EXCEPTION 'Preferência de notificação inválida.' USING ERRCODE='22023'; END IF;
 INSERT INTO voluntariado_privado.notificacoes_preferencias(usuario_id, categoria, canal, ativo)
 VALUES (uid, p_categoria, p_canal, p_ativo)
 ON CONFLICT (usuario_id, categoria, canal) DO UPDATE SET ativo=EXCLUDED.ativo, atualizado_em=now();
END $$;

-- ---------------------------------------------------------------- RPCs das Edge Functions
-- Reserva um lote para envio. Reserva com mais de 5 min (function caiu) volta a valer.
CREATE FUNCTION public.notificacoes_entregues_reservar(p_canais text[], p_limite int DEFAULT 100)
RETURNS TABLE(id bigint, canal text, destino text, tentativas int, notificacao_id bigint,
              tipo text, titulo text, corpo text, atividade_id bigint, meta_id bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN QUERY
 WITH lote AS (
  SELECT e.id FROM voluntariado_privado.notificacoes_entregues e
   WHERE e.canal=ANY(p_canais)
     AND ((e.status='PENDENTE' AND e.proximo_em<=now())
       OR (e.status='ENVIANDO' AND e.reservado_em<now()-interval '5 minutes'))
   ORDER BY e.proximo_em, e.id
   LIMIT least(greatest(coalesce(p_limite,100),1),500)
   FOR UPDATE SKIP LOCKED
 ), reservadas AS (
  UPDATE voluntariado_privado.notificacoes_entregues e
     SET status='ENVIANDO', tentativas=e.tentativas+1, reservado_em=now(), atualizado_em=now()
    FROM lote WHERE e.id=lote.id
  RETURNING e.id, e.canal, e.destino, e.tentativas, e.notificacao_id
 )
 SELECT r.id, r.canal, r.destino, r.tentativas, r.notificacao_id, n.tipo, n.titulo, n.corpo,
        n.atividade_id, n.meta_id
   FROM reservadas r JOIN public.notificacoes n ON n.id=r.notificacao_id
  ORDER BY r.id;
END $$;

-- Espera antes da próxima tentativa: 1, 5, 15 e 60 minutos; na 5ª falha, desiste.
CREATE FUNCTION voluntariado_privado.notificacoes_espera(p_tentativas int) RETURNS interval
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_tentativas<=1 THEN interval '1 minute' WHEN p_tentativas=2 THEN interval '5 minutes'
             WHEN p_tentativas=3 THEN interval '15 minutes' ELSE interval '60 minutes' END;
$$;

-- p_resultados: [{id, ok, id_externo?, erro?, definitivo?, remover_destino?}]
-- ok com id_externo (push) fica ENVIADA à espera do recibo; ok sem id_externo, ENTREGUE.
CREATE FUNCTION public.notificacoes_entregues_concluir(p_resultados jsonb) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_total int;
BEGIN
 IF jsonb_typeof(p_resultados)<>'array' THEN
  RAISE EXCEPTION 'Resultados inválidos.' USING ERRCODE='22023'; END IF;
 WITH r AS (
  SELECT (x->>'id')::bigint AS id, coalesce((x->>'ok')::boolean,false) AS ok,
         nullif(x->>'id_externo','') AS id_externo, left(x->>'erro',500) AS erro,
         coalesce((x->>'definitivo')::boolean,false) AS definitivo,
         coalesce((x->>'remover_destino')::boolean,false) AS remover
    FROM jsonb_array_elements(p_resultados) x
 ), atualizadas AS (
  UPDATE voluntariado_privado.notificacoes_entregues e
     SET status=CASE WHEN r.ok AND r.id_externo IS NOT NULL THEN 'ENVIADA'
                     WHEN r.ok THEN 'ENTREGUE'
                     WHEN r.definitivo OR e.tentativas>=5 THEN 'FALHOU'
                     ELSE 'PENDENTE' END,
         enviado_em=CASE WHEN r.ok THEN now() ELSE e.enviado_em END,
         id_externo=coalesce(r.id_externo, e.id_externo),
         erro=CASE WHEN r.ok THEN NULL ELSE r.erro END,
         proximo_em=CASE WHEN r.ok THEN e.proximo_em
                         ELSE now()+voluntariado_privado.notificacoes_espera(e.tentativas) END,
         reservado_em=NULL, atualizado_em=now()
    FROM r WHERE e.id=r.id AND e.status='ENVIANDO'
  RETURNING e.id, e.canal, e.destino, r.remover
 ), removidos AS (
  DELETE FROM voluntariado_privado.dispositivos_push d
   USING atualizadas a WHERE a.remover AND a.canal='push' AND d.token=a.destino
 )
 SELECT count(*) INTO v_total FROM atualizadas;
 RETURN v_total;
END $$;

-- Pushes aceitos pelo Expo há pelo menos p_espera e há menos de 23 h (o Expo guarda 24 h).
CREATE FUNCTION public.notificacoes_recibos_pendentes(p_espera interval DEFAULT interval '15 minutes',
                                                      p_limite int DEFAULT 1000)
RETURNS TABLE(id bigint, id_externo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT e.id, e.id_externo FROM voluntariado_privado.notificacoes_entregues e
  WHERE e.status='ENVIADA' AND e.canal='push' AND e.id_externo IS NOT NULL
    AND e.enviado_em<=now()-p_espera AND e.enviado_em>now()-interval '23 hours'
  ORDER BY e.enviado_em
  LIMIT least(greatest(coalesce(p_limite,1000),1),1000);
$$;

-- p_resultados: [{id, ok, erro?, remover_destino?}]. Recibo é o fim da linha: ok → ENTREGUE.
CREATE FUNCTION public.notificacoes_recibos_registrar(p_resultados jsonb) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_total int;
BEGIN
 IF jsonb_typeof(p_resultados)<>'array' THEN
  RAISE EXCEPTION 'Resultados inválidos.' USING ERRCODE='22023'; END IF;
 WITH r AS (
  SELECT (x->>'id')::bigint AS id, coalesce((x->>'ok')::boolean,false) AS ok,
         left(x->>'erro',500) AS erro, coalesce((x->>'remover_destino')::boolean,false) AS remover
    FROM jsonb_array_elements(p_resultados) x
 ), atualizadas AS (
  UPDATE voluntariado_privado.notificacoes_entregues e
     SET status=CASE WHEN r.ok THEN 'ENTREGUE' ELSE 'FALHOU' END,
         erro=CASE WHEN r.ok THEN NULL ELSE r.erro END, atualizado_em=now()
    FROM r WHERE e.id=r.id AND e.status='ENVIADA'
  RETURNING e.canal, e.destino, r.remover
 ), removidos AS (
  DELETE FROM voluntariado_privado.dispositivos_push d
   USING atualizadas a WHERE a.remover AND a.canal='push' AND d.token=a.destino
 )
 SELECT count(*) INTO v_total FROM atualizadas;
 RETURN v_total;
END $$;

REVOKE ALL ON FUNCTION voluntariado_privado.notificacoes_destinos(uuid,text),
 voluntariado_privado.notificacoes_enfileirar(), voluntariado_privado.notificacoes_chamar_funcao(text),
 voluntariado_privado.notificacoes_acordar(), voluntariado_privado.notificacoes_espera(int),
 public.notificacoes_preferencias(), public.notificacoes_salvar_preferencia(text,text,boolean),
 public.notificacoes_entregues_reservar(text[],int), public.notificacoes_entregues_concluir(jsonb),
 public.notificacoes_recibos_pendentes(interval,int), public.notificacoes_recibos_registrar(jsonb)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.notificacoes_preferencias(),
 public.notificacoes_salvar_preferencia(text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notificacoes_entregues_reservar(text[],int),
 public.notificacoes_entregues_concluir(jsonb), public.notificacoes_recibos_pendentes(interval,int),
 public.notificacoes_recibos_registrar(jsonb) TO service_role;

-- ---------------------------------------------------------------- agendamentos (pg_cron)
CREATE FUNCTION voluntariado_privado.notificacoes_rotina() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM voluntariado_privado.notificacoes_entregues
            WHERE (status='PENDENTE' AND proximo_em<=now())
               OR (status='ENVIANDO' AND reservado_em<now()-interval '5 minutes')) THEN
  PERFORM voluntariado_privado.notificacoes_chamar_funcao('notificacoes-despachar');
 END IF;
 IF EXISTS(SELECT 1 FROM voluntariado_privado.notificacoes_entregues
            WHERE status='ENVIADA' AND enviado_em<=now()-interval '15 minutes'
              AND enviado_em>now()-interval '23 hours') THEN
  PERFORM voluntariado_privado.notificacoes_chamar_funcao('notificacoes-recibos');
 END IF;
END $$;
REVOKE ALL ON FUNCTION voluntariado_privado.notificacoes_rotina() FROM PUBLIC, anon, authenticated, service_role;

DO $cron$
BEGIN
 IF to_regnamespace('cron') IS NOT NULL THEN
  -- Só chama as functions quando há trabalho; nos outros minutos é uma consulta barata.
  PERFORM cron.schedule('notificacoes-rotina', '* * * * *',
   'SELECT voluntariado_privado.notificacoes_rotina()');
  -- Histórico de entregas por 30 dias (as notificações em si continuam).
  PERFORM cron.schedule('notificacoes-limpeza', '30 3 * * *',
   $$DELETE FROM voluntariado_privado.notificacoes_entregues WHERE criado_em<now()-interval '30 days'$$);
 END IF;
END $cron$;

COMMIT;
