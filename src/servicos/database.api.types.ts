import type { Database } from './database.types';

// Parâmetros que as RPCs aceitam explicitamente como null. O catálogo gerado
// continua sendo a única fonte das tabelas, funções e demais tipos da API.
type RpcNulos = {
  diario_salvar_revisao: 'p_id' | 'p_imagem' | 'p_revisao';
  oficinas_salvar: 'p_id' | 'p_revisao' | 'p_conhecimentos' | 'p_observacoes';
  oficinas_decidir: 'p_observacao';
  voluntariado_decidir: 'p_motivo';
  perfil_foto_salvar: 'p_caminho' | 'p_anterior';
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

// Reconciliação 20261026130000_notificacoes ainda não aplicada no remoto.
// Remover este bloco ao regenerar database.types.ts.
type NotificacaoLinha = {
  id: number;
  usuario_id: string;
  tipo: string;
  titulo: string;
  corpo: string;
  atividade_id: number | null;
  meta_id: number | null;
  lida_em: string | null;
  criado_em: string;
};
type TabelaNotificacoes = {
  Row: NotificacaoLinha;
  Insert: Partial<NotificacaoLinha>;
  Update: Partial<NotificacaoLinha>;
  Relationships: [];
};
type TabelasAplicativo = Database['public']['Tables'] & {
  notificacoes: TabelaNotificacoes;
};

// RPC da reconciliação 20261005170000_diario_excluir ainda não aplicada no
// remoto. Remover este bloco ao regenerar database.types.ts.
type FuncoesPendentes = {
  // Reconciliação 20261108130000_diario_paginacao; remover ao regenerar database.types.ts.
  diario_listar_pagina: {
    Args: { p_antes_data: string | null; p_antes_id: number | null; p_limite: number };
    Returns: Database['public']['Functions']['diario_listar']['Returns'];
  };
  // Reconciliação 20261023170000_comprovantes_storage, aplicada no remoto; remover ao regenerar database.types.ts.
  comprovante_caminho: { Args: { p_ext: string }; Returns: string };
  diario_excluir_revisao: { Args: { p_id: number; p_revisao: number }; Returns: string | null };
  gestor_alternar_modo: { Args: { p_gestor: boolean }; Returns: string };
  gestor_pode_alternar_modo: { Args: Record<string, never>; Returns: boolean };
  push_registrar_token: { Args: { p_token: string; p_plataforma: string }; Returns: undefined };
  notificacoes_marcar_lida: { Args: { p_id: number }; Returns: undefined };
  notificacoes_marcar_todas_lidas: { Args: Record<string, never>; Returns: undefined };
  push_remover_token: { Args: { p_token: string }; Returns: undefined };
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
