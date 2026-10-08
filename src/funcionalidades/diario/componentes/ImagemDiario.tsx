import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { useDadosVoluntariado } from '@/compartilhado/hooks/useConsulta';
import { urlImagemDiario } from '../api';
import { Botao } from '@/compartilhado/componentes/Ui';
import { tipo } from '@/compartilhado/tema';

export function ImagemDiario({ caminho }: { caminho: string }) {
  const [falhou, setFalhou] = useState(false);
  const [abrindo, setAbrindo] = useState(true);
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(
    useCallback(() => {
      setFalhou(false);
      setAbrindo(true);
      return urlImagemDiario(caminho);
    }, [caminho]),
  );
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
          onLoadStart={() => setAbrindo(true)}
          onLoadEnd={() => setAbrindo(false)}
          onError={() => setFalhou(true)}
        />
      ) : null}
    </View>
  );
}
