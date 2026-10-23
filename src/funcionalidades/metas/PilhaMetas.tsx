import React from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TelaMetas } from './telas/TelaMetas';
import { TelaDetalheMeta } from './telas/TelaDetalheMeta';
import { TelaFormMeta } from './telas/TelaFormMeta';
import { TelaRegistrarRecebimento } from './telas/TelaRegistrarRecebimento';
import { TelaFilaConferencia } from './telas/TelaFilaConferencia';
import { TelaMinhasContribuicoesMetas } from './telas/TelaMinhasContribuicoes';

export type ParametrosMetas = {
  lista: undefined;
  detalhe: { id: number };
  formulario: { id: number | null };
  registrar: { id: number };
  minhas: undefined;
  fila: undefined;
};
const Pilha = createNativeStackNavigator<ParametrosMetas>();

/** Metas em dinheiro (PIX) ou de materiais, com contribuições conferidas pela gestão. */
export function PilhaMetas({ inicio }: { inicio: () => void }) {
  const { ehGestao } = useSessaoAtual();
  return (
    <Pilha.Navigator screenOptions={{ headerShown: false }}>
      <Pilha.Screen name="lista">
        {({ navigation }) => (
          <TelaMetas
            voltar={inicio}
            abrir={id => navigation.navigate('detalhe', { id })}
            criar={() => navigation.navigate('formulario', { id: null })}
            minhas={() => navigation.navigate('minhas')}
            fila={() => navigation.navigate('fila')}
          />
        )}
      </Pilha.Screen>
      <Pilha.Screen name="detalhe">
        {({ navigation, route }) => (
          <TelaDetalheMeta
            key={route.params.id}
            id={route.params.id}
            voltar={() => navigation.goBack()}
            editar={() => navigation.navigate('formulario', route.params)}
            registrar={() => navigation.navigate('registrar', route.params)}
            minhas={() => navigation.navigate('minhas')}
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
          <Pilha.Screen name="fila">
            {({ navigation }) => (
              <TelaFilaConferencia
                voltar={() => navigation.goBack()}
                abrirMeta={id => navigation.navigate('detalhe', { id })}
              />
            )}
          </Pilha.Screen>
          <Pilha.Screen name="registrar">
            {({ navigation, route }) => (
              <TelaRegistrarRecebimento id={route.params.id} voltar={() => navigation.goBack()} />
            )}
          </Pilha.Screen>
        </>
      ) : (
        <Pilha.Screen name="minhas">
          {({ navigation }) => (
            <TelaMinhasContribuicoesMetas
              voltar={() => navigation.goBack()}
              abrir={id => navigation.navigate('detalhe', { id })}
            />
          )}
        </Pilha.Screen>
      )}
    </Pilha.Navigator>
  );
}
