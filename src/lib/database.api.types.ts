import type { Database } from './database.types';

// Parâmetros que as RPCs aceitam explicitamente como null. O catálogo gerado
// continua sendo a única fonte das tabelas, funções e demais tipos da API.
type RpcNulos = {
  materiais_salvar: 'p_id';
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

export type DatabaseAplicativo = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: {
      [Nome in keyof Database['public']['Functions']]: FuncaoAplicativo<
        Nome,
        Database['public']['Functions'][Nome]
      >;
    };
  };
};
