import type { Database, Json, Tables } from './database.types';
import type { Atividade, SlotDisponibilidade } from './tipos';

// Contrato da migration 20260923120000. Não representa geração do schema remoto.
// Integrar à geração oficial depois da aplicação e conferência no Supabase.
export type DatabaseVoluntariado = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions'> & {
    Functions: Database['public']['Functions'] & {
      voluntariado_elegibilidade: { Args: Record<string, never>; Returns: boolean };
      voluntariado_salvar_perfil: {
        Args: { p_dados: Json; p_habilidades: number[] };
        Returns: boolean;
      };
      voluntariado_detalhe: { Args: { p_atividade: number }; Returns: Json };
      voluntariado_candidatar: { Args: { p_atividade: number }; Returns: number };
      voluntariado_cancelar: { Args: { p_inscricao: number }; Returns: undefined };
      voluntariado_candidatos: { Args: { p_atividade: number }; Returns: Json };
      voluntariado_decidir: {
        Args: { p_inscricao: number; p_decisao: string; p_motivo?: string };
        Returns: undefined;
      };
      voluntariado_status_atividade: {
        Args: { p_atividade: number; p_status: string };
        Returns: undefined;
      };
      voluntariado_gerar_checkin: { Args: { p_atividade: number }; Returns: Json };
      voluntariado_checkin: { Args: { p_atividade: number; p_token: string }; Returns: undefined };
      voluntariado_minhas_inscricoes: { Args: Record<string, never>; Returns: Json };
    };
  };
};

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
