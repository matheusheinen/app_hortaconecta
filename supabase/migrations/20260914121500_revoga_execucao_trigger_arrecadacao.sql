--
-- atualizar_arrecadacao_meta() é função de trigger, não deve ser chamável
-- via RPC (/rest/v1/rpc/atualizar_arrecadacao_meta). Ver advisor de segurança.
--

REVOKE EXECUTE ON FUNCTION public.atualizar_arrecadacao_meta() FROM PUBLIC, anon, authenticated;
