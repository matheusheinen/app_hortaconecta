import React from 'react';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import {
  PilhaAtividades,
  type ParametrosPilhaAtividades,
} from '@/funcionalidades/voluntariado/PilhaAtividades';
import { PilhaMetas, type ParametrosMetas } from '@/funcionalidades/metas/PilhaMetas';
import { PilhaInicio, type ParametrosInicio } from '@/funcionalidades/inicio/PilhaInicio';
import { PilhaPerfilOng } from '@/funcionalidades/perfil/PilhaPerfilOng';
import { PilhaPerfilVoluntario } from '@/funcionalidades/perfil/PilhaPerfilVoluntario';
import { PilhaDiario } from '@/funcionalidades/diario/PilhaDiario';
import { cores } from '@/compartilhado/tema';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { Icone, type NomeIcone } from '@/compartilhado/componentes/Icone';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ParametrosDiario = {
  lista: undefined;
  detalhe: { id: number };
  formulario: { id: number | null };
};

export type ParametrosAbasPrincipais = {
  inicio: NavigatorScreenParams<ParametrosInicio> | undefined;
  atividades: NavigatorScreenParams<ParametrosPilhaAtividades> | undefined;
  metas: NavigatorScreenParams<ParametrosMetas> | undefined;
  diario: NavigatorScreenParams<ParametrosDiario> | undefined;
  perfil: undefined;
};

const Abas = createBottomTabNavigator<ParametrosAbasPrincipais>();

const iconesAbas: Record<keyof ParametrosAbasPrincipais, NomeIcone> = {
  inicio: 'inicio',
  atividades: 'pessoas',
  metas: 'caixa',
  diario: 'livro',
  perfil: 'perfil',
};

export function opcoesAbasPrincipais(
  nome: keyof ParametrosAbasPrincipais,
  insetInferior = 0,
): BottomTabNavigationOptions {
  return {
    headerShown: false,
    tabBarActiveTintColor: cores.folha,
    tabBarInactiveTintColor: cores.tintaSuave,
    sceneStyle: { backgroundColor: cores.creme },
    tabBarLabelPosition: 'below-icon',
    tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
    tabBarIcon: ({ color }) => <Icone nome={iconesAbas[nome]} cor={color} tamanho={22} />,
    tabBarItemStyle: { minHeight: 48, paddingVertical: 5 },
    tabBarStyle: {
      backgroundColor: cores.fundo,
      borderTopColor: cores.linha,
      borderTopWidth: 1,
      height: 64 + insetInferior,
      paddingTop: 4,
      paddingBottom: insetInferior + 4,
      elevation: 0,
      shadowOpacity: 0,
    },
  };
}

/** Os dois perfis compartilham os destinos e os rótulos refletem seu papel. */
export function AbasPrincipais() {
  const { ehGestao } = useSessaoAtual();
  const { bottom } = useSafeAreaInsets();
  return (
    <Abas.Navigator screenOptions={({ route }) => opcoesAbasPrincipais(route.name, bottom)}>
      <Abas.Screen name="inicio" options={{ tabBarLabel: 'Início' }}>
        {({ navigation }) => (
          <PilhaInicio
            atividades={() => navigation.navigate('atividades', { screen: 'lista' })}
            materiais={() => navigation.navigate('metas', { screen: 'lista' })}
            diario={() => navigation.navigate('diario', { screen: 'lista' })}
            perfil={() => navigation.navigate('perfil')}
            abrirAtividade={(id: number) =>
              navigation.navigate('atividades', {
                screen: 'detalhe',
                params: { atividadeId: id },
                initial: false,
              })
            }
            abrirMeta={(id: number) =>
              navigation.navigate('metas', {
                screen: 'detalhe',
                params: { id },
                initial: false,
              })
            }
            abrirPublicacao={(id: number) =>
              navigation.navigate('diario', {
                screen: 'detalhe',
                params: { id },
                initial: false,
              })
            }
            minhasAtividades={() =>
              navigation.navigate('atividades', { screen: 'historico', initial: false })
            }
            minhasContribuicoes={() =>
              navigation.navigate('metas', { screen: 'minhas', initial: false })
            }
          />
        )}
      </Abas.Screen>

      <Abas.Screen
        name="atividades"
        options={{ tabBarLabel: ehGestao ? 'Atividades' : 'Voluntariado' }}
      >
        {({ navigation }) => (
          <PilhaAtividades
            inicio={() => navigation.navigate('inicio', { screen: 'resumo' })}
            aoPerfil={() => navigation.navigate('perfil')}
          />
        )}
      </Abas.Screen>

      <Abas.Screen name="metas" options={{ tabBarLabel: ehGestao ? 'Doações' : 'Contribuir' }}>
        {({ navigation }) => (
          <PilhaMetas inicio={() => navigation.navigate('inicio', { screen: 'resumo' })} />
        )}
      </Abas.Screen>

      <Abas.Screen name="diario" options={{ tabBarLabel: 'Diário' }}>
        {({ navigation }) => (
          <PilhaDiario inicio={() => navigation.navigate('inicio', { screen: 'resumo' })} />
        )}
      </Abas.Screen>

      <Abas.Screen name="perfil" options={{ tabBarLabel: 'Perfil' }}>
        {() => (ehGestao ? <PilhaPerfilOng /> : <PilhaPerfilVoluntario />)}
      </Abas.Screen>
    </Abas.Navigator>
  );
}
