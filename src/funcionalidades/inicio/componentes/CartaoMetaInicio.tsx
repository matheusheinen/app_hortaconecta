import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icone } from '@/compartilhado/componentes/Icone';
import { cores } from '@/compartilhado/tema';
import { descreverProgresso } from '@/funcionalidades/metas/regras';
import type { Meta } from '@/funcionalidades/metas/tipos';
import { progressoMetaInicio } from '../regras';
import { estilosInicio } from './estilosInicio';

/** Meta aberta mais recente, com barra de progresso e chamada para contribuir. */
export function CartaoMetaInicio({ meta, abrir }: { meta: Meta; abrir: (id: number) => void }) {
  const progresso = progressoMetaInicio(meta);
  return (
    <Pressable
      onPress={() => abrir(meta.id)}
      accessibilityRole="button"
      accessibilityLabel={`${meta.titulo}. ${progresso}% arrecadado. Quero contribuir.`}
      style={({ pressed }) => [
        estilosInicio.cartao,
        estilos.material,
        pressed && estilosInicio.pressionado,
      ]}
    >
      <View style={estilos.topo}>
        <View style={estilos.icone}>
          <Icone nome={meta.tipo === 'FINANCEIRA' ? 'presente' : 'caixa'} tamanho={24} />
        </View>
        <View style={estilosInicio.flex}>
          <Text style={estilosInicio.cartaoTitulo}>{meta.titulo}</Text>
          <Text style={estilosInicio.apoio}>{descreverProgresso(meta)}</Text>
        </View>
        <Text style={estilos.percentual}>{progresso}%</Text>
      </View>
      <View
        style={estilos.progresso}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: progresso }}
        accessibilityLabel="Progresso da meta"
      >
        <View style={[estilos.progressoPreenchido, { width: `${progresso}%` }]} />
      </View>
      <View style={estilos.contribuir}>
        <Text style={estilosInicio.link}>Quero contribuir</Text>
        <Icone nome="seta" tamanho={14} />
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  material: { padding: 16 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: cores.folhaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentual: { fontSize: 13, fontWeight: '600', color: cores.folha },
  progresso: {
    height: 7,
    borderRadius: 4,
    backgroundColor: cores.folhaClara,
    overflow: 'hidden',
    marginTop: 16,
  },
  progressoPreenchido: { height: '100%', borderRadius: 4, backgroundColor: cores.folha },
  contribuir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 13,
  },
});
