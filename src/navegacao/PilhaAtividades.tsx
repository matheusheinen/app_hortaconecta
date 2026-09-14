import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TelaAtividades } from '../telas/TelaAtividades';
import { TelaFormAtividade } from '../telas/TelaFormAtividade';
import type { Atividade } from '../lib/tipos';

export type ParametrosPilhaAtividades = {
  lista: undefined;
  formulario: { atividade: Atividade | null };
};

const Pilha = createNativeStackNavigator<ParametrosPilhaAtividades>();

type Props = {
  ehGestao: boolean;
  nome: string;
  autorId: string;
  sair: () => void;
};

export function PilhaAtividades({ ehGestao, nome, autorId, sair }: Props) {
  return (
    <Pilha.Navigator screenOptions={{ headerShown: false }}>
      <Pilha.Screen name="lista">
        {({ navigation }) => (
          <TelaAtividades
            ehGestao={ehGestao}
            nome={nome}
            onNova={() => navigation.navigate('formulario', { atividade: null })}
            onEditar={(atividade) => navigation.navigate('formulario', { atividade })}
            onSair={sair}
          />
        )}
      </Pilha.Screen>
      <Pilha.Screen name="formulario">
        {({ navigation, route }) => (
          <TelaFormAtividade
            atividade={route.params.atividade}
            autorId={autorId}
            onPronto={() => navigation.goBack()}
            onCancelar={() => navigation.goBack()}
          />
        )}
      </Pilha.Screen>
    </Pilha.Navigator>
  );
}
