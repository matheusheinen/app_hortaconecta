import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icone } from '@/compartilhado/componentes/Icone';
import { cores } from '@/compartilhado/tema';
import { useNotificacoes } from '../ContextoNotificacoes';

/** Botão do sino com o contador de não lidas. Fica no cabeçalho do Início. */
export function SinoNotificacoes({ onPress }: { onPress: () => void }) {
  const { naoLidas } = useNotificacoes();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        naoLidas ? `Notificações, ${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'Notificações'
      }
      style={({ pressed }) => [estilos.botao, pressed && estilos.pressionado]}
    >
      <Icone nome="sino" tamanho={22} />
      {naoLidas > 0 ? (
        <View style={estilos.selo}>
          <Text style={estilos.seloTexto}>{naoLidas > 9 ? '9+' : naoLidas}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  botao: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressionado: { opacity: 0.75 },
  selo: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: cores.folha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seloTexto: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
