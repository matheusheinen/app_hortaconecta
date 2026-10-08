import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TelaDiario } from './telas/TelaDiario';
import { TelaDetalheDiario } from './telas/TelaDetalheDiario';
import { TelaFormDiario } from './telas/TelaFormDiario';
type Rotas = { lista: undefined; detalhe: { id: number }; formulario: { id: number | null } };
const Pilha = createNativeStackNavigator<Rotas>();
export function PilhaDiario({ gestao, inicio }: { gestao: boolean; inicio: () => void }) {
  return (
    <Pilha.Navigator screenOptions={{ headerShown: false }}>
      <Pilha.Screen name="lista">
        {({ navigation }) => (
          <TelaDiario
            gestao={gestao}
            voltar={inicio}
            abrir={id => navigation.navigate('detalhe', { id })}
            criar={() => navigation.navigate('formulario', { id: null })}
          />
        )}
      </Pilha.Screen>
      <Pilha.Screen name="detalhe">
        {({ navigation, route }) => (
          <TelaDetalheDiario
            key={route.params.id}
            id={route.params.id}
            gestao={gestao}
            voltar={() => navigation.goBack()}
            editar={() => navigation.navigate('formulario', route.params)}
          />
        )}
      </Pilha.Screen>
      {gestao ? (
        <Pilha.Screen name="formulario">
          {({ navigation, route }) => (
            <TelaFormDiario id={route.params.id} voltar={() => navigation.goBack()} />
          )}
        </Pilha.Screen>
      ) : null}
    </Pilha.Navigator>
  );
}
