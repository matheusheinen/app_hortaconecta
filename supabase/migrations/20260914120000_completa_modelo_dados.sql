--
-- Completa o modelo de dados: habilidades, ongs, inscrições, arrecadação e
-- diário de transparência. Ver CLAUDE.md > Modelo de dados / Regras de negócio.
--

--
-- Enums
--

CREATE TYPE public.tipo_meta AS ENUM (
    'FINANCEIRA',
    'MATERIAL'
);

CREATE TYPE public.status_meta AS ENUM (
    'ABERTA',
    'ENCERRADA',
    'CANCELADA'
);

CREATE TYPE public.status_validacao AS ENUM (
    'PENDENTE',
    'APROVADA',
    'RECUSADA'
);

CREATE TYPE public.status_inscricao AS ENUM (
    'PENDENTE',
    'APROVADA',
    'RECUSADA',
    'CANCELADA'
);


--
-- Tabelas
--

CREATE TABLE public.habilidades (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome_habilidade text NOT NULL,
    categoria text,
    CONSTRAINT habilidades_nome_habilidade_key UNIQUE (nome_habilidade),
    CONSTRAINT habilidades_nome_habilidade_check CHECK ((length(TRIM(BOTH FROM nome_habilidade)) BETWEEN 2 AND 80))
);

CREATE TABLE public.ongs (
    usuario_id uuid PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
    cnpj text,
    razao_social text,
    data_criacao date,
    responsavel_legal text,
    chave_pix text,
    nome_beneficiario_pix text,
    whatsapp text,
    atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT ongs_cnpj_key UNIQUE (cnpj),
    CONSTRAINT ongs_cnpj_check CHECK ((cnpj ~ '^[0-9]{14}$'::text)),
    CONSTRAINT ongs_whatsapp_check CHECK ((whatsapp ~ '^[0-9]{10,11}$'::text))
);

CREATE TABLE public.usuario_habilidades (
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    habilidade_id bigint NOT NULL REFERENCES public.habilidades(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, habilidade_id)
);

CREATE TABLE public.inscricoes_atividades (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    atividade_id bigint NOT NULL REFERENCES public.atividades(id) ON DELETE CASCADE,
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    data_inscricao timestamp with time zone NOT NULL DEFAULT now(),
    status_inscricao public.status_inscricao NOT NULL DEFAULT 'PENDENTE',
    presenca_confirmada boolean NOT NULL DEFAULT false,
    CONSTRAINT inscricoes_atividades_unica UNIQUE (atividade_id, usuario_id)
);

CREATE TABLE public.metas_demandas (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo text NOT NULL,
    descricao text NOT NULL,
    tipo public.tipo_meta NOT NULL,
    unidade_medida text,
    quantidade_meta numeric(12,2) NOT NULL,
    quantidade_arrecadada numeric(12,2) NOT NULL DEFAULT 0,
    url_imagem_capa text,
    data_limite date,
    status public.status_meta NOT NULL DEFAULT 'ABERTA',
    criado_em timestamp with time zone NOT NULL DEFAULT now(),
    atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT metas_demandas_titulo_check CHECK ((length(TRIM(BOTH FROM titulo)) BETWEEN 3 AND 120)),
    CONSTRAINT metas_demandas_quantidade_meta_check CHECK ((quantidade_meta > 0)),
    CONSTRAINT metas_demandas_quantidade_arrecadada_check CHECK ((quantidade_arrecadada >= 0))
);

COMMENT ON TABLE public.metas_demandas IS 'quantidade_arrecadada só é atualizada via validação de contribuições (trigger atualizar_arrecadacao_meta).';

CREATE TABLE public.contribuicoes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    meta_id bigint NOT NULL REFERENCES public.metas_demandas(id) ON DELETE CASCADE,
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    quantidade_oferecida numeric(12,2) NOT NULL,
    url_comprovante text NOT NULL,
    data_envio timestamp with time zone NOT NULL DEFAULT now(),
    status_validacao public.status_validacao NOT NULL DEFAULT 'PENDENTE',
    validado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    validado_em timestamp with time zone,
    observacao_validacao text,
    CONSTRAINT contribuicoes_quantidade_check CHECK ((quantidade_oferecida > 0)),
    CONSTRAINT contribuicoes_validacao_coerente_check CHECK (
        ((status_validacao = 'PENDENTE') AND validado_por IS NULL AND validado_em IS NULL)
        OR ((status_validacao <> 'PENDENTE') AND validado_por IS NOT NULL AND validado_em IS NOT NULL)
    )
);

CREATE TABLE public.diario_transparencia (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    titulo text NOT NULL,
    descricao_curta text,
    url_imagem text,
    atividade_id bigint REFERENCES public.atividades(id) ON DELETE SET NULL,
    data_publicacao timestamp with time zone NOT NULL DEFAULT now(),
    autor_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT diario_transparencia_titulo_check CHECK ((length(TRIM(BOTH FROM titulo)) BETWEEN 3 AND 120))
);

CREATE TABLE public.configuracao_instituicao (
    id smallint PRIMARY KEY DEFAULT 1,
    nome_curto text NOT NULL,
    nome_completo text NOT NULL,
    cidade text NOT NULL,
    uf text NOT NULL,
    chamada text,
    sobre text,
    cor_primaria text,
    cor_acento text,
    url_logo text,
    site text,
    telefone text,
    whatsapp text,
    email_contato text,
    atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT configuracao_instituicao_singleton_check CHECK ((id = 1)),
    CONSTRAINT configuracao_instituicao_uf_check CHECK ((uf ~ '^[A-Z]{2}$'::text))
);

COMMENT ON TABLE public.configuracao_instituicao IS 'Registro único com nome, cores e contatos da instituição. Não fixar esses valores no código — ver CLAUDE.md > RNF0005.';


--
-- Índices
--

CREATE INDEX usuario_habilidades_habilidade_idx ON public.usuario_habilidades USING btree (habilidade_id);
CREATE INDEX inscricoes_atividades_atividade_idx ON public.inscricoes_atividades USING btree (atividade_id);
CREATE INDEX inscricoes_atividades_usuario_idx ON public.inscricoes_atividades USING btree (usuario_id);
CREATE INDEX metas_demandas_status_idx ON public.metas_demandas USING btree (status, data_limite);
CREATE INDEX contribuicoes_meta_idx ON public.contribuicoes USING btree (meta_id);
CREATE INDEX contribuicoes_usuario_idx ON public.contribuicoes USING btree (usuario_id);
CREATE INDEX diario_transparencia_publicacao_idx ON public.diario_transparencia USING btree (data_publicacao DESC);


--
-- Função e trigger: baixa de arrecadação só após validação da contribuição
--

CREATE FUNCTION public.atualizar_arrecadacao_meta() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  if new.status_validacao = 'APROVADA' and old.status_validacao is distinct from 'APROVADA' then
    update public.metas_demandas
       set quantidade_arrecadada = quantidade_arrecadada + new.quantidade_oferecida
     where id = new.meta_id;
  elsif old.status_validacao = 'APROVADA' and new.status_validacao is distinct from 'APROVADA' then
    update public.metas_demandas
       set quantidade_arrecadada = quantidade_arrecadada - old.quantidade_oferecida
     where id = new.meta_id;
  end if;

  return new;
end;
$$;

CREATE TRIGGER trg_contribuicoes_arrecadacao AFTER UPDATE ON public.contribuicoes FOR EACH ROW EXECUTE FUNCTION public.atualizar_arrecadacao_meta();


--
-- Triggers de atualizado_em (reaproveitam public.set_atualizado_em())
--

CREATE TRIGGER trg_ongs_atualizado BEFORE UPDATE ON public.ongs FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();
CREATE TRIGGER trg_metas_demandas_atualizado BEFORE UPDATE ON public.metas_demandas FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();
CREATE TRIGGER trg_configuracao_instituicao_atualizado BEFORE UPDATE ON public.configuracao_instituicao FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();


--
-- RLS: habilidades
--

ALTER TABLE public.habilidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habilidades: leitura por autenticados" ON public.habilidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "habilidades: gestão insere" ON public.habilidades FOR INSERT TO authenticated WITH CHECK (public.e_ong());
CREATE POLICY "habilidades: gestão atualiza" ON public.habilidades FOR UPDATE TO authenticated USING (public.e_ong()) WITH CHECK (public.e_ong());
CREATE POLICY "habilidades: gestão exclui" ON public.habilidades FOR DELETE TO authenticated USING (public.e_ong());


--
-- RLS: ongs
--

ALTER TABLE public.ongs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ongs: leitura por autenticados" ON public.ongs FOR SELECT TO authenticated USING (true);
CREATE POLICY "ongs: cria a própria linha" ON public.ongs FOR INSERT TO authenticated WITH CHECK ((usuario_id = (SELECT auth.uid())) AND public.e_ong());
CREATE POLICY "ongs: edita os próprios dados" ON public.ongs FOR UPDATE TO authenticated USING (usuario_id = (SELECT auth.uid())) WITH CHECK (usuario_id = (SELECT auth.uid()));


--
-- RLS: usuario_habilidades
--

ALTER TABLE public.usuario_habilidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_habilidades: o próprio ou a gestão lê" ON public.usuario_habilidades FOR SELECT TO authenticated USING ((usuario_id = (SELECT auth.uid())) OR public.e_ong());
CREATE POLICY "usuario_habilidades: usuário adiciona as próprias" ON public.usuario_habilidades FOR INSERT TO authenticated WITH CHECK (usuario_id = (SELECT auth.uid()));
CREATE POLICY "usuario_habilidades: usuário remove as próprias" ON public.usuario_habilidades FOR DELETE TO authenticated USING (usuario_id = (SELECT auth.uid()));


--
-- RLS: inscricoes_atividades
--

ALTER TABLE public.inscricoes_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inscricoes: interessados leem" ON public.inscricoes_atividades FOR SELECT TO authenticated USING (
    (usuario_id = (SELECT auth.uid()))
    OR public.e_ong()
    OR EXISTS (SELECT 1 FROM public.atividades a WHERE a.id = atividade_id AND a.autor_id = (SELECT auth.uid()))
);

CREATE POLICY "inscricoes: voluntário se candidata" ON public.inscricoes_atividades FOR INSERT TO authenticated WITH CHECK (
    (usuario_id = (SELECT auth.uid()))
    AND public.perfil_completo()
    AND EXISTS (SELECT 1 FROM public.atividades a WHERE a.id = atividade_id AND a.status = 'ABERTA')
);

CREATE POLICY "inscricoes: usuário cancela, gestão faz triagem" ON public.inscricoes_atividades FOR UPDATE TO authenticated USING (
    (usuario_id = (SELECT auth.uid())) OR public.e_ong()
) WITH CHECK (
    ((usuario_id = (SELECT auth.uid())) AND (status_inscricao = 'CANCELADA'))
    OR public.e_ong()
);

CREATE POLICY "inscricoes: só a gestão exclui" ON public.inscricoes_atividades FOR DELETE TO authenticated USING (public.e_ong());


--
-- RLS: metas_demandas
--

ALTER TABLE public.metas_demandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas_demandas: leitura por autenticados" ON public.metas_demandas FOR SELECT TO authenticated USING (true);
CREATE POLICY "metas_demandas: gestão insere" ON public.metas_demandas FOR INSERT TO authenticated WITH CHECK (public.e_ong());
CREATE POLICY "metas_demandas: gestão atualiza" ON public.metas_demandas FOR UPDATE TO authenticated USING (public.e_ong()) WITH CHECK (public.e_ong());
CREATE POLICY "metas_demandas: gestão exclui" ON public.metas_demandas FOR DELETE TO authenticated USING (public.e_ong());


--
-- RLS: contribuicoes
--

ALTER TABLE public.contribuicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contribuicoes: o próprio ou a gestão lê" ON public.contribuicoes FOR SELECT TO authenticated USING ((usuario_id = (SELECT auth.uid())) OR public.e_ong());
CREATE POLICY "contribuicoes: usuário envia comprovante" ON public.contribuicoes FOR INSERT TO authenticated WITH CHECK ((usuario_id = (SELECT auth.uid())) AND (status_validacao = 'PENDENTE'));
CREATE POLICY "contribuicoes: só a gestão valida" ON public.contribuicoes FOR UPDATE TO authenticated USING (public.e_ong()) WITH CHECK (public.e_ong() AND (validado_por = (SELECT auth.uid())));
CREATE POLICY "contribuicoes: só a gestão exclui" ON public.contribuicoes FOR DELETE TO authenticated USING (public.e_ong());


--
-- RLS: diario_transparencia
--

ALTER TABLE public.diario_transparencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diario: leitura por autenticados" ON public.diario_transparencia FOR SELECT TO authenticated USING (true);
CREATE POLICY "diario: gestão publica" ON public.diario_transparencia FOR INSERT TO authenticated WITH CHECK (public.e_ong() AND (autor_id = (SELECT auth.uid())));
CREATE POLICY "diario: gestão edita" ON public.diario_transparencia FOR UPDATE TO authenticated USING (public.e_ong()) WITH CHECK (public.e_ong());
CREATE POLICY "diario: gestão exclui" ON public.diario_transparencia FOR DELETE TO authenticated USING (public.e_ong());


--
-- RLS: configuracao_instituicao
--

ALTER TABLE public.configuracao_instituicao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuracao: leitura pública" ON public.configuracao_instituicao FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "configuracao: só a gestão atualiza" ON public.configuracao_instituicao FOR UPDATE TO authenticated USING (public.e_ong()) WITH CHECK (public.e_ong());


--
-- Seed: registro único da instituição (dados públicos; PIX real não entra aqui, fica em ongs)
--

INSERT INTO public.configuracao_instituicao (nome_curto, nome_completo, cidade, uf, cor_primaria, cor_acento)
VALUES ('Horta Guaporé', 'Horta Comunitária Guaporé — Centro Ocupacional Bruno José Campos', 'Guaporé', 'RS', '#1F4A34', '#A33B52')
ON CONFLICT (id) DO NOTHING;
