import React, { useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { tipo } from '@/compartilhado/tema';
import { urlComprovante } from '../api';

/** Abre o comprovante sob demanda: a URL assinada só é pedida ao tocar no botão. */
export function ComprovanteContribuicao({ caminho }: { caminho: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setCarregando(true);
    setErro(null);
    try {
      setUrl(await urlComprovante(caminho));
    } catch (falha) {
      setErro(mensagemErro(falha));
    } finally {
      setCarregando(false);
    }
  }

  if (url) {
    return (
      <View style={{ gap: 8 }}>
        <Image
          source={{ uri: url }}
          style={{ height: 260, width: '100%', borderRadius: 10 }}
          resizeMode="contain"
          accessibilityLabel="Comprovante da contribuição"
          onError={() => {
            setUrl(null);
            setErro('Não foi possível carregar o comprovante.');
          }}
        />
        <Botao titulo="Ocultar comprovante" variante="contorno" onPress={() => setUrl(null)} />
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      {erro ? <Text style={tipo.apoio}>{erro}</Text> : null}
      {carregando ? <ActivityIndicator accessibilityLabel="Carregando comprovante" /> : null}
      <Botao
        titulo={erro ? 'Tentar de novo' : 'Ver comprovante'}
        variante="contorno"
        carregando={carregando}
        onPress={() => {
          void abrir();
        }}
      />
    </View>
  );
}
