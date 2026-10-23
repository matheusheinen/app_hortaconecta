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

// Colunas da reconciliação 20261005150000_contribuicoes_metas_pix ainda não
// aplicada no remoto. Remover este bloco ao regenerar database.types.ts.
type ColunasPix = { chave_pix: string | null; nome_beneficiario_pix: string | null };
type Configuracao = Database['public']['Tables']['configuracao_instituicao'];
type TabelasAplicativo = Omit<Database['public']['Tables'], 'configuracao_instituicao'> & {
  configuracao_instituicao: Omit<Configuracao, 'Row' | 'Insert' | 'Update'> & {
    Row: Configuracao['Row'] & ColunasPix;
    Insert: Configuracao['Insert'] & Partial<ColunasPix>;
    Update: Configuracao['Update'] & Partial<ColunasPix>;
  };
};

// RPC da reconciliação 20261005170000_diario_excluir ainda não aplicada no
// remoto. Remover este bloco ao regenerar database.types.ts.
type FuncoesPendentes = {
  // Reconciliação 20261023170000_comprovantes_storage, aplicada no remoto; remover ao regenerar database.types.ts.
  comprovante_caminho: { Args: { p_ext: string }; Returns: string };
  diario_excluir_revisao: { Args: { p_id: number; p_revisao: number }; Returns: string | null };
  gestor_alternar_modo: { Args: { p_gestor: boolean }; Returns: string };
  gestor_pode_alternar_modo: { Args: Record<string, never>; Returns: boolean };
};

export type DatabaseAplicativo = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions' | 'Tables'> & {
    Tables: TabelasAplicativo;
    Functions: {
      [Nome in keyof Database['public']['Functions']]: FuncaoAplicativo<
        Nome,
        Database['public']['Functions'][Nome]
      >;
    } & FuncoesPendentes;
  };
};
