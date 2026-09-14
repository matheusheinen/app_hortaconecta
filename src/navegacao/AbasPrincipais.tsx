import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { PilhaAtividades } from './PilhaAtividades';
import { PilhaMetas } from './PilhaMetas';
import { TelaInicioOng } from '../telas/TelaInicioOng';
import { TelaInicioVoluntario } from '../telas/TelaInicioVoluntario';
import { TelaPerfilOng } from '../telas/TelaPerfilOng';
import { TelaPerfilVoluntario } from '../telas/TelaPerfilVoluntario';
import { TelaEmBreve } from '../telas/TelaEmBreve';
import { cores } from '../lib/tema';
import type { Usuario } from '../lib/tipos';

export type ParametrosAbasPrincipais = {
  inicio: undefined;
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
  recarregarPerfil: () => Promise<void>;
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
        {({ navigation }) =>
          ehGestao ? (
            <TelaInicioOng
              nome={perfil.nome}
              sair={sair}
              aoIrParaAtividades={() => navigation.navigate('atividades')}
              aoIrParaMetas={() => navigation.navigate('metas')}
            />
          ) : (
            <TelaInicioVoluntario
              nome={perfil.nome}
              sair={sair}
              aoIrParaAtividades={() => navigation.navigate('atividades')}
              aoIrParaMetas={() => navigation.navigate('metas')}
            />
          )
        }
      </Abas.Screen>

      <Abas.Screen name="atividades" options={{ tabBarLabel: 'Atividades' }}>
        {() => (
          <PilhaAtividades ehGestao={ehGestao} nome={perfil.nome} autorId={perfil.id} sair={sair} />
        )}
      </Abas.Screen>

      <Abas.Screen name="diario" options={{ tabBarLabel: 'Diário' }}>
        {() => (
          <TelaEmBreve
            titulo="Diário"
            nome={perfil.nome}
            sair={sair}
            descricao="O diário de transparência com fotos e relatos das atividades chega em breve."
          />
        )}
      </Abas.Screen>

      <Abas.Screen name="metas" options={{ tabBarLabel: 'Metas' }}>
        {() => <PilhaMetas ehGestao={ehGestao} nome={perfil.nome} sair={sair} />}
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
