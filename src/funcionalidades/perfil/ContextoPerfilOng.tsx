import React, { createContext, useContext, type ReactNode } from 'react';
import type { DadosPerfilOng, PerfilOngCarregado } from './apiOng';

/** Perfil da gestão carregado uma vez pela pilha e compartilhado entre hub e seções. */
export type ContextoPerfilOng = {
  dados: PerfilOngCarregado | null;
  erro: string | null;
  carregando: boolean;
  carregar: () => void;
  salvar: (parcial: Partial<DadosPerfilOng>) => Promise<void>;
};

const Contexto = createContext<ContextoPerfilOng | null>(null);

export function ProvedorPerfilOng({
  valor,
  children,
}: {
  valor: ContextoPerfilOng;
  children: ReactNode;
}) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Estado completo, com carga e erro: usado pelo hub. */
export function useContextoPerfilOng() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('Perfil da gestão fora do provedor.');
  return contexto;
}

/** Perfil já carregado: as seções só abrem a partir do hub, depois da carga. */
export function usePerfilOng() {
  const valor = useContext(Contexto);
  if (!valor?.dados) throw new Error('Perfil da gestão fora do provedor.');
  return { dados: valor.dados, salvar: valor.salvar };
}
