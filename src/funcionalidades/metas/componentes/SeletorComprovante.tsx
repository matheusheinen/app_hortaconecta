import React from 'react';
import { Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Botao } from '@/compartilhado/componentes/Ui';
import { avisar } from '@/compartilhado/utils/confirmar';
import { mensagemErro } from '@/compartilhado/utils/erros';

export type ComprovanteEscolhido = { uri: string; base64: string };

/** Escolhe a imagem do comprovante (JPEG, PNG ou WebP, até 5 MiB) e mostra a prévia. */
export function SeletorComprovante({
  valor,
  aoMudar,
  desabilitado,
}: {
  valor: ComprovanteEscolhido | null;
  aoMudar: (valor: ComprovanteEscolhido | null) => void;
  desabilitado?: boolean;
}) {
  async function escolher() {
    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
        exif: false,
        allowsMultipleSelection: false,
      });
      if (resultado.canceled) return;
      const asset = resultado.assets[0];
      if (!asset.base64) throw new Error('Não foi possível ler a imagem. Escolha outra foto.');
      aoMudar({ uri: asset.uri, base64: asset.base64 });
    } catch (falha) {
      avisar('Comprovante', mensagemErro(falha));
    }
  }
  if (valor) {
    return (
      <>
        <Image
          source={{ uri: valor.uri }}
          style={{ height: 180, width: '100%', borderRadius: 10 }}
          resizeMode="contain"
          accessibilityLabel="Comprovante selecionado"
        />
        <Botao
          titulo="Remover comprovante"
          variante="contorno"
          onPress={() => aoMudar(null)}
          desabilitado={desabilitado}
        />
      </>
    );
  }
  return (
    <Botao
      titulo="Anexar comprovante (opcional)"
      variante="contorno"
      onPress={() => {
        void escolher();
      }}
      desabilitado={desabilitado}
    />
  );
}
