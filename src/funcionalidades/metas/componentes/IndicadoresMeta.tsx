import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { rotuloStatusMeta, rotuloStatusValidacao, type Meta, type StatusValidacao } from '../tipos';
import { descreverProgresso, percentualMeta } from '../regras';

export function ProgressoMeta({ meta }: { meta: Meta }) {
  const percentual = percentualMeta(meta);
  return (
    <View style={{ gap: espaco.xs }}>
      <View style={estilos.progressoTopo}>
        <Text style={estilos.valor}>{descreverProgresso(meta)}</Text>
        <Text style={tipo.apoio}>{percentual}%</Text>
      </View>
      <View
        style={estilos.trilha}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percentual }}
      >
        <View style={[estilos.preenchimento, { width: `${percentual}%` }]} />
      </View>
    </View>
  );
}

export function EtiquetaMeta({ meta }: { meta: Meta }) {
  return (
    <Text style={estilos.etiqueta}>
      {meta.tipo === 'FINANCEIRA' ? 'EM DINHEIRO' : 'MATERIAL'} ·{' '}
      {rotuloStatusMeta[meta.status].toUpperCase()}
    </Text>
  );
}

const estilos = StyleSheet.create({
  progressoTopo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: espaco.sm,
  },
  valor: { fontSize: 15, fontWeight: '700', color: cores.tinta, flexShrink: 1 },
  trilha: { height: 8, borderRadius: 4, backgroundColor: cores.folhaClara, overflow: 'hidden' },
  preenchimento: { height: 8, borderRadius: 4, backgroundColor: cores.folha },
  etiqueta: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: cores.tintaSuave },
  situacao: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: espaco.sm,
    paddingVertical: espaco.xs,
  },
  situacaoTexto: { fontSize: 12, fontWeight: '700' },
});

/** Estilos compartilhados pelas telas de metas. */
export const estilosMeta = StyleSheet.create({
  destaque: { fontSize: 15, fontWeight: '700', color: cores.tinta },
});

const coresValidacao: Record<StatusValidacao, { fundo: string; texto: string }> = {
  PENDENTE: { fundo: cores.areia, texto: cores.terra },
  APROVADA: { fundo: cores.folhaFundo, texto: cores.folhaEscura },
  RECUSADA: { fundo: cores.beterrabaClara, texto: cores.beterraba },
};

/** Situação da conferência de uma contribuição, em etiqueta colorida. */
export function EtiquetaValidacao({ status }: { status: StatusValidacao }) {
  const { fundo, texto } = coresValidacao[status];
  return (
    <View style={[estilos.situacao, { backgroundColor: fundo }]}>
      <Text style={[estilos.situacaoTexto, { color: texto }]}>{rotuloStatusValidacao[status]}</Text>
    </View>
  );
}
