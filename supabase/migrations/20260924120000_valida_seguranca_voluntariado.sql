BEGIN;

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
ON public.inscricoes_atividades FROM PUBLIC, anon, authenticated;

COMMIT;
