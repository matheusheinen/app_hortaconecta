import type { SlotDisponibilidade } from './tipos';

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
