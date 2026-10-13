import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cores, espaco, tipo } from '../tema';
import { Botao } from './Ui';

type Estado = { falhou: boolean };

/**
 * Error boundary da raiz: um erro de renderização mostra esta tela em vez de
 * derrubar o app. Precisa ser classe; o React não tem hook para isso.
 */
export class LimiteErro extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { falhou: false };

  static getDerivedStateFromError(): Estado {
    return { falhou: true };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('Erro de renderização:', erro, info.componentStack);
  }

  render() {
    if (!this.state.falhou) return this.props.children;
    return (
      <View style={estilos.tela}>
        <Text style={tipo.secao} accessibilityRole="header">
          Algo deu errado
        </Text>
        <Text style={tipo.corpo}>
          Esta tela encontrou um problema. Tente de novo; se continuar, avise a gestão.
        </Text>
        <Botao titulo="Tentar novamente" onPress={() => this.setState({ falhou: false })} />
      </View>
    );
  }
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    justifyContent: 'center',
    gap: espaco.md,
    padding: espaco.lg,
    backgroundColor: cores.superficie,
  },
});
