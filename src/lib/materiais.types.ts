
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
