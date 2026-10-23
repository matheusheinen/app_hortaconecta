import React from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { Text } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useAcao } from '@/compartilhado/hooks/useAcao';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { tipo } from '@/compartilhado/tema';
import { listarPendentes } from '../api';
import { useConferencia } from '../useConferencia';
import { CartaoConferencia } from '../componentes/CartaoConferencia';

/** Fila única da gestão: tudo o que aguarda conferência, de todas as metas, das mais antigas. */
export function TelaFilaConferencia({
  voltar,
  abrirMeta,
}: {
  voltar: () => void;
  abrirMeta: (id: number) => void;
}) {
  const { usuarioId } = useSessaoAtual();
  const { dados, erro, carregando, carregar } = useConsulta(listarPendentes);
  const acao = useAcao();
  const conferir = useConferencia(acao, usuarioId, carregar);
  return (
    <TelaFluxo
      titulo="Fila de conferência"
      voltar={voltar}
      erro={acao.erro ?? erro}
      carregando={carregando && !dados}
      atualizar={carregar}
    >
      <Text style={tipo.corpo}>
        Compare o comprovante com o extrato antes de confirmar. Só as doações confirmadas contam no
        total da meta.
      </Text>
      {dados?.length === 0 ? (
        <Text style={tipo.apoio}>Nenhuma contribuição aguardando conferência.</Text>
      ) : null}
      {dados?.map(c => (
        <React.Fragment key={c.id}>
          <CartaoConferencia
            contribuicao={c}
            meta={c.metas_demandas ?? { tipo: 'FINANCEIRA', unidade_medida: null }}
            titulo={c.metas_demandas?.titulo ?? 'Meta'}
            ocupado={acao.ocupado}
            conferir={(contribuicao, aprovada, observacao) =>
              conferir(
                contribuicao,
                c.metas_demandas ?? { tipo: 'FINANCEIRA', unidade_medida: null },
                aprovada,
                observacao,
              )
            }
          />
          {c.metas_demandas ? (
            <Botao
              titulo="Ver meta"
              variante="contorno"
              onPress={() => abrirMeta(c.meta_id)}
              desabilitado={acao.ocupado}
            />
          ) : null}
        </React.Fragment>
      ))}
    </TelaFluxo>
  );
}
