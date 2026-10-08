import type { Tables } from './database.types';

export type TipoPerfil = 'VOLUNTARIO' | 'ONG';

export type TipoAtividade = 'TAREFA_ONG' | 'OFICINA_AUTORAL';

export type StatusAtividade =
  'PENDENTE_APROVACAO' | 'ABERTA' | 'ENCERRADA' | 'REALIZADA' | 'CANCELADA' | 'RECUSADA';

export type Usuario = Tables<'usuarios'>;

export type Voluntario = Tables<'voluntarios'>;

export type Habilidade = Tables<'habilidades'>;

export type Atividade = {
  id: number;
  titulo: string;
  descricao: string;
  tipo: TipoAtividade;
  autor_id: string;
  data_hora_prevista: string;
  vagas_totais: number;
  carga_horaria: number;
  status: StatusAtividade;
  criado_em: string;
};

/** Campos que o formulário edita. O resto o banco preenche. */
export type AtividadeFormulario = Pick<
  Atividade,
  'titulo' | 'descricao' | 'data_hora_prevista' | 'vagas_totais' | 'carga_horaria'
>;

export const rotuloStatus: Record<StatusAtividade, string> = {
  PENDENTE_APROVACAO: 'Aguardando aprovação',
  ABERTA: 'Aberta',
  ENCERRADA: 'Encerrada',
  REALIZADA: 'Realizada',
  CANCELADA: 'Cancelada',
  RECUSADA: 'Recusada',
};

export type TipoMeta = 'FINANCEIRA' | 'MATERIAL';

export type StatusMeta = 'ABERTA' | 'ENCERRADA' | 'CANCELADA';

export type Meta = {
  id: number;
  titulo: string;
  descricao: string;
  tipo: TipoMeta;
  unidade_medida: string | null;
  quantidade_meta: number;
  quantidade_arrecadada: number;
  data_limite: string | null;
  status: StatusMeta;
  criado_em: string;
};

/** Campos que o formulário edita. Status e arrecadação o banco controla. */
export type MetaFormulario = Pick<
  Meta,
  'titulo' | 'descricao' | 'tipo' | 'unidade_medida' | 'quantidade_meta' | 'data_limite'
>;

export const rotuloStatusMeta: Record<StatusMeta, string> = {
  ABERTA: 'Aberta',
  ENCERRADA: 'Encerrada',
  CANCELADA: 'Cancelada',
};

export type StatusValidacao = 'PENDENTE' | 'APROVADA' | 'RECUSADA';

export type Contribuicao = {
  id: number;
  meta_id: number;
  usuario_id: string;
  quantidade_oferecida: number;
  url_comprovante: string | null;
  data_envio: string;
  status_validacao: StatusValidacao;
  validado_por: string | null;
  validado_em: string | null;
  observacao_validacao: string | null;
};

export const rotuloStatusValidacao: Record<StatusValidacao, string> = {
  PENDENTE: 'Aguardando conferência',
  APROVADA: 'Confirmada',
  RECUSADA: 'Recusada',
};

export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';

export type PeriodoDia = 'manha' | 'tarde' | 'noite';

/** Formato livre guardado em `voluntarios.disponibilidade_horarios` (jsonb). */
export type SlotDisponibilidade = { dia: DiaSemana; periodo: PeriodoDia };

export const DIAS_SEMANA: { codigo: DiaSemana; rotulo: string }[] = [
  { codigo: 'dom', rotulo: 'Dom' },
  { codigo: 'seg', rotulo: 'Seg' },
  { codigo: 'ter', rotulo: 'Ter' },
  { codigo: 'qua', rotulo: 'Qua' },
  { codigo: 'qui', rotulo: 'Qui' },
  { codigo: 'sex', rotulo: 'Sex' },
  { codigo: 'sab', rotulo: 'Sáb' },
];

export const PERIODOS_DIA: { codigo: PeriodoDia; rotulo: string }[] = [
  { codigo: 'manha', rotulo: 'Manhã' },
  { codigo: 'tarde', rotulo: 'Tarde' },
  { codigo: 'noite', rotulo: 'Noite' },
];
