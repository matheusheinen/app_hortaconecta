import React, { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { Aviso, Botao } from '@/compartilhado/componentes/Ui';
import { Icone } from '@/compartilhado/componentes/Icone';
import { TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { CartaoModoGestor } from '@/funcionalidades/modoGestor/ModoGestor';
import { CartaoPreferenciasNotificacoes } from '@/funcionalidades/notificacoes/componentes/CartaoPreferenciasNotificacoes';
import { FotoPerfil } from './FotoPerfil';

/** Tela inicial do perfil: cabeçalho, resumo de status e lista de seções. */
export function HubPerfil({
  nome,
  papel,
  sair,
  erro,
  carregando,
  carregar,
  antesModoGestor,
  children,
}: {
  nome: string;
  papel: string;
  sair: () => void;
  erro: string | null;
  carregando: boolean;
  carregar: () => void;
  antesModoGestor?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={tipo.titulo} accessibilityRole="header">
            Meu perfil
          </Text>
          <Text style={tipo.apoio}>Foto, dados e preferências da sua conta.</Text>
        </View>
        <Pressable
          onPress={sair}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          style={({ pressed }) => [estilos.sair, pressed && estilos.acaoPressionada]}
        >
          <Icone nome="sair" tamanho={15} cor={cores.folha} />
          <Text style={estilos.sairTexto}>Sair</Text>
        </Pressable>
      </View>
      <FotoPerfil nome={nome} papel={papel} />
      {erro ? <Aviso mensagem={erro} /> : null}
      {erro ? <Botao titulo="Tentar novamente" onPress={carregar} /> : null}
      {carregando && !erro ? <ActivityIndicator color={cores.folha} /> : null}
      {children}
      <CartaoPreferenciasNotificacoes />
      {antesModoGestor}
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
      <Text style={estilos.contagem}>
        {feitas} de {total} seções completas
      </Text>
    </View>
  );
}

export function CartaoSecao({
  titulo,
  resumo,
  simbolo,
  completa,
  onPress,
}: {
  titulo: string;
  resumo: string;
  simbolo: string;
  completa: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${completa ? 'Completo' : 'Pendente'}.`}
      accessibilityHint="Abre esta seção do perfil para edição."
      style={({ pressed }) => [estilos.secao, pressed && estilos.acaoPressionada]}
    >
      <View style={estilos.simboloSecao}>
        <Text style={estilos.simboloTexto}>{simbolo}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={estilos.secaoTitulo}>{titulo}</Text>
        <Text style={tipo.apoio}>{resumo}</Text>
      </View>
      <View style={[estilos.statusPill, completa ? estilos.statusFeito : estilos.statusFalta]}>
        <Text
          style={[
            estilos.statusTexto,
            completa ? estilos.secaoStatusOk : estilos.secaoStatusPendente,
          ]}
        >
          {completa ? '✓ Feito' : 'Falta'}
        </Text>
      </View>
      <View style={estilos.setaSecao}>
        <Icone nome="seta" tamanho={14} cor={cores.tintaSuave} />
      </View>
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

/** Opção que liga e desliga, como um período livre ou uma habilidade. */
export function OpcaoMarcavel({
  rotulo,
  rotuloAcessivel = rotulo,
  ativa,
  onPress,
}: {
  rotulo: string;
  rotuloAcessivel?: string;
  ativa: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: ativa }}
      accessibilityLabel={rotuloAcessivel}
      style={[estilos.opcao, ativa && estilos.opcaoAtiva]}
    >
      <Text style={[estilos.opcaoTexto, ativa && estilos.opcaoTextoAtivo]}>{rotulo}</Text>
    </Pressable>
  );
}

export const estilosPerfil = StyleSheet.create({
  multilinha: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  linha: { flexDirection: 'row', gap: espaco.sm },
  explicacao: { ...tipo.apoio, marginBottom: espaco.md },
  /** Linha que quebra para agrupar OpcaoMarcavel. */
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, flex: 1 },
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
  sair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.xs,
    paddingHorizontal: espaco.sm,
    paddingVertical: espaco.xs + 2,
    borderRadius: 18,
    backgroundColor: cores.mint,
  },
  sairTexto: { fontSize: 12, fontWeight: '700', color: cores.folha },
  acaoPressionada: { opacity: 0.78 },
  status: { borderRadius: 14, padding: 12, gap: espaco.sm, borderWidth: 1 },
  statusOk: { backgroundColor: cores.folhaClara, borderColor: cores.folhaLinha },
  statusPendente: { backgroundColor: cores.areia, borderColor: cores.areiaLinha },
  statusTitulo: { fontSize: 15, fontWeight: '700', color: cores.tinta },
  barra: { height: 5, borderRadius: 3, backgroundColor: cores.fundo, overflow: 'hidden' },
  barraPreenchida: { height: 5, borderRadius: 3, backgroundColor: cores.folha },
  contagem: { ...tipo.apoio, fontSize: 11 },
  secao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    backgroundColor: cores.fundo,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 72,
    borderWidth: 1,
    borderColor: cores.linha,
    boxShadow: '0px 2px 4px rgba(28, 67, 48, 0.06)',
  },
  simboloSecao: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: cores.folhaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simboloTexto: { fontSize: 17 },
  secaoTitulo: { fontSize: 14, fontWeight: '700', color: cores.tinta },
  statusPill: { borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5 },
  statusFeito: { backgroundColor: cores.folhaFundo, borderColor: cores.folhaLinha, borderWidth: 1 },
  statusFalta: { backgroundColor: cores.areia, borderColor: cores.areiaLinha, borderWidth: 1 },
  statusTexto: { fontSize: 10, fontWeight: '700' },
  secaoStatusOk: { color: cores.folha },
  secaoStatusPendente: { color: cores.terra },
  setaSecao: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.superficie,
  },
  opcao: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: 20,
    paddingHorizontal: espaco.md,
    paddingVertical: espaco.xs + 2,
    backgroundColor: cores.fundo,
  },
  opcaoAtiva: { borderColor: cores.folha, backgroundColor: cores.folhaClara },
  opcaoTexto: { fontSize: 13, fontWeight: '600', color: cores.tintaSuave },
  opcaoTextoAtivo: { color: cores.folha },
});
