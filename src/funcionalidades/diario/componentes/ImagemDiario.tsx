import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { urlImagemDiario } from '../api';
import { Botao } from '@/compartilhado/componentes/Ui';
import { tipo } from '@/compartilhado/tema';

export function ImagemDiario({ caminho }: { caminho: string }) {
  const [falhou, setFalhou] = useState(false);
  const [abrindo, setAbrindo] = useState(true);
  const { dados, erro, carregando, carregar } = useConsulta(
    useCallback(() => {
      setFalhou(false);
      setAbrindo(true);
      return urlImagemDiario(caminho);
    }, [caminho]),
  );
  // O Image do react-native-web recomeça o carregamento quando esses callbacks mudam;
  // callbacks recriados a cada render causariam um loop de setState.
  const aoCarregar = useCallback(() => setAbrindo(false), []);
  const aoFalhar = useCallback(() => setFalhou(true), []);
  function tentar() {
    setFalhou(false);
    setAbrindo(true);
    void carregar();
  }
  return (
    <View style={{ gap: 8 }}>
      {carregando || (!erro && !falhou && abrindo) ? (
        <ActivityIndicator accessibilityLabel="Carregando imagem" />
      ) : null}
      {erro || falhou ? (
        <>
          <Text style={tipo.apoio}>
            Não foi possível carregar a imagem. O texto continua disponível.
          </Text>
          <Botao titulo="Tentar carregar imagem" variante="contorno" onPress={tentar} />
        </>
      ) : !carregando && dados ? (
        <Image
          key={dados}
          source={{ uri: dados }}
          style={{ height: 220, width: '100%', borderRadius: 10 }}
          resizeMode="cover"
          accessibilityLabel="Imagem da atividade institucional"
          onLoadEnd={aoCarregar}
          onError={aoFalhar}
        />
      ) : null}
    </View>
  );
}
