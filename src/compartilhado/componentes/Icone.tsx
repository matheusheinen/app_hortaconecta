import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { cores } from '../tema';

export type NomeIcone =
  | 'inicio'
  | 'pessoas'
  | 'caixa'
  | 'livro'
  | 'perfil'
  | 'relogio'
  | 'check'
  | 'presente'
  | 'folha'
  | 'seta'
  | 'oficina'
  | 'certificado'
  | 'sair';

type Props = {
  nome: NomeIcone;
  cor?: string;
  tamanho?: number;
};

/** Os controles que usam estes ícones fornecem seus próprios rótulos. */
export function Icone({ nome, cor = cores.folha, tamanho = 24 }: Props) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: tamanho, height: tamanho }}
    >
      <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
        <G stroke={cor} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          {nome === 'inicio' ? (
            <>
              <Path d="m3 10 9-7 9 7M5 9v11h5v-7h4v7h5V9" />
            </>
          ) : null}
          {nome === 'pessoas' ? (
            <>
              <Circle cx={9} cy={8} r={3} />
              <Path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2" />
            </>
          ) : null}
          {nome === 'caixa' ? (
            <>
              <Path d="m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4" />
            </>
          ) : null}
          {nome === 'livro' ? (
            <>
              <Path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15" />
            </>
          ) : null}
          {nome === 'perfil' ? (
            <>
              <Circle cx={12} cy={8} r={3.5} />
              <Path d="M5 21v-2a7 7 0 0 1 14 0v2" />
            </>
          ) : null}
          {nome === 'relogio' ? (
            <>
              <Circle cx={12} cy={12} r={9} />
              <Path d="M12 7v5l3 2" />
            </>
          ) : null}
          {nome === 'check' ? (
            <>
              <Circle cx={12} cy={12} r={9} />
              <Path d="m8 12 3 3 5-6" />
            </>
          ) : null}
          {nome === 'presente' ? (
            <>
              <Rect x={3} y={8} width={18} height={4} rx={1} />
              <Path d="M5 12v8h14v-8M12 8v12M12 8H8.5a2.5 2.5 0 1 1 2.4-3.2L12 8Zm0 0h3.5a2.5 2.5 0 1 0-2.4-3.2L12 8Z" />
            </>
          ) : null}
          {nome === 'folha' ? (
            <>
              <Path d="M5 20c3-6 6-9 12-12M8 17C1 10 7 4 20 3c-1 13-5 18-12 14Z" />
            </>
          ) : null}
          {nome === 'seta' ? <Path d="m9 5 7 7-7 7" /> : null}
          {nome === 'oficina' ? (
            <>
              <Path d="M14 6a5 5 0 0 0-6 6L3.5 16.5a2.8 2.8 0 0 0 4 4L12 16a5 5 0 0 0 6-6l-3 3-4-4 3-3Z" />
              <Path d="m16 3 5 5M18.5 5.5l-4 4" />
            </>
          ) : null}
          {nome === 'certificado' ? (
            <>
              <Rect x={3} y={3} width={18} height={14} rx={2} />
              <Path d="M7 7h10M7 11h4M14 17v5l3-2 3 2v-5" />
              <Circle cx={17} cy={14} r={3} />
            </>
          ) : null}
          {nome === 'sair' ? (
            <>
              <Path d="M9 4H4v16h5M9 12h12m-4-4 4 4-4 4" />
            </>
          ) : null}
        </G>
      </Svg>
    </View>
  );
}
