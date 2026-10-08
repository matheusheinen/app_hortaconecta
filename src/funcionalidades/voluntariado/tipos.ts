import type { Tables } from '@/servicos/database.types';
import type { Atividade, SlotDisponibilidade } from '@/compartilhado/tipos';

export type Inscricao = Tables<'inscricoes_atividades'> & {
  decidido_em: string | null;
  decidido_por: string | null;
  motivo_decisao: string | null;
  checkin_em: string | null;
  carga_horaria_registrada: number | null;
};
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
  disponibilidade_horarios: SlotDisponibilidade[];
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
