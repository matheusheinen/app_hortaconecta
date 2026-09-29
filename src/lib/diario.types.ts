import type { DatabaseMateriais } from './materiais.types';
import type { Json } from './database.types';
export type Publicacao = {
 revisao: number; id: number; titulo: string; texto: string | null; descricao_curta: string | null;
 status: 'PUBLICADA' | 'OCULTA'; imagem_caminho: string | null;
 data_publicacao: string; autor_id: string; atualizado_em: string;
};
export type DatabaseDiario = Omit<DatabaseMateriais,'public'> & {
 public: Omit<DatabaseMateriais['public'],'Functions'> & {
  Functions: DatabaseMateriais['public']['Functions'] & {
   diario_listar: { Args: Record<string,never>; Returns: Json };
   diario_detalhe: { Args: { p_id: number }; Returns: Json };
   diario_caminho: { Args: { p_ext: string }; Returns: string };
   diario_salvar_revisao: { Args: { p_id: number | null; p_titulo: string; p_texto: string; p_status: string; p_imagem: string | null; p_revisao: number | null }; Returns: number };
   diario_status_revisao: { Args: { p_id: number; p_status: string; p_revisao: number }; Returns: undefined };
  };
 };
};
