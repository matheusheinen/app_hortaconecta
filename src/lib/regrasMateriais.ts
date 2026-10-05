export function quantidadeMaterial(texto: string): number {
  if (!/^[0-9]+$/.test(texto.trim())) throw new Error('Informe uma quantidade inteira em unidades.');
  const valor = Number(texto);
  if (!Number.isSafeInteger(valor) || valor < 1 || valor > 1000000) {
    throw new Error('A quantidade deve estar entre 1 e 1.000.000 de unidades.');
  }
  return valor;
}
export const rotuloMaterial = {
  ABERTA: 'Aberta', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada',
  PENDENTE: 'Aguardando entrega', CONFIRMADA: 'Entrega confirmada',
};
