import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TelaMetas } from '../telas/TelaMetas';
import { TelaFormMeta } from '../telas/TelaFormMeta';
import type { Meta } from '../lib/tipos';

export type ParametrosPilhaMetas = {
  lista: undefined;
  formulario: { meta: Meta | null };
};

const Pilha = createNativeStackNavigator<ParametrosPilhaMetas>();

type Props = {
  ehGestao: boolean;
  nome: string;
  sair: () => void;
};

export function PilhaMetas({ ehGestao, nome, sair }: Props) {
  return (
    <Pilha.Navigator screenOptions={{ headerShown: false }}>
      <Pilha.Screen name="lista">
        {({ navigation }) => (
          <TelaMetas
            ehGestao={ehGestao}
            nome={nome}
            onNova={() => navigation.navigate('formulario', { meta: null })}
            onEditar={(meta) => navigation.navigate('formulario', { meta })}
            onSair={sair}
          />
        )}
      </Pilha.Screen>
      <Pilha.Screen name="formulario">
        {({ navigation, route }) => (
          <TelaFormMeta
            meta={route.params.meta}
            onPronto={() => navigation.goBack()}
            onCancelar={() => navigation.goBack()}
          />
        )}
      </Pilha.Screen>
    </Pilha.Navigator>
  );
}
