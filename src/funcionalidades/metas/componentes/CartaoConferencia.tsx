import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Botao, Campo } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { espaco, tipo } from '@/compartilhado/tema';
import { formatarDataHora } from '@/compartilhado/utils/datas';
import type { Meta } from '../tipos';
import type { ContribuicaoComDoador } from '../api';
import { descreverQuantidade } from '../regras';
import { estilosMeta } from './IndicadoresMeta';
import { ComprovanteContribuicao } from './ComprovanteContribuicao';

/** Contribuição PENDENTE com comprovante e os botões de conferir; recusar pede o motivo. */
export function CartaoConferencia({
  contribuicao: c,
  meta,
  titulo,
  ocupado,
  conferir,
}: {
  contribuicao: ContribuicaoComDoador;
  meta: Pick<Meta, 'tipo' | 'unidade_medida'>;
  /** Título da meta, quando o cartão aparece fora do detalhe dela. */
  titulo?: string;
  ocupado: boolean;
  conferir: (c: ContribuicaoComDoador, aprovada: boolean, observacao: string) => void;
}) {
  const [observacao, setObservacao] = useState('');
  return (
    <CartaoFluxo>
      {titulo ? <Text style={tipo.apoio}>{titulo}</Text> : null}
      <Text style={estilosMeta.destaque}>
        {c.usuarios?.nome ?? 'Voluntário'} · {descreverQuantidade(c.quantidade_oferecida, meta)}
      </Text>
      <Text style={tipo.apoio}>Informado em {formatarDataHora(c.data_envio)}</Text>
      {c.url_comprovante ? (
        <ComprovanteContribuicao caminho={c.url_comprovante} />
      ) : (
        <Text style={tipo.apoio}>Sem comprovante anexado.</Text>
      )}
      <Campo
        rotulo="Observação (obrigatória para recusar)"
        value={observacao}
        onChangeText={setObservacao}
        maxLength={500}
        multiline
        editable={!ocupado}
      />
      <View style={estilos.linha}>
        <View style={{ flex: 1 }}>
          <Botao
            titulo="Confirmar"
            onPress={() => conferir(c, true, observacao)}
            desabilitado={ocupado}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Botao
            titulo="Recusar"
            variante="destrutivo"
            onPress={() => conferir(c, false, observacao)}
            desabilitado={ocupado}
          />
        </View>
      </View>
    </CartaoFluxo>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', gap: espaco.sm },
});
