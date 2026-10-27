import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { registrarTokenPush, removerTokenPush } from './api';
import type { Notificacao } from './tipos';
import { dadosDoToque } from './toque';

const CANAL_PADRAO = 'padrao';

/** Token deste aparelho já enviado ao servidor; usado para removê-lo ao sair da conta. */
let tokenRegistrado: string | null = null;

// Com o app aberto, a notificação aparece como banner em vez de ser descartada.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function plataforma(): 'ios' | 'android' | null {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
}

/**
 * Cria o canal (Android) e pede permissão para avisos do sistema. Nunca lança: o sino dentro
 * do app funciona sem permissão. Devolve se os avisos do sistema estão liberados.
 */
export async function pedirPermissaoNotificacoes(): Promise<boolean> {
  try {
    const sistema = plataforma();
    if (!sistema) return false;
    // No Android 13+ o pedido de permissão só aparece depois de existir um canal.
    if (sistema === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_PADRAO, {
        name: 'Avisos do Horta Conecta',
        importance: AndroidImportance.DEFAULT,
      });
    }
    let permissao = await Notifications.getPermissionsAsync();
    if (!permissao.granted && permissao.canAskAgain) {
      permissao = await Notifications.requestPermissionsAsync();
    }
    return permissao.granted;
  } catch (falha) {
    console.warn('Notificações: não foi possível pedir permissão.', falha);
    return false;
  }
}

/**
 * Mostra no sistema (banner/central de notificações) o aviso de uma notificação que acabou de
 * chegar em tempo real. É um aviso local: não depende de FCM, APNs nem de build próprio, mas
 * só aparece com o app aberto ou em segundo plano recente.
 */
export async function mostrarAvisoLocal(notificacao: Notificacao): Promise<void> {
  try {
    if (!plataforma()) return;
    const permissao = await Notifications.getPermissionsAsync();
    if (!permissao.granted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notificacao.titulo,
        body: notificacao.corpo,
        data: { notificacaoId: notificacao.id, ...dadosDoToque(notificacao) },
      },
      trigger: null,
    });
  } catch (falha) {
    console.warn('Notificações: não foi possível mostrar o aviso.', falha);
  }
}

/**
 * Push remoto (app fechado). Exige development build, FCM/APNs configurados e um envio no
 * servidor, então só roda com EXPO_PUBLIC_PUSH_REMOTO=true. Nunca lança.
 */
export async function registrarDispositivoPush(): Promise<string | null> {
  try {
    const sistema = plataforma();
    if (!sistema || !Device.isDevice || !(await pedirPermissaoNotificacoes())) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('Notificações: projectId do EAS ausente. Rode `eas init`.');
      return null;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registrarTokenPush(token, sistema);
    tokenRegistrado = token;
    return token;
  } catch (falha) {
    console.warn('Notificações: não foi possível registrar o aparelho.', falha);
    return null;
  }
}

/** Remove o token deste aparelho do servidor. Chamar ainda com a sessão ativa. */
export async function desregistrarDispositivoPush(): Promise<void> {
  const token = tokenRegistrado;
  if (!token) return;
  tokenRegistrado = null;
  try {
    await removerTokenPush(token);
  } catch (falha) {
    console.warn('Notificações: não foi possível remover o aparelho.', falha);
  }
}
