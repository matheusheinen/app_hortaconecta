import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { cores } from '@/compartilhado/tema';

/** Campo arredondado da tela de acesso, com rótulo em caixa alta acima. */
export function CampoAcesso({
  rotulo,
  referencia,
  ...props
}: TextInputProps & {
  rotulo: string;
  referencia?: React.Ref<TextInput>;
}) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        ref={referencia}
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.placeholder}
        selectionColor={cores.folha}
        {...props}
        style={estilos.entrada}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { marginBottom: 18 },
  rotulo: {
    color: cores.tintaMedia,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  entrada: {
    minHeight: 54,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: cores.campoLinha,
    backgroundColor: cores.mint,
    color: cores.tinta,
    fontSize: 15,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
});
