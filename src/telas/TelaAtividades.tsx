import React, { useCallback } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDadosVoluntariado } from '../lib/useDadosVoluntariado';
import { supabase } from '../lib/supabase';
import { cores, espaco, tipo } from '../lib/tema';
import { rotuloStatus, type Atividade } from '../lib/tipos';
import { Aviso, Botao } from '../componentes/Ui';
import { mensagemErro } from '../lib/voluntariado';

type Props = {
  ehGestao: boolean;
  nome: string;
  onNova: () => void;
  onEditar: (atividade: Atividade) => void;
  onDetalhe: (id: number) => void;
  onMinhas: () => void;
  onHistorico: () => void;
  onSair: () => void;
};

export function TelaAtividades({ ehGestao, nome, onNova, onEditar, onSair, onDetalhe, onMinhas, onHistorico }: Props) {
  const { dados, carregando, erro, carregar } = useDadosVoluntariado(
    useCallback(async () => {
      // A visibilidade da listagem continua dependendo do RLS de atividades.
      const { data, error } = await supabase.from('atividades').select('*')
        .order('data_hora_prevista', { ascending: true });
      if (error) throw error;
      return data;
    }, []),
  );
  const atividades = dados ?? [];

  function confirmarExclusao(atividade: Atividade) {
    const mensagem = `"${atividade.titulo}" será removida. Atividades com candidaturas devem ser canceladas nos detalhes para preservar o histórico.`;

    const excluir = async () => {
      try {
        const { error, data } = await supabase.from('atividades').delete().eq('id', atividade.id).select('id').single();
        if (error) throw error;
        if (!data) throw new Error('Nenhuma atividade foi removida. Recarregue a lista.');
        await carregar();
      } catch (falha) {
        avisar('Não foi possível excluir', mensagemErro(falha));
      }
    };

    confirmar('Excluir atividade', mensagem, excluir);
  }

  return (
    <View style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={tipo.titulo}>Atividades</Text>
          <Text style={tipo.apoio}>
            {nome} · {ehGestao ? 'gestão da ONG' : 'voluntário'}
          </Text>
        </View>
        <Pressable onPress={onSair} hitSlop={12}>
          <Text style={[tipo.apoio, { color: cores.folha, fontWeight: '600' }]}>Sair</Text>
        </Pressable>
      </View>

      {ehGestao ? (
        <View style={estilos.barraAcao}>
          <Botao titulo="Publicar tarefa" onPress={onNova} />
        </View>
      ) : <View style={[estilos.barraAcao, { gap: espaco.sm }]}>
        <Botao titulo="Minhas candidaturas" onPress={onMinhas} />
        <Botao titulo="Histórico de participação" variante="contorno" onPress={onHistorico} />
      </View>}

      {erro ? (
        <View style={{ paddingHorizontal: espaco.lg }}>
          <Aviso mensagem={erro} />
          <Botao titulo="Tentar novamente" onPress={carregar} />
        </View>
      ) : null}

      <FlatList
        data={atividades}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={estilos.lista}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} />}
        ListEmptyComponent={
          carregando || erro ? null : (
            <View style={estilos.vazio}>
              <Text style={[tipo.secao, { marginBottom: espaco.sm }]}>
                {ehGestao ? 'Nenhuma tarefa publicada' : 'Nada por aqui ainda'}
              </Text>
              <Text style={tipo.apoio}>
                {ehGestao
                  ? 'Publique a primeira tarefa para a comunidade se candidatar.'
                  : 'Quando a horta publicar uma tarefa, ela aparece nesta tela.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable style={estilos.cartao} onPress={() => onDetalhe(item.id)} accessibilityRole="button" accessibilityLabel={`Ver detalhes de ${item.titulo}`}>
            <View style={estilos.cartaoTopo}>
              <Text style={estilos.cartaoTitulo}>{item.titulo}</Text>
              <Text style={estilos.selo}>{rotuloStatus[item.status]}</Text>
            </View>

            <Text style={[tipo.corpo, { marginTop: espaco.sm }]} numberOfLines={3}>
              {item.descricao}
            </Text>

            <Text style={[tipo.apoio, { marginTop: espaco.md }]}>
              {formatarData(item.data_hora_prevista)} · {item.vagas_totais}{' '}
              {item.vagas_totais === 1 ? 'vaga' : 'vagas'} · {item.carga_horaria}h
            </Text>

            {ehGestao ? (
              <View style={estilos.acoes}>
                <View style={{ flex: 1 }}>
                  <Botao titulo="Editar" variante="contorno" onPress={() => onEditar(item)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Botao
                    titulo="Excluir"
                    variante="destrutivo"
                    onPress={() => confirmarExclusao(item)}
                  />
                </View>
              </View>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}

/**
 * O react-native-web não implementa Alert. No navegador caímos nos
 * diálogos nativos do browser; no celular, no Alert do React Native.
 */
function confirmar(titulo: string, mensagem: string, aoConfirmar: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensagem}`)) aoConfirmar();
    return;
  }

  Alert.alert(titulo, mensagem, [
    { text: 'Manter', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: aoConfirmar },
  ]);
}

function avisar(titulo: string, mensagem: string) {
  if (Platform.OS === 'web') {
    window.alert(`${titulo}\n\n${mensagem}`);
    return;
  }
  Alert.alert(titulo, mensagem);
}

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.superficie },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espaco.md,
    paddingHorizontal: espaco.lg,
    paddingTop: espaco.xl,
    paddingBottom: espaco.md,
    backgroundColor: cores.fundo,
  },
  barraAcao: {
    paddingHorizontal: espaco.lg,
    paddingBottom: espaco.md,
    backgroundColor: cores.fundo,
    borderBottomWidth: 1,
    borderBottomColor: cores.linha,
  },
  lista: { padding: espaco.lg, gap: espaco.md },
  cartao: {
    backgroundColor: cores.fundo,
    borderRadius: 10,
    padding: espaco.md,
    borderLeftWidth: 3,
    borderLeftColor: cores.folha,
  },
  cartaoTopo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espaco.sm,
  },
  cartaoTitulo: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: cores.tinta,
  },
  selo: {
    fontSize: 12,
    color: cores.folha,
    backgroundColor: cores.folhaClara,
    paddingHorizontal: espaco.sm,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  acoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.md },
  vazio: { padding: espaco.xl, alignItems: 'center' },
});
