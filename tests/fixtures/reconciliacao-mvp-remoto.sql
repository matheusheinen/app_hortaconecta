-- Catálogo PUBLIC do projeto hnawclapixopwjyrpxpq em 30/09/2026, somente DDL via SELECT.
-- Dados de usuários NÃO foram copiados. Auth/JWT e Storage são mocks de teste;
-- não emula GoTrue nem a API Storage. Sem baseline/deploy de produção.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
-- enums
CREATE TYPE public.status_atividade AS ENUM ('PENDENTE_APROVACAO','ABERTA','ENCERRADA','REALIZADA','CANCELADA','RECUSADA');
CREATE TYPE public.status_inscricao AS ENUM ('PENDENTE','APROVADA','RECUSADA','CANCELADA');
CREATE TYPE public.status_meta AS ENUM ('ABERTA','ENCERRADA','CANCELADA');
CREATE TYPE public.status_validacao AS ENUM ('PENDENTE','APROVADA','RECUSADA');
CREATE TYPE public.tipo_atividade AS ENUM ('TAREFA_ONG','OFICINA_AUTORAL');
CREATE TYPE public.tipo_meta AS ENUM ('FINANCEIRA','MATERIAL');
CREATE TYPE public.tipo_perfil AS ENUM ('VOLUNTARIO','ONG');

-- tables
CREATE TABLE public.atividade_habilidades (atividade_id bigint NOT NULL,habilidade_id bigint NOT NULL);
CREATE TABLE public.atividades (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,titulo text NOT NULL,descricao text NOT NULL,tipo tipo_atividade NOT NULL,autor_id uuid NOT NULL,data_hora_prevista timestamp with time zone NOT NULL,vagas_totais integer NOT NULL,carga_horaria numeric(5,2) NOT NULL,status status_atividade DEFAULT 'PENDENTE_APROVACAO'::status_atividade NOT NULL,criado_em timestamp with time zone DEFAULT now() NOT NULL,atualizado_em timestamp with time zone DEFAULT now() NOT NULL,vagas_ocupadas integer DEFAULT 0 NOT NULL);
CREATE TABLE public.configuracao_instituicao (id smallint DEFAULT 1 NOT NULL,nome_curto text NOT NULL,nome_completo text NOT NULL,cidade text NOT NULL,uf text NOT NULL,chamada text,sobre text,cor_primaria text,cor_acento text,url_logo text,site text,telefone text,whatsapp text,email_contato text,atualizado_em timestamp with time zone DEFAULT now() NOT NULL,endereco text);
CREATE TABLE public.contribuicoes (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,meta_id bigint NOT NULL,usuario_id uuid NOT NULL,quantidade_oferecida numeric(12,2) NOT NULL,url_comprovante text,data_envio timestamp with time zone DEFAULT now() NOT NULL,status_validacao status_validacao DEFAULT 'PENDENTE'::status_validacao NOT NULL,validado_por uuid,validado_em timestamp with time zone,observacao_validacao text);
CREATE TABLE public.diario_transparencia (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,titulo text NOT NULL,descricao_curta text,url_imagem text,atividade_id bigint,data_publicacao timestamp with time zone DEFAULT now() NOT NULL,autor_id uuid NOT NULL);
CREATE TABLE public.habilidades (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,nome_habilidade text NOT NULL,categoria text);
CREATE TABLE public.inscricoes_atividades (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,atividade_id bigint NOT NULL,usuario_id uuid NOT NULL,data_inscricao timestamp with time zone DEFAULT now() NOT NULL,status_inscricao status_inscricao DEFAULT 'PENDENTE'::status_inscricao NOT NULL,presenca_confirmada boolean DEFAULT false NOT NULL);
CREATE TABLE public.metas_demandas (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,titulo text NOT NULL,descricao text NOT NULL,tipo tipo_meta NOT NULL,unidade_medida text,quantidade_meta numeric(12,2) NOT NULL,quantidade_arrecadada numeric(12,2) DEFAULT 0 NOT NULL,url_imagem_capa text,data_limite date,status status_meta DEFAULT 'ABERTA'::status_meta NOT NULL,criado_em timestamp with time zone DEFAULT now() NOT NULL,atualizado_em timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public.ongs (usuario_id uuid NOT NULL,cnpj text,razao_social text,data_criacao date,responsavel_legal text,chave_pix text,nome_beneficiario_pix text,whatsapp text,atualizado_em timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public.usuario_habilidades (usuario_id uuid NOT NULL,habilidade_id bigint NOT NULL);
CREATE TABLE public.usuarios (id uuid NOT NULL,nome text NOT NULL,telefone text,descricao text,perfil_instagram text,tipo_perfil tipo_perfil DEFAULT 'VOLUNTARIO'::tipo_perfil NOT NULL,foto_perfil text,exclusao_solicitada_em timestamp with time zone,criado_em timestamp with time zone DEFAULT now() NOT NULL,atualizado_em timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public.voluntarios (usuario_id uuid NOT NULL,cpf text,data_nascimento date,profissao text,disponibilidade_horarios jsonb DEFAULT '[]'::jsonb NOT NULL,atualizado_em timestamp with time zone DEFAULT now() NOT NULL,cep text,logradouro text,numero text,complemento text,bairro text,cidade text,uf text);

-- constraints
ALTER TABLE atividade_habilidades ADD CONSTRAINT atividade_habilidades_pkey PRIMARY KEY (atividade_id, habilidade_id);
ALTER TABLE atividades ADD CONSTRAINT atividades_pkey PRIMARY KEY (id);
ALTER TABLE configuracao_instituicao ADD CONSTRAINT configuracao_instituicao_pkey PRIMARY KEY (id);
ALTER TABLE contribuicoes ADD CONSTRAINT contribuicoes_pkey PRIMARY KEY (id);
ALTER TABLE diario_transparencia ADD CONSTRAINT diario_transparencia_pkey PRIMARY KEY (id);
ALTER TABLE habilidades ADD CONSTRAINT habilidades_pkey PRIMARY KEY (id);
ALTER TABLE inscricoes_atividades ADD CONSTRAINT inscricoes_atividades_pkey PRIMARY KEY (id);
ALTER TABLE metas_demandas ADD CONSTRAINT metas_demandas_pkey PRIMARY KEY (id);
ALTER TABLE ongs ADD CONSTRAINT ongs_pkey PRIMARY KEY (usuario_id);
ALTER TABLE usuario_habilidades ADD CONSTRAINT usuario_habilidades_pkey PRIMARY KEY (usuario_id, habilidade_id);
ALTER TABLE usuarios ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);
ALTER TABLE voluntarios ADD CONSTRAINT voluntarios_pkey PRIMARY KEY (usuario_id);
ALTER TABLE habilidades ADD CONSTRAINT habilidades_nome_habilidade_key UNIQUE (nome_habilidade);
ALTER TABLE inscricoes_atividades ADD CONSTRAINT inscricoes_atividades_unica UNIQUE (atividade_id, usuario_id);
ALTER TABLE ongs ADD CONSTRAINT ongs_cnpj_key UNIQUE (cnpj);
ALTER TABLE voluntarios ADD CONSTRAINT voluntarios_cpf_key UNIQUE (cpf);
ALTER TABLE atividades ADD CONSTRAINT atividades_carga_horaria_check CHECK ((carga_horaria > (0)::numeric));
ALTER TABLE atividades ADD CONSTRAINT atividades_titulo_check CHECK (((length(TRIM(BOTH FROM titulo)) >= 3) AND (length(TRIM(BOTH FROM titulo)) <= 120)));
ALTER TABLE atividades ADD CONSTRAINT atividades_vagas_ocupadas_check CHECK (((vagas_ocupadas >= 0) AND (vagas_ocupadas <= vagas_totais)));
ALTER TABLE atividades ADD CONSTRAINT atividades_vagas_totais_check CHECK (((vagas_totais >= 1) AND (vagas_totais <= 500)));
ALTER TABLE configuracao_instituicao ADD CONSTRAINT configuracao_instituicao_singleton_check CHECK ((id = 1));
ALTER TABLE configuracao_instituicao ADD CONSTRAINT configuracao_instituicao_uf_check CHECK ((uf ~ '^[A-Z]{2}$'::text));
ALTER TABLE contribuicoes ADD CONSTRAINT contribuicoes_quantidade_check CHECK ((quantidade_oferecida > (0)::numeric));
ALTER TABLE contribuicoes ADD CONSTRAINT contribuicoes_validacao_coerente_check CHECK ((((status_validacao = 'PENDENTE'::status_validacao) AND (validado_por IS NULL) AND (validado_em IS NULL)) OR ((status_validacao <> 'PENDENTE'::status_validacao) AND (validado_por IS NOT NULL) AND (validado_em IS NOT NULL))));
ALTER TABLE diario_transparencia ADD CONSTRAINT diario_transparencia_titulo_check CHECK (((length(TRIM(BOTH FROM titulo)) >= 3) AND (length(TRIM(BOTH FROM titulo)) <= 120)));
ALTER TABLE habilidades ADD CONSTRAINT habilidades_nome_habilidade_check CHECK (((length(TRIM(BOTH FROM nome_habilidade)) >= 2) AND (length(TRIM(BOTH FROM nome_habilidade)) <= 80)));
ALTER TABLE metas_demandas ADD CONSTRAINT metas_demandas_quantidade_arrecadada_check CHECK ((quantidade_arrecadada >= (0)::numeric));
ALTER TABLE metas_demandas ADD CONSTRAINT metas_demandas_quantidade_meta_check CHECK ((quantidade_meta > (0)::numeric));
ALTER TABLE metas_demandas ADD CONSTRAINT metas_demandas_titulo_check CHECK (((length(TRIM(BOTH FROM titulo)) >= 3) AND (length(TRIM(BOTH FROM titulo)) <= 120)));
ALTER TABLE ongs ADD CONSTRAINT ongs_cnpj_check CHECK ((cnpj ~ '^[0-9]{14}$'::text));
ALTER TABLE ongs ADD CONSTRAINT ongs_whatsapp_check CHECK ((whatsapp ~ '^[0-9]{10,11}$'::text));
ALTER TABLE usuarios ADD CONSTRAINT usuarios_descricao_check CHECK ((length(descricao) <= 500));
ALTER TABLE usuarios ADD CONSTRAINT usuarios_nome_check CHECK (((length(TRIM(BOTH FROM nome)) >= 2) AND (length(TRIM(BOTH FROM nome)) <= 120)));
ALTER TABLE usuarios ADD CONSTRAINT usuarios_perfil_instagram_check CHECK ((perfil_instagram ~ '^[A-Za-z0-9._]{1,30}$'::text));
ALTER TABLE usuarios ADD CONSTRAINT usuarios_telefone_check CHECK ((telefone ~ '^[0-9]{10,11}$'::text));
ALTER TABLE voluntarios ADD CONSTRAINT voluntarios_cep_check CHECK (((cep IS NULL) OR (cep ~ '^[0-9]{8}$'::text)));
ALTER TABLE voluntarios ADD CONSTRAINT voluntarios_cpf_check CHECK ((cpf ~ '^[0-9]{11}$'::text));
ALTER TABLE voluntarios ADD CONSTRAINT voluntarios_data_nascimento_check CHECK (((data_nascimento > '1900-01-01'::date) AND (data_nascimento < CURRENT_DATE)));
ALTER TABLE voluntarios ADD CONSTRAINT voluntarios_uf_check CHECK (((uf IS NULL) OR (uf ~ '^[A-Z]{2}$'::text)));
ALTER TABLE atividade_habilidades ADD CONSTRAINT atividade_habilidades_atividade_id_fkey FOREIGN KEY (atividade_id) REFERENCES atividades(id) ON DELETE CASCADE;
ALTER TABLE atividade_habilidades ADD CONSTRAINT atividade_habilidades_habilidade_id_fkey FOREIGN KEY (habilidade_id) REFERENCES habilidades(id) ON DELETE CASCADE;
ALTER TABLE atividades ADD CONSTRAINT atividades_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE RESTRICT;
ALTER TABLE contribuicoes ADD CONSTRAINT contribuicoes_meta_id_fkey FOREIGN KEY (meta_id) REFERENCES metas_demandas(id) ON DELETE CASCADE;
ALTER TABLE contribuicoes ADD CONSTRAINT contribuicoes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE contribuicoes ADD CONSTRAINT contribuicoes_validado_por_fkey FOREIGN KEY (validado_por) REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE diario_transparencia ADD CONSTRAINT diario_transparencia_atividade_id_fkey FOREIGN KEY (atividade_id) REFERENCES atividades(id) ON DELETE SET NULL;
ALTER TABLE diario_transparencia ADD CONSTRAINT diario_transparencia_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES usuarios(id) ON DELETE RESTRICT;
ALTER TABLE inscricoes_atividades ADD CONSTRAINT inscricoes_atividades_atividade_id_fkey FOREIGN KEY (atividade_id) REFERENCES atividades(id) ON DELETE CASCADE;
ALTER TABLE inscricoes_atividades ADD CONSTRAINT inscricoes_atividades_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE ongs ADD CONSTRAINT ongs_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE usuario_habilidades ADD CONSTRAINT usuario_habilidades_habilidade_id_fkey FOREIGN KEY (habilidade_id) REFERENCES habilidades(id) ON DELETE CASCADE;
ALTER TABLE usuario_habilidades ADD CONSTRAINT usuario_habilidades_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE voluntarios ADD CONSTRAINT voluntarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;

-- indexes
CREATE INDEX atividade_habilidades_habilidade_idx ON public.atividade_habilidades USING btree (habilidade_id);
CREATE INDEX atividades_agenda_idx ON public.atividades USING btree (status, data_hora_prevista DESC);
CREATE INDEX atividades_autor_idx ON public.atividades USING btree (autor_id);
CREATE INDEX contribuicoes_meta_idx ON public.contribuicoes USING btree (meta_id);
CREATE INDEX contribuicoes_usuario_idx ON public.contribuicoes USING btree (usuario_id);
CREATE INDEX diario_transparencia_publicacao_idx ON public.diario_transparencia USING btree (data_publicacao DESC);
CREATE INDEX inscricoes_atividades_atividade_idx ON public.inscricoes_atividades USING btree (atividade_id);
CREATE INDEX inscricoes_atividades_usuario_idx ON public.inscricoes_atividades USING btree (usuario_id);
CREATE INDEX metas_demandas_status_idx ON public.metas_demandas USING btree (status, data_limite);
CREATE INDEX usuario_habilidades_habilidade_idx ON public.usuario_habilidades USING btree (habilidade_id);

-- functions
CREATE OR REPLACE FUNCTION public.atualizar_arrecadacao_meta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update public.metas_demandas m
     set quantidade_arrecadada = (
           select coalesce(sum(c.quantidade_oferecida), 0)
             from public.contribuicoes c
            where c.meta_id = m.id
              and c.status_validacao = 'APROVADA'
         )
   where m.id = coalesce(new.meta_id, old.meta_id);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.atualizar_vagas_ocupadas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- Recalcula em vez de incrementar: o contador nunca fica dessincronizado,
  -- e o custo é irrelevante na escala de uma horta comunitária.
  update public.atividades a
     set vagas_ocupadas = (
           select count(*)
             from public.inscricoes_atividades i
            where i.atividade_id = a.id
              and i.status_inscricao in ('PENDENTE', 'APROVADA')
         )
   where a.id = coalesce(new.atividade_id, old.atividade_id);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.e_ong(uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1 from public.usuarios u
    where u.id = uid and u.tipo_perfil = 'ONG'
  );
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.usuarios (id, nome, tipo_perfil)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    'VOLUNTARIO'
  );

  insert into public.voluntarios (usuario_id) values (new.id);

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.perfil_completo(uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (
    select 1
      from public.usuarios u
      left join public.voluntarios v on v.usuario_id = u.id
     where u.id = uid
       and (
         u.tipo_perfil = 'ONG'
         or (
              v.cpf is not null
          and v.data_nascimento is not null
          and v.profissao is not null
          and btrim(coalesce(v.logradouro, '')) <> ''
          and btrim(coalesce(v.numero, '')) <> ''
          and btrim(coalesce(v.cidade, '')) <> ''
          and jsonb_array_length(v.disponibilidade_horarios) > 0
          and exists (
                select 1
                  from public.usuario_habilidades uh
                 where uh.usuario_id = u.id
              )
         )
       )
  );
$function$;

CREATE OR REPLACE FUNCTION public.proteger_campos_perfil()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- A trava vale apenas para conexões vindas do app. Rotinas
  -- administrativas (service_role, SQL Editor, migrations) passam.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.tipo_perfil is distinct from old.tipo_perfil then
    raise exception 'Alteração de tipo_perfil não permitida.' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  new.atualizado_em := now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.solicitar_exclusao_conta()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  update public.usuarios
     set exclusao_solicitada_em = now()
   where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.validar_transicao_inscricao()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- Mesma isenção de proteger_campos_perfil(): rotinas administrativas
  -- (service_role, SQL Editor, migrations) e a gestão passam direto.
  if current_user not in ('authenticated', 'anon') or public.e_ong() then
    return new;
  end if;

  if new.presenca_confirmada is distinct from old.presenca_confirmada then
    raise exception 'Somente a gestão confirma presença.' using errcode = 'insufficient_privilege';
  end if;

  if new.status_inscricao is distinct from old.status_inscricao
     and not (
          (old.status_inscricao in ('PENDENTE', 'APROVADA') and new.status_inscricao = 'CANCELADA')
       or (old.status_inscricao = 'CANCELADA' and new.status_inscricao = 'PENDENTE')
     ) then
    raise exception 'Transição de candidatura não permitida.' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$function$;


-- triggers
CREATE TRIGGER trg_atividades_atualizado BEFORE UPDATE ON public.atividades FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER trg_configuracao_instituicao_atualizado BEFORE UPDATE ON public.configuracao_instituicao FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER trg_contribuicoes_arrecadacao AFTER INSERT OR DELETE OR UPDATE ON public.contribuicoes FOR EACH ROW EXECUTE FUNCTION atualizar_arrecadacao_meta();
CREATE TRIGGER trg_inscricoes_vagas AFTER INSERT OR DELETE OR UPDATE ON public.inscricoes_atividades FOR EACH ROW EXECUTE FUNCTION atualizar_vagas_ocupadas();
CREATE TRIGGER trg_metas_demandas_atualizado BEFORE UPDATE ON public.metas_demandas FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER trg_ongs_atualizado BEFORE UPDATE ON public.ongs FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER trg_proteger_campos_perfil BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION proteger_campos_perfil();
CREATE TRIGGER trg_usuarios_atualizado BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER trg_validar_transicao_inscricao BEFORE UPDATE ON public.inscricoes_atividades FOR EACH ROW EXECUTE FUNCTION validar_transicao_inscricao();
CREATE TRIGGER trg_voluntarios_atualizado BEFORE UPDATE ON public.voluntarios FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

-- rls
ALTER TABLE public.atividade_habilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracao_instituicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contribuicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diario_transparencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscricoes_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_demandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ongs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_habilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voluntarios ENABLE ROW LEVEL SECURITY;

-- policies
CREATE POLICY "atividade_habilidades: leitura por autenticados" ON public.atividade_habilidades AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "atividade_habilidades: quem edita a atividade desmarca" ON public.atividade_habilidades AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM atividades a
  WHERE ((a.id = atividade_habilidades.atividade_id) AND (e_ong() OR ((a.autor_id = ( SELECT auth.uid() AS uid)) AND (a.status = 'PENDENTE_APROVACAO'::status_atividade)))))));
CREATE POLICY "atividade_habilidades: quem edita a atividade marca" ON public.atividade_habilidades AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM atividades a
  WHERE ((a.id = atividade_habilidades.atividade_id) AND (e_ong() OR ((a.autor_id = ( SELECT auth.uid() AS uid)) AND (a.status = 'PENDENTE_APROVACAO'::status_atividade)))))));
CREATE POLICY "atividades: autor ou gestão atualiza" ON public.atividades AS PERMISSIVE FOR UPDATE TO authenticated USING ((((autor_id = ( SELECT auth.uid() AS uid)) AND (status = 'PENDENTE_APROVACAO'::status_atividade)) OR e_ong())) WITH CHECK ((((autor_id = ( SELECT auth.uid() AS uid)) AND (status = 'PENDENTE_APROVACAO'::status_atividade)) OR e_ong()));
CREATE POLICY "atividades: insere tarefa ou propõe oficina" ON public.atividades AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((e_ong() AND (autor_id = ( SELECT auth.uid() AS uid))) OR ((autor_id = ( SELECT auth.uid() AS uid)) AND (tipo = 'OFICINA_AUTORAL'::tipo_atividade) AND (status = 'PENDENTE_APROVACAO'::status_atividade) AND perfil_completo())));
CREATE POLICY "atividades: publicadas para todos, rascunhos para o autor" ON public.atividades AS PERMISSIVE FOR SELECT TO authenticated USING (((status = ANY (ARRAY['ABERTA'::status_atividade, 'ENCERRADA'::status_atividade, 'REALIZADA'::status_atividade])) OR (autor_id = ( SELECT auth.uid() AS uid)) OR e_ong()));
CREATE POLICY "atividades: só a gestão exclui" ON public.atividades AS PERMISSIVE FOR DELETE TO authenticated USING (e_ong());
CREATE POLICY "configuracao: leitura pública" ON public.configuracao_instituicao AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "configuracao: só a gestão atualiza" ON public.configuracao_instituicao AS PERMISSIVE FOR UPDATE TO authenticated USING (e_ong()) WITH CHECK (e_ong());
CREATE POLICY "contribuicoes: gestão lança o que recebeu" ON public.contribuicoes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((e_ong() AND (status_validacao = 'APROVADA'::status_validacao) AND (validado_por = ( SELECT auth.uid() AS uid))));
CREATE POLICY "contribuicoes: o próprio ou a gestão lê" ON public.contribuicoes AS PERMISSIVE FOR SELECT TO authenticated USING (((usuario_id = ( SELECT auth.uid() AS uid)) OR e_ong()));
CREATE POLICY "contribuicoes: só a gestão exclui" ON public.contribuicoes AS PERMISSIVE FOR DELETE TO authenticated USING (e_ong());
CREATE POLICY "contribuicoes: só a gestão valida" ON public.contribuicoes AS PERMISSIVE FOR UPDATE TO authenticated USING (e_ong()) WITH CHECK ((e_ong() AND (validado_por = ( SELECT auth.uid() AS uid))));
CREATE POLICY "contribuicoes: usuário envia comprovante" ON public.contribuicoes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((usuario_id = ( SELECT auth.uid() AS uid)) AND (status_validacao = 'PENDENTE'::status_validacao)));
CREATE POLICY "diario: gestão edita" ON public.diario_transparencia AS PERMISSIVE FOR UPDATE TO authenticated USING (e_ong()) WITH CHECK (e_ong());
CREATE POLICY "diario: gestão exclui" ON public.diario_transparencia AS PERMISSIVE FOR DELETE TO authenticated USING (e_ong());
CREATE POLICY "diario: gestão publica" ON public.diario_transparencia AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((e_ong() AND (autor_id = ( SELECT auth.uid() AS uid))));
CREATE POLICY "diario: leitura por autenticados" ON public.diario_transparencia AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "habilidades: gestão atualiza" ON public.habilidades AS PERMISSIVE FOR UPDATE TO authenticated USING (e_ong()) WITH CHECK (e_ong());
CREATE POLICY "habilidades: gestão exclui" ON public.habilidades AS PERMISSIVE FOR DELETE TO authenticated USING (e_ong());
CREATE POLICY "habilidades: gestão insere" ON public.habilidades AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (e_ong());
CREATE POLICY "habilidades: leitura por autenticados" ON public.habilidades AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "inscricoes: interessados leem" ON public.inscricoes_atividades AS PERMISSIVE FOR SELECT TO authenticated USING (((usuario_id = ( SELECT auth.uid() AS uid)) OR e_ong() OR (EXISTS ( SELECT 1
   FROM atividades a
  WHERE ((a.id = inscricoes_atividades.atividade_id) AND (a.autor_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY "inscricoes: só a gestão exclui" ON public.inscricoes_atividades AS PERMISSIVE FOR DELETE TO authenticated USING (e_ong());
CREATE POLICY "inscricoes: usuário cancela ou recandidata, gestão faz triage" ON public.inscricoes_atividades AS PERMISSIVE FOR UPDATE TO authenticated USING (((usuario_id = ( SELECT auth.uid() AS uid)) OR e_ong())) WITH CHECK ((e_ong() OR ((usuario_id = ( SELECT auth.uid() AS uid)) AND ((status_inscricao = 'CANCELADA'::status_inscricao) OR ((status_inscricao = 'PENDENTE'::status_inscricao) AND (EXISTS ( SELECT 1
   FROM atividades a
  WHERE ((a.id = inscricoes_atividades.atividade_id) AND (a.status = 'ABERTA'::status_atividade) AND (a.data_hora_prevista > now())))))))));
CREATE POLICY "inscricoes: voluntário se candidata" ON public.inscricoes_atividades AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((usuario_id = ( SELECT auth.uid() AS uid)) AND perfil_completo() AND (EXISTS ( SELECT 1
   FROM atividades a
  WHERE ((a.id = inscricoes_atividades.atividade_id) AND (a.status = 'ABERTA'::status_atividade) AND (a.data_hora_prevista > now()) AND (a.vagas_ocupadas < a.vagas_totais))))));
CREATE POLICY "metas_demandas: gestão atualiza" ON public.metas_demandas AS PERMISSIVE FOR UPDATE TO authenticated USING (e_ong()) WITH CHECK (e_ong());
CREATE POLICY "metas_demandas: gestão exclui" ON public.metas_demandas AS PERMISSIVE FOR DELETE TO authenticated USING (e_ong());
CREATE POLICY "metas_demandas: gestão insere" ON public.metas_demandas AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (e_ong());
CREATE POLICY "metas_demandas: leitura por autenticados" ON public.metas_demandas AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "ongs: cria a própria linha" ON public.ongs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((usuario_id = ( SELECT auth.uid() AS uid)) AND e_ong()));
CREATE POLICY "ongs: edita os próprios dados" ON public.ongs AS PERMISSIVE FOR UPDATE TO authenticated USING ((usuario_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((usuario_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "ongs: leitura por autenticados" ON public.ongs AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuario_habilidades: o próprio ou a gestão lê" ON public.usuario_habilidades AS PERMISSIVE FOR SELECT TO authenticated USING (((usuario_id = ( SELECT auth.uid() AS uid)) OR e_ong()));
CREATE POLICY "usuario_habilidades: usuário adiciona as próprias" ON public.usuario_habilidades AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((usuario_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "usuario_habilidades: usuário remove as próprias" ON public.usuario_habilidades AS PERMISSIVE FOR DELETE TO authenticated USING ((usuario_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "usuarios: edita o próprio perfil" ON public.usuarios AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "usuarios: leitura por autenticados" ON public.usuarios AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "voluntarios: cria a própria linha" ON public.voluntarios AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((usuario_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "voluntarios: edita os próprios dados" ON public.voluntarios AS PERMISSIVE FOR UPDATE TO authenticated USING ((usuario_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((usuario_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "voluntarios: o próprio ou a gestão" ON public.voluntarios AS PERMISSIVE FOR SELECT TO authenticated USING (((usuario_id = ( SELECT auth.uid() AS uid)) OR e_ong()));

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated,service_role;
GRANT DELETE ON TABLE public.atividade_habilidades TO anon;
GRANT INSERT ON TABLE public.atividade_habilidades TO anon;
GRANT REFERENCES ON TABLE public.atividade_habilidades TO anon;
GRANT SELECT ON TABLE public.atividade_habilidades TO anon;
GRANT TRIGGER ON TABLE public.atividade_habilidades TO anon;
GRANT TRUNCATE ON TABLE public.atividade_habilidades TO anon;
GRANT UPDATE ON TABLE public.atividade_habilidades TO anon;
GRANT DELETE ON TABLE public.atividade_habilidades TO authenticated;
GRANT INSERT ON TABLE public.atividade_habilidades TO authenticated;
GRANT REFERENCES ON TABLE public.atividade_habilidades TO authenticated;
GRANT SELECT ON TABLE public.atividade_habilidades TO authenticated;
GRANT TRIGGER ON TABLE public.atividade_habilidades TO authenticated;
GRANT TRUNCATE ON TABLE public.atividade_habilidades TO authenticated;
GRANT UPDATE ON TABLE public.atividade_habilidades TO authenticated;
GRANT DELETE ON TABLE public.atividade_habilidades TO service_role;
GRANT INSERT ON TABLE public.atividade_habilidades TO service_role;
GRANT REFERENCES ON TABLE public.atividade_habilidades TO service_role;
GRANT SELECT ON TABLE public.atividade_habilidades TO service_role;
GRANT TRIGGER ON TABLE public.atividade_habilidades TO service_role;
GRANT TRUNCATE ON TABLE public.atividade_habilidades TO service_role;
GRANT UPDATE ON TABLE public.atividade_habilidades TO service_role;
GRANT DELETE ON TABLE public.atividades TO anon;
GRANT INSERT ON TABLE public.atividades TO anon;
GRANT REFERENCES ON TABLE public.atividades TO anon;
GRANT SELECT ON TABLE public.atividades TO anon;
GRANT TRIGGER ON TABLE public.atividades TO anon;
GRANT TRUNCATE ON TABLE public.atividades TO anon;
GRANT UPDATE ON TABLE public.atividades TO anon;
GRANT DELETE ON TABLE public.atividades TO authenticated;
GRANT INSERT ON TABLE public.atividades TO authenticated;
GRANT REFERENCES ON TABLE public.atividades TO authenticated;
GRANT SELECT ON TABLE public.atividades TO authenticated;
GRANT TRIGGER ON TABLE public.atividades TO authenticated;
GRANT TRUNCATE ON TABLE public.atividades TO authenticated;
GRANT UPDATE ON TABLE public.atividades TO authenticated;
GRANT DELETE ON TABLE public.atividades TO service_role;
GRANT INSERT ON TABLE public.atividades TO service_role;
GRANT REFERENCES ON TABLE public.atividades TO service_role;
GRANT SELECT ON TABLE public.atividades TO service_role;
GRANT TRIGGER ON TABLE public.atividades TO service_role;
GRANT TRUNCATE ON TABLE public.atividades TO service_role;
GRANT UPDATE ON TABLE public.atividades TO service_role;
GRANT DELETE ON TABLE public.configuracao_instituicao TO anon;
GRANT INSERT ON TABLE public.configuracao_instituicao TO anon;
GRANT REFERENCES ON TABLE public.configuracao_instituicao TO anon;
GRANT SELECT ON TABLE public.configuracao_instituicao TO anon;
GRANT TRIGGER ON TABLE public.configuracao_instituicao TO anon;
GRANT TRUNCATE ON TABLE public.configuracao_instituicao TO anon;
GRANT UPDATE ON TABLE public.configuracao_instituicao TO anon;
GRANT DELETE ON TABLE public.configuracao_instituicao TO authenticated;
GRANT INSERT ON TABLE public.configuracao_instituicao TO authenticated;
GRANT REFERENCES ON TABLE public.configuracao_instituicao TO authenticated;
GRANT SELECT ON TABLE public.configuracao_instituicao TO authenticated;
GRANT TRIGGER ON TABLE public.configuracao_instituicao TO authenticated;
GRANT TRUNCATE ON TABLE public.configuracao_instituicao TO authenticated;
GRANT UPDATE ON TABLE public.configuracao_instituicao TO authenticated;
GRANT DELETE ON TABLE public.configuracao_instituicao TO service_role;
GRANT INSERT ON TABLE public.configuracao_instituicao TO service_role;
GRANT REFERENCES ON TABLE public.configuracao_instituicao TO service_role;
GRANT SELECT ON TABLE public.configuracao_instituicao TO service_role;
GRANT TRIGGER ON TABLE public.configuracao_instituicao TO service_role;
GRANT TRUNCATE ON TABLE public.configuracao_instituicao TO service_role;
GRANT UPDATE ON TABLE public.configuracao_instituicao TO service_role;
GRANT DELETE ON TABLE public.contribuicoes TO anon;
GRANT INSERT ON TABLE public.contribuicoes TO anon;
GRANT REFERENCES ON TABLE public.contribuicoes TO anon;
GRANT SELECT ON TABLE public.contribuicoes TO anon;
GRANT TRIGGER ON TABLE public.contribuicoes TO anon;
GRANT TRUNCATE ON TABLE public.contribuicoes TO anon;
GRANT UPDATE ON TABLE public.contribuicoes TO anon;
GRANT DELETE ON TABLE public.contribuicoes TO authenticated;
GRANT INSERT ON TABLE public.contribuicoes TO authenticated;
GRANT REFERENCES ON TABLE public.contribuicoes TO authenticated;
GRANT SELECT ON TABLE public.contribuicoes TO authenticated;
GRANT TRIGGER ON TABLE public.contribuicoes TO authenticated;
GRANT TRUNCATE ON TABLE public.contribuicoes TO authenticated;
GRANT UPDATE ON TABLE public.contribuicoes TO authenticated;
GRANT DELETE ON TABLE public.contribuicoes TO service_role;
GRANT INSERT ON TABLE public.contribuicoes TO service_role;
GRANT REFERENCES ON TABLE public.contribuicoes TO service_role;
GRANT SELECT ON TABLE public.contribuicoes TO service_role;
GRANT TRIGGER ON TABLE public.contribuicoes TO service_role;
GRANT TRUNCATE ON TABLE public.contribuicoes TO service_role;
GRANT UPDATE ON TABLE public.contribuicoes TO service_role;
GRANT DELETE ON TABLE public.diario_transparencia TO anon;
GRANT INSERT ON TABLE public.diario_transparencia TO anon;
GRANT REFERENCES ON TABLE public.diario_transparencia TO anon;
GRANT SELECT ON TABLE public.diario_transparencia TO anon;
GRANT TRIGGER ON TABLE public.diario_transparencia TO anon;
GRANT TRUNCATE ON TABLE public.diario_transparencia TO anon;
GRANT UPDATE ON TABLE public.diario_transparencia TO anon;
GRANT DELETE ON TABLE public.diario_transparencia TO authenticated;
GRANT INSERT ON TABLE public.diario_transparencia TO authenticated;
GRANT REFERENCES ON TABLE public.diario_transparencia TO authenticated;
GRANT SELECT ON TABLE public.diario_transparencia TO authenticated;
GRANT TRIGGER ON TABLE public.diario_transparencia TO authenticated;
GRANT TRUNCATE ON TABLE public.diario_transparencia TO authenticated;
GRANT UPDATE ON TABLE public.diario_transparencia TO authenticated;
GRANT DELETE ON TABLE public.diario_transparencia TO service_role;
GRANT INSERT ON TABLE public.diario_transparencia TO service_role;
GRANT REFERENCES ON TABLE public.diario_transparencia TO service_role;
GRANT SELECT ON TABLE public.diario_transparencia TO service_role;
GRANT TRIGGER ON TABLE public.diario_transparencia TO service_role;
GRANT TRUNCATE ON TABLE public.diario_transparencia TO service_role;
GRANT UPDATE ON TABLE public.diario_transparencia TO service_role;
GRANT DELETE ON TABLE public.habilidades TO anon;
GRANT INSERT ON TABLE public.habilidades TO anon;
GRANT REFERENCES ON TABLE public.habilidades TO anon;
GRANT SELECT ON TABLE public.habilidades TO anon;
GRANT TRIGGER ON TABLE public.habilidades TO anon;
GRANT TRUNCATE ON TABLE public.habilidades TO anon;
GRANT UPDATE ON TABLE public.habilidades TO anon;
GRANT DELETE ON TABLE public.habilidades TO authenticated;
GRANT INSERT ON TABLE public.habilidades TO authenticated;
GRANT REFERENCES ON TABLE public.habilidades TO authenticated;
GRANT SELECT ON TABLE public.habilidades TO authenticated;
GRANT TRIGGER ON TABLE public.habilidades TO authenticated;
GRANT TRUNCATE ON TABLE public.habilidades TO authenticated;
GRANT UPDATE ON TABLE public.habilidades TO authenticated;
GRANT DELETE ON TABLE public.habilidades TO service_role;
GRANT INSERT ON TABLE public.habilidades TO service_role;
GRANT REFERENCES ON TABLE public.habilidades TO service_role;
GRANT SELECT ON TABLE public.habilidades TO service_role;
GRANT TRIGGER ON TABLE public.habilidades TO service_role;
GRANT TRUNCATE ON TABLE public.habilidades TO service_role;
GRANT UPDATE ON TABLE public.habilidades TO service_role;
GRANT DELETE ON TABLE public.inscricoes_atividades TO anon;
GRANT INSERT ON TABLE public.inscricoes_atividades TO anon;
GRANT REFERENCES ON TABLE public.inscricoes_atividades TO anon;
GRANT SELECT ON TABLE public.inscricoes_atividades TO anon;
GRANT TRIGGER ON TABLE public.inscricoes_atividades TO anon;
GRANT TRUNCATE ON TABLE public.inscricoes_atividades TO anon;
GRANT UPDATE ON TABLE public.inscricoes_atividades TO anon;
GRANT DELETE ON TABLE public.inscricoes_atividades TO authenticated;
GRANT INSERT ON TABLE public.inscricoes_atividades TO authenticated;
GRANT REFERENCES ON TABLE public.inscricoes_atividades TO authenticated;
GRANT SELECT ON TABLE public.inscricoes_atividades TO authenticated;
GRANT TRIGGER ON TABLE public.inscricoes_atividades TO authenticated;
GRANT TRUNCATE ON TABLE public.inscricoes_atividades TO authenticated;
GRANT UPDATE ON TABLE public.inscricoes_atividades TO authenticated;
GRANT DELETE ON TABLE public.inscricoes_atividades TO service_role;
GRANT INSERT ON TABLE public.inscricoes_atividades TO service_role;
GRANT REFERENCES ON TABLE public.inscricoes_atividades TO service_role;
GRANT SELECT ON TABLE public.inscricoes_atividades TO service_role;
GRANT TRIGGER ON TABLE public.inscricoes_atividades TO service_role;
GRANT TRUNCATE ON TABLE public.inscricoes_atividades TO service_role;
GRANT UPDATE ON TABLE public.inscricoes_atividades TO service_role;
GRANT DELETE ON TABLE public.metas_demandas TO anon;
GRANT INSERT ON TABLE public.metas_demandas TO anon;
GRANT REFERENCES ON TABLE public.metas_demandas TO anon;
GRANT SELECT ON TABLE public.metas_demandas TO anon;
GRANT TRIGGER ON TABLE public.metas_demandas TO anon;
GRANT TRUNCATE ON TABLE public.metas_demandas TO anon;
GRANT UPDATE ON TABLE public.metas_demandas TO anon;
GRANT DELETE ON TABLE public.metas_demandas TO authenticated;
GRANT INSERT ON TABLE public.metas_demandas TO authenticated;
GRANT REFERENCES ON TABLE public.metas_demandas TO authenticated;
GRANT SELECT ON TABLE public.metas_demandas TO authenticated;
GRANT TRIGGER ON TABLE public.metas_demandas TO authenticated;
GRANT TRUNCATE ON TABLE public.metas_demandas TO authenticated;
GRANT UPDATE ON TABLE public.metas_demandas TO authenticated;
GRANT DELETE ON TABLE public.metas_demandas TO service_role;
GRANT INSERT ON TABLE public.metas_demandas TO service_role;
GRANT REFERENCES ON TABLE public.metas_demandas TO service_role;
GRANT SELECT ON TABLE public.metas_demandas TO service_role;
GRANT TRIGGER ON TABLE public.metas_demandas TO service_role;
GRANT TRUNCATE ON TABLE public.metas_demandas TO service_role;
GRANT UPDATE ON TABLE public.metas_demandas TO service_role;
GRANT DELETE ON TABLE public.ongs TO anon;
GRANT INSERT ON TABLE public.ongs TO anon;
GRANT REFERENCES ON TABLE public.ongs TO anon;
GRANT SELECT ON TABLE public.ongs TO anon;
GRANT TRIGGER ON TABLE public.ongs TO anon;
GRANT TRUNCATE ON TABLE public.ongs TO anon;
GRANT UPDATE ON TABLE public.ongs TO anon;
GRANT DELETE ON TABLE public.ongs TO authenticated;
GRANT INSERT ON TABLE public.ongs TO authenticated;
GRANT REFERENCES ON TABLE public.ongs TO authenticated;
GRANT SELECT ON TABLE public.ongs TO authenticated;
GRANT TRIGGER ON TABLE public.ongs TO authenticated;
GRANT TRUNCATE ON TABLE public.ongs TO authenticated;
GRANT UPDATE ON TABLE public.ongs TO authenticated;
GRANT DELETE ON TABLE public.ongs TO service_role;
GRANT INSERT ON TABLE public.ongs TO service_role;
GRANT REFERENCES ON TABLE public.ongs TO service_role;
GRANT SELECT ON TABLE public.ongs TO service_role;
GRANT TRIGGER ON TABLE public.ongs TO service_role;
GRANT TRUNCATE ON TABLE public.ongs TO service_role;
GRANT UPDATE ON TABLE public.ongs TO service_role;
GRANT DELETE ON TABLE public.usuario_habilidades TO anon;
GRANT INSERT ON TABLE public.usuario_habilidades TO anon;
GRANT REFERENCES ON TABLE public.usuario_habilidades TO anon;
GRANT SELECT ON TABLE public.usuario_habilidades TO anon;
GRANT TRIGGER ON TABLE public.usuario_habilidades TO anon;
GRANT TRUNCATE ON TABLE public.usuario_habilidades TO anon;
GRANT UPDATE ON TABLE public.usuario_habilidades TO anon;
GRANT DELETE ON TABLE public.usuario_habilidades TO authenticated;
GRANT INSERT ON TABLE public.usuario_habilidades TO authenticated;
GRANT REFERENCES ON TABLE public.usuario_habilidades TO authenticated;
GRANT SELECT ON TABLE public.usuario_habilidades TO authenticated;
GRANT TRIGGER ON TABLE public.usuario_habilidades TO authenticated;
GRANT TRUNCATE ON TABLE public.usuario_habilidades TO authenticated;
GRANT UPDATE ON TABLE public.usuario_habilidades TO authenticated;
GRANT DELETE ON TABLE public.usuario_habilidades TO service_role;
GRANT INSERT ON TABLE public.usuario_habilidades TO service_role;
GRANT REFERENCES ON TABLE public.usuario_habilidades TO service_role;
GRANT SELECT ON TABLE public.usuario_habilidades TO service_role;
GRANT TRIGGER ON TABLE public.usuario_habilidades TO service_role;
GRANT TRUNCATE ON TABLE public.usuario_habilidades TO service_role;
GRANT UPDATE ON TABLE public.usuario_habilidades TO service_role;
GRANT DELETE ON TABLE public.usuarios TO anon;
GRANT INSERT ON TABLE public.usuarios TO anon;
GRANT REFERENCES ON TABLE public.usuarios TO anon;
GRANT SELECT ON TABLE public.usuarios TO anon;
GRANT TRIGGER ON TABLE public.usuarios TO anon;
GRANT TRUNCATE ON TABLE public.usuarios TO anon;
GRANT UPDATE ON TABLE public.usuarios TO anon;
GRANT DELETE ON TABLE public.usuarios TO authenticated;
GRANT INSERT ON TABLE public.usuarios TO authenticated;
GRANT REFERENCES ON TABLE public.usuarios TO authenticated;
GRANT SELECT ON TABLE public.usuarios TO authenticated;
GRANT TRIGGER ON TABLE public.usuarios TO authenticated;
GRANT TRUNCATE ON TABLE public.usuarios TO authenticated;
GRANT UPDATE ON TABLE public.usuarios TO authenticated;
GRANT DELETE ON TABLE public.usuarios TO service_role;
GRANT INSERT ON TABLE public.usuarios TO service_role;
GRANT REFERENCES ON TABLE public.usuarios TO service_role;
GRANT SELECT ON TABLE public.usuarios TO service_role;
GRANT TRIGGER ON TABLE public.usuarios TO service_role;
GRANT TRUNCATE ON TABLE public.usuarios TO service_role;
GRANT UPDATE ON TABLE public.usuarios TO service_role;
GRANT DELETE ON TABLE public.voluntarios TO anon;
GRANT INSERT ON TABLE public.voluntarios TO anon;
GRANT REFERENCES ON TABLE public.voluntarios TO anon;
GRANT SELECT ON TABLE public.voluntarios TO anon;
GRANT TRIGGER ON TABLE public.voluntarios TO anon;
GRANT TRUNCATE ON TABLE public.voluntarios TO anon;
GRANT UPDATE ON TABLE public.voluntarios TO anon;
GRANT DELETE ON TABLE public.voluntarios TO authenticated;
GRANT INSERT ON TABLE public.voluntarios TO authenticated;
GRANT REFERENCES ON TABLE public.voluntarios TO authenticated;
GRANT SELECT ON TABLE public.voluntarios TO authenticated;
GRANT TRIGGER ON TABLE public.voluntarios TO authenticated;
GRANT TRUNCATE ON TABLE public.voluntarios TO authenticated;
GRANT UPDATE ON TABLE public.voluntarios TO authenticated;
GRANT DELETE ON TABLE public.voluntarios TO service_role;
GRANT INSERT ON TABLE public.voluntarios TO service_role;
GRANT REFERENCES ON TABLE public.voluntarios TO service_role;
GRANT SELECT ON TABLE public.voluntarios TO service_role;
GRANT TRIGGER ON TABLE public.voluntarios TO service_role;
GRANT TRUNCATE ON TABLE public.voluntarios TO service_role;
GRANT UPDATE ON TABLE public.voluntarios TO service_role;
GRANT EXECUTE ON FUNCTION atualizar_arrecadacao_meta() TO service_role;
GRANT EXECUTE ON FUNCTION atualizar_vagas_ocupadas() TO service_role;
GRANT EXECUTE ON FUNCTION e_ong(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION e_ong(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION perfil_completo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION perfil_completo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION proteger_campos_perfil() TO PUBLIC;
GRANT EXECUTE ON FUNCTION proteger_campos_perfil() TO anon;
GRANT EXECUTE ON FUNCTION proteger_campos_perfil() TO authenticated;
GRANT EXECUTE ON FUNCTION proteger_campos_perfil() TO service_role;
GRANT EXECUTE ON FUNCTION set_atualizado_em() TO service_role;
GRANT EXECUTE ON FUNCTION solicitar_exclusao_conta() TO authenticated;
GRANT EXECUTE ON FUNCTION solicitar_exclusao_conta() TO service_role;
GRANT EXECUTE ON FUNCTION validar_transicao_inscricao() TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon,authenticated,service_role;
-- Trigger público anexado ao mock Auth, idêntico ao catálogo remoto de auth.users.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- Defaults PUBLIC auditados: os testes comprovam fechamento explícito nos objetos novos.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
