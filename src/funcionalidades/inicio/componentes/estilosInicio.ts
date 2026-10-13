import { StyleSheet } from 'react-native';
import { cores } from '@/compartilhado/tema';

/** Estilos repetidos entre os blocos do Início do voluntário. */
export const estilosInicio = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  cartao: {
    backgroundColor: cores.fundo,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: 18,
  },
  cartaoTitulo: { fontSize: 15, fontWeight: '600', color: cores.tinta, lineHeight: 20 },
  apoio: { fontSize: 12, lineHeight: 18, color: cores.tintaSuave, marginTop: 3 },
  link: { color: cores.folha, fontWeight: '600', fontSize: 12 },
  pressionado: { opacity: 0.75 },
});
