import type { Enums, Tables } from '@/servicos/database.types';

export type TipoMeta = Enums<'tipo_meta'>;

export type StatusMeta = Enums<'status_meta'>;

/** Colunas de `metas_demandas` que o app lê. */
export type Meta = Omit<Tables<'metas_demandas'>, 'atualizado_em' | 'url_imagem_capa'>;

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

export type StatusValidacao = Enums<'status_validacao'>;

export type Contribuicao = Tables<'contribuicoes'>;

export const rotuloStatusValidacao: Record<StatusValidacao, string> = {
  PENDENTE: 'Aguardando conferência',
  APROVADA: 'Confirmada',
  RECUSADA: 'Recusada',
};
