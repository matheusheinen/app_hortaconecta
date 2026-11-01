import React, { useCallback } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { Text } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useAcao } from '@/compartilhado/hooks/useAcao';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { confirmarAcao } from '@/compartilhado/utils/confirmar';
import { formatarDataCurta, hojeIso } from '@/compartilhado/utils/datas';
import { tipo } from '@/compartilhado/tema';
import type { Meta } from '../tipos';
import { alterarStatusMeta, carregarMeta } from '../api';
import { prazoVencido, recebendoContribuicoes } from '../regras';
import { useConferencia } from '../useConferencia';
import { EtiquetaMeta, ProgressoMeta } from '../componentes/IndicadoresMeta';
import { PainelGestaoMeta } from '../componentes/PainelGestaoMeta';
import { PainelVoluntarioMeta } from '../componentes/PainelVoluntarioMeta';

export function TelaDetalheMeta({
  id,
  voltar,
  editar,
  registrar,
  minhas,
}: {
  id: number;
  voltar: () => void;
  editar: () => void;
  registrar: () => void;
  minhas: () => void;
}) {
  const { ehGestao, usuarioId, convidado, sair: criarConta } = useSessaoAtual();
  const consulta = useCallback(() => carregarMeta(id), [id]);
  const { dados, erro, carregando, carregar } = useConsulta(consulta);
  const acao = useAcao();
  const meta = dados?.meta;
  const hoje = hojeIso();

  function mudarStatus(status: Meta['status'], titulo: string, texto: string) {
    confirmarAcao(titulo, texto, 'Confirmar', () => {
      void acao.executar(async () => {
        await alterarStatusMeta(id, status);
        await carregar();
      });
    });
  }
  const conferirContribuicao = useConferencia(acao, usuarioId, carregar);

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
              conferir={(c, aprovada, observacao) =>
                conferirContribuicao(c, meta, aprovada, observacao)
              }
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
              aoDeclarar={carregar}
              minhas={minhas}
            />
          )}
        </>
      ) : null}
    </TelaFluxo>
  );
}
