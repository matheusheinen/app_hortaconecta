import React, { useCallback } from 'react';
import { Text } from 'react-native';
import { Aviso, Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useAcao } from '@/compartilhado/hooks/useAcao';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { confirmarExclusao } from '@/compartilhado/utils/confirmar';
import { tipo } from '@/compartilhado/tema';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { carregarSolicitacaoExclusao, solicitarExclusaoConta } from '../apiExclusao';

/** Cartão "Meus dados" do perfil do voluntário (RNF0004, LGPD). */
export function SolicitarExclusao() {
  const { usuarioId } = useSessaoAtual();
  const { dados, erro, carregando, carregar } = useConsulta(
    useCallback(() => carregarSolicitacaoExclusao(usuarioId), [usuarioId]),
  );
  const acao = useAcao();

  function pedir() {
    confirmarExclusao(
      'Solicitar exclusão dos dados?',
      'A gestão da instituição será avisada e removerá seus dados pessoais, habilidades e candidaturas. Registros de doações confirmadas podem ser mantidos pelo prazo exigido em lei.',
      () => {
        void acao.executar(async () => {
          await solicitarExclusaoConta();
          await carregar();
        });
      },
    );
  }

  if (carregando && dados === null && !erro) return null;
  return (
    <CartaoFluxo>
      <Text style={tipo.secao}>Meus dados</Text>
      {erro || acao.erro ? <Aviso mensagem={acao.erro ?? erro ?? ''} /> : null}
      {dados ? (
        <Text style={tipo.corpo}>
          Você pediu a exclusão dos seus dados em {new Date(dados).toLocaleDateString('pt-BR')}. A
          gestão vai concluir o pedido e avisar você pelo contato cadastrado.
        </Text>
      ) : (
        <>
          <Text style={tipo.apoio}>
            Você pode pedir a qualquer momento que a instituição apague seus dados pessoais, como
            prevê a LGPD.
          </Text>
          <Botao
            titulo="Solicitar exclusão dos meus dados"
            variante="destrutivo"
            carregando={acao.ocupado}
            desabilitado={!!erro}
            onPress={pedir}
          />
        </>
      )}
    </CartaoFluxo>
  );
}
