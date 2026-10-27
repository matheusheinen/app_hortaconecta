import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { navegacaoRef } from '@/funcionalidades/notificacoes/navegacao';
import { useSessao } from '@/funcionalidades/autenticacao/useSessao';
import { useRecuperacaoAtiva } from '@/funcionalidades/autenticacao/recuperacaoSenha';
import { fundoLogin, TelaLogin } from '@/funcionalidades/autenticacao/telas/TelaLogin';
import { AbasPrincipais } from './AbasPrincipais';
import { AbasConvidado } from './AbasConvidado';
import { cores } from '@/compartilhado/tema';
import { Aviso, Botao } from '@/compartilhado/componentes/Ui';
import { LimiteErro } from '@/compartilhado/componentes/LimiteErro';
import { ProvedorModoGestor } from '@/funcionalidades/modoGestor/ModoGestor';
import { ProvedorNotificacoes } from '@/funcionalidades/notificacoes/ContextoNotificacoes';
import { useRegistroPush } from '@/funcionalidades/notificacoes/useRegistroPush';
import { desregistrarDispositivoPush } from '@/funcionalidades/notificacoes/push';
import { ProvedorSessao, type SessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';

// A barra de abas já aplica a margem inferior; repetir aqui dobraria o espaço.
const bordasComAbas: Edge[] = ['top', 'left', 'right'];

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <LimiteErro>
        <Conteudo />
      </LimiteErro>
    </SafeAreaProvider>
  );
}

function Conteudo() {
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
  useRegistroPush(perfil?.id ?? null, !!sessao && !ehConvidado);

  // Memorizados: um objeto novo a cada render faria todas as telas renderizarem de novo.
  const valorSessao = useMemo<SessaoAtual | null>(
    () =>
      perfil
        ? {
            usuarioId: perfil.id,
            nome: perfil.nome,
            ehGestao: ehGestao && !ehConvidado,
            convidado: ehConvidado,
            // O token só sai do servidor com a sessão ainda válida, então vem antes do logout.
            sair: () => {
              void desregistrarDispositivoPush().finally(sair);
            },
            recarregarPerfil,
          }
        : null,
    [perfil, ehGestao, ehConvidado, sair, recarregarPerfil],
  );
  const modoGestor = useMemo(
    () => (podeAlternarModo ? { ativo: ehGestao, alternar: alternarModo } : null),
    [podeAlternarModo, ehGestao, alternarModo],
  );

  if (recuperandoSenha) {
    return (
      <SafeAreaView style={[estilos.raiz, { backgroundColor: fundoLogin }]}>
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

  if (!sessao || !perfil || !valorSessao) {
    return (
      <SafeAreaView style={[estilos.raiz, { backgroundColor: fundoLogin }]}>
        <TelaLogin erroSessao={erroPerfil} />
      </SafeAreaView>
    );
  }

  if (ehConvidado) {
    return (
      <SafeAreaView style={estilos.raiz} edges={bordasComAbas}>
        <ProvedorSessao valor={valorSessao}>
          <NavigationContainer>
            <AbasConvidado />
          </NavigationContainer>
        </ProvedorSessao>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={estilos.raiz} edges={bordasComAbas}>
      <ProvedorSessao valor={valorSessao}>
        <ProvedorNotificacoes usuarioId={perfil.id}>
          <ProvedorModoGestor value={modoGestor}>
            {/* A chave reinicia as pilhas ao trocar de modo, evitando telas do outro papel. */}
            <NavigationContainer ref={navegacaoRef} key={perfil.tipo_perfil}>
              <AbasPrincipais />
            </NavigationContainer>
          </ProvedorModoGestor>
        </ProvedorNotificacoes>
      </ProvedorSessao>
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
