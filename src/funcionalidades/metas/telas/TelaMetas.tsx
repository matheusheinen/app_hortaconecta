import React, { useState } from 'react';
import { memoTela } from '@/compartilhado/componentes/memoTela';
import { Pressable, Text } from 'react-native';
import { AbasFiltro, Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { formatarDataCurta, hojeIso } from '@/compartilhado/utils/datas';
import { tipo } from '@/compartilhado/tema';
import { listarMetas } from '../api';
import { descreverProgresso, metaFinalizada, prazoVencido } from '../regras';
import { EtiquetaMeta, ProgressoMeta } from '../componentes/IndicadoresMeta';

export const TelaMetas = memoTela(function TelaMetas({
  ehGestao,
  voltar,
  abrir,
  criar,
  minhas,
  convidado = false,
}: {
  ehGestao: boolean;
  voltar: () => void;
  abrir: (id: number) => void;
  criar: () => void;
  minhas: () => void;
  convidado?: boolean;
}) {
  const { dados, erro, carregando, carregar } = useConsulta(listarMetas);
  const hoje = hojeIso();
  const [aba, setAba] = useState<'abertas' | 'finalizadas'>('abertas');
  const abertas = (dados ?? []).filter(m => !metaFinalizada(m));
  const finalizadas = (dados ?? []).filter(metaFinalizada);
  const visiveis = aba === 'abertas' ? abertas : finalizadas;
  return (
    <TelaFluxo
      titulo={ehGestao ? 'Metas e doações' : 'Contribuir'}
      voltar={voltar}
      erro={erro}
      carregando={carregando}
      atualizar={carregar}
    >
      <Text style={tipo.corpo}>
        {ehGestao
          ? 'Publique metas em dinheiro ou de materiais, confira as contribuições e registre o que receber.'
          : 'Apoie a horta com uma doação em dinheiro (PIX) ou com materiais. Só contam no total as doações confirmadas pela gestão.'}
      </Text>
      {ehGestao ? (
        <Botao titulo="Nova meta" onPress={criar} />
      ) : convidado ? null : (
        <Botao titulo="Minhas contribuições" variante="contorno" onPress={minhas} />
      )}
      <AbasFiltro
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { valor: 'abertas', rotulo: 'Abertas', quantidade: dados ? abertas.length : undefined },
          {
            valor: 'finalizadas',
            rotulo: 'Finalizadas',
            quantidade: dados ? finalizadas.length : undefined,
          },
        ]}
      />
      {dados && !visiveis.length ? (
        <Text style={tipo.apoio}>
          {aba === 'abertas'
            ? 'Nenhuma meta aberta no momento.'
            : 'Nenhuma meta encerrada ou cancelada.'}
        </Text>
      ) : null}
      {visiveis.map(m => (
        <Pressable
          key={m.id}
          onPress={() => abrir(m.id)}
          accessibilityRole="button"
          accessibilityLabel={`${m.titulo}. ${descreverProgresso(m)}.`}
        >
          <CartaoFluxo>
            <EtiquetaMeta meta={m} />
            <Text style={tipo.secao}>{m.titulo}</Text>
            <ProgressoMeta meta={m} />
            <Text style={tipo.apoio}>
              {m.data_limite
                ? `${prazoVencido(m, hoje) ? 'Prazo encerrado em' : 'Prazo:'} ${formatarDataCurta(m.data_limite)}`
                : 'Sem prazo definido'}
            </Text>
          </CartaoFluxo>
        </Pressable>
      ))}
    </TelaFluxo>
  );
});
