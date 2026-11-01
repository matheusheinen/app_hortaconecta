import { avisar, confirmarAcao } from '@/compartilhado/utils/confirmar';
import { mensagemErro } from '@/compartilhado/utils/erros';
import type { useAcao } from '@/compartilhado/hooks/useAcao';
import type { Meta } from './tipos';
import { validarContribuicao, type ContribuicaoComDoador } from './api';
import { descreverQuantidade, validarConferencia } from './regras';

/** Confirma, valida a observação e registra a decisão da gestão; `depois` recarrega a tela. */
export function useConferencia(
  acao: ReturnType<typeof useAcao>,
  gestaoId: string,
  depois: () => Promise<void>,
) {
  return function conferir(
    c: ContribuicaoComDoador,
    meta: Pick<Meta, 'tipo' | 'unidade_medida'>,
    aprovada: boolean,
    observacao: string,
  ) {
    let nota: string | null;
    try {
      nota = validarConferencia(aprovada, observacao);
    } catch (falha) {
      avisar('Confira os dados', mensagemErro(falha));
      return;
    }
    confirmarAcao(
      aprovada ? 'Confirmar contribuição?' : 'Recusar contribuição?',
      aprovada
        ? `Confirme só depois de conferir o recebimento de ${descreverQuantidade(c.quantidade_oferecida, meta)}. O valor passa a contar no total e a decisão não pode ser desfeita.`
        : 'A contribuição não entra no total. O voluntário verá a recusa e o motivo, e a decisão não pode ser desfeita.',
      aprovada ? 'Confirmar' : 'Recusar',
      () => {
        void acao.executar(async () => {
          await validarContribuicao(c.id, gestaoId, aprovada, nota);
          await depois();
        });
      },
      !aprovada,
    );
  };
}
