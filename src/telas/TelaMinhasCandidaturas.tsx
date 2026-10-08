import React from 'react';
import { Text } from 'react-native';
import { Botao } from '../componentes/Ui';
import { CartaoFluxo, TelaFluxoVoluntariado } from '../componentes/TelaFluxoVoluntariado';
import { tipo } from '../lib/tema';
import { rotuloStatus } from '../lib/tipos';
import { carregarMinhasInscricoes } from '../lib/voluntariado';
import { rotuloInscricao } from '../lib/voluntariado.types';
import { useDadosVoluntariado } from '../lib/useDadosVoluntariado';

export function TelaMinhasCandidaturas({
  voltar,
  abrir,
  historico = false,
}: {
  voltar: () => void;
  abrir: (id: number) => void;
  historico?: boolean;
}) {
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(carregarMinhasInscricoes);
  const itens = (dados ?? []).filter(item => !historico || item.inscricao.presenca_confirmada);
  return (
    <TelaFluxoVoluntariado
      titulo={historico ? 'Histórico de participação' : 'Minhas candidaturas'}
      voltar={voltar}
      erro={erro}
      carregando={carregando}
      atualizar={carregar}
    >
      {historico ? (
        <Text style={tipo.apoio}>
          A carga horária abaixo é a prevista na atividade, registrada no check-in. Não mede horas
          efetivamente realizadas.
        </Text>
      ) : null}
      {!itens.length ? (
        <Text style={tipo.apoio}>
          {historico
            ? 'Você ainda não tem presenças confirmadas.'
            : 'Você ainda não tem candidaturas.'}
        </Text>
      ) : null}
      {itens.map(({ atividade: a, inscricao: i }) => (
        <CartaoFluxo key={i.id}>
          <Text style={tipo.secao}>{a.titulo}</Text>
          <Text style={tipo.corpo}>{new Date(a.data_hora_prevista).toLocaleString('pt-BR')}</Text>
          <Text style={tipo.corpo}>Candidatura: {rotuloInscricao[i.status_inscricao]}</Text>
          <Text style={tipo.corpo}>Atividade: {rotuloStatus[a.status]}</Text>
          <Text style={tipo.corpo}>
            Presença: {i.presenca_confirmada ? 'Confirmada' : 'Não confirmada'}
          </Text>
          {i.checkin_em ? (
            <Text style={tipo.apoio}>
              Check-in: {new Date(i.checkin_em).toLocaleString('pt-BR')}
            </Text>
          ) : null}
          <Text style={tipo.corpo}>
            Carga horária prevista: {i.carga_horaria_registrada ?? a.carga_horaria}h
            {i.presenca_confirmada && i.carga_horaria_registrada === null
              ? ' (valor atual; registro antigo sem carga no check-in)'
              : ''}
          </Text>
          <Botao titulo="Ver atividade" variante="contorno" onPress={() => abrir(a.id)} />
        </CartaoFluxo>
      ))}
    </TelaFluxoVoluntariado>
  );
}
