import React, { createContext, useContext, type ReactNode } from 'react';

/**
 * Quem está usando o app. Fica disponível para qualquer tela, em vez de descer
 * por props das abas às pilhas e das pilhas às telas.
 */
export type SessaoAtual = {
  usuarioId: string;
  nome: string;
  /** Perfil da gestão (ONG) com o modo gestor ativo. */
  ehGestao: boolean;
  /** Acesso anônimo, só de leitura. "Criar conta" encerra a sessão com `sair`. */
  convidado: boolean;
  sair: () => void;
  recarregarPerfil: (propagarErro?: boolean) => Promise<void>;
};

const Contexto = createContext<SessaoAtual | null>(null);

export function ProvedorSessao({ valor, children }: { valor: SessaoAtual; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessaoAtual(): SessaoAtual {
  const sessao = useContext(Contexto);
  if (!sessao) throw new Error('Tela fora do provedor de sessão.');
  return sessao;
}
