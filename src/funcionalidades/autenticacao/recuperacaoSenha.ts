import { useSyncExternalStore } from 'react';

// verifyOtp cria sessão antes de a nova senha ser definida. Enquanto a
// recuperação está ativa, o App mantém a tela de acesso em vez de entrar.
let ativa = false;
const ouvintes = new Set<() => void>();

export function definirRecuperacaoAtiva(valor: boolean) {
  if (ativa === valor) return;
  ativa = valor;
  ouvintes.forEach(ouvinte => ouvinte());
}

export function useRecuperacaoAtiva() {
  return useSyncExternalStore(
    ouvinte => {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    () => ativa,
  );
}
