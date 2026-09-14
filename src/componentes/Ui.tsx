import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { cores, espaco, tipo } from '../lib/tema';

type BotaoProps = {
  titulo: string;
  onPress: () => void;
  variante?: 'primario' | 'contorno' | 'destrutivo';
  carregando?: boolean;
  desabilitado?: boolean;
};

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  carregando = false,
  desabilitado = false,
}: BotaoProps) {
  const inativo = desabilitado || carregando;

  return (
    <Pressable
      onPress={onPress}
      disabled={inativo}
      accessibilityRole="button"
      style={({ pressed }) => [
        estilos.botao,
        variante === 'primario' && estilos.botaoPrimario,
        variante === 'contorno' && estilos.botaoContorno,
        variante === 'destrutivo' && estilos.botaoDestrutivo,
        pressed && estilos.botaoPressionado,
        inativo && estilos.botaoInativo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={variante === 'primario' ? cores.fundo : cores.folha} />
      ) : (
        <Text
          style={[
            estilos.botaoTexto,
            variante === 'primario' && { color: cores.fundo },
            variante === 'contorno' && { color: cores.folha },
            variante === 'destrutivo' && { color: cores.beterraba },
          ]}
        >
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}

type CampoProps = TextInputProps & {
  rotulo: string;
  dica?: string;
};

export function Campo({ rotulo, dica, ...resto }: CampoProps) {
  return (
    <View style={{ marginBottom: espaco.md }}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        style={estilos.entrada}
        placeholderTextColor={cores.tintaSuave}
        {...resto}
      />
      {dica ? <Text style={[tipo.apoio, { marginTop: espaco.xs }]}>{dica}</Text> : null}
    </View>
  );
}

export function Aviso({ mensagem }: { mensagem: string }) {
  return (
    <View style={estilos.aviso}>
      <Text style={[tipo.apoio, { color: cores.beterraba }]}>{mensagem}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  botao: {
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espaco.lg,
  },
  botaoPrimario: { backgroundColor: cores.folha },
  botaoContorno: { borderWidth: 1.5, borderColor: cores.folha },
  botaoDestrutivo: { borderWidth: 1.5, borderColor: cores.beterraba },
  botaoPressionado: { opacity: 0.7 },
  botaoInativo: { opacity: 0.45 },
  botaoTexto: { fontSize: 15, fontWeight: '600' },
  rotulo: {
    fontSize: 13,
    fontWeight: '600',
    color: cores.tintaSuave,
    marginBottom: espaco.sm,
  },
  entrada: {
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: 8,
    paddingHorizontal: espaco.md,
    paddingVertical: 12,
    fontSize: 15,
    color: cores.tinta,
    backgroundColor: cores.fundo,
    minHeight: 48,
  },
  aviso: {
    backgroundColor: '#FBEFF2',
    borderRadius: 8,
    padding: espaco.md,
    marginBottom: espaco.md,
  },
});
