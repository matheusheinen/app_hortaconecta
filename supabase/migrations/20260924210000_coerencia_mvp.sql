BEGIN;
ALTER TABLE public.diario_transparencia ADD COLUMN revisao integer NOT NULL DEFAULT 1 CHECK(revisao>0);
CREATE FUNCTION voluntariado_privado.diario_revisao() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.revisao:=OLD.revisao+1; RETURN NEW; END $$;
CREATE TRIGGER trg_diario_revisao BEFORE UPDATE ON public.diario_transparencia FOR EACH ROW EXECUTE FUNCTION voluntariado_privado.diario_revisao();
-- RPCs antigas ficam inacessíveis ao cliente, mas são reutilizadas pelas wrappers validadas.
REVOKE ALL ON FUNCTION public.diario_salvar(bigint,text,text,text,text),public.diario_status(bigint,text) FROM PUBLIC,anon,authenticated;
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

CREATE FUNCTION public.gestao_salvar_perfil(p_dados jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid();
BEGIN
 PERFORM 1 FROM public.usuarios WHERE id=uid AND tipo_perfil='ONG' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sessão de gestão inválida.'; END IF;
 IF coalesce(length(btrim(p_dados->>'nome')),0) NOT BETWEEN 2 AND 120 OR length(coalesce(p_dados->>'descricao',''))>500
 OR (nullif(p_dados->>'telefone','') IS NOT NULL AND p_dados->>'telefone' !~ '^[0-9]{10,11}$')
 OR (nullif(p_dados->>'perfil_instagram','') IS NOT NULL AND p_dados->>'perfil_instagram' !~ '^[A-Za-z0-9._]{1,30}$')
 OR nullif(p_dados->>'data_criacao','')::date>current_date THEN RAISE EXCEPTION 'Dados do perfil inválidos.'; END IF;
 UPDATE public.usuarios SET nome=btrim(p_dados->>'nome'),telefone=nullif(p_dados->>'telefone',''),endereco=nullif(p_dados->>'endereco',''),
 perfil_instagram=nullif(p_dados->>'perfil_instagram',''),descricao=nullif(p_dados->>'descricao','') WHERE id=uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Perfil não encontrado.'; END IF;
 INSERT INTO public.ongs(usuario_id,cnpj,razao_social,data_criacao,responsavel_legal,chave_pix,nome_beneficiario_pix,whatsapp)
 VALUES(uid,nullif(p_dados->>'cnpj',''),nullif(p_dados->>'razao_social',''),nullif(p_dados->>'data_criacao','')::date,
 nullif(p_dados->>'responsavel_legal',''),nullif(p_dados->>'chave_pix',''),nullif(p_dados->>'nome_beneficiario_pix',''),nullif(p_dados->>'whatsapp',''))
 ON CONFLICT(usuario_id) DO UPDATE SET cnpj=EXCLUDED.cnpj,razao_social=EXCLUDED.razao_social,data_criacao=EXCLUDED.data_criacao,
 responsavel_legal=EXCLUDED.responsavel_legal,chave_pix=EXCLUDED.chave_pix,nome_beneficiario_pix=EXCLUDED.nome_beneficiario_pix,whatsapp=EXCLUDED.whatsapp;
 IF NOT FOUND THEN RAISE EXCEPTION 'Dados da ONG não foram salvos.'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.diario_salvar_revisao(bigint,text,text,text,text,integer),public.diario_status_revisao(bigint,text,integer),public.gestao_salvar_perfil(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.diario_salvar_revisao(bigint,text,text,text,text,integer),public.diario_status_revisao(bigint,text,integer),public.gestao_salvar_perfil(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION voluntariado_privado.diario_revisao(),voluntariado_privado.atividade_historico() FROM PUBLIC,anon,authenticated;
COMMIT;
