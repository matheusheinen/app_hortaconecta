import React, { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { Aviso, Botao } from '@/compartilhado/componentes/Ui';
import { Icone } from '@/compartilhado/componentes/Icone';
import { TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { CartaoModoGestor } from '@/funcionalidades/modoGestor/ModoGestor';

/** Tela inicial do perfil: cabeçalho, resumo de status e lista de seções. */
export function HubPerfil({
  nome,
  papel,
  sair,
  erro,
  carregando,
  carregar,
  children,
}: {
  nome: string;
  papel: string;
  sair: () => void;
  erro: string | null;
  carregando: boolean;
  carregar: () => void;
  children: ReactNode;
}) {
  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={tipo.titulo} accessibilityRole="header">
            Perfil
          </Text>
          <Text style={tipo.apoio}>
            {nome} · {papel}
          </Text>
        </View>
        <Pressable
          onPress={sair}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          <Text style={[tipo.apoio, { color: cores.folha, fontWeight: '600' }]}>Sair</Text>
        </Pressable>
      </View>
      {erro ? <Aviso mensagem={erro} /> : null}
      {erro ? <Botao titulo="Tentar novamente" onPress={carregar} /> : null}
      {carregando && !erro ? <ActivityIndicator color={cores.folha} /> : null}
      {children}
      <CartaoModoGestor />
    </ScrollView>
  );
}

export function StatusPerfil({
  ok,
  titulo,
  texto,
  feitas,
  total,
}: {
  ok: boolean;
  titulo: string;
  texto: string;
  feitas: number;
  total: number;
}) {
  return (
    <View style={[estilos.status, ok ? estilos.statusOk : estilos.statusPendente]}>
      <Text style={estilos.statusTitulo}>{titulo}</Text>
      <Text style={tipo.apoio}>{texto}</Text>
      <View
        style={estilos.barra}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: feitas }}
      >
        <View style={[estilos.barraPreenchida, { width: `${(feitas / total) * 100}%` }]} />
      </View>
    </View>
  );
}

export function CartaoSecao({
  titulo,
  resumo,
  completa,
  onPress,
}: {
  titulo: string;
  resumo: string;
  completa: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${completa ? 'Completo' : 'Pendente'}.`}
      style={({ pressed }) => [estilos.secao, pressed && { opacity: 0.8 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={estilos.secaoTitulo}>{titulo}</Text>
        <Text style={tipo.apoio}>{resumo}</Text>
      </View>
      <View style={[estilos.chip, completa ? estilos.chipOk : estilos.chipPendente]}>
        <Text style={[estilos.chipTexto, { color: completa ? cores.folha : cores.terra }]}>
          {completa ? 'Completo' : 'Pendente'}
        </Text>
      </View>
      <Icone nome="seta" tamanho={16} cor={cores.tintaSuave} />
    </Pressable>
  );
}

/**
 * Moldura de uma seção editável. `salvar` devolve a mensagem de validação,
 * ou null quando gravou; nesse caso a tela volta ao hub.
 */
export function SecaoPerfil({
  titulo,
  voltar,
  salvar,
  children,
}: {
  titulo: string;
  voltar: () => void;
  salvar: () => Promise<string | null>;
  children: ReactNode;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function aoSalvar() {
    if (ocupado) return;
    setErro(null);
    setOcupado(true);
    try {
      const problema = await salvar();
      if (problema) setErro(problema);
      else voltar();
    } catch (falha) {
      setErro(mensagemErro(falha));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <TelaFluxo titulo={titulo} voltar={voltar}>
      {erro ? <Aviso mensagem={erro} /> : null}
      <View>{children}</View>
      <Botao titulo="Salvar" onPress={aoSalvar} carregando={ocupado} />
    </TelaFluxo>
  );
}

export const estilosPerfil = StyleSheet.create({
  multilinha: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  linha: { flexDirection: 'row', gap: espaco.sm },
  explicacao: { ...tipo.apoio, marginBottom: espaco.md },
});

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.superficie },
  conteudo: {
    padding: 20,
    paddingTop: espaco.xl,
    paddingBottom: espaco.xl,
    gap: espaco.md,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  cabecalho: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco.md },
  status: { borderRadius: 18, padding: espaco.md, gap: espaco.sm, borderWidth: 1 },
  statusOk: { backgroundColor: cores.folhaClara, borderColor: '#CFE5D7' },
  statusPendente: { backgroundColor: '#FBF4EA', borderColor: '#EEDDC5' },
  statusTitulo: { fontSize: 16, fontWeight: '700', color: cores.tinta },
  barra: { height: 8, borderRadius: 4, backgroundColor: cores.fundo, overflow: 'hidden' },
  barraPreenchida: { height: 8, borderRadius: 4, backgroundColor: cores.folha },
  secao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    backgroundColor: cores.fundo,
    borderRadius: 18,
    padding: espaco.md,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  secaoTitulo: { fontSize: 15, fontWeight: '700', color: cores.tinta },
  chip: { borderRadius: 12, paddingHorizontal: espaco.sm, paddingVertical: 3 },
  chipOk: { backgroundColor: cores.folhaClara },
  chipPendente: { backgroundColor: '#FBF4EA' },
  chipTexto: { fontSize: 12, fontWeight: '700' },
});
