import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icone, type NomeIcone } from '@/compartilhado/componentes/Icone';
import { cores } from '@/compartilhado/tema';
import { formatarHorasInicio, type ResumoInicio } from '../regras';
import { estilosInicio } from './estilosInicio';

const numero = (valor: number | undefined) =>
  valor === undefined ? '—' : valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Horas previstas, atividades e contribuições; "—" enquanto o resumo não chega. */
export function IndicadoresInicio({
  resumo,
  aoIrParaCertificados,
  minhasAtividades,
  minhasContribuicoes,
}: {
  resumo: ResumoInicio | null;
  /** Ausente quando certificados estão fora do MVP; as horas abrem o histórico. */
  aoIrParaCertificados?: () => void;
  minhasAtividades: () => void;
  minhasContribuicoes: () => void;
}) {
  return (
    <View style={estilos.indicadores}>
      <Indicador
        icone="relogio"
        valor={resumo ? formatarHorasInicio(resumo.horasRegistradas) : '—'}
        titulo="Horas previstas"
        cor={cores.indicadorHoras}
        onPress={aoIrParaCertificados ?? minhasAtividades}
        descricao={`Carga prevista registrada no check-in das presenças confirmadas. ${aoIrParaCertificados ? 'Ver certificados.' : 'Ver histórico de participação.'}`}
      />
      <Indicador
        icone="check"
        valor={numero(resumo?.atividadesParticipadas)}
        titulo="Atividades"
        cor={cores.indicadorAtividades}
        onPress={minhasAtividades}
        descricao="Presenças confirmadas. Ver histórico de participação."
      />
      <Indicador
        icone="presente"
        valor={numero(resumo?.contribuicoesConfirmadas)}
        titulo="Contribuições"
        cor={cores.indicadorContribuicoes}
        onPress={minhasContribuicoes}
        descricao="Entregas confirmadas. Ver minhas contribuições."
      />
    </View>
  );
}

function Indicador({
  icone,
  valor,
  titulo,
  cor,
  onPress,
  descricao,
}: {
  icone: NomeIcone;
  valor: string;
  titulo: string;
  cor: string;
  onPress: () => void;
  descricao: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}: ${valor}. ${descricao}`}
      style={({ pressed }) => [
        estilosInicio.cartao,
        estilos.indicador,
        pressed && estilosInicio.pressionado,
      ]}
    >
      <Icone nome={icone} cor={cor} tamanho={21} />
      <Text style={estilos.valor}>{valor}</Text>
      <Text style={estilos.titulo}>{titulo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  indicadores: { flexDirection: 'row', gap: 10 },
  indicador: {
    flex: 1,
    minHeight: 104,
    paddingHorizontal: 6,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valor: {
    color: cores.folha,
    fontWeight: '700',
    fontSize: 21,
    marginTop: 9,
    marginBottom: 3,
  },
  titulo: { color: cores.tintaSuave, fontSize: 11, lineHeight: 15, textAlign: 'center' },
});
