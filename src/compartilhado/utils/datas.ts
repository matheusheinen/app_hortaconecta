/** Data sem hora (AAAA-MM-DD) no formato DD/MM/AAAA. Meio-dia evita virar o dia pelo fuso. */
export function formatarDataCurta(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');
}

/** Data e hora (timestamp ISO) no formato local. */
export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR');
}

/** DD/MM/AAAA → AAAA-MM-DD, rejeitando datas inexistentes. */
export function interpretarData(texto: string): string | null {
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  if (
    d.getFullYear() !== Number(ano) ||
    d.getMonth() !== Number(mes) - 1 ||
    d.getDate() !== Number(dia)
  )
    return null;
  return `${ano}-${mes}-${dia}`;
}

/** AAAA-MM-DD → DD/MM/AAAA, para preencher campos de data. */
export function paraCampoData(iso: string | null): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Dia local (AAAA-MM-DD) da data informada; sem ela, de hoje. */
export function hojeIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
