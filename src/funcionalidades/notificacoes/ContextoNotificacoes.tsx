import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { assinarNotificacoes, contarNaoLidas } from './api';
import { mostrarAvisoLocal } from './push';

type Valor = {
  naoLidas: number;
  /** Muda a cada notificação recebida; telas abertas usam para recarregar a lista. */
  versao: number;
  recarregar: () => Promise<void>;
};

const Contexto = createContext<Valor>({ naoLidas: 0, versao: 0, recarregar: async () => {} });

export function useNotificacoes(): Valor {
  return useContext(Contexto);
}

/**
 * Mantém o contador de não lidas e ouve as notificações novas em tempo real. Falhas aqui
 * (tabela ainda não instalada, sem rede) apenas deixam o contador em zero.
 */
export function ProvedorNotificacoes({
  usuarioId,
  children,
}: {
  usuarioId: string;
  children: React.ReactNode;
}) {
  const [naoLidas, setNaoLidas] = useState(0);
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(async () => {
    try {
      setNaoLidas(await contarNaoLidas());
    } catch {
      setNaoLidas(0);
    }
  }, []);

  useEffect(() => {
    contarNaoLidas()
      .then(setNaoLidas)
      .catch(() => setNaoLidas(0));
    const parar = assinarNotificacoes(usuarioId, notificacao => {
      setNaoLidas(atual => atual + 1);
      setVersao(atual => atual + 1);
      // No navegador não há aviso do sistema; o sino já mostra a novidade.
      if (Platform.OS !== 'web') void mostrarAvisoLocal(notificacao.titulo, notificacao.corpo);
    });
    // Ao voltar do segundo plano, o canal pode ter perdido eventos.
    const app = AppState.addEventListener('change', estado => {
      if (estado === 'active') {
        void recarregar();
        setVersao(atual => atual + 1);
      }
    });
    return () => {
      parar();
      app.remove();
    };
  }, [usuarioId, recarregar]);

  const valor = useMemo(() => ({ naoLidas, versao, recarregar }), [naoLidas, versao, recarregar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
