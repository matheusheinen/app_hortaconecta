import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cores, espaco } from '@/compartilhado/tema';
import {
  DIAS_SEMANA,
  PERIODOS_DIA,
  type DiaSemana,
  type PeriodoDia,
  type SlotDisponibilidade,
} from '@/compartilhado/tipos';
import { OpcaoMarcavel, SecaoPerfil, estilosPerfil } from '../componentes/PerfilSecoes';
import { usePerfilVoluntario } from '../ContextoPerfilVoluntario';

export function TelaSecaoDisponibilidade({ voltar }: { voltar: () => void }) {
  const { perfil, salvar } = usePerfilVoluntario();
  const [slots, setSlots] = useState<SlotDisponibilidade[]>(
    perfil.dados.disponibilidade_horarios as SlotDisponibilidade[],
  );
  const alternar = (dia: DiaSemana, periodo: PeriodoDia) =>
    setSlots(atual =>
      atual.some(s => s.dia === dia && s.periodo === periodo)
        ? atual.filter(s => !(s.dia === dia && s.periodo === periodo))
        : [...atual, { dia, periodo }],
    );
  return (
    <SecaoPerfil
      titulo="Disponibilidade"
      voltar={voltar}
      salvar={async () => {
        await salvar({ disponibilidade_horarios: slots });
        return null;
      }}
    >
      <Text style={estilosPerfil.explicacao}>
        Toque nos períodos em que você costuma estar livre.
      </Text>
      {DIAS_SEMANA.map(dia => (
        <View key={dia.codigo} style={estilos.linhaDia}>
          <Text style={estilos.rotuloDia}>{dia.rotulo}</Text>
          <View style={estilosPerfil.opcoes}>
            {PERIODOS_DIA.map(periodo => (
              <OpcaoMarcavel
                key={periodo.codigo}
                rotulo={periodo.rotulo}
                rotuloAcessivel={`${dia.rotulo}, ${periodo.rotulo}`}
                ativa={slots.some(s => s.dia === dia.codigo && s.periodo === periodo.codigo)}
                onPress={() => alternar(dia.codigo, periodo.codigo)}
              />
            ))}
          </View>
        </View>
      ))}
    </SecaoPerfil>
  );
}

const estilos = StyleSheet.create({
  linhaDia: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm, marginBottom: espaco.sm },
  rotuloDia: { width: 36, fontSize: 13, fontWeight: '600', color: cores.tintaSuave },
});
