import { createNavigationContainerRef } from '@react-navigation/native';
import type { ParametrosAbasPrincipais } from '@/app/AbasPrincipais';
import type { Destino } from './destino';

/**
 * Ref do navegador principal: permite abrir uma tela a partir de fora da árvore de telas, como
 * ao tocar num aviso do sistema. Só é válida depois que o NavigationContainer monta.
 */
export const navegacaoRef = createNavigationContainerRef<ParametrosAbasPrincipais>();

/** Quem abriu a tela. "notificacoes" faz o Voltar retornar à lista de notificações. */
export type Origem = 'notificacoes';

/**
 * Volta da tela e, se ela foi aberta por uma notificação, devolve a pessoa à lista de onde veio
 * em vez de largá-la na lista da aba de destino.
 */
export function voltarDe(origem: Origem | undefined, voltar: () => void) {
  voltar();
  if (origem === 'notificacoes' && navegacaoRef.isReady()) navegacaoRef.navigate('inicio');
}

/** Abre o destino. Devolve false se o navegador ainda não está pronto. */
export function abrirDestino(destino: Destino): boolean {
  if (!navegacaoRef.isReady()) return false;
  // initial: false mantém só a tela pedida na pilha; voltar leva de volta ao Início.
  switch (destino.tela) {
    case 'candidatos':
      navegacaoRef.navigate('atividades', {
        screen: 'candidatos',
        params: { atividadeId: destino.atividadeId, origem: 'notificacoes' },
        initial: false,
      });
      break;
    case 'atividade':
      navegacaoRef.navigate('atividades', {
        screen: 'detalhe',
        params: { atividadeId: destino.atividadeId, origem: 'notificacoes' },
        initial: false,
      });
      break;
    case 'fila':
      navegacaoRef.navigate('metas', {
        screen: 'fila',
        params: { origem: 'notificacoes' },
        initial: false,
      });
      break;
    case 'minhasContribuicoes':
      navegacaoRef.navigate('metas', {
        screen: 'minhas',
        params: { origem: 'notificacoes' },
        initial: false,
      });
      break;
    case 'meta':
      navegacaoRef.navigate('metas', {
        screen: 'detalhe',
        params: { id: destino.metaId, origem: 'notificacoes' },
        initial: false,
      });
      break;
    case 'notificacoes':
      navegacaoRef.navigate('inicio', { screen: 'notificacoes', initial: false });
      break;
  }
  return true;
}
