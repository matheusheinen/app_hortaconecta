import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { cores, espaco, tipo } from '../lib/tema';
import { rotuloStatusMeta, type Meta } from '../lib/tipos';
import { useOng } from '../lib/useOng';
import { Aviso, Botao } from '../componentes/Ui';

type Props = {
  ehGestao: boolean;
  nome: string;
  onNova: () => void;
  onEditar: (meta: Meta) => void;
  onSair: () => void;
};

export function TelaMetas({ ehGestao, nome, onNova, onEditar, onSair }: Props) {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const { ong } = useOng();

  const carregar = useCallback(async () => {
    setErro(null);
    setCarregando(true);

    const { data, error } = await supabase
      .from('metas_demandas')
      .select('*')
      .order('status', { ascending: true })
      .order('criado_em', { ascending: false });

    if (error) setErro(error.message);
    setMetas(data ?? []);
    setCarregando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  function confirmarExclusao(meta: Meta) {
    const excluir = async () => {
      const { error } = await supabase.from('metas_demandas').delete().eq('id', meta.id);
      if (error) {
        avisar('Não foi possível excluir', error.message);
        return;
      }
      carregar();
    };

    confirmar('Excluir meta', `"${meta.titulo}" será removida. Não dá para desfazer.`, excluir);
  }

  async function encerrar(meta: Meta) {
    const { error } = await supabase
      .from('metas_demandas')
      .update({ status: 'ENCERRADA' })
      .eq('id', meta.id);

    if (error) {
      avisar('Não foi possível encerrar', error.message);
      return;
    }
    carregar();
  }

  return (
    <View style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={tipo.titulo}>Metas</Text>
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
          <Botao titulo="Nova meta" onPress={onNova} />
        </View>
      ) : null}

      {erro ? (
        <View style={{ paddingHorizontal: espaco.lg }}>
          <Aviso mensagem={erro} />
        </View>
      ) : null}

      <FlatList
        data={metas}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={estilos.lista}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} />}
        ListEmptyComponent={
          carregando ? null : (
            <View style={estilos.vazio}>
              <Text style={[tipo.secao, { marginBottom: espaco.sm }]}>
                {ehGestao ? 'Nenhuma meta cadastrada' : 'Nada por aqui ainda'}
              </Text>
              <Text style={tipo.apoio}>
                {ehGestao
                  ? 'Crie a primeira meta para a comunidade apadrinhar.'
                  : 'Quando a horta abrir uma meta, ela aparece nesta tela.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <CartaoMeta
            meta={item}
            ehGestao={ehGestao}
            chavePix={ong?.chave_pix ?? null}
            onEditar={() => onEditar(item)}
            onExcluir={() => confirmarExclusao(item)}
            onEncerrar={() => encerrar(item)}
          />
        )}
      />
    </View>
  );
}

type CartaoMetaProps = {
  meta: Meta;
  ehGestao: boolean;
  chavePix: string | null;
  onEditar: () => void;
  onExcluir: () => void;
  onEncerrar: () => void;
};

function CartaoMeta({ meta, ehGestao, chavePix, onEditar, onExcluir, onEncerrar }: CartaoMetaProps) {
  const [copiado, setCopiado] = useState(false);
  const percentual = Math.min(100, Math.round((meta.quantidade_arrecadada / meta.quantidade_meta) * 100));
  const unidade = meta.tipo === 'FINANCEIRA' ? 'R$' : (meta.unidade_medida ?? 'un.');

  async function copiarChave() {
    if (!chavePix) return;
    await Clipboard.setStringAsync(chavePix);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <View style={estilos.cartao}>
      <View style={estilos.cartaoTopo}>
        <Text style={estilos.cartaoTitulo}>{meta.titulo}</Text>
        <Text style={estilos.selo}>{rotuloStatusMeta[meta.status]}</Text>
      </View>

      <Text style={[tipo.corpo, { marginTop: espaco.sm }]} numberOfLines={3}>
        {meta.descricao}
      </Text>

      <View style={estilos.progressoTrilha}>
        <View style={[estilos.progressoPreenchido, { width: `${percentual}%` }]} />
      </View>
      <Text style={[tipo.apoio, { marginTop: espaco.xs }]}>
        {unidade} {meta.quantidade_arrecadada} de {unidade} {meta.quantidade_meta} · {percentual}%
        {meta.data_limite ? ` · até ${formatarData(meta.data_limite)}` : ''}
      </Text>

      {!ehGestao && meta.tipo === 'FINANCEIRA' && meta.status === 'ABERTA' ? (
        chavePix ? (
          <View style={{ marginTop: espaco.md }}>
            <Botao
              titulo={copiado ? 'Chave copiada!' : 'Copiar chave PIX'}
              variante="contorno"
              onPress={copiarChave}
            />
          </View>
        ) : (
          <Text style={[tipo.apoio, { marginTop: espaco.md, fontStyle: 'italic' }]}>
            Chave PIX ainda não cadastrada pela gestão.
          </Text>
        )
      ) : null}

      {ehGestao ? (
        <View style={estilos.acoes}>
          <View style={{ flex: 1 }}>
            <Botao titulo="Editar" variante="contorno" onPress={onEditar} />
          </View>
          {meta.status === 'ABERTA' ? (
            <View style={{ flex: 1 }}>
              <Botao titulo="Encerrar" variante="contorno" onPress={onEncerrar} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Botao titulo="Excluir" variante="destrutivo" onPress={onExcluir} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

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
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('pt-BR');
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
  progressoTrilha: {
    height: 8,
    borderRadius: 4,
    backgroundColor: cores.folhaClara,
    marginTop: espaco.md,
    overflow: 'hidden',
  },
  progressoPreenchido: {
    height: 8,
    borderRadius: 4,
    backgroundColor: cores.folha,
  },
  acoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.md },
  vazio: { padding: espaco.xl, alignItems: 'center' },
});
