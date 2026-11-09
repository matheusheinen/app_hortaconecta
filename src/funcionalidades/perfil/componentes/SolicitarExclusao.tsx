import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Aviso, Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { Icone } from '@/compartilhado/componentes/Icone';
import { useAcao } from '@/compartilhado/hooks/useAcao';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { confirmarExclusao } from '@/compartilhado/utils/confirmar';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { carregarSolicitacaoExclusao, solicitarExclusaoConta } from '../apiExclusao';

const descricaoExclusao =
  'A gestão da instituição será avisada e removerá seus dados pessoais, habilidades e candidaturas. Registros de doações confirmadas podem ser mantidos pelo prazo exigido em lei.';

/** Cartão "Meus dados" do perfil do voluntário (RNF0004, LGPD). */
export function SolicitarExclusao() {
  const [expandido, setExpandido] = useState(false);
  const { usuarioId } = useSessaoAtual();
  const { dados, erro, carregando, carregar } = useConsulta(
    useCallback(() => carregarSolicitacaoExclusao(usuarioId), [usuarioId]),
  );
  const acao = useAcao();

  function pedir() {
    confirmarExclusao('Solicitar exclusão dos dados?', descricaoExclusao, () => {
      void acao.executar(async () => {
        await solicitarExclusaoConta();
        await carregar();
      });
    });
  }

  if (carregando && dados === null && !erro) return null;
  return (
    <View style={estilos.container}>
      {dados ? (
        <CartaoFluxo>
          <Text style={tipo.secao}>Solicitação registrada</Text>
          <Text style={tipo.apoio}>
            Você pediu a exclusão dos seus dados em {new Date(dados).toLocaleDateString('pt-BR')}. A
            gestão vai concluir o pedido e avisar você pelo contato cadastrado.
          </Text>
        </CartaoFluxo>
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Solicitar exclusão dos meus dados"
            accessibilityState={{ expanded: expandido }}
            onPress={() => setExpandido(aberto => !aberto)}
            style={({ pressed }) => [estilos.atalho, pressed && estilos.atalhoPressionado]}
          >
            <Text style={estilos.rotulo}>Solicitar exclusão dos meus dados</Text>
            <View style={expandido ? estilos.iconeAberto : undefined}>
              <Icone nome="seta" tamanho={15} cor={cores.tintaClara} />
            </View>
          </Pressable>
          {expandido ? (
            <View style={estilos.detalhes}>
              <Text style={tipo.apoio}>{descricaoExclusao}</Text>
              <Botao
                titulo="Revisar solicitação"
                variante="destrutivo"
                carregando={acao.ocupado}
                desabilitado={!!erro}
                onPress={pedir}
              />
            </View>
          ) : null}
        </>
      )}
      {erro || acao.erro ? <Aviso mensagem={acao.erro ?? erro ?? ''} /> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: espaco.sm },
  atalho: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
    paddingHorizontal: espaco.xs,
    opacity: 0.78,
  },
  atalhoPressionado: { opacity: 1 },
  rotulo: { ...tipo.apoio, fontSize: 12, color: cores.tintaClara },
  iconeAberto: { transform: [{ rotate: '90deg' }] },
  detalhes: { gap: espaco.sm, paddingHorizontal: espaco.xs },
});
