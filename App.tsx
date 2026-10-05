import React from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useSessao } from './src/lib/useSessao';
import { fundoLogin, TelaLogin } from './src/telas/TelaLogin';
import { AbasPrincipais } from './src/navegacao/AbasPrincipais';
import { cores } from './src/lib/tema';
import { Aviso, Botao } from './src/componentes/Ui';

export default function App() {
  const { sessao, perfil, carregando, erroPerfil, ehGestao, sair, recarregarPerfil } = useSessao();

  if (carregando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator size="large" color={cores.folha} />
      </View>
    );
  }

  if (sessao && !perfil) {
    return (
      <SafeAreaView style={estilos.raiz}>
        <View style={{ padding: 24, gap: 16 }}>
          <Aviso mensagem={erroPerfil ?? 'Não foi possível carregar seu perfil.'} />
          <Botao
            titulo="Tentar novamente"
            onPress={() => {
              void recarregarPerfil().catch(() => {});
            }}
          />
          <Botao titulo="Sair" variante="contorno" onPress={sair} />
        </View>
      </SafeAreaView>
    );
  }

  if (!sessao || !perfil) {
    return (
      <SafeAreaView style={[estilos.raiz, { backgroundColor: fundoLogin }]}>
        <StatusBar barStyle="dark-content" />
        <TelaLogin erroSessao={erroPerfil} />
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
  raiz: { flex: 1, backgroundColor: cores.superficie },
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.fundo,
  },
});
