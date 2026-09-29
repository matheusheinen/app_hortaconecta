-- Recorte de catálogo observado em 29/09/2026 via SELECT, sem dados remotos.
-- NÃO é dump integral: Auth/JWT são simulados; atividades/Storage ficam fora do recorte.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE TYPE public.tipo_perfil AS ENUM ('VOLUNTARIO','ONG');
CREATE TABLE public.usuarios (
  id uuid NOT NULL,
  nome text NOT NULL,
  telefone text,
  descricao text,
  perfil_instagram text,
  tipo_perfil public.tipo_perfil NOT NULL DEFAULT 'VOLUNTARIO'::tipo_perfil,
  foto_perfil text,
  exclusao_solicitada_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.voluntarios (
  usuario_id uuid NOT NULL,
  cpf text,
  data_nascimento date,
  profissao text,
  disponibilidade_horarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text
);
CREATE TABLE public.ongs (
  usuario_id uuid NOT NULL,
  cnpj text,
  razao_social text,
  data_criacao date,
  responsavel_legal text,
  chave_pix text,
  nome_beneficiario_pix text,
  whatsapp text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.habilidades (
  id int8 NOT NULL GENERATED ALWAYS AS IDENTITY,
  nome_habilidade text NOT NULL,
  categoria text
);
CREATE TABLE public.usuario_habilidades (
  usuario_id uuid NOT NULL,
  habilidade_id int8 NOT NULL
);
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_descricao_check CHECK ((length(descricao) <= 500));
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_nome_check CHECK (((length(TRIM(BOTH FROM nome)) >= 2) AND (length(TRIM(BOTH FROM nome)) <= 120)));
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_perfil_instagram_check CHECK ((perfil_instagram ~ '^[A-Za-z0-9._]{1,30}$'::text));
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);
ALTER TABLE public.usuarios ADD CONSTRAINT usuarios_telefone_check CHECK ((telefone ~ '^[0-9]{10,11}$'::text));
ALTER TABLE public.voluntarios ADD CONSTRAINT voluntarios_cep_check CHECK (((cep IS NULL) OR (cep ~ '^[0-9]{8}$'::text)));
ALTER TABLE public.voluntarios ADD CONSTRAINT voluntarios_cpf_check CHECK ((cpf ~ '^[0-9]{11}$'::text));
ALTER TABLE public.voluntarios ADD CONSTRAINT voluntarios_cpf_key UNIQUE (cpf);
ALTER TABLE public.voluntarios ADD CONSTRAINT voluntarios_data_nascimento_check CHECK (((data_nascimento > '1900-01-01'::date) AND (data_nascimento < CURRENT_DATE)));
ALTER TABLE public.voluntarios ADD CONSTRAINT voluntarios_pkey PRIMARY KEY (usuario_id);
ALTER TABLE public.voluntarios ADD CONSTRAINT voluntarios_uf_check CHECK (((uf IS NULL) OR (uf ~ '^[A-Z]{2}$'::text)));
ALTER TABLE public.voluntarios ADD CONSTRAINT voluntarios_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE public.habilidades ADD CONSTRAINT habilidades_nome_habilidade_check CHECK (((length(TRIM(BOTH FROM nome_habilidade)) >= 2) AND (length(TRIM(BOTH FROM nome_habilidade)) <= 80)));
ALTER TABLE public.habilidades ADD CONSTRAINT habilidades_nome_habilidade_key UNIQUE (nome_habilidade);
ALTER TABLE public.habilidades ADD CONSTRAINT habilidades_pkey PRIMARY KEY (id);
ALTER TABLE public.ongs ADD CONSTRAINT ongs_cnpj_check CHECK ((cnpj ~ '^[0-9]{14}$'::text));
ALTER TABLE public.ongs ADD CONSTRAINT ongs_cnpj_key UNIQUE (cnpj);
ALTER TABLE public.ongs ADD CONSTRAINT ongs_pkey PRIMARY KEY (usuario_id);
ALTER TABLE public.ongs ADD CONSTRAINT ongs_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE public.ongs ADD CONSTRAINT ongs_whatsapp_check CHECK ((whatsapp ~ '^[0-9]{10,11}$'::text));
ALTER TABLE public.usuario_habilidades ADD CONSTRAINT usuario_habilidades_habilidade_id_fkey FOREIGN KEY (habilidade_id) REFERENCES habilidades(id) ON DELETE CASCADE;
ALTER TABLE public.usuario_habilidades ADD CONSTRAINT usuario_habilidades_pkey PRIMARY KEY (usuario_id, habilidade_id);
ALTER TABLE public.usuario_habilidades ADD CONSTRAINT usuario_habilidades_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;
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

CREATE TRIGGER trg_proteger_campos_perfil BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION proteger_campos_perfil();
CREATE TRIGGER trg_usuarios_atualizado BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER trg_voluntarios_atualizado BEFORE UPDATE ON public.voluntarios FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
CREATE TRIGGER trg_ongs_atualizado BEFORE UPDATE ON public.ongs FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();
ALTER TABLE public.habilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ongs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_habilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voluntarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuarios: leitura por autenticados" ON public.usuarios AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "usuarios: edita o próprio perfil" ON public.usuarios AS PERMISSIVE FOR UPDATE TO authenticated USING ((id = ( SELECT auth.uid() AS uid))) WITH CHECK ((id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "voluntarios: o próprio ou a gestão" ON public.voluntarios AS PERMISSIVE FOR SELECT TO authenticated USING (((usuario_id = ( SELECT auth.uid() AS uid)) OR e_ong()));
CREATE POLICY "voluntarios: edita os próprios dados" ON public.voluntarios AS PERMISSIVE FOR UPDATE TO authenticated USING ((usuario_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((usuario_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "voluntarios: cria a própria linha" ON public.voluntarios AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((usuario_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "ongs: leitura por autenticados" ON public.ongs AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "ongs: cria a própria linha" ON public.ongs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((usuario_id = ( SELECT auth.uid() AS uid)) AND e_ong()));
CREATE POLICY "ongs: edita os próprios dados" ON public.ongs AS PERMISSIVE FOR UPDATE TO authenticated USING ((usuario_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((usuario_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "usuario_habilidades: o próprio ou a gestão lê" ON public.usuario_habilidades AS PERMISSIVE FOR SELECT TO authenticated USING (((usuario_id = ( SELECT auth.uid() AS uid)) OR e_ong()));
CREATE POLICY "usuario_habilidades: usuário adiciona as próprias" ON public.usuario_habilidades AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((usuario_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "usuario_habilidades: usuário remove as próprias" ON public.usuario_habilidades AS PERMISSIVE FOR DELETE TO authenticated USING ((usuario_id = ( SELECT auth.uid() AS uid)));
REVOKE ALL ON FUNCTION public.perfil_completo(uuid),public.e_ong(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.perfil_completo(uuid),public.e_ong(uuid) TO authenticated,service_role;
-- Reproduz defaults amplos para provar que a migration restringe seus objetos novos.
ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES GRANT USAGE ON SCHEMAS TO anon,authenticated,service_role;
