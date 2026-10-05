import { Alert, Platform } from 'react-native';

/**
 * Confirmação de ação destrutiva. O react-native-web não implementa Alert:
 * no navegador usa o diálogo nativo do browser; no celular, o Alert.
 */
export function confirmarExclusao(titulo: string, mensagem: string, aoConfirmar: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensagem}`)) aoConfirmar();
    return;
  }

  Alert.alert(titulo, mensagem, [
    { text: 'Manter', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: aoConfirmar },
  ]);
}
