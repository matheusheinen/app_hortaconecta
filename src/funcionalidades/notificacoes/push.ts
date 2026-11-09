import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { registrarTokenPush, removerTokenPush } from './api';
import { obterNotificacoesDoSistema } from './sistema';
import type { Notificacao } from './tipos';
import { dadosDoToque } from './toque';

const CANAL_PADRAO = 'padrao';

/** Token deste aparelho já enviado ao servidor; usado para removê-lo ao sair da conta. */
let tokenRegistrado: string | null = null;
/** Ouvinte de troca de token (o sistema pode renovar o token do aparelho). */
let ouvinteToken: { remove: () => void } | null = null;

/**
 * Com o push remoto ativo, o próprio push mostra o aviso do sistema; o aviso local disparado
 * pelo Realtime duplicaria a notificação.
 */
export function pushRemotoRegistrado(): boolean {
  return tokenRegistrado !== null;
}

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
    const Notifications = obterNotificacoesDoSistema();
    if (!sistema || !Notifications) return false;
    // No Android 13+ o pedido de permissão só aparece depois de existir um canal.
    if (sistema === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_PADRAO, {
        name: 'Avisos do Horta Conecta',
        importance: Notifications.AndroidImportance.DEFAULT,
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
 * chegar em tempo real, quando o ambiente suporta o módulo nativo. É um aviso local:
 * não depende de FCM/APNs e só aparece com o app aberto ou em segundo plano recente.
 */
export async function mostrarAvisoLocal(notificacao: Notificacao): Promise<void> {
  try {
    if (!plataforma()) return;
    const Notifications = obterNotificacoesDoSistema();
    if (!Notifications) return;
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
    if (!sistema || isRunningInExpoGo() || !Device.isDevice) return null;
    const Notifications = obterNotificacoesDoSistema();
    if (!Notifications || !(await pedirPermissaoNotificacoes())) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('Notificações: projectId do EAS ausente. Rode `eas init`.');
      return null;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registrarTokenPush(token, sistema);
    tokenRegistrado = token;
    // O ouvinte entrega o token nativo (FCM/APNs); o servidor precisa do token Expo, então
    // pede de novo e registra se mudou.
    ouvinteToken ??= Notifications.addPushTokenListener(() => {
      void Notifications.getExpoPushTokenAsync({ projectId })
        .then(async ({ data: novo }) => {
          if (!tokenRegistrado || novo === tokenRegistrado) return;
          await registrarTokenPush(novo, sistema);
          tokenRegistrado = novo;
        })
        .catch(falha => console.warn('Notificações: não foi possível renovar o token.', falha));
    });
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
  ouvinteToken?.remove();
  ouvinteToken = null;
  try {
    await removerTokenPush(token);
  } catch (falha) {
    console.warn('Notificações: não foi possível remover o aparelho.', falha);
  }
}
