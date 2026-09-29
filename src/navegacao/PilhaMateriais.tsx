import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TelaMateriais, TelaDetalheMaterial, TelaFormMaterial, TelaMinhasContribuicoes } from '../telas/TelasMateriais';

export type ParametrosMateriais = {
  lista: undefined; detalhe: { id: number }; formulario: { id: number | null }; minhas: undefined;
};
const Pilha = createNativeStackNavigator<ParametrosMateriais>();
export function PilhaMateriais({ ehGestao, inicio }: { ehGestao: boolean; inicio: () => void }) {
  return <Pilha.Navigator screenOptions={{ headerShown: false }}>
    <Pilha.Screen name="lista">{({ navigation }) => <TelaMateriais ehGestao={ehGestao} voltar={inicio}
      abrir={id => navigation.navigate('detalhe', { id })} criar={() => navigation.navigate('formulario', { id: null })}
      minhas={() => navigation.navigate('minhas')} />}</Pilha.Screen>
    <Pilha.Screen name="detalhe">{({ navigation, route }) => <TelaDetalheMaterial key={route.params.id} id={route.params.id}
      ehGestao={ehGestao} voltar={() => navigation.goBack()} editar={() => navigation.navigate('formulario', route.params)}
      minhas={() => navigation.navigate('minhas')} />}</Pilha.Screen>
    {ehGestao ? <Pilha.Screen name="formulario">{({ navigation, route }) => <TelaFormMaterial id={route.params.id}
      voltar={() => navigation.goBack()} />}</Pilha.Screen> :
      <Pilha.Screen name="minhas">{({ navigation }) => <TelaMinhasContribuicoes voltar={() => navigation.goBack()}
        abrir={id => navigation.navigate('detalhe', { id })} />}</Pilha.Screen>}
  </Pilha.Navigator>;
}
