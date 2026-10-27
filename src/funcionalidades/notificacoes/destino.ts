import type { Notificacao } from './tipos';

/** Para onde cada notificação leva. As telas de gestão só existem no modo gestão. */
export type Destino =
  | { tela: 'candidatos'; atividadeId: number }
  | { tela: 'atividade'; atividadeId: number }
  | { tela: 'fila' }
  | { tela: 'minhasContribuicoes' }
  | { tela: 'meta'; metaId: number }
  | { tela: 'notificacoes' };

type Dados = Pick<Notificacao, 'tipo' | 'atividade_id' | 'meta_id'>;

/**
 * Leva ao lugar onde a pessoa resolve o que o aviso diz: a gestão vai à lista de candidatos ou à
 * fila de conferência; o voluntário, à atividade ou às suas contribuições. Se o alvo foi apagado
 * (os ids ficam nulos), a lista de notificações é o destino seguro.
 */
export function destinoNotificacao(n: Dados, ehGestao: boolean): Destino {
  const { atividade_id: atividadeId, meta_id: metaId } = n;
  switch (n.tipo) {
    case 'CANDIDATURA_NOVA':
    case 'CANDIDATURA_CANCELADA':
    case 'PRESENCA_CONFIRMADA':
      if (atividadeId === null) return { tela: 'notificacoes' };
      return ehGestao ? { tela: 'candidatos', atividadeId } : { tela: 'atividade', atividadeId };
    case 'CANDIDATURA_APROVADA':
    case 'CANDIDATURA_RECUSADA':
    case 'ATIVIDADE_CANCELADA':
      return atividadeId === null ? { tela: 'notificacoes' } : { tela: 'atividade', atividadeId };
    case 'CONTRIBUICAO_NOVA':
      if (ehGestao) return { tela: 'fila' };
      return metaId === null ? { tela: 'notificacoes' } : { tela: 'meta', metaId };
    case 'CONTRIBUICAO_APROVADA':
    case 'CONTRIBUICAO_RECUSADA':
      return ehGestao
        ? metaId === null
          ? { tela: 'notificacoes' }
          : { tela: 'meta', metaId }
        : { tela: 'minhasContribuicoes' };
    default:
      return { tela: 'notificacoes' };
  }
}
