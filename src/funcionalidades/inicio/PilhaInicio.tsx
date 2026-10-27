import React from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TelaInicioOng } from './telas/TelaInicioOng';
import { TelaInicioVoluntario } from './telas/TelaInicioVoluntario';
import {
  TelaOficinas,
  TelaDetalheOficina,
  TelaFormOficina,
} from '@/funcionalidades/oficinas/telas/TelasOficinas';
import {
  TelaCertificados,
  TelaCertificado,
} from '@/funcionalidades/certificados/telas/TelasCertificados';
import { TelaNotificacoes } from '@/funcionalidades/notificacoes/telas/TelaNotificacoes';
import { recursosPosMvp } from '@/compartilhado/escopoMvp';
export type ParametrosInicio = {
  resumo: undefined;
  notificacoes: undefined;
  certificados: undefined;
  certificado: { id: string };
  oficinas: undefined;
  oficina: { id: number };
  propor: { id: number | null };
};
const Pilha = createNativeStackNavigator<ParametrosInicio>();
export function PilhaInicio({
  atividades,
  materiais,
  diario,
  perfil,
  abrirAtividade,
  abrirMeta,
  abrirPublicacao,
  minhasAtividades,
  minhasContribuicoes,
}: {
  atividades: () => void;
  materiais: () => void;
  diario: () => void;
  perfil: () => void;
  abrirAtividade: (id: number) => void;
  abrirMeta: (id: number) => void;
  abrirPublicacao: (id: number) => void;
  minhasAtividades: () => void;
  minhasContribuicoes: () => void;
}) {
  const { ehGestao: gestao } = useSessaoAtual();
  return (
    <Pilha.Navigator screenOptions={{ headerShown: false }}>
      <Pilha.Screen name="resumo">
        {({ navigation }) => {
          const acoes = {
            aoIrParaAtividades: atividades,
            aoIrParaMetas: materiais,
            aoIrParaDiario: diario,
            aoNotificacoes: () => navigation.navigate('notificacoes'),
            aoIrParaCertificados: recursosPosMvp.certificados
              ? () => navigation.navigate('certificados')
              : undefined,
            aoIrParaOficinas: recursosPosMvp.oficinas
              ? () => navigation.navigate('oficinas')
              : undefined,
          };
          return gestao ? (
            <TelaInicioOng {...acoes} />
          ) : (
            <TelaInicioVoluntario
              {...acoes}
              aoPerfil={perfil}
              abrirAtividade={abrirAtividade}
              abrirMeta={abrirMeta}
              abrirPublicacao={abrirPublicacao}
              minhasAtividades={minhasAtividades}
              minhasContribuicoes={minhasContribuicoes}
            />
          );
        }}
      </Pilha.Screen>
      <Pilha.Screen name="notificacoes">
        {({ navigation }) => (
          <TelaNotificacoes
            voltar={() => navigation.goBack()}
            abrirAtividade={abrirAtividade}
            abrirMeta={abrirMeta}
          />
        )}
      </Pilha.Screen>
      {recursosPosMvp.oficinas ? (
        <>
          <Pilha.Screen name="oficinas">
            {({ navigation }) => (
              <TelaOficinas
                voltar={() => navigation.goBack()}
                criar={() => navigation.navigate('propor', { id: null })}
                abrir={id => navigation.navigate('oficina', { id })}
              />
            )}
          </Pilha.Screen>
          <Pilha.Screen name="oficina">
            {({ navigation, route }) => (
              <TelaDetalheOficina
                key={route.params.id}
                id={route.params.id}
                voltar={() => navigation.goBack()}
                editar={() => navigation.navigate('propor', route.params)}
              />
            )}
          </Pilha.Screen>
          {!gestao ? (
            <Pilha.Screen name="propor">
              {({ navigation, route }) => (
                <TelaFormOficina
                  id={route.params.id}
                  voltar={() => navigation.goBack()}
                  pronto={id => navigation.popTo('oficina', { id })}
                  perfil={perfil}
                />
              )}
            </Pilha.Screen>
          ) : null}
        </>
      ) : null}
      {recursosPosMvp.certificados ? (
        <>
          <Pilha.Screen name="certificados">
            {({ navigation }) => (
              <TelaCertificados
                voltar={() => navigation.goBack()}
                abrir={id => navigation.navigate('certificado', { id })}
              />
            )}
          </Pilha.Screen>
          <Pilha.Screen name="certificado">
            {({ navigation, route }) => (
              <TelaCertificado
                key={route.params.id}
                id={route.params.id}
                voltar={() => navigation.goBack()}
              />
            )}
          </Pilha.Screen>
        </>
      ) : null}
    </Pilha.Navigator>
  );
}
