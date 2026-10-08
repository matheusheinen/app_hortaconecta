import React, { useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TelaAtividades } from '../telas/TelaAtividades';
import { TelaFormAtividade } from '../telas/TelaFormAtividade';
import { TelaDetalheAtividade } from '../telas/TelaDetalheAtividade';
import { TelaMinhasCandidaturas } from '../telas/TelaMinhasCandidaturas';
import { TelaCandidatosAtividade } from '../telas/TelaCandidatosAtividade';
import { TelaCheckin, TelaQrAtividade } from '../telas/TelaCheckin';
import { TelaFluxoVoluntariado } from '../componentes/TelaFluxoVoluntariado';
import { useDadosVoluntariado } from '../lib/useDadosVoluntariado';
import { carregarDetalhe } from '../lib/voluntariado';

export type ParametrosPilhaAtividades = {
  lista: undefined;
  formulario: { atividadeId: number | null };
  detalhe: { atividadeId: number };
  candidatos: { atividadeId: number };
  checkin: { atividadeId: number };
  minhas: undefined;
  historico: undefined;
};
const Pilha = createNativeStackNavigator<ParametrosPilhaAtividades>();
type Props = {
  ehGestao: boolean;
  autorId: string;
  inicio: () => void;
  aoPerfil: () => void;
  convidado?: boolean;
  aoCriarConta?: () => void;
};

export function PilhaAtividades({
  ehGestao,
  autorId,
  inicio,
  aoPerfil,
  convidado = false,
  aoCriarConta,
}: Props) {
  return (
    <Pilha.Navigator screenOptions={{ headerShown: false }}>
      <Pilha.Screen name="lista">
        {({ navigation }) => (
          <TelaAtividades
            ehGestao={ehGestao}
            voltar={inicio}
            onNova={() => navigation.navigate('formulario', { atividadeId: null })}
            onEditar={atividade => navigation.navigate('formulario', { atividadeId: atividade.id })}
            onDetalhe={atividadeId => navigation.navigate('detalhe', { atividadeId })}
            onMinhas={() => navigation.navigate('minhas')}
            onHistorico={() => navigation.navigate('historico')}
            convidado={convidado}
          />
        )}
      </Pilha.Screen>
      <Pilha.Screen name="detalhe">
        {({ navigation, route }) => (
          <TelaDetalheAtividade
            atividadeId={route.params.atividadeId}
            ehGestao={ehGestao}
            voltar={() => navigation.goBack()}
            editar={() =>
              navigation.navigate('formulario', { atividadeId: route.params.atividadeId })
            }
            candidatos={() => navigation.navigate('candidatos', route.params)}
            checkin={() => navigation.navigate('checkin', route.params)}
            perfil={aoPerfil}
            convidado={convidado}
            criarConta={aoCriarConta}
          />
        )}
      </Pilha.Screen>
      {ehGestao ? (
        <>
          <Pilha.Screen name="formulario">
            {({ navigation, route }) =>
              route.params.atividadeId === null ? (
                <TelaFormAtividade
                  atividade={null}
                  autorId={autorId}
                  onPronto={() => navigation.goBack()}
                  onCancelar={() => navigation.goBack()}
                />
              ) : (
                <EditarAtividade
                  atividadeId={route.params.atividadeId}
                  autorId={autorId}
                  voltar={() => navigation.goBack()}
                />
              )
            }
          </Pilha.Screen>
          <Pilha.Screen name="candidatos">
            {({ navigation, route }) => (
              <TelaCandidatosAtividade
                atividadeId={route.params.atividadeId}
                usuarioId={autorId}
                voltar={() => navigation.goBack()}
              />
            )}
          </Pilha.Screen>
        </>
      ) : (
        <>
          <Pilha.Screen name="minhas">
            {({ navigation }) => (
              <TelaMinhasCandidaturas
                voltar={() => navigation.goBack()}
                abrir={atividadeId => navigation.navigate('detalhe', { atividadeId })}
              />
            )}
          </Pilha.Screen>
          <Pilha.Screen name="historico">
            {({ navigation }) => (
              <TelaMinhasCandidaturas
                historico
                voltar={() => navigation.goBack()}
                abrir={atividadeId => navigation.navigate('detalhe', { atividadeId })}
              />
            )}
          </Pilha.Screen>
        </>
      )}
      <Pilha.Screen name="checkin">
        {({ navigation, route }) =>
          ehGestao ? (
            <TelaQrAtividade
              atividadeId={route.params.atividadeId}
              voltar={() => navigation.goBack()}
            />
          ) : (
            <TelaCheckin
              atividadeId={route.params.atividadeId}
              voltar={() => navigation.goBack()}
            />
          )
        }
      </Pilha.Screen>
    </Pilha.Navigator>
  );
}

function EditarAtividade({
  atividadeId,
  autorId,
  voltar,
}: {
  atividadeId: number;
  autorId: string;
  voltar: () => void;
}) {
  const consulta = useCallback(() => carregarDetalhe(atividadeId), [atividadeId]);
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(consulta);
  if (carregando || !dados)
    return (
      <TelaFluxoVoluntariado
        titulo="Editar atividade"
        voltar={voltar}
        erro={erro}
        carregando={carregando}
        atualizar={carregar}
      >
        {null}
      </TelaFluxoVoluntariado>
    );
  return (
    <TelaFormAtividade
      atividade={dados.atividade}
      autorId={autorId}
      onPronto={voltar}
      onCancelar={voltar}
    />
  );
}
