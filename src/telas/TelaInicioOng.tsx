import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cores, espaco, tipo } from '../lib/tema';
import { Botao } from '../componentes/Ui';
import { useConfiguracaoInstituicao } from '../lib/useConfiguracaoInstituicao';

type Props = {
  nome: string;
  sair: () => void;
  aoIrParaAtividades: () => void;
  aoIrParaMetas: () => void;
};

export function TelaInicioOng({ nome, sair, aoIrParaAtividades, aoIrParaMetas }: Props) {
  const { configuracao } = useConfiguracaoInstituicao();

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={tipo.titulo}>{configuracao?.nome_curto ?? 'Painel da gestão'}</Text>
          <Text style={tipo.apoio}>{nome} · gestão da ONG</Text>
        </View>
        <Pressable onPress={sair} hitSlop={12}>
          <Text style={[tipo.apoio, { color: cores.folha, fontWeight: '600' }]}>Sair</Text>
        </Pressable>
      </View>

      {configuracao?.chamada ? (
        <Text style={[tipo.corpo, { marginTop: espaco.md }]}>{configuracao.chamada}</Text>
      ) : null}

      <View style={estilos.cartao}>
        <Text style={tipo.secao}>Tarefas</Text>
        <Text style={[tipo.apoio, { marginTop: espaco.xs, marginBottom: espaco.md }]}>
          Publique uma tarefa para a comunidade se candidatar ou acompanhe as candidaturas
          recebidas.
        </Text>
        <Botao titulo="Ir para atividades" onPress={aoIrParaAtividades} />
      </View>

      <View style={estilos.cartao}>
        <Text style={tipo.secao}>Metas</Text>
        <Text style={[tipo.apoio, { marginTop: espaco.xs, marginBottom: espaco.md }]}>
          Crie metas financeiras ou materiais e acompanhe a arrecadação.
        </Text>
        <Botao titulo="Ir para metas" onPress={aoIrParaMetas} />
      </View>

      <View style={estilos.cartao}>
        <Text style={tipo.secao}>Em desenvolvimento</Text>
        <Text style={[tipo.apoio, { marginTop: espaco.xs }]}>
          Diário de transparência, envio e validação de comprovantes de doação e triagem de
          candidatos chegam nas próximas sprints.
        </Text>
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.superficie },
  conteudo: { paddingBottom: espaco.xl },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espaco.md,
    paddingHorizontal: espaco.lg,
    paddingTop: espaco.xl,
    paddingBottom: espaco.md,
    backgroundColor: cores.fundo,
  },
  cartao: {
    backgroundColor: cores.fundo,
    borderRadius: 10,
    padding: espaco.md,
    marginHorizontal: espaco.lg,
    marginTop: espaco.md,
    borderLeftWidth: 3,
    borderLeftColor: cores.folha,
  },
});
