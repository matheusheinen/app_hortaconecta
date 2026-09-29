import type { DatabaseDiario } from './diario.types';
import type { Json } from './database.types';
export type PropostaOficina = {
 id: number; autor_id: string; nome_autor?: string; titulo: string; descricao: string;
 tema: string; objetivo: string; duracao_minutos: number; conhecimentos: string | null; observacoes: string | null;
 status: 'PENDENTE' | 'APROVADA' | 'REJEITADA' | 'CANCELADA'; criado_em: string; atualizado_em: string;
 revisao: number; decidido_em: string | null; decidido_por: string | null; observacao_decisao: string | null; cancelado_em: string | null;
};
export type DatabaseOficinas = Omit<DatabaseDiario,'public'> & {
 public: Omit<DatabaseDiario['public'],'Functions'> & {
  Functions: DatabaseDiario['public']['Functions'] & {
   oficinas_listar: { Args: Record<string,never>; Returns: Json };
   oficinas_detalhe: { Args: { p_id: number }; Returns: Json };
   oficinas_salvar: { Args: { p_id: number | null; p_revisao: number | null; p_titulo: string; p_descricao: string; p_tema: string;
    p_objetivo: string; p_duracao: number; p_conhecimentos: string | null; p_observacoes: string | null }; Returns: number };
   oficinas_cancelar: { Args: { p_id: number; p_revisao: number }; Returns: undefined };
   oficinas_decidir: { Args: { p_id: number; p_revisao: number; p_status: string; p_observacao: string | null }; Returns: undefined };
  };
 };
};
