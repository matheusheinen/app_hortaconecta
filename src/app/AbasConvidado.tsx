import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import {
  PilhaAtividades,
  type ParametrosPilhaAtividades,
} from '@/funcionalidades/voluntariado/PilhaAtividades';
import { PilhaMetas, type ParametrosMetas } from '@/funcionalidades/metas/PilhaMetas';
import { opcoesAbasPrincipais } from './AbasPrincipais';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import {
  TelaInicioConvidado,
  TelaPerfilConvidado,
} from '@/funcionalidades/convidado/TelasConvidado';

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
export function AbasConvidado() {
  const { sair } = useSessaoAtual();
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
            inicio={() => navigation.navigate('inicio')}
            aoPerfil={() => navigation.navigate('perfil')}
          />
        )}
      </Abas.Screen>
      <Abas.Screen name="metas" options={{ tabBarLabel: 'Contribuir' }}>
        {({ navigation }) => <PilhaMetas inicio={() => navigation.navigate('inicio')} />}
      </Abas.Screen>
      <Abas.Screen name="perfil" options={{ tabBarLabel: 'Perfil' }}>
        {() => <TelaPerfilConvidado criarConta={sair} sair={sair} />}
      </Abas.Screen>
    </Abas.Navigator>
  );
}
