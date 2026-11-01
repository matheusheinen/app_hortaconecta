import type { SlotDisponibilidade } from '@/compartilhado/tipos';
import type { MinhaInscricao, StatusAtividade } from './tipos';

/**
 * Aba da listagem. ENCERRADA só fecha as candidaturas: a atividade ainda
 * acontece e recebe check-in, então continua entre as abertas.
 */
export function atividadeFinalizada(status: StatusAtividade): boolean {
  return status === 'REALIZADA' || status === 'CANCELADA' || status === 'RECUSADA';
}

export type AbaAtividades = 'abertas' | 'finalizadas' | 'arquivadas';

/**
 * Aba onde a atividade aparece. Arquivada sai das outras abas e só a gestão a
 * vê; para os demais perfis ela some da lista.
 */
export function abaDaAtividade(
  atividade: { status: StatusAtividade; arquivada_em: string | null },
  ehGestao: boolean,
): AbaAtividades | null {
  if (atividade.arquivada_em) return ehGestao ? 'arquivadas' : null;
  return atividadeFinalizada(atividade.status) ? 'finalizadas' : 'abertas';
}

export function disponibilidadeValida(valor: unknown): valor is SlotDisponibilidade[] {
  if (!Array.isArray(valor)) return false;
  const vistos = new Set<string>();
  return valor.every((slot: unknown) => {
    if (!slot || typeof slot !== 'object' || !('dia' in slot) || !('periodo' in slot)) return false;
    if (
      !['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'].includes(String(slot.dia)) ||
      !['manha', 'tarde', 'noite'].includes(String(slot.periodo)) ||
      Object.keys(slot).length !== 2
    )
      return false;
    const chave = `${slot.dia}/${slot.periodo}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export function interpretarDataHora(texto: string): Date | null {
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dia, mes, ano, hora, minuto] = m.map(Number);
  if (ano < 1901 || hora > 23 || minuto > 59) return null;
  const d = new Date(ano, mes - 1, dia, hora, minuto);
  return d.getFullYear() === ano &&
    d.getMonth() === mes - 1 &&
    d.getDate() === dia &&
    d.getHours() === hora &&
    d.getMinutes() === minuto
    ? d
    : null;
}

export function interpretarCarga(texto: string): number | null {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(texto.trim())) return null;
  const n = Number(texto.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 999.99 ? n : null;
}

export function lerQrCheckin(texto: string, atividadeId: number): string {
  if (texto.length > 512) throw new Error('QR Code inválido.');
  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch {
    throw new Error('Este QR Code não é de check-in do Horta Conecta.');
  }
  if (
    !valor ||
    typeof valor !== 'object' ||
    !('tipo' in valor) ||
    valor.tipo !== 'hortaconecta-checkin-v1' ||
    !('atividade_id' in valor) ||
    valor.atividade_id !== atividadeId ||
    !('token' in valor) ||
    typeof valor.token !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor.token)
  ) {
    throw new Error('QR Code inválido ou de outra atividade.');
  }
  return valor.token;
}

/**
 * Soma a carga PREVISTA registrada no check-in das presenças confirmadas. Registros antigos sem
 * snapshot ficam fora do total e são contados à parte, como no resumo do Início.
 */
export function totalHorasParticipacao(itens: MinhaInscricao[]): {
  horas: number;
  participacoes: number;
  semCarga: number;
} {
  const presencas = itens.filter(({ inscricao }) => inscricao.presenca_confirmada);
  let horas = 0;
  let semCarga = 0;
  for (const { inscricao } of presencas) {
    const carga = inscricao.carga_horaria_registrada;
    if (carga !== null && Number.isFinite(carga) && carga > 0) horas += carga;
    else semCarga++;
  }
  return { horas, participacoes: presencas.length, semCarga };
}

/** Mensagem exibida após cada participação confirmada. Sem título, usa a forma genérica. */
export function mensagemImpacto(titulo?: string | null): string {
  const nome = titulo?.trim();
  return nome
    ? `Obrigado por participar de "${nome}"! Seu tempo ajuda a manter a horta viva e a fortalecer a comunidade.`
    : 'Obrigado por participar! Seu tempo ajuda a manter a horta viva e a fortalecer a comunidade.';
}
