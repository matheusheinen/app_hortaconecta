/** Acrescenta uma página ao feed sem repetir publicação já exibida. */
export function juntarPaginas<T extends { id: number }>(atual: T[], nova: T[]): T[] {
  const vistos = new Set(atual.map(p => p.id));
  return [...atual, ...nova.filter(p => !vistos.has(p.id))];
}
