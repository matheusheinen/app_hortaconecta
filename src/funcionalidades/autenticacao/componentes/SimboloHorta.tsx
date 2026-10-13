import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { cores } from '@/compartilhado/tema';

/** Símbolo da marca. As cores do desenho fazem parte da ilustração, não do tema. */
export function SimboloHorta() {
  return (
    <View
      style={estilos.simbolo}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={44} height={44} viewBox="0 0 48 48" fill="none">
        <Path
          d="M14 40C18 32 25 25 33 9"
          stroke="#C4DD69"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <Path d="M21 31C13 30 11 25 12 19C18 20 23 25 21 31Z" fill="#B6D557" />
        <Path d="M26 23C19 20 18 15 20 10C26 13 29 18 26 23Z" fill="#D5E77E" />
        <Path d="M31 15C28 10 30 6 35 4C36 10 35 13 31 15Z" fill="#B6D557" />
        <Path d="M19 34C24 29 31 29 36 31C31 37 25 39 19 34Z" fill="#D5E77E" />
        <Path d="M26 25C30 19 36 18 41 20C37 25 32 28 26 25Z" fill="#B6D557" />
      </Svg>
    </View>
  );
}

const estilos = StyleSheet.create({
  simbolo: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: cores.folha,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    boxShadow: '0px 4px 8px rgba(28, 67, 48, 0.12)',
  },
});
