// Registro dos canais com adaptador. Para e-mail (Resend, SMTP...) ou WhatsApp (B18):
// criar o arquivo do canal, registrar aqui e ligar em voluntariado_privado.notificacoes_canais.
import { criarCanalExpoPush } from './expoPush.ts';
import type { Canal } from './tipos.ts';

export function canaisDisponiveis(token?: string): Map<string, Canal> {
  const canais: Canal[] = [criarCanalExpoPush(fetch, token)];
  return new Map(canais.map(c => [c.nome, c]));
}
