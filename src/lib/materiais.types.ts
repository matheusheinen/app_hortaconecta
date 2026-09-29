import type { DatabaseVoluntariado } from './voluntariado.types';
import type { Json } from './database.types';

export type SolicitacaoMaterial = {
  id: number; nome: string; descricao: string;
  quantidade_necessaria: number; quantidade_recebida: number;
  status: 'ABERTA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
  criado_em: string; atualizado_em: string; criado_por: string;
};
export type ContribuicaoMaterial = {
  id: number; solicitacao_id: number; usuario_id: string; quantidade: number;
  status: 'PENDENTE' | 'CONFIRMADA' | 'CANCELADA'; criado_em: string;
  decidido_em: string | null; decidido_por: string | null; observacao: string | null;
  nome_usuario?: string;
};
export type DetalheMaterial = { solicitacao: SolicitacaoMaterial; contribuicoes: ContribuicaoMaterial[] };
export type MinhaContribuicao = { solicitacao: SolicitacaoMaterial; contribuicao: ContribuicaoMaterial };
export type DatabaseMateriais = Omit<DatabaseVoluntariado, 'public'> & {
  public: Omit<DatabaseVoluntariado['public'], 'Functions'> & {
    Functions: DatabaseVoluntariado['public']['Functions'] & {
      materiais_salvar: { Args: { p_id: number | null; p_nome: string; p_descricao: string; p_quantidade: number }; Returns: number };
      materiais_contribuir: { Args: { p_solicitacao: number; p_quantidade: number }; Returns: number };
      materiais_decidir: { Args: { p_contribuicao: number; p_status: string }; Returns: undefined };
      materiais_status: { Args: { p_solicitacao: number; p_status: string }; Returns: undefined };
      materiais_listar: { Args: Record<string, never>; Returns: Json };
      materiais_detalhe: { Args: { p_solicitacao: number }; Returns: Json };
      materiais_minhas: { Args: Record<string, never>; Returns: Json };
    };
  };
};
