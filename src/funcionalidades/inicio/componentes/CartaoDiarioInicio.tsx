import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icone } from '@/compartilhado/componentes/Icone';
import { cores } from '@/compartilhado/tema';
import { ImagemDiario } from '@/funcionalidades/diario/componentes/ImagemDiario';
import type { Publicacao } from '@/funcionalidades/diario/tipos';
import { estilosInicio } from './estilosInicio';

/** Publicação mais recente do Diário, com foto ou ilustração. */
export function CartaoDiarioInicio({
  publicacao,
  abrir,
}: {
  publicacao: Publicacao;
  abrir: (id: number) => void;
}) {
  return (
    <View style={[estilosInicio.cartao, estilos.diario]}>
      {publicacao.imagem_caminho ? (
        <ImagemDiario caminho={publicacao.imagem_caminho} />
      ) : (
        <View style={estilos.semFoto}>
          <Icone nome="livro" tamanho={35} />
          <Text style={estilos.legenda}>Histórias que fazem a diferença</Text>
        </View>
      )}
      <Pressable
        onPress={() => abrir(publicacao.id)}
        accessibilityRole="button"
        accessibilityLabel={`Ler publicação: ${publicacao.titulo}`}
        style={({ pressed }) => [estilos.conteudo, pressed && estilosInicio.pressionado]}
      >
        <Text style={estilos.data}>
          {new Date(publicacao.data_publicacao).toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'long',
          })}
        </Text>
        <Text style={estilos.titulo}>{publicacao.titulo}</Text>
        <Text style={estilosInicio.apoio} numberOfLines={2}>
          {publicacao.texto ??
            publicacao.descricao_curta ??
            'Acompanhe as novidades da instituição.'}
        </Text>
        <View style={estilos.ler}>
          <Text style={estilosInicio.link}>Ler história</Text>
          <Icone nome="seta" tamanho={14} />
        </View>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  diario: { overflow: 'hidden' },
  semFoto: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: cores.folhaClara,
  },
  legenda: { color: cores.folha, fontSize: 13 },
  conteudo: { padding: 18 },
  data: {
    color: cores.tintaSuave,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  titulo: {
    color: cores.tinta,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    marginBottom: 4,
  },
  ler: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, minHeight: 30 },
});
