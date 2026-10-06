import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { PilhaAtividades, type ParametrosPilhaAtividades } from './PilhaAtividades';
import { PilhaMetas, type ParametrosMetas } from './PilhaMetas';
import { opcoesAbasPrincipais } from './AbasPrincipais';
import { TelaInicioConvidado, TelaPerfilConvidado } from '../telas/TelasConvidado';

type ParametrosAbasConvidado = {
  inicio: undefined;
  atividades: NavigatorScreenParams<ParametrosPilhaAtividades> | undefined;
  metas: NavigatorScreenParams<ParametrosMetas> | undefined;
  perfil: undefined;
};

const Abas = createBottomTabNavigator<ParametrosAbasConvidado>();

/**
 * Convidado só lê. Sem Diário, Certificados, Oficinas e check-in; o banco também
 * bloqueia a escrita (claim is_anonymous), então a tela só evita botões inúteis.
 * "Criar conta ou entrar" encerra a sessão anônima e volta ao login.
 */
export function AbasConvidado({ usuarioId, sair }: { usuarioId: string; sair: () => void }) {
  return (
    <Abas.Navigator screenOptions={({ route }) => opcoesAbasPrincipais(route.name)}>
      <Abas.Screen name="inicio" options={{ tabBarLabel: 'Início' }}>
        {({ navigation }) => (
          <TelaInicioConvidado
            criarConta={sair}
            atividades={() => navigation.navigate('atividades', { screen: 'lista' })}
            metas={() => navigation.navigate('metas', { screen: 'lista' })}
          />
        )}
      </Abas.Screen>
      <Abas.Screen name="atividades" options={{ tabBarLabel: 'Voluntariado' }}>
        {({ navigation }) => (
          <PilhaAtividades
            ehGestao={false}
            autorId={usuarioId}
            inicio={() => navigation.navigate('inicio')}
            aoPerfil={() => navigation.navigate('perfil')}
            convidado
            aoCriarConta={sair}
          />
        )}
      </Abas.Screen>
      <Abas.Screen name="metas" options={{ tabBarLabel: 'Contribuir' }}>
        {({ navigation }) => (
          <PilhaMetas
            ehGestao={false}
            usuarioId={usuarioId}
            inicio={() => navigation.navigate('inicio')}
            convidado
            aoCriarConta={sair}
          />
        )}
      </Abas.Screen>
      <Abas.Screen name="perfil" options={{ tabBarLabel: 'Perfil' }}>
        {() => <TelaPerfilConvidado criarConta={sair} sair={sair} />}
      </Abas.Screen>
    </Abas.Navigator>
  );
}
