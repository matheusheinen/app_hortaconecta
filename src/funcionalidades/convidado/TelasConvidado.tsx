import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { estilosFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useConfiguracaoInstituicao } from '@/compartilhado/hooks/useConfiguracaoInstituicao';
import { LogoInstituicao } from '@/compartilhado/componentes/LogoInstituicao';
import { cores, tipo } from '@/compartilhado/tema';
import { Icone } from '@/compartilhado/componentes/Icone';

type AcoesConvidado = { criarConta: () => void };

/** Início do convidado: apresenta a instituição e leva às telas de leitura. */
export function TelaInicioConvidado({
  criarConta,
  atividades,
  metas,
}: AcoesConvidado & {
  atividades: () => void;
  metas: () => void;
}) {
  const { configuracao } = useConfiguracaoInstituicao();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.superficie }}
      contentContainerStyle={estilosFluxo.conteudo}
    >
      <LogoInstituicao url={configuracao?.url_logo} tamanho={72} />
      <Text style={tipo.titulo} accessibilityRole="header">
        {configuracao?.nome_curto ?? 'Horta Conecta'}
      </Text>
      {configuracao?.chamada ? <Text style={tipo.corpo}>{configuracao.chamada}</Text> : null}
      {configuracao?.sobre ? <Text style={tipo.corpo}>{configuracao.sobre}</Text> : null}
      <Text style={tipo.corpo}>
        Explore as oportunidades e necessidades da horta. Para se inscrever ou contribuir, entre ou
        crie uma conta.
      </Text>
      <View style={estilos.atalhos}>
        <Atalho titulo="Ver atividades" icone="pessoas" onPress={atividades} />
        <Atalho titulo="Ver doações" icone="caixa" onPress={metas} />
      </View>
      <Botao titulo="Criar conta ou entrar" onPress={criarConta} />
    </ScrollView>
  );
}

/** Perfil do convidado: sem dados para editar, só o caminho para ter uma conta. */
export function TelaPerfilConvidado({ criarConta, sair }: AcoesConvidado & { sair: () => void }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: cores.superficie }}
      contentContainerStyle={estilosFluxo.conteudo}
    >
      <Text style={tipo.titulo} accessibilityRole="header">
        Perfil
      </Text>
      <Text style={tipo.corpo}>
        Você está navegando como convidado. Entre ou crie uma conta para se inscrever, contribuir e
        acompanhar suas participações.
      </Text>
      <Botao titulo="Criar conta ou entrar" onPress={criarConta} />
      <Botao titulo="Sair do modo convidado" variante="contorno" onPress={sair} />
    </ScrollView>
  );
}

function Atalho({
  titulo,
  icone,
  onPress,
}: {
  titulo: string;
  icone: 'pessoas' | 'caixa';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [estilos.atalho, pressed && estilos.pressionado]}
    >
      <Icone nome={icone} tamanho={22} />
      <Text style={estilos.tituloAtalho}>{titulo}</Text>
      <Icone nome="seta" tamanho={15} cor={cores.tintaSuave} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  atalhos: { gap: 8 },
  atalho: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: 12,
    backgroundColor: cores.fundo,
  },
  tituloAtalho: { flex: 1, color: cores.tinta, fontSize: 14, fontWeight: '600' },
  pressionado: { opacity: 0.75 },
});
