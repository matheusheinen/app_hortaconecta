import type { Database } from './database.types';

// Parâmetros que as RPCs aceitam explicitamente como null. O catálogo gerado
// continua sendo a única fonte das tabelas, funções e demais tipos da API.
type RpcNulos = {
  diario_salvar_revisao: 'p_id' | 'p_imagem' | 'p_revisao';
  oficinas_salvar: 'p_id' | 'p_revisao' | 'p_conhecimentos' | 'p_observacoes';
  oficinas_decidir: 'p_observacao';
  voluntariado_decidir: 'p_motivo';
};

type FuncaoAplicativo<Nome extends PropertyKey, Funcao> = Funcao extends {
  Args: infer Argumentos;
}
  ? {
      [Campo in keyof Funcao]: Campo extends 'Args'
        ? {
            [Argumento in keyof Argumentos]: Nome extends keyof RpcNulos
              ? Argumento extends RpcNulos[Nome]
                ? Argumentos[Argumento] | null
                : Argumentos[Argumento]
              : Argumentos[Argumento];
          }
        : Funcao[Campo];
    }
  : Funcao;

// RPC da reconciliação 20261005170000_diario_excluir ainda não aplicada no
// remoto. Remover este bloco ao regenerar database.types.ts.
type FuncoesPendentes = {
  diario_excluir_revisao: { Args: { p_id: number; p_revisao: number }; Returns: string | null };
  gestor_alternar_modo: { Args: { p_gestor: boolean }; Returns: string };
  gestor_pode_alternar_modo: { Args: Record<string, never>; Returns: boolean };
};

export type DatabaseAplicativo = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: {
      [Nome in keyof Database['public']['Functions']]: FuncaoAplicativo<
        Nome,
        Database['public']['Functions'][Nome]
      >;
    } & FuncoesPendentes;
  };
};
