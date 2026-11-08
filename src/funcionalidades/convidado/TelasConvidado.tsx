import React from 'react';
import { ScrollView, Text } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, estilosFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useConfiguracaoInstituicao } from '@/compartilhado/hooks/useConfiguracaoInstituicao';
import { LogoInstituicao } from '@/compartilhado/componentes/LogoInstituicao';
import { cores, tipo } from '@/compartilhado/tema';

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
      <CartaoFluxo>
        <Text style={tipo.secao}>Você está como convidado</Text>
        <Text style={tipo.corpo}>
          Dá para ver as atividades e as metas da horta. Para participar ou contribuir, crie uma
          conta.
        </Text>
        <Botao titulo="Criar conta ou entrar" onPress={criarConta} />
      </CartaoFluxo>
      <Botao titulo="Ver atividades" variante="contorno" onPress={atividades} />
      <Botao titulo="Ver metas de doação" variante="contorno" onPress={metas} />
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
      <CartaoFluxo>
        <Text style={tipo.secao}>Você está como convidado</Text>
        <Text style={tipo.corpo}>
          Convidados só visualizam. Com uma conta você se candidata às atividades, contribui com as
          metas, acompanha suas participações e recebe certificados.
        </Text>
        <Botao titulo="Criar conta ou entrar" onPress={criarConta} />
      </CartaoFluxo>
      <Botao titulo="Sair do modo convidado" variante="contorno" onPress={sair} />
    </ScrollView>
  );
}
