import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cores, espaco, tipo } from '../lib/tema';
import { Icone, type NomeIcone } from '../componentes/Icone';
import { useConfiguracaoInstituicao } from '../lib/useConfiguracaoInstituicao';

type Props = {
  nome: string;
  sair: () => void;
  aoIrParaAtividades: () => void;
  aoIrParaMetas: () => void;
  aoIrParaDiario: () => void;
  /** Ausente quando o recurso está fora do MVP (ver lib/escopoMvp). */
  aoIrParaCertificados?: () => void;
  aoIrParaOficinas?: () => void;
};

export function TelaInicioOng({ nome, sair, aoIrParaAtividades, aoIrParaMetas, aoIrParaDiario, aoIrParaOficinas, aoIrParaCertificados }: Props) {
  const { configuracao } = useConfiguracaoInstituicao();

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <View style={estilos.painel}>
        <View style={estilos.cabecalho}>
          <View style={estilos.saudacao}>
            <Text style={estilos.sobretitulo}>BEM-VINDO À GESTÃO</Text>
            <Text style={estilos.nome}>{nome.trim() ? `Olá, ${nome.trim()}` : 'Olá!'}</Text>
            <Text style={tipo.apoio}>{configuracao?.nome_curto ?? 'Painel da gestão'}</Text>
          </View>
          <Pressable
            onPress={sair}
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
            style={({ pressed }) => [estilos.sair, pressed && estilos.pressionado]}
          >
            <Icone nome="sair" tamanho={20} />
          </Pressable>
        </View>

        {configuracao?.chamada ? (
          <View style={estilos.chamada}>
            <Icone nome="folha" tamanho={22} />
            <Text style={[tipo.apoio, estilos.chamadaTexto]}>{configuracao.chamada}</Text>
          </View>
        ) : null}

        <Text style={estilos.secao}>SUA COMUNIDADE</Text>
        <View style={estilos.acoes}>
          <CartaoGestao
            titulo="Atividades"
            resumo="Publique tarefas e acompanhe candidaturas."
            icone="pessoas"
            onPress={aoIrParaAtividades}
          />
          <CartaoGestao
            titulo="Materiais"
            resumo="Solicite materiais e confirme as entregas."
            icone="caixa"
            onPress={aoIrParaMetas}
          />
          {aoIrParaCertificados ? (
            <CartaoGestao
              titulo="Certificados"
              resumo="Acompanhe os certificados emitidos."
              icone="certificado"
              onPress={aoIrParaCertificados}
            />
          ) : null}
          {aoIrParaOficinas ? (
            <CartaoGestao
              titulo="Oficinas"
              resumo="Conheça as propostas da comunidade."
              icone="oficina"
              onPress={aoIrParaOficinas}
            />
          ) : null}
          <CartaoGestao
            titulo="Diário de Transparência"
            resumo="Compartilhe os avanços e as histórias da ONG."
            icone="livro"
            onPress={aoIrParaDiario}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function CartaoGestao({ titulo, resumo, icone, onPress }: {
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
  sobretitulo: { fontSize: 11, fontWeight: '600', letterSpacing: 0.7, color: cores.folha },
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
  chamada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: espaco.md,
    borderRadius: 18,
    backgroundColor: cores.folhaClara,
    marginBottom: espaco.lg,
  },
  chamadaTexto: { flex: 1, color: cores.folha },
  secao: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, color: cores.tinta, marginBottom: 12 },
  acoes: { gap: 12 },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: cores.fundo,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cores.linha,
    padding: espaco.md,
  },
  icone: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: cores.folhaClara,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCartao: { flex: 1, gap: 4 },
  tituloCartao: { fontSize: 16, fontWeight: '700', color: cores.tinta },
  resumoCartao: { fontSize: 12, lineHeight: 18, color: cores.tintaSuave },
  pressionado: { opacity: 0.75 },
});
