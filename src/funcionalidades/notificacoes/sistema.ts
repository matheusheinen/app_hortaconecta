import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

type NotificacoesDoSistema = typeof import('expo-notifications');

let notificacoes: NotificacoesDoSistema | null = null;

/** O sino e a lista do app funcionam mesmo sem suporte aos avisos do sistema. */
export function obterNotificacoesDoSistema(): NotificacoesDoSistema | null {
  // No Android, o pacote importa ExpoTopicSubscriptionModule antes de expor até as
  // APIs locais. Esse módulo não existe no Expo Go: a guarda precisa vir antes do require.
  if (Platform.OS === 'web' || (Platform.OS === 'android' && isRunningInExpoGo())) return null;

  if (!notificacoes) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- A guarda precisa preceder a carga nativa.
    const modulo: NotificacoesDoSistema = require('expo-notifications');
    modulo.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    notificacoes = modulo;
  }
  return notificacoes;
}
