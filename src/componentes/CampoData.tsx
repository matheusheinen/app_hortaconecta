import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { cores, espaco, tipo } from '../lib/tema';
import { mascararData } from '../lib/mascaras';
import { Campo } from './Ui';

type Props = {
  rotulo: string;
  valorTexto: string;
  aoMudarTexto: (texto: string) => void;
  dica?: string;
  minimo?: Date;
  maximo?: Date;
};

/**
 * No nativo abre o seletor de data do sistema; na web — sem suporte
 * confiável no react-native-web — cai pro campo de texto DD/MM/AAAA.
 * Em ambos os casos o valor é texto DD/MM/AAAA, igual ao Campo comum:
 * quem valida e converte pra ISO é o formulário, no submit.
 */
export function CampoData({ rotulo, valorTexto, aoMudarTexto, dica, minimo, maximo }: Props) {
  const [aberto, setAberto] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <Campo
        rotulo={rotulo}
        value={valorTexto}
        onChangeText={texto => aoMudarTexto(mascararData(texto))}
        placeholder="DD/MM/AAAA"
        dica={dica ?? 'Formato DD/MM/AAAA'}
        keyboardType="numbers-and-punctuation"
      />
    );
  }

  const dataAtual = interpretarTexto(valorTexto) ?? maximo ?? new Date();

  function aoSelecionar(evento: DateTimePickerEvent, dataEscolhida?: Date) {
    if (Platform.OS === 'android') setAberto(false);
    if (evento.type === 'set' && dataEscolhida) {
      aoMudarTexto(formatarTexto(dataEscolhida));
    }
  }

  return (
    <View style={{ marginBottom: espaco.md }}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Pressable onPress={() => setAberto(true)} style={estilos.campo}>
        <Text style={{ fontSize: 15, color: valorTexto ? cores.tinta : cores.tintaSuave }}>
          {valorTexto || 'Selecionar data'}
        </Text>
      </Pressable>
      {dica ? <Text style={[tipo.apoio, { marginTop: espaco.xs }]}>{dica}</Text> : null}

      {aberto ? (
        <>
          <DateTimePicker
            value={dataAtual}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimo}
            maximumDate={maximo}
            onChange={aoSelecionar}
          />
          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={() => setAberto(false)}
              style={{ alignSelf: 'flex-end', marginTop: espaco.xs }}
            >
              <Text style={{ color: cores.folha, fontWeight: '600' }}>Concluir</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function interpretarTexto(texto: string): Date | null {
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  const [, dia, mes, ano] = m;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  if (d.getDate() !== Number(dia) || d.getMonth() !== Number(mes) - 1) return null;
  return d;
}

function formatarTexto(data: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(data.getDate())}/${p(data.getMonth() + 1)}/${data.getFullYear()}`;
}

const estilos = StyleSheet.create({
  rotulo: { fontSize: 13, fontWeight: '600', color: cores.tintaSuave, marginBottom: espaco.sm },
  campo: {
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: 8,
    paddingHorizontal: espaco.md,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: cores.fundo,
  },
});
