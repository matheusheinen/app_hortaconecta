import React from 'react';
import { Text } from 'react-native';
import { tipo } from '@/compartilhado/tema';
import type { Publicacao } from '../tipos';

export function DataPublicacao({ p }: { p: Publicacao }) {
  return (
    <Text style={tipo.apoio}>
      {new Date(p.data_publicacao).toLocaleDateString('pt-BR')}
      {p.status === 'OCULTA' ? ' · Não visível ao público' : ''}
    </Text>
  );
}
