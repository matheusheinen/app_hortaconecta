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
        atualizar ? <RefreshControl refreshing={carregando} onRefresh={atualizar} /> : undefined
      }
    >
      <Botao titulo="Voltar" variante="contorno" onPress={voltar} />
      <Text style={tipo.titulo}>{titulo}</Text>
      {erro ? <Aviso mensagem={erro} /> : null}
      {erro && atualizar ? <Botao titulo="Tentar novamente" onPress={atualizar} /> : null}
      {carregando ? <Text style={tipo.apoio}>Carregando...</Text> : children}
    </ScrollView>
  );
}
export function CartaoFluxo({ children }: { children: ReactNode }) {
  return <View style={estilosFluxo.cartao}>{children}</View>;
}
export const estilosFluxo = StyleSheet.create({
  conteudo: { padding: espaco.lg, paddingBottom: espaco.xl, gap: espaco.md },
  cartao: {
    backgroundColor: cores.fundo,
    borderRadius: 10,
    padding: espaco.md,
    gap: espaco.sm,
    borderLeftWidth: 3,
    borderLeftColor: cores.folha,
  },
});
