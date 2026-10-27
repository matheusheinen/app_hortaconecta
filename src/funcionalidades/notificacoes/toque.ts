import type { Notificacao, TipoNotificacao } from './tipos';

/** O que viaja dentro do aviso do sistema para o app saber aonde levar ao toque. */
export type DadosDoToque = {
  notificacaoId: number;
  tipo: TipoNotificacao;
  atividade_id: number | null;
  meta_id: number | null;
};

export function dadosDoToque(n: Notificacao): Omit<DadosDoToque, 'notificacaoId'> {
  return { tipo: n.tipo, atividade_id: n.atividade_id, meta_id: n.meta_id };
}

const tipos: ReadonlySet<string> = new Set<TipoNotificacao>([
  'CANDIDATURA_NOVA',
  'CANDIDATURA_CANCELADA',
  'PRESENCA_CONFIRMADA',
  'CONTRIBUICAO_NOVA',
  'CANDIDATURA_APROVADA',
  'CANDIDATURA_RECUSADA',
  'ATIVIDADE_CANCELADA',
  'CONTRIBUICAO_APROVADA',
  'CONTRIBUICAO_RECUSADA',
]);

const idOuNulo = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isInteger(valor) ? valor : null;

/** O conteúdo vem do sistema operacional, então nada dele é confiado sem checar. */
export function lerDadosDoToque(dados: unknown): DadosDoToque | null {
  if (!dados || typeof dados !== 'object') return null;
  const d = dados as Record<string, unknown>;
  const notificacaoId = idOuNulo(d.notificacaoId);
  if (notificacaoId === null || typeof d.tipo !== 'string' || !tipos.has(d.tipo)) return null;
  return {
    notificacaoId,
    tipo: d.tipo as TipoNotificacao,
    atividade_id: idOuNulo(d.atividade_id),
    meta_id: idOuNulo(d.meta_id),
  };
}
