import type { Enums, Tables } from '@/servicos/database.types';

export type TipoAtividade = Enums<'tipo_atividade'>;

export type StatusAtividade = Enums<'status_atividade'>;

/** Colunas de `atividades` que o app lê. */
export type Atividade = Omit<
  Tables<'atividades'>,
  'atualizado_em' | 'vagas_ocupadas' | 'arquivada_em'
>;

/** Atividade lida com `vagas_ocupadas` (total de candidaturas aprovadas). */
export type AtividadeComVagas = Atividade & { vagas_ocupadas: number };

/** Campos que o formulário edita. O resto o banco preenche. */
export type AtividadeFormulario = Pick<
  Atividade,
  'titulo' | 'descricao' | 'data_hora_prevista' | 'vagas_totais' | 'carga_horaria'
>;

export const rotuloStatusAtividade: Record<StatusAtividade, string> = {
  PENDENTE_APROVACAO: 'Aguardando aprovação',
  ABERTA: 'Aberta',
  ENCERRADA: 'Encerrada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
  RECUSADA: 'Recusada',
};

export type Inscricao = Tables<'inscricoes_atividades'>;

export type DetalheAtividade = {
  atividade: Atividade & { local?: string | null };
  inscricao: Inscricao | null;
  aprovados: number;
  elegivel: boolean;
  agora: string;
};

export type Candidato = Inscricao & {
  nome: string;
  descricao: string | null;
  profissao: string | null;
  /** jsonb livre; LEFT JOIN pode trazer null. Use disponibilidadeValida antes de ler. */
  disponibilidade_horarios: unknown;
  habilidades: string[];
};

export type MinhaInscricao = { atividade: Atividade; inscricao: Inscricao };

export type TokenCheckin = { atividade_id: number; token: string; expira_em: string };

export const rotuloInscricao: Record<Inscricao['status_inscricao'], string> = {
  PENDENTE: 'Aguardando análise',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
  CANCELADA: 'Cancelada',
};
