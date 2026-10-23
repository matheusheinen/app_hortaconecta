import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { espaco, tipo } from '@/compartilhado/tema';
import { formatarDataHora } from '@/compartilhado/utils/datas';
import { rotuloStatusValidacao, type Meta } from '../tipos';
import type { ContribuicaoComDoador } from '../api';
import { descreverQuantidade } from '../regras';
import { estilosMeta } from './IndicadoresMeta';
import { ComprovanteContribuicao } from './ComprovanteContribuicao';

export function PainelGestaoMeta({
  meta,
  contribuicoes,
  ocupado,
  editar,
  registrar,
  conferir,
  mudarStatus,
}: {
  meta: Meta;
  contribuicoes: ContribuicaoComDoador[];
  ocupado: boolean;
  editar: () => void;
  registrar: () => void;
  conferir: (c: ContribuicaoComDoador, aprovada: boolean) => void;
  mudarStatus: (status: Meta['status'], titulo: string, texto: string) => void;
}) {
  const pendentes = contribuicoes.filter(c => c.status_validacao === 'PENDENTE');
  const conferidas = contribuicoes.filter(c => c.status_validacao !== 'PENDENTE');
  return (
    <>
      <Botao titulo="Registrar doação recebida" onPress={registrar} desabilitado={ocupado} />
      <Text style={tipo.secao}>
        Para conferir{pendentes.length ? ` · ${pendentes.length}` : ''}
      </Text>
      {!pendentes.length ? (
        <Text style={tipo.apoio}>Nenhuma contribuição aguardando conferência.</Text>
      ) : null}
      {pendentes.map(c => (
        <CartaoFluxo key={c.id}>
          <Text style={estilosMeta.destaque}>
            {c.usuarios?.nome ?? 'Voluntário'} · {descreverQuantidade(c.quantidade_oferecida, meta)}
          </Text>
          <Text style={tipo.apoio}>Informado em {formatarDataHora(c.data_envio)}</Text>
          {c.url_comprovante ? (
            <ComprovanteContribuicao caminho={c.url_comprovante} />
          ) : (
            <Text style={tipo.apoio}>Sem comprovante anexado.</Text>
          )}
          <View style={estilos.linha}>
            <View style={{ flex: 1 }}>
              <Botao titulo="Confirmar" onPress={() => conferir(c, true)} desabilitado={ocupado} />
            </View>
            <View style={{ flex: 1 }}>
              <Botao
                titulo="Recusar"
                variante="destrutivo"
                onPress={() => conferir(c, false)}
                desabilitado={ocupado}
              />
            </View>
          </View>
        </CartaoFluxo>
      ))}
      <Text style={tipo.secao}>Histórico</Text>
      {!conferidas.length ? <Text style={tipo.apoio}>Nada conferido nesta meta ainda.</Text> : null}
      {conferidas.map(c => (
        <CartaoFluxo key={c.id}>
          <Text style={estilosMeta.destaque}>
            {c.usuarios?.nome ?? 'Voluntário'} · {descreverQuantidade(c.quantidade_oferecida, meta)}
          </Text>
          <Text style={tipo.apoio}>
            {rotuloStatusValidacao[c.status_validacao]}
            {c.validado_em ? ` em ${formatarDataHora(c.validado_em)}` : ''}
          </Text>
          {c.observacao_validacao ? <Text style={tipo.apoio}>{c.observacao_validacao}</Text> : null}
          {c.url_comprovante ? <ComprovanteContribuicao caminho={c.url_comprovante} /> : null}
        </CartaoFluxo>
      ))}
      <Botao titulo="Editar meta" variante="contorno" onPress={editar} desabilitado={ocupado} />
      {meta.status === 'ABERTA' ? (
        <>
          <Botao
            titulo="Encerrar meta"
            variante="contorno"
            desabilitado={ocupado}
            onPress={() =>
              mudarStatus(
                'ENCERRADA',
                'Encerrar meta?',
                'Ela sai do mural e para de receber contribuições dos voluntários. O que já entrou continua registrado.',
              )
            }
          />
          <Botao
            titulo="Cancelar meta"
            variante="destrutivo"
            desabilitado={ocupado}
            onPress={() =>
              mudarStatus(
                'CANCELADA',
                'Cancelar meta?',
                'Use quando a meta não vai mais acontecer. As contribuições registradas são preservadas.',
              )
            }
          />
        </>
      ) : (
        <Botao
          titulo="Reabrir meta"
          variante="contorno"
          desabilitado={ocupado}
          onPress={() =>
            mudarStatus(
              'ABERTA',
              'Reabrir meta?',
              'Ela volta ao mural e pode receber novas contribuições.',
            )
          }
        />
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', gap: espaco.sm },
});
