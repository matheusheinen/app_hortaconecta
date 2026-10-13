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
import { cores, espaco, tipo } from '../tema';

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
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inativo, busy: carregando }}
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
        <ActivityIndicator
          color={
            variante === 'primario'
              ? cores.fundo
              : variante === 'destrutivo'
                ? cores.beterraba
                : cores.folha
          }
        />
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

export function Campo({ rotulo, dica, style, ...resto }: CampoProps) {
  return (
    <View style={{ marginBottom: espaco.md }}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        style={[estilos.entrada, style]}
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.tintaSuave}
        selectionColor={cores.folha}
        {...resto}
      />
      {dica ? <Text style={[tipo.apoio, { marginTop: espaco.xs }]}>{dica}</Text> : null}
    </View>
  );
}

export function Aviso({ mensagem }: { mensagem: string }) {
  return (
    <View style={estilos.aviso} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={[tipo.apoio, { color: cores.beterraba }]}>{mensagem}</Text>
    </View>
  );
}

type OpcaoAba<T extends string> = { valor: T; rotulo: string; quantidade?: number };

/** Abas de filtro de uma listagem (ex.: abertas / finalizadas). */
export function AbasFiltro<T extends string>({
  opcoes,
  valor,
  aoMudar,
}: {
  opcoes: OpcaoAba<T>[];
  valor: T;
  aoMudar: (valor: T) => void;
}) {
  return (
    <View style={estilos.abas} accessibilityRole="tablist">
      {opcoes.map(opcao => {
        const ativa = opcao.valor === valor;
        const rotulo =
          opcao.quantidade === undefined ? opcao.rotulo : `${opcao.rotulo} (${opcao.quantidade})`;
        return (
          <Pressable
            key={opcao.valor}
            onPress={() => aoMudar(opcao.valor)}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativa }}
            accessibilityLabel={rotulo}
            style={[estilos.aba, ativa && estilos.abaAtiva]}
          >
            <Text style={[estilos.abaTexto, ativa && estilos.abaTextoAtiva]}>{rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  abas: {
    flexDirection: 'row',
    backgroundColor: cores.mint,
    borderRadius: 14,
    padding: espaco.xs,
    gap: espaco.xs,
  },
  aba: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espaco.sm,
  },
  abaAtiva: { backgroundColor: cores.fundo, boxShadow: '0px 1px 3px rgba(28, 67, 48, 0.12)' },
  abaTexto: { fontSize: 14, fontWeight: '600', color: cores.tintaSuave },
  abaTextoAtiva: { color: cores.folha, fontWeight: '700' },
  botao: {
    minHeight: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: espaco.lg,
    paddingVertical: 14,
  },
  botaoPrimario: {
    backgroundColor: cores.folha,
    boxShadow: '0px 3px 5px rgba(28, 67, 48, 0.12)',
  },
  botaoContorno: { borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.fundo },
  botaoDestrutivo: {
    borderWidth: 1,
    borderColor: cores.beterrabaLinha,
    backgroundColor: cores.beterrabaClara,
  },
  botaoPressionado: { opacity: 0.8 },
  botaoInativo: { opacity: 0.45 },
  botaoTexto: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  rotulo: {
    fontSize: 13,
    fontWeight: '600',
    color: cores.tintaSuave,
    marginBottom: espaco.sm,
  },
  entrada: {
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: 18,
    paddingHorizontal: espaco.md,
    paddingVertical: 14,
    fontSize: 15,
    color: cores.tinta,
    backgroundColor: cores.mint,
    minHeight: 54,
  },
  aviso: {
    backgroundColor: cores.beterrabaClara,
    borderRadius: 16,
    padding: espaco.md,
    marginBottom: espaco.md,
  },
});
