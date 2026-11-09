import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icone, type NomeIcone } from '@/compartilhado/componentes/Icone';
import { cores } from '@/compartilhado/tema';
import { estilosInicio } from './estilosInicio';

/** Título de seção em caixa alta com o link "Ver todas" à direita. */
export function CabecalhoSecao({
  titulo,
  acao,
  onPress,
}: {
  titulo: string;
  acao: string;
  onPress: () => void;
}) {
  return (
    <View style={estilos.topo}>
      <Text accessibilityRole="header" style={estilos.titulo}>
        {titulo}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${acao}: ${titulo}`}
        style={estilos.verMais}
      >
        <Text style={estilos.verMaisTexto}>{acao}</Text>
        <Icone nome="seta" tamanho={13} />
      </Pressable>
    </View>
  );
}

/** Cartão mostrado quando uma seção não tem conteúdo. */
export function EstadoVazio({
  icone,
  titulo,
  texto,
}: {
  icone: NomeIcone;
  titulo: string;
  texto: string;
}) {
  return (
    <View style={[estilosInicio.cartao, estilos.vazio]}>
      <View style={estilos.vazioIcone}>
        <Icone nome={icone} tamanho={24} />
      </View>
      <View style={estilosInicio.flex}>
        <Text style={estilosInicio.cartaoTitulo}>{titulo}</Text>
        <Text style={estilosInicio.apoio}>{texto}</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    marginBottom: 8,
    minHeight: 44,
  },
  titulo: { color: cores.tinta, fontSize: 16, fontWeight: '700' },
  verMais: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 8 },
  verMaisTexto: { color: cores.folha, fontSize: 12 },
  vazio: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 18 },
  vazioIcone: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: cores.folhaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
