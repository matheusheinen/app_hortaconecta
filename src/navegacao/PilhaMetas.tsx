import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  TelaDetalheMeta,
  TelaFormMeta,
  TelaMetas,
  TelaMinhasContribuicoesMetas,
  TelaRegistrarRecebimento,
} from '../telas/TelasMetas';

export type ParametrosMetas = {
  lista: undefined;
  detalhe: { id: number };
  formulario: { id: number | null };
  registrar: { id: number };
  minhas: undefined;
};
const Pilha = createNativeStackNavigator<ParametrosMetas>();

/** Metas em dinheiro (PIX) ou de materiais, com contribuições conferidas pela gestão. */
export function PilhaMetas({
  ehGestao,
  usuarioId,
  inicio,
  convidado = false,
  aoCriarConta,
}: {
  ehGestao: boolean;
  usuarioId: string;
  inicio: () => void;
  convidado?: boolean;
  aoCriarConta?: () => void;
}) {
  return (
    <Pilha.Navigator screenOptions={{ headerShown: false }}>
      <Pilha.Screen name="lista">
        {({ navigation }) => (
          <TelaMetas
            ehGestao={ehGestao}
            voltar={inicio}
            abrir={id => navigation.navigate('detalhe', { id })}
            criar={() => navigation.navigate('formulario', { id: null })}
            minhas={() => navigation.navigate('minhas')}
            convidado={convidado}
          />
        )}
      </Pilha.Screen>
      <Pilha.Screen name="detalhe">
        {({ navigation, route }) => (
          <TelaDetalheMeta
            key={route.params.id}
            id={route.params.id}
            ehGestao={ehGestao}
            usuarioId={usuarioId}
            voltar={() => navigation.goBack()}
            editar={() => navigation.navigate('formulario', route.params)}
            registrar={() => navigation.navigate('registrar', route.params)}
            minhas={() => navigation.navigate('minhas')}
            convidado={convidado}
            criarConta={aoCriarConta}
          />
        )}
      </Pilha.Screen>
      {ehGestao ? (
        <>
          <Pilha.Screen name="formulario">
            {({ navigation, route }) => (
              <TelaFormMeta id={route.params.id} voltar={() => navigation.goBack()} />
            )}
          </Pilha.Screen>
          <Pilha.Screen name="registrar">
            {({ navigation, route }) => (
              <TelaRegistrarRecebimento
                id={route.params.id}
                gestaoId={usuarioId}
                voltar={() => navigation.goBack()}
              />
            )}
          </Pilha.Screen>
        </>
      ) : (
        <Pilha.Screen name="minhas">
          {({ navigation }) => (
            <TelaMinhasContribuicoesMetas
              usuarioId={usuarioId}
              voltar={() => navigation.goBack()}
              abrir={id => navigation.navigate('detalhe', { id })}
            />
          )}
        </Pilha.Screen>
      )}
    </Pilha.Navigator>
  );
}
