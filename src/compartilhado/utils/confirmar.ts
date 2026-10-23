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

/**
 * Confirmação de ação comum ou destrutiva, com o rótulo do botão que confirma.
 * Mesmo motivo de `confirmarExclusao`: no navegador o Alert do react-native-web
 * não faz nada, então o diálogo nativo do browser assume.
 */
export function confirmarAcao(
  titulo: string,
  mensagem: string,
  rotulo: string,
  aoConfirmar: () => void,
  destrutiva = false,
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensagem}`)) aoConfirmar();
    return;
  }

  Alert.alert(titulo, mensagem, [
    { text: 'Voltar', style: 'cancel' },
    { text: rotulo, style: destrutiva ? 'destructive' : 'default', onPress: aoConfirmar },
  ]);
}

/** Aviso de um botão só; no navegador usa o alerta nativo do browser. */
export function avisar(titulo: string, mensagem: string) {
  if (Platform.OS === 'web') {
    window.alert(`${titulo}\n\n${mensagem}`);
    return;
  }

  Alert.alert(titulo, mensagem);
}
