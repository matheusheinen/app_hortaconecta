import React from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { memoTela } from '@/compartilhado/componentes/memoTela';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { Icone, type NomeIcone } from '@/compartilhado/componentes/Icone';
import { SinoNotificacoes } from '@/funcionalidades/notificacoes/componentes/SinoNotificacoes';
import { useConfiguracaoInstituicao } from '@/compartilhado/hooks/useConfiguracaoInstituicao';
import { LogoInstituicao } from '@/compartilhado/componentes/LogoInstituicao';

type Props = {
  aoIrParaAtividades: () => void;
  aoIrParaMetas: () => void;
  aoIrParaDiario: () => void;
  aoNotificacoes: () => void;
  /** Ausente quando o recurso está fora do MVP (ver compartilhado/escopoMvp.ts). */
  aoIrParaCertificados?: () => void;
  aoIrParaOficinas?: () => void;
};

export const TelaInicioOng = memoTela(function TelaInicioOng({
  aoIrParaAtividades,
  aoIrParaMetas,
  aoIrParaDiario,
  aoNotificacoes,
  aoIrParaOficinas,
  aoIrParaCertificados,
}: Props) {
  const { nome, sair } = useSessaoAtual();
  const { configuracao } = useConfiguracaoInstituicao();

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <View style={estilos.painel}>
        <View style={estilos.cabecalho}>
          <LogoInstituicao url={configuracao?.url_logo} tamanho={44} />
          <View style={estilos.saudacao}>
            <Text style={estilos.sobretitulo}>Gestão da horta</Text>
            <Text style={estilos.nome}>{nome.trim() ? `Olá, ${nome.trim()}` : 'Olá!'}</Text>
            <Text style={tipo.apoio}>{configuracao?.nome_curto ?? 'Painel da horta'}</Text>
          </View>
          <SinoNotificacoes onPress={aoNotificacoes} />
          <Pressable
            onPress={sair}
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
            style={({ pressed }) => [estilos.sair, pressed && estilos.pressionado]}
          >
            <Icone nome="sair" tamanho={20} />
          </Pressable>
        </View>

        <Text style={estilos.introducao}>
          Organize atividades, confira doações e compartilhe as novidades da horta.
        </Text>

        <Text style={estilos.secao}>Acessos rápidos</Text>
        <View style={estilos.acoes}>
          <CartaoGestao
            titulo="Atividades"
            resumo="Publicar e acompanhar inscrições."
            icone="pessoas"
            onPress={aoIrParaAtividades}
          />
          <CartaoGestao
            titulo="Metas e doações"
            resumo="Metas, doações e conferências."
            icone="caixa"
            onPress={aoIrParaMetas}
          />
          {aoIrParaCertificados ? (
            <CartaoGestao
              titulo="Certificados"
              resumo="Presenças e certificados."
              icone="certificado"
              onPress={aoIrParaCertificados}
            />
          ) : null}
          {aoIrParaOficinas ? (
            <CartaoGestao
              titulo="Oficinas"
              resumo="Propostas da comunidade."
              icone="oficina"
              onPress={aoIrParaOficinas}
            />
          ) : null}
          <CartaoGestao
            titulo="Diário de Transparência"
            resumo="Relatos e novidades da horta."
            icone="livro"
            onPress={aoIrParaDiario}
          />
        </View>
      </View>
    </ScrollView>
  );
});

function CartaoGestao({
  titulo,
  resumo,
  icone,
  onPress,
}: {
  titulo: string;
  resumo: string;
  icone: NomeIcone;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityHint={resumo}
      style={({ pressed }) => [estilos.cartao, pressed && estilos.pressionado]}
    >
      <View style={estilos.icone}>
        <Icone nome={icone} tamanho={22} />
      </View>
      <View style={estilos.textoCartao}>
        <Text style={estilos.tituloCartao}>{titulo}</Text>
        <Text style={estilos.resumoCartao}>{resumo}</Text>
      </View>
      <Icone nome="seta" tamanho={15} cor={cores.tintaSuave} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.superficie },
  conteudo: { padding: 20, paddingTop: 24, paddingBottom: espaco.xl },
  painel: { width: '100%', maxWidth: 680, alignSelf: 'center' },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.md,
    marginBottom: espaco.lg,
  },
  saudacao: { flex: 1, gap: 4 },
  sobretitulo: { fontSize: 12, fontWeight: '600', color: cores.folha },
  nome: { fontSize: 24, fontWeight: '700', color: cores.tinta, letterSpacing: -0.4 },
  sair: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.fundo,
  },
  introducao: { ...tipo.corpo, marginBottom: espaco.md },
  secao: {
    fontSize: 16,
    fontWeight: '700',
    color: cores.tinta,
    marginBottom: 8,
  },
  acoes: { gap: 12 },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: cores.fundo,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.linha,
    padding: 12,
  },
  icone: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: cores.folhaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCartao: { flex: 1, gap: 4 },
  tituloCartao: { fontSize: 15, fontWeight: '700', color: cores.tinta },
  resumoCartao: { fontSize: 12, lineHeight: 18, color: cores.tintaSuave },
  pressionado: { opacity: 0.75 },
});
