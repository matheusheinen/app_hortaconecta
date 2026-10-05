-- Fixture EXCLUSIVAMENTE para PostgreSQL em memória nos testes.
-- Não é baseline de produção e não afirma reproduzir o schema remoto ausente.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
CREATE TYPE public.tipo_perfil AS ENUM ('VOLUNTARIO','ONG');
CREATE TYPE public.tipo_atividade AS ENUM ('TAREFA_ONG','OFICINA_AUTORAL');
CREATE TYPE public.status_atividade AS ENUM ('PENDENTE_APROVACAO','ABERTA','ENCERRADA','REALIZADA','CANCELADA','RECUSADA');
CREATE TABLE public.usuarios (
  id uuid PRIMARY KEY, nome text NOT NULL, telefone text, endereco text, descricao text,
  perfil_instagram text, tipo_perfil public.tipo_perfil NOT NULL DEFAULT 'VOLUNTARIO',
  foto_perfil text, exclusao_solicitada_em timestamptz,
  criado_em timestamptz DEFAULT now(), atualizado_em timestamptz DEFAULT now()
);
CREATE TABLE public.voluntarios (
  usuario_id uuid PRIMARY KEY REFERENCES public.usuarios(id), cpf text UNIQUE,
  data_nascimento date, profissao text, disponibilidade_horarios jsonb NOT NULL DEFAULT '[]',
  atualizado_em timestamptz DEFAULT now()
);
CREATE TABLE public.atividades (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, titulo text NOT NULL, descricao text NOT NULL,
  tipo public.tipo_atividade NOT NULL, autor_id uuid NOT NULL REFERENCES public.usuarios(id),
  data_hora_prevista timestamptz NOT NULL, vagas_totais integer NOT NULL CHECK(vagas_totais > 0),
  carga_horaria numeric NOT NULL CHECK(carga_horaria > 0), status public.status_atividade NOT NULL DEFAULT 'ABERTA',
  criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.e_ong() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM public.usuarios WHERE id = auth.uid() AND tipo_perfil = 'ONG');
$$;
CREATE FUNCTION public.perfil_completo() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true; $$;
CREATE FUNCTION public.set_atualizado_em() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END $$;
