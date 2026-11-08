import React from 'react';
import { Image } from 'react-native';

/** Logotipo cadastrado pela gestão (B28). Sem logotipo, não ocupa espaço. */
export function LogoInstituicao({
  url,
  tamanho = 48,
}: {
  url: string | null | undefined;
  tamanho?: number;
}) {
  if (!url || !/^(data:image\/(png|jpeg);base64,|https:\/\/)/.test(url)) return null;
  return (
    <Image
      source={{ uri: url }}
      style={{ width: tamanho, height: tamanho }}
      resizeMode="contain"
      accessibilityLabel="Logotipo da instituição"
    />
  );
}
