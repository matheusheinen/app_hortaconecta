// Canal push pelo Expo Push Service (que repassa ao FCM no Android e ao APNs no iOS).
// https://docs.expo.dev/push-notifications/sending-notifications/
// Sem dependências do Deno: o fetch e o token chegam por parâmetro (testável no Node).
import type { Buscar, Canal, Entrega, ResultadoEnvio, ResultadoRecibo } from './tipos.ts';

export const URL_ENVIO = 'https://exp.host/--/api/v2/push/send';
export const URL_RECIBOS = 'https://exp.host/--/api/v2/push/getReceipts';
const LOTE_ENVIO = 100;
const LOTE_RECIBOS = 1000;
/** Mesmo canal criado pelo app (src/funcionalidades/notificacoes/push.ts). */
const CANAL_ANDROID = 'padrao';

/** Erros em que repetir o envio não resolve. */
const DEFINITIVOS = new Set(['DeviceNotRegistered', 'MessageTooBig']);

type Ticket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message?: string; details?: { error?: string } };
type Recibo = { status: 'ok' } | { status: 'error'; message?: string; details?: { error?: string } };

export function montarMensagem(e: Entrega) {
  return {
    to: e.destino,
    title: e.titulo,
    body: e.corpo,
    // O app lê isto em lerDadosDoToque para abrir o destino certo ao tocar.
    data: {
      notificacaoId: e.notificacao_id,
      tipo: e.tipo,
      atividade_id: e.atividade_id,
      meta_id: e.meta_id,
    },
    sound: 'default',
    priority: 'high',
    channelId: CANAL_ANDROID,
  };
}

function cabecalhos(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  // Só é exigido se "enhanced push security" estiver ligado no EAS.
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function fatiar<T>(itens: T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
}

function descreverErro(t: { message?: string; details?: { error?: string } }): string {
  return [t.details?.error, t.message].filter(Boolean).join(': ') || 'Erro desconhecido do Expo';
}

/** Converte a resposta de um lote de envio em um resultado por entrega (mesma ordem). */
export function interpretarTickets(lote: Entrega[], tickets: unknown): ResultadoEnvio[] {
  const lista = Array.isArray(tickets) ? (tickets as Ticket[]) : [];
  return lote.map((e, i) => {
    const t = lista[i];
    if (!t) return { id: e.id, ok: false, erro: 'Expo não devolveu ticket' };
    if (t.status === 'ok') return { id: e.id, ok: true, id_externo: t.id };
    const codigo = t.details?.error ?? '';
    return {
      id: e.id,
      ok: false,
      erro: descreverErro(t),
      definitivo: DEFINITIVOS.has(codigo),
      remover_destino: codigo === 'DeviceNotRegistered',
    };
  });
}

/** Falha do lote inteiro (rede, 429, 5xx, credencial): todas voltam para a fila. */
function falhaDoLote(lote: Entrega[], erro: string): ResultadoEnvio[] {
  return lote.map(e => ({ id: e.id, ok: false, erro }));
}

export function criarCanalExpoPush(buscar: Buscar, token?: string): Canal {
  return {
    nome: 'push',
    async enviar(entregas) {
      const resultados: ResultadoEnvio[] = [];
      for (const lote of fatiar(entregas, LOTE_ENVIO)) {
        try {
          const resposta = await buscar(URL_ENVIO, {
            method: 'POST',
            headers: cabecalhos(token),
            body: JSON.stringify(lote.map(montarMensagem)),
          });
          const corpo = await resposta.json().catch(() => null);
          if (!resposta.ok || !corpo?.data) {
            const codigo = corpo?.errors?.[0]?.code ?? `HTTP ${resposta.status}`;
            resultados.push(...falhaDoLote(lote, String(codigo)));
            continue;
          }
          resultados.push(...interpretarTickets(lote, corpo.data));
        } catch (falha) {
          resultados.push(...falhaDoLote(lote, `Rede: ${String(falha)}`));
        }
      }
      return resultados;
    },
  };
}

/**
 * Consulta os recibos. Recibo ausente (ainda não pronto) não vira resultado: a entrega segue
 * ENVIADA e é consultada de novo na próxima rodada.
 */
export async function consultarRecibos(
  buscar: Buscar,
  pendentes: { id: number; id_externo: string }[],
  token?: string,
): Promise<ResultadoRecibo[]> {
  const resultados: ResultadoRecibo[] = [];
  for (const lote of fatiar(pendentes, LOTE_RECIBOS)) {
    const resposta = await buscar(URL_RECIBOS, {
      method: 'POST',
      headers: cabecalhos(token),
      body: JSON.stringify({ ids: lote.map(p => p.id_externo) }),
    });
    const corpo = await resposta.json().catch(() => null);
    if (!resposta.ok || !corpo?.data) continue; // tenta na próxima rodada
    resultados.push(...interpretarRecibos(lote, corpo.data));
  }
  return resultados;
}

export function interpretarRecibos(
  lote: { id: number; id_externo: string }[],
  recibos: Record<string, Recibo>,
): ResultadoRecibo[] {
  const resultados: ResultadoRecibo[] = [];
  for (const p of lote) {
    const r = recibos[p.id_externo];
    if (!r) continue;
    if (r.status === 'ok') resultados.push({ id: p.id, ok: true });
    else
      resultados.push({
        id: p.id,
        ok: false,
        erro: descreverErro(r),
        remover_destino: r.details?.error === 'DeviceNotRegistered',
      });
  }
  return resultados;
}
