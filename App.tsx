import React from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { useSessao } from './src/lib/useSessao';
import { useRecuperacaoAtiva } from './src/lib/recuperacaoSenha';
import { fundoLogin, TelaLogin } from './src/telas/TelaLogin';
import { AbasPrincipais } from './src/navegacao/AbasPrincipais';
import { AbasConvidado } from './src/navegacao/AbasConvidado';
import { cores } from './src/lib/tema';
import { Aviso, Botao } from './src/componentes/Ui';
import { ProvedorModoGestor } from './src/componentes/ModoGestor';

export default function App() {
  const {
    sessao,
    perfil,
    carregando,
    erroPerfil,
    ehConvidado,
    ehGestao,
    podeAlternarModo,
    alternarModo,
    sair,
    recarregarPerfil,
  } = useSessao();

  const recuperandoSenha = useRecuperacaoAtiva();

  if (recuperandoSenha) {
    return (
      <SafeAreaView style={[estilos.raiz, { backgroundColor: fundoLogin }]}>
        <StatusBar barStyle="dark-content" />
        <TelaLogin erroSessao={erroPerfil} />
      </SafeAreaView>
    );
  }

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

  if (ehConvidado) {
    return (
      <SafeAreaView style={estilos.raiz}>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer>
          <AbasConvidado usuarioId={perfil.id} sair={sair} />
        </NavigationContainer>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.raiz}>
      <StatusBar barStyle="dark-content" />
      <ProvedorModoGestor
        value={podeAlternarModo ? { ativo: ehGestao, alternar: alternarModo } : null}
      >
        {/* A chave reinicia as pilhas ao trocar de modo, evitando telas do outro papel. */}
        <NavigationContainer key={perfil.tipo_perfil}>
          <AbasPrincipais
            perfil={perfil}
            ehGestao={ehGestao}
            sair={sair}
            recarregarPerfil={recarregarPerfil}
          />
        </NavigationContainer>
      </ProvedorModoGestor>
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
