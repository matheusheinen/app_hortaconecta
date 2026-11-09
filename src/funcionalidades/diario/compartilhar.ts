/** Texto enviado pelo botão "Compartilhar publicação" (B18). Só o relato, sem a imagem privada. */
export function textoCompartilharPublicacao(p: {
  titulo: string;
  texto: string | null;
  descricao_curta: string | null;
}): string {
  const relato = (p.texto ?? p.descricao_curta ?? '').trim();
  const resumo = relato.length <= 280 ? relato : `${relato.slice(0, 279).trimEnd()}…`;
  return [`🌱 Diário da Horta Conecta: ${p.titulo}`, resumo, 'Acompanhe pelo app Horta Conecta.']
    .filter(Boolean)
    .join('\n\n');
}
