import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { PilhaAtividades } from './PilhaAtividades';
import { PilhaMateriais } from './PilhaMateriais';
import { PilhaInicio, type ParametrosInicio } from './PilhaInicio';
import { TelaPerfilOng } from '../telas/TelaPerfilOng';
import { TelaPerfilVoluntario } from '../telas/TelaPerfilVoluntario';
import { PilhaDiario } from './PilhaDiario';
import { cores } from '../lib/tema';
import type { Usuario } from '../lib/tipos';

export type ParametrosAbasPrincipais = {
  inicio: NavigatorScreenParams<ParametrosInicio> | undefined;
  atividades: undefined;
  diario: undefined;
  metas: undefined;
  perfil: undefined;
};

const Abas = createBottomTabNavigator<ParametrosAbasPrincipais>();

type Props = {
  perfil: Usuario;
  ehGestao: boolean;
  sair: () => void;
  recarregarPerfil: (propagarErro?: boolean) => Promise<void>;
};

/**
 * Abas fixas para os dois perfis — só a tela de Início, a de Perfil e o
 * texto das telas "em breve" mudam conforme ehGestao. Evita duplicar a
 * navegação inteira por tipo de perfil.
 */
export function AbasPrincipais({ perfil, ehGestao, sair, recarregarPerfil }: Props) {
  return (
    <Abas.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.folha,
        tabBarInactiveTintColor: cores.tintaSuave,
        tabBarStyle: { backgroundColor: cores.fundo, borderTopColor: cores.linha },
      }}
    >
      <Abas.Screen name="inicio" options={{ tabBarLabel: 'Início' }}>
        {({ navigation }) => <PilhaInicio gestao={ehGestao} usuarioId={perfil.id} nome={perfil.nome} sair={sair}
          atividades={() => navigation.navigate('atividades')} materiais={() => navigation.navigate('metas')}
          diario={() => navigation.navigate('diario')} perfil={() => navigation.navigate('perfil')} />}
      </Abas.Screen>

      <Abas.Screen name="atividades" options={{ tabBarLabel: 'Atividades' }}>
        {({ navigation }) => (
          <PilhaAtividades ehGestao={ehGestao} nome={perfil.nome} autorId={perfil.id} sair={sair} aoPerfil={() => navigation.navigate('perfil')} />
        )}
      </Abas.Screen>

      <Abas.Screen name="diario" options={{ tabBarLabel: 'Diário' }}>
        {({ navigation }) => <PilhaDiario gestao={ehGestao} inicio={() => navigation.navigate('inicio', { screen: 'resumo' })} />}
      </Abas.Screen>

      <Abas.Screen name="metas" options={{ tabBarLabel: ehGestao ? 'Materiais' : 'Contribuir' }}>
        {({ navigation }) => <PilhaMateriais ehGestao={ehGestao} inicio={() => navigation.navigate('inicio', { screen: 'resumo' })} />}
      </Abas.Screen>

      <Abas.Screen name="perfil" options={{ tabBarLabel: 'Perfil' }}>
        {() =>
          ehGestao ? (
            <TelaPerfilOng perfil={perfil} sair={sair} recarregarPerfil={recarregarPerfil} />
          ) : (
            <TelaPerfilVoluntario perfil={perfil} sair={sair} recarregarPerfil={recarregarPerfil} />
          )
        }
      </Abas.Screen>
    </Abas.Navigator>
  );
}
