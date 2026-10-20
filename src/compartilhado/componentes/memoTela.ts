import { memo, type ComponentType } from 'react';

/**
 * As pilhas montam as telas por render callback (`{({ navigation }) => <Tela …/>}`),
 * o que desliga a otimização do React Navigation que evita renderizar telas
 * fora de foco. Este memo a devolve: a tela só renderiza de novo quando muda
 * algum dado. Funções são ignoradas porque as pilhas as recriam a cada render.
 *
 * Use só em telas cujos callbacks dependem apenas de `navigation` (estável) ou
 * de dados que também chegam como props; senão a tela guardaria um callback antigo.
 */
export function memoTela<P extends object>(Tela: ComponentType<P>) {
  return memo(Tela, mesmosDados);
}

function mesmosDados(anterior: object, atual: object): boolean {
  const a = anterior as Record<string, unknown>;
  const b = atual as Record<string, unknown>;
  const chaves = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const chave of chaves) {
    if (typeof a[chave] === 'function' && typeof b[chave] === 'function') continue;
    if (!Object.is(a[chave], b[chave])) return false;
  }
  return true;
}
