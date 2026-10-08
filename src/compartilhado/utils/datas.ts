/** Data sem hora (AAAA-MM-DD) no formato DD/MM/AAAA. Meio-dia evita virar o dia pelo fuso. */
export function formatarDataCurta(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');
}

/** Data e hora (timestamp ISO) no formato local. */
export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}
