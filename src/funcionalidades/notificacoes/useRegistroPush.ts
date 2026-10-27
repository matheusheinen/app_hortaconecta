import { useEffect } from 'react';
import { pedirPermissaoNotificacoes, registrarDispositivoPush } from './push';

const pushRemoto = process.env.EXPO_PUBLIC_PUSH_REMOTO === 'true';

/**
 * Pede permissão dos avisos do sistema enquanto há uma conta (não convidado) ativa e, se o
 * push remoto estiver ligado, registra também o aparelho no servidor.
 */
export function useRegistroPush(usuarioId: string | null, ativo: boolean) {
  useEffect(() => {
    if (!usuarioId || !ativo) return;
    void (pushRemoto ? registrarDispositivoPush() : pedirPermissaoNotificacoes());
  }, [usuarioId, ativo]);
}
