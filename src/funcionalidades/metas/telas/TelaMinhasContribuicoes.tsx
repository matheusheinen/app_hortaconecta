import React, { useCallback } from 'react';
import { Text } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { formatarDataHora } from '@/compartilhado/utils/datas';
import { tipo } from '@/compartilhado/tema';
import { rotuloStatusValidacao } from '../tipos';
import { minhasContribuicoesMetas } from '../api';
import { descreverQuantidade } from '../regras';
import { estilosMeta } from '../componentes/IndicadoresMeta';

export function TelaMinhasContribuicoesMetas({
  usuarioId,
  voltar,
  abrir,
}: {
  usuarioId: string;
  voltar: () => void;
  abrir: (id: number) => void;
}) {
  const consulta = useCallback(() => minhasContribuicoesMetas(usuarioId), [usuarioId]);
  const { dados, erro, carregando, carregar } = useConsulta(consulta);
  return (
    <TelaFluxo
      titulo="Minhas contribuições"
      voltar={voltar}
      erro={erro}
      carregando={carregando}
      atualizar={carregar}
    >
      {dados?.length === 0 ? (
        <Text style={tipo.apoio}>Você ainda não registrou contribuições.</Text>
      ) : null}
      {dados?.map(c => (
        <CartaoFluxo key={c.id}>
          <Text style={tipo.secao}>{c.metas_demandas?.titulo ?? 'Meta'}</Text>
          <Text style={estilosMeta.destaque}>
            {c.metas_demandas
              ? descreverQuantidade(c.quantidade_oferecida, c.metas_demandas)
              : c.quantidade_oferecida}
          </Text>
          <Text style={tipo.apoio}>
            {rotuloStatusValidacao[c.status_validacao]} · {formatarDataHora(c.data_envio)}
          </Text>
          {c.observacao_validacao ? <Text style={tipo.apoio}>{c.observacao_validacao}</Text> : null}
          {c.metas_demandas ? (
            <Botao titulo="Ver meta" variante="contorno" onPress={() => abrir(c.meta_id)} />
          ) : null}
        </CartaoFluxo>
      ))}
    </TelaFluxo>
  );
}
