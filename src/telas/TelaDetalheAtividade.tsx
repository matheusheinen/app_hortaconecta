import React, { useCallback, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Botao } from '../componentes/Ui';
import { CartaoFluxo, TelaFluxoVoluntariado } from '../componentes/TelaFluxoVoluntariado';
import { tipo } from '../lib/tema';
import { rotuloStatus } from '../lib/tipos';
import { supabase } from '../lib/supabase';
import { carregarDetalhe, mensagemErro } from '../lib/voluntariado';
import { rotuloInscricao } from '../lib/voluntariado.types';
import { useDadosVoluntariado } from '../lib/useDadosVoluntariado';

type Props = {
  atividadeId: number;
  ehGestao: boolean;
  voltar: () => void;
  editar: () => void;
  candidatos: () => void;
  checkin: () => void;
  perfil: () => void;
};
export function TelaDetalheAtividade({
  atividadeId,
  ehGestao,
  voltar,
  editar,
  candidatos,
  checkin,
  perfil,
}: Props) {
  const consulta = useCallback(() => carregarDetalhe(atividadeId), [atividadeId]);
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(consulta);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function executar(acao: () => PromiseLike<{ error: unknown }>) {
    if (ocupado) return;
    setOcupado(true);
    setErroAcao(null);
    try {
      const resposta = await acao();
      if (resposta.error) throw resposta.error;
      await carregar();
    } catch (falha) {
      setErroAcao(mensagemErro(falha));
    } finally {
      setOcupado(false);
    }
  }
  const a = dados?.atividade;
  const i = dados?.inscricao;
  // Apenas conveniência visual; o servidor valida novamente todas as regras.
  const futura = !!a && new Date(a.data_hora_prevista).getTime() > Date.now();
  return (
    <TelaFluxoVoluntariado
      titulo="Detalhes da atividade"
      voltar={voltar}
      erro={erroAcao ?? erro}
      carregando={carregando}
      atualizar={carregar}
    >
      {a ? (
        <>
          <CartaoFluxo>
            <Text style={tipo.secao}>{a.titulo}</Text>
            <Text style={tipo.corpo}>{a.descricao}</Text>
            <Text style={tipo.corpo}>
              Data e horário: {new Date(a.data_hora_prevista).toLocaleString('pt-BR')}
            </Text>
            <Text style={tipo.corpo}>Local: {a.local || 'Não informado. Consulte a gestão.'}</Text>
            <Text style={tipo.corpo}>
              Vagas: {a.vagas_totais} · Aprovados: {dados.aprovados} · Disponíveis:{' '}
              {Math.max(0, a.vagas_totais - dados.aprovados)}
            </Text>
            <Text style={tipo.corpo}>Carga horária prevista: {a.carga_horaria}h</Text>
            <Text style={tipo.corpo}>
              Tipo: {a.tipo === 'TAREFA_ONG' ? 'Tarefa da instituição' : 'Oficina autoral'}
            </Text>
            <Text style={tipo.corpo}>Status: {rotuloStatus[a.status]}</Text>
          </CartaoFluxo>
          {ehGestao ? (
            <>
              <Botao
                titulo="Ver candidatos e participantes"
                onPress={candidatos}
                desabilitado={ocupado}
              />
              <Botao
                titulo="Editar atividade"
                variante="contorno"
                onPress={editar}
                desabilitado={ocupado}
              />
              {['ABERTA', 'ENCERRADA'].includes(a.status) ? (
                <>
                  <Botao
                    titulo="Exibir QR Code de check-in"
                    onPress={checkin}
                    desabilitado={ocupado}
                  />
                  {a.tipo === 'TAREFA_ONG' ? (
                    <>
                      {a.status === 'ABERTA' ? (
                        <Botao
                          titulo="Encerrar candidaturas"
                          variante="contorno"
                          carregando={ocupado}
                          onPress={() =>
                            executar(() =>
                              supabase.rpc('voluntariado_status_atividade', {
                                p_atividade: atividadeId,
                                p_status: 'ENCERRADA',
                              }),
                            )
                          }
                        />
                      ) : null}
                      <Botao
                        titulo="Marcar como realizada"
                        variante="contorno"
                        desabilitado={ocupado}
                        onPress={() =>
                          executar(() =>
                            supabase.rpc('voluntariado_status_atividade', {
                              p_atividade: atividadeId,
                              p_status: 'REALIZADA',
                            }),
                          )
                        }
                      />
                      <Botao
                        titulo="Cancelar atividade"
                        variante="destrutivo"
                        desabilitado={ocupado}
                        onPress={() =>
                          Alert.alert(
                            'Cancelar atividade',
                            'As candidaturas e presenças serão preservadas no histórico.',
                            [
                              { text: 'Manter', style: 'cancel' },
                              {
                                text: 'Cancelar atividade',
                                style: 'destructive',
                                onPress: () =>
                                  executar(() =>
                                    supabase.rpc('voluntariado_status_atividade', {
                                      p_atividade: atividadeId,
                                      p_status: 'CANCELADA',
                                    }),
                                  ),
                              },
                            ],
                          )
                        }
                      />
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <>
              {i ? (
                <CartaoFluxo>
                  <Text style={tipo.secao}>
                    Sua candidatura: {rotuloInscricao[i.status_inscricao]}
                  </Text>
                  {i.motivo_decisao ? (
                    <Text style={tipo.corpo}>Observação da gestão: {i.motivo_decisao}</Text>
                  ) : null}
                  <Text style={tipo.corpo}>
                    {i.presenca_confirmada
                      ? `Presença confirmada${i.checkin_em ? ` em ${new Date(i.checkin_em).toLocaleString('pt-BR')}` : ''}.`
                      : 'Presença ainda não confirmada.'}
                  </Text>
                  {i.status_inscricao === 'APROVADA' &&
                  !i.presenca_confirmada &&
                  ['ABERTA', 'ENCERRADA'].includes(a.status) ? (
                    <>
                      <Text style={tipo.apoio}>
                        No local, escaneie o QR Code exibido pela gestão. Disponível de 30 minutos
                        antes do início até o fim previsto.
                      </Text>
                      <Botao titulo="Fazer check-in" onPress={checkin} desabilitado={ocupado} />
                    </>
                  ) : null}
                  {['PENDENTE', 'APROVADA'].includes(i.status_inscricao) &&
                  !i.presenca_confirmada &&
                  futura &&
                  ['ABERTA', 'ENCERRADA'].includes(a.status) ? (
                    <Botao
                      titulo="Cancelar minha candidatura"
                      variante="destrutivo"
                      carregando={ocupado}
                      onPress={() =>
                        Alert.alert(
                          'Cancelar candidatura',
                          'O cancelamento é definitivo nesta etapa.',
                          [
                            { text: 'Manter', style: 'cancel' },
                            {
                              text: 'Cancelar candidatura',
                              style: 'destructive',
                              onPress: () =>
                                executar(() =>
                                  supabase.rpc('voluntariado_cancelar', { p_inscricao: i.id }),
                                ),
                            },
                          ],
                        )
                      }
                    />
                  ) : null}
                </CartaoFluxo>
              ) : (
                <>
                  {!dados.elegivel ? (
                    <>
                      <Text style={tipo.apoio}>
                        Complete seu perfil, habilidades e disponibilidade antes de se candidatar.
                      </Text>
                      <Botao titulo="Completar perfil" onPress={perfil} />
                    </>
                  ) : null}
                  <Botao
                    titulo="Quero me candidatar"
                    carregando={ocupado}
                    desabilitado={!dados.elegivel || !futura || a.status !== 'ABERTA'}
                    onPress={() =>
                      executar(() =>
                        supabase.rpc('voluntariado_candidatar', { p_atividade: atividadeId }),
                      )
                    }
                  />
                  <Text style={tipo.apoio}>
                    A candidatura depende da análise da gestão. O envio não reserva uma vaga.
                  </Text>
                </>
              )}
            </>
          )}
        </>
      ) : null}
    </TelaFluxoVoluntariado>
  );
}
