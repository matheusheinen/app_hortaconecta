import React, { createContext, useContext, type ReactNode } from 'react';
import type { PerfilVoluntarioCarregado } from './apiVoluntario';
import type { DadosPerfilVoluntario } from './regras';

/** Perfil carregado uma vez pela pilha e compartilhado entre o hub e as seções. */
export type ContextoPerfilVoluntario = {
  perfil: PerfilVoluntarioCarregado | null;
  erro: string | null;
  carregando: boolean;
  carregar: () => void;
  /** Salva uma seção e atualiza o estado compartilhado com a resposta do banco. */
  salvar: (parcial: Partial<DadosPerfilVoluntario>, habilidades?: number[]) => Promise<void>;
};

const Contexto = createContext<ContextoPerfilVoluntario | null>(null);

export function ProvedorPerfilVoluntario({
  valor,
  children,
}: {
  valor: ContextoPerfilVoluntario;
  children: ReactNode;
}) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Estado completo, com carga e erro: usado pelo hub. */
export function useContextoPerfilVoluntario() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('Perfil do voluntário fora do provedor.');
  return contexto;
}

/** Perfil já carregado: as seções só abrem a partir do hub, depois da carga. */
export function usePerfilVoluntario() {
  const valor = useContext(Contexto);
  if (!valor?.perfil) throw new Error('Perfil do voluntário fora do provedor.');
  return { perfil: valor.perfil, salvar: valor.salvar };
}
