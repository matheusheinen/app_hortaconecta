import React, { useCallback, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { tipo } from '@/compartilhado/tema';
import { rotuloInscricao, rotuloStatusAtividade } from '../tipos';
import { alterarStatusAtividade, cancelarCandidatura, candidatar, carregarDetalhe } from '../api';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { useConfiguracaoInstituicao } from '@/compartilhado/hooks/useConfiguracaoInstituicao';
import { abrirWhatsApp } from '@/compartilhado/utils/whatsapp';
import { mascararTelefone } from '@/compartilhado/utils/mascaras';

type Props = {
  atividadeId: number;
  ehGestao: boolean;
  voltar: () => void;
  editar: () => void;
  candidatos: () => void;
  checkin: () => void;
  perfil: () => void;
  convidado?: boolean;
  criarConta?: () => void;
};
export function TelaDetalheAtividade({
  atividadeId,
  ehGestao,
  voltar,
  editar,
  candidatos,
  checkin,
  perfil,
  convidado = false,
  criarConta,
}: Props) {
  const consulta = useCallback(() => carregarDetalhe(atividadeId), [atividadeId]);
  const { dados, erro, carregando, carregar } = useConsulta(consulta);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  async function executar(acao: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true);
    setErroAcao(null);
    try {
      await acao();
      await carregar();
    } catch (falha) {
      setErroAcao(mensagemErro(falha));
    } finally {
      setOcupado(false);
    }
  }
  const { configuracao } = useConfiguracaoInstituicao();
  const whatsapp = configuracao?.whatsapp ?? null;
  async function falarComGestao(titulo: string, quando: string) {
    if (!whatsapp) return;
    const mensagem = `Olá! Tenho uma dúvida sobre a atividade "${titulo}" (${new Date(quando).toLocaleString('pt-BR')}).`;
    if (!(await abrirWhatsApp(whatsapp, mensagem))) {
      Alert.alert(
        'Não foi possível abrir o WhatsApp',
        `Fale com a gestão pelo número ${mascararTelefone(whatsapp)}.`,
      );
    }
  }
  const a = dados?.atividade;
  const i = dados?.inscricao;
  // Apenas conveniência visual; o servidor valida novamente todas as regras.
  const futura = !!a && new Date(a.data_hora_prevista).getTime() > Date.now();
  return (
    <TelaFluxo
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
            <Text style={tipo.corpo}>Status: {rotuloStatusAtividade[a.status]}</Text>
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
                            executar(() => alterarStatusAtividade(atividadeId, 'ENCERRADA'))
                          }
                        />
                      ) : null}
                      <Botao
                        titulo="Marcar como realizada"
                        variante="contorno"
                        desabilitado={ocupado}
                        onPress={() =>
                          executar(() => alterarStatusAtividade(atividadeId, 'REALIZADA'))
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
                                  executar(() => alterarStatusAtividade(atividadeId, 'CANCELADA')),
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
          ) : convidado ? (
            <>
              <CartaoFluxo>
                <Text style={tipo.secao}>Você está como convidado</Text>
                <Text style={tipo.corpo}>Crie uma conta para se candidatar a esta atividade.</Text>
                {criarConta ? <Botao titulo="Criar conta ou entrar" onPress={criarConta} /> : null}
              </CartaoFluxo>
              {whatsapp ? (
                <Botao
                  titulo="Falar com a gestão no WhatsApp"
                  variante="contorno"
                  onPress={() => {
                    void falarComGestao(a.titulo, a.data_hora_prevista);
                  }}
                />
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
                              onPress: () => executar(() => cancelarCandidatura(i.id)),
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
                    onPress={() => executar(() => candidatar(atividadeId))}
                  />
                  <Text style={tipo.apoio}>
                    A candidatura depende da análise da gestão. O envio não reserva uma vaga.
                  </Text>
                </>
              )}
              {whatsapp ? (
                <Botao
                  titulo="Falar com a gestão no WhatsApp"
                  variante="contorno"
                  onPress={() => {
                    void falarComGestao(a.titulo, a.data_hora_prevista);
                  }}
                />
              ) : null}
            </>
          )}
        </>
      ) : null}
    </TelaFluxo>
  );
}
