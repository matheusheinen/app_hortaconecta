import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { rotuloStatusMeta, type Meta } from '../tipos';
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
});

/** Estilos compartilhados pelas telas de metas. */
export const estilosMeta = StyleSheet.create({
  destaque: { fontSize: 15, fontWeight: '700', color: cores.tinta },
});
