import React, { useCallback } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TelaAtividades } from './telas/TelaAtividades';
import { TelaFormAtividade } from './telas/TelaFormAtividade';
import { TelaDetalheAtividade } from './telas/TelaDetalheAtividade';
import { TelaMinhasCandidaturas } from './telas/TelaMinhasCandidaturas';
import { TelaCandidatosAtividade } from './telas/TelaCandidatosAtividade';
import { TelaCheckin, TelaQrAtividade } from './telas/TelaCheckin';
import { TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { carregarDetalhe } from './api';

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
  inicio: () => void;
  aoPerfil: () => void;
};

export function PilhaAtividades({ inicio, aoPerfil }: Props) {
  const { ehGestao } = useSessaoAtual();
  return (
    <Pilha.Navigator screenOptions={{ headerShown: false }}>
      <Pilha.Screen name="lista">
        {({ navigation }) => (
          <TelaAtividades
            voltar={inicio}
            onNova={() => navigation.navigate('formulario', { atividadeId: null })}
            onEditar={atividade => navigation.navigate('formulario', { atividadeId: atividade.id })}
            onDetalhe={atividadeId => navigation.navigate('detalhe', { atividadeId })}
            onMinhas={() => navigation.navigate('minhas')}
            onHistorico={() => navigation.navigate('historico')}
          />
        )}
      </Pilha.Screen>
      <Pilha.Screen name="detalhe">
        {({ navigation, route }) => (
          <TelaDetalheAtividade
            atividadeId={route.params.atividadeId}
            voltar={() => navigation.goBack()}
            editar={() =>
              navigation.navigate('formulario', { atividadeId: route.params.atividadeId })
            }
            candidatos={() => navigation.navigate('candidatos', route.params)}
            checkin={() => navigation.navigate('checkin', route.params)}
            perfil={aoPerfil}
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
                  onPronto={() => navigation.goBack()}
                  onCancelar={() => navigation.goBack()}
                />
              ) : (
                <EditarAtividade
                  atividadeId={route.params.atividadeId}
                  voltar={() => navigation.goBack()}
                />
              )
            }
          </Pilha.Screen>
          <Pilha.Screen name="candidatos">
            {({ navigation, route }) => (
              <TelaCandidatosAtividade
                atividadeId={route.params.atividadeId}
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

function EditarAtividade({ atividadeId, voltar }: { atividadeId: number; voltar: () => void }) {
  const consulta = useCallback(() => carregarDetalhe(atividadeId), [atividadeId]);
  const { dados, erro, carregando, carregar } = useConsulta(consulta);
  if (carregando || !dados)
    return (
      <TelaFluxo
        titulo="Editar atividade"
        voltar={voltar}
        erro={erro}
        carregando={carregando}
        atualizar={carregar}
      >
        {null}
      </TelaFluxo>
    );
  return <TelaFormAtividade atividade={dados.atividade} onPronto={voltar} onCancelar={voltar} />;
}
