import React, { useCallback, useState } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { Text } from 'react-native';
import { AbasFiltro, Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { formatarDataHora } from '@/compartilhado/utils/datas';
import { tipo } from '@/compartilhado/tema';
import { minhasContribuicoesMetas } from '../api';
import {
  contarPorSituacao,
  descreverQuantidade,
  filtrarPorSituacao,
  type FiltroContribuicoes,
} from '../regras';
import { estilosMeta, EtiquetaValidacao } from '../componentes/IndicadoresMeta';
import { ComprovanteContribuicao } from '../componentes/ComprovanteContribuicao';

export function TelaMinhasContribuicoesMetas({
  voltar,
  abrir,
}: {
  voltar: () => void;
  abrir: (id: number) => void;
}) {
  const { usuarioId } = useSessaoAtual();
  const consulta = useCallback(() => minhasContribuicoesMetas(usuarioId), [usuarioId]);
  const { dados, erro, carregando, carregar } = useConsulta(consulta);
  const [filtro, setFiltro] = useState<FiltroContribuicoes>('TODAS');
  const contagem = contarPorSituacao(dados ?? []);
  const visiveis = filtrarPorSituacao(dados ?? [], filtro);
  return (
    <TelaFluxo
      titulo="Minhas contribuições"
      voltar={voltar}
      erro={erro}
      carregando={carregando}
      atualizar={carregar}
    >
      {dados?.length ? (
        <AbasFiltro
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[
            { valor: 'TODAS', rotulo: 'Todas', quantidade: contagem.TODAS },
            { valor: 'PENDENTE', rotulo: 'Em análise', quantidade: contagem.PENDENTE },
            { valor: 'APROVADA', rotulo: 'Confirmadas', quantidade: contagem.APROVADA },
            { valor: 'RECUSADA', rotulo: 'Recusadas', quantidade: contagem.RECUSADA },
          ]}
        />
      ) : null}
      {dados?.length === 0 ? (
        <Text style={tipo.apoio}>Você ainda não registrou contribuições.</Text>
      ) : null}
      {dados?.length && !visiveis.length ? (
        <Text style={tipo.apoio}>Nenhuma contribuição nesta situação.</Text>
      ) : null}
      {visiveis.map(c => (
        <CartaoFluxo key={c.id}>
          <Text style={tipo.secao}>{c.metas_demandas?.titulo ?? 'Meta'}</Text>
          <Text style={estilosMeta.destaque}>
            {c.metas_demandas
              ? descreverQuantidade(c.quantidade_oferecida, c.metas_demandas)
              : c.quantidade_oferecida}
          </Text>
          <EtiquetaValidacao status={c.status_validacao} />
          <Text style={tipo.apoio}>Enviada em {formatarDataHora(c.data_envio)}</Text>
          {c.observacao_validacao ? <Text style={tipo.apoio}>{c.observacao_validacao}</Text> : null}
          {c.url_comprovante ? <ComprovanteContribuicao caminho={c.url_comprovante} /> : null}
          {c.metas_demandas ? (
            <Botao titulo="Ver meta" variante="contorno" onPress={() => abrir(c.meta_id)} />
          ) : null}
        </CartaoFluxo>
      ))}
    </TelaFluxo>
  );
}
