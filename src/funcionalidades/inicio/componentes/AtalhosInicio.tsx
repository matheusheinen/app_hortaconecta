import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icone, type NomeIcone } from '@/compartilhado/componentes/Icone';
import { cores } from '@/compartilhado/tema';
import { estilosInicio } from './estilosInicio';

/** Atalhos para recursos fora do MVP; some quando nenhum deles está ativo. */
export function AtalhosInicio({
  aoIrParaOficinas,
  aoIrParaCertificados,
}: {
  aoIrParaOficinas?: () => void;
  aoIrParaCertificados?: () => void;
}) {
  if (!aoIrParaOficinas && !aoIrParaCertificados) return null;
  return (
    <View style={estilos.atalhos}>
      {aoIrParaOficinas ? (
        <Atalho
          icone="oficina"
          titulo="Oficinas"
          texto="Compartilhe saberes"
          onPress={aoIrParaOficinas}
        />
      ) : null}
      {aoIrParaCertificados ? (
        <Atalho
          icone="certificado"
          titulo="Certificados"
          texto="Veja sua participação"
          onPress={aoIrParaCertificados}
        />
      ) : null}
    </View>
  );
}

function Atalho({
  icone,
  titulo,
  texto,
  onPress,
}: {
  icone: NomeIcone;
  titulo: string;
  texto: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        estilosInicio.cartao,
        estilos.atalho,
        pressed && estilosInicio.pressionado,
      ]}
    >
      <Icone nome={icone} tamanho={23} />
      <Text style={estilos.titulo}>{titulo}</Text>
      <Text style={estilosInicio.apoio}>{texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  atalhos: { flexDirection: 'row', gap: 12, marginTop: 22 },
  atalho: { flex: 1, padding: 16 },
  titulo: { color: cores.tinta, fontSize: 14, fontWeight: '600', marginTop: 9 },
});
