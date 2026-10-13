import React, { useCallback } from 'react';
import { Alert, Text } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useAcao } from '@/compartilhado/hooks/useAcao';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { formatarDataCurta, hojeIso } from '@/compartilhado/utils/datas';
import { tipo } from '@/compartilhado/tema';
import type { Meta } from '../tipos';
import {
  alterarStatusMeta,
  carregarMeta,
  validarContribuicao,
  type ContribuicaoComDoador,
} from '../api';
import { descreverQuantidade, prazoVencido, recebendoContribuicoes } from '../regras';
import { EtiquetaMeta, ProgressoMeta } from '../componentes/IndicadoresMeta';
import { PainelGestaoMeta } from '../componentes/PainelGestaoMeta';
import { PainelVoluntarioMeta } from '../componentes/PainelVoluntarioMeta';

export function TelaDetalheMeta({
  id,
  ehGestao,
  usuarioId,
  voltar,
  editar,
  registrar,
  minhas,
  convidado = false,
  criarConta,
}: {
  id: number;
  ehGestao: boolean;
  usuarioId: string;
  voltar: () => void;
  editar: () => void;
  registrar: () => void;
  minhas: () => void;
  convidado?: boolean;
  criarConta?: () => void;
}) {
  const consulta = useCallback(() => carregarMeta(id), [id]);
  const { dados, erro, carregando, carregar } = useConsulta(consulta);
  const acao = useAcao();
  const meta = dados?.meta;
  const hoje = hojeIso();

  function mudarStatus(status: Meta['status'], titulo: string, texto: string) {
    Alert.alert(titulo, texto, [
      { text: 'Voltar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () => {
          void acao.executar(async () => {
            await alterarStatusMeta(id, status);
            await carregar();
          });
        },
      },
    ]);
  }
  function conferir(c: ContribuicaoComDoador, aprovada: boolean) {
    Alert.alert(
      aprovada ? 'Confirmar contribuição?' : 'Recusar contribuição?',
      aprovada
        ? `Confirme só depois de conferir o recebimento de ${descreverQuantidade(c.quantidade_oferecida, meta!)}. O valor passa a contar no total.`
        : 'A contribuição não entra no total. O voluntário verá a recusa.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: aprovada ? 'Confirmar' : 'Recusar',
          style: aprovada ? 'default' : 'destructive',
          onPress: () => {
            void acao.executar(async () => {
              await validarContribuicao(c.id, usuarioId, aprovada, null);
              await carregar();
            });
          },
        },
      ],
    );
  }

  return (
    <TelaFluxo
      titulo="Detalhes da meta"
      voltar={voltar}
      erro={acao.erro ?? erro}
      carregando={carregando && !dados}
      atualizar={carregar}
    >
      {meta ? (
        <>
          <CartaoFluxo>
            <EtiquetaMeta meta={meta} />
            <Text style={tipo.secao}>{meta.titulo}</Text>
            <Text style={tipo.corpo}>{meta.descricao}</Text>
            <ProgressoMeta meta={meta} />
            <Text style={tipo.apoio}>
              {meta.data_limite
                ? `Prazo: ${formatarDataCurta(meta.data_limite)}`
                : 'Sem prazo definido'}{' '}
              · só contam doações confirmadas pela gestão.
            </Text>
          </CartaoFluxo>
          {ehGestao ? (
            <PainelGestaoMeta
              meta={meta}
              contribuicoes={dados.contribuicoes}
              ocupado={acao.ocupado}
              editar={editar}
              registrar={registrar}
              conferir={conferir}
              mudarStatus={mudarStatus}
            />
          ) : convidado ? (
            <CartaoFluxo>
              <Text style={tipo.secao}>Você está como convidado</Text>
              <Text style={tipo.corpo}>Crie uma conta para contribuir com esta meta.</Text>
              {criarConta ? <Botao titulo="Criar conta ou entrar" onPress={criarConta} /> : null}
            </CartaoFluxo>
          ) : (
            <PainelVoluntarioMeta
              meta={meta}
              contribuicoes={dados.contribuicoes}
              recebendo={recebendoContribuicoes(meta, hoje)}
              vencido={prazoVencido(meta, hoje)}
              usuarioId={usuarioId}
              aoDeclarar={carregar}
              minhas={minhas}
            />
          )}
        </>
      ) : null}
    </TelaFluxo>
  );
}
