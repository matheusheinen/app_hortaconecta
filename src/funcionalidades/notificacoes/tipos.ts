export type TipoNotificacao =
  | 'CANDIDATURA_NOVA'
  | 'CANDIDATURA_CANCELADA'
  | 'PRESENCA_CONFIRMADA'
  | 'CONTRIBUICAO_NOVA'
  | 'CANDIDATURA_APROVADA'
  | 'CANDIDATURA_RECUSADA'
  | 'ATIVIDADE_CANCELADA'
  | 'CONTRIBUICAO_APROVADA'
  | 'CONTRIBUICAO_RECUSADA';

export type Notificacao = {
  id: number;
  usuario_id: string;
  tipo: TipoNotificacao;
  titulo: string;
  corpo: string;
  atividade_id: number | null;
  meta_id: number | null;
  lida_em: string | null;
  criado_em: string;
};
