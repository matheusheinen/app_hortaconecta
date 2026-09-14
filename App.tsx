import React from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useSessao } from './src/lib/useSessao';
import { TelaLogin } from './src/telas/TelaLogin';
import { AbasPrincipais } from './src/navegacao/AbasPrincipais';
import { cores } from './src/lib/tema';

export default function App() {
  const { sessao, perfil, carregando, ehGestao, sair, recarregarPerfil } = useSessao();

  if (carregando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={cores.folha} />
      </View>
    );
  }

  if (!sessao || !perfil) {
    return (
      <SafeAreaView style={estilos.raiz}>
        <StatusBar barStyle="dark-content" />
        <TelaLogin />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.raiz}>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <AbasPrincipais
          perfil={perfil}
          ehGestao={ehGestao}
          sair={sair}
          recarregarPerfil={recarregarPerfil}
        />
      </NavigationContainer>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: cores.fundo },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.fundo,
  },
});
