import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icone } from '@/compartilhado/componentes/Icone';
import { cores } from '@/compartilhado/tema';
import type { Atividade } from '@/funcionalidades/voluntariado/tipos';
import { estilosInicio } from './estilosInicio';

/** Atividade em destaque ou sugerida; oficinas e cartões alternados ficam em azul. */
export function CartaoAtividadeInicio({
  atividade,
  vagasDisponiveis,
  azul,
  etiqueta,
  abrir,
}: {
  atividade: Atividade;
  vagasDisponiveis: number;
  azul: boolean;
  etiqueta?: string;
  abrir: (id: number) => void;
}) {
  const oficina = atividade.tipo === 'OFICINA_AUTORAL';
  const destaque = oficina || azul;
  return (
    <Pressable
      onPress={() => abrir(atividade.id)}
      accessibilityRole="button"
      accessibilityLabel={`${atividade.titulo}. ${vagasDisponiveis} vagas disponíveis. Ver atividade.`}
      style={({ pressed }) => [
        estilosInicio.cartao,
        estilos.atividade,
        pressed && estilosInicio.pressionado,
      ]}
    >
      <View style={[estilos.icone, destaque && estilos.iconeAzul]}>
        <Icone
          nome={oficina ? 'oficina' : 'folha'}
          cor={destaque ? cores.azul : cores.folhaViva}
          tamanho={26}
        />
      </View>
      <View style={estilosInicio.flex}>
        <View style={estilos.etiquetas}>
          <View style={[estilos.etiqueta, destaque && estilos.etiquetaAzul]}>
            <Text style={[estilos.etiquetaTexto, destaque && estilos.textoAzul]}>
              {etiqueta ?? (oficina ? 'Oficina' : 'Na comunidade')}
            </Text>
          </View>
          <Text style={estilos.vagas}>
            {vagasDisponiveis} {vagasDisponiveis === 1 ? 'vaga' : 'vagas'}
          </Text>
        </View>
        <Text numberOfLines={2} style={estilosInicio.cartaoTitulo}>
          {atividade.titulo}
        </Text>
        <Text style={estilos.data}>
          {dataAtividade(atividade.data_hora_prevista, atividade.carga_horaria)}
        </Text>
      </View>
      <Icone nome="seta" tamanho={17} cor={cores.tintaSuave} />
    </Pressable>
  );
}

/** "qui., 16 de out. · 09:00 · 2h" */
function dataAtividade(iso: string, horas: number) {
  const data = new Date(iso);
  return `${data.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${horas.toLocaleString('pt-BR')}h`;
}

const estilos = StyleSheet.create({
  atividade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 10,
  },
  icone: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: cores.folhaFundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconeAzul: { backgroundColor: cores.azulClaro },
  etiquetas: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 5,
  },
  etiqueta: {
    backgroundColor: cores.folhaFundo,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  etiquetaTexto: { color: cores.folhaEscura, fontSize: 10, fontWeight: '600' },
  etiquetaAzul: { backgroundColor: cores.azulClaro },
  textoAzul: { color: cores.azul },
  vagas: { fontSize: 10, color: cores.tintaSuave },
  data: { fontSize: 11, lineHeight: 16, color: cores.tintaSuave, marginTop: 3 },
});
