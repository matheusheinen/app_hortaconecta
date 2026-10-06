import React, { type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, Botao } from './Ui';
import { cores, espaco, tipo } from '../lib/tema';

export function TelaFluxoVoluntariado({
  titulo,
  voltar,
  erro,
  carregando = false,
  atualizar,
  children,
}: {
  titulo: string;
  voltar: () => void;
  erro?: string | null;
  carregando?: boolean;
  atualizar?: () => void;
  children: ReactNode;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.superficie }}
      contentContainerStyle={estilosFluxo.conteudo}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        atualizar ? <RefreshControl refreshing={carregando} onRefresh={atualizar} tintColor={cores.folha} colors={[cores.folha]} /> : undefined
      }
    >
      <Text style={tipo.titulo} accessibilityRole="header">{titulo}</Text>
      {erro ? <Aviso mensagem={erro} /> : null}
      {erro && atualizar ? <Botao titulo="Tentar novamente" onPress={atualizar} /> : null}
      {carregando ? <Text style={tipo.apoio}>Carregando...</Text> : children}
      <Botao titulo="Voltar" variante="contorno" onPress={voltar} />
    </ScrollView>
  );
}
export function CartaoFluxo({ children }: { children: ReactNode }) {
  return <View style={estilosFluxo.cartao}>{children}</View>;
}
export const estilosFluxo = StyleSheet.create({
  conteudo: { padding: 20, paddingTop: espaco.lg, paddingBottom: espaco.xl, gap: espaco.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
  cartao: {
    backgroundColor: cores.fundo,
    borderRadius: 18,
    padding: espaco.md,
    gap: espaco.sm,
    borderWidth: 1,
    borderColor: cores.linha,
  },
});
