import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cores, espaco, tipo } from '../lib/tema';

type Props = {
  titulo: string;
  descricao: string;
  nome: string;
  sair: () => void;
};

/** Placeholder para abas do menu cujas funcionalidades ainda não foram desenvolvidas. */
export function TelaEmBreve({ titulo, descricao, nome, sair }: Props) {
  return (
    <View style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={tipo.titulo}>{titulo}</Text>
          <Text style={tipo.apoio}>{nome}</Text>
        </View>
        <Pressable onPress={sair} hitSlop={12}>
          <Text style={[tipo.apoio, { color: cores.folha, fontWeight: '600' }]}>Sair</Text>
        </Pressable>
      </View>

      <View style={estilos.vazio}>
        <Text style={[tipo.secao, { marginBottom: espaco.sm }]}>Em desenvolvimento</Text>
        <Text style={[tipo.apoio, { textAlign: 'center' }]}>{descricao}</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.superficie },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espaco.md,
    paddingHorizontal: espaco.lg,
    paddingTop: espaco.xl,
    paddingBottom: espaco.md,
    backgroundColor: cores.fundo,
  },
  vazio: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaco.xl },
});
