export const LIMITE_IMAGEM_DIARIO = 5 * 1024 * 1024;
export function validarPublicacao(titulo: string, texto: string) {
  if (
    titulo.trim().length < 3 ||
    titulo.trim().length > 120 ||
    texto.trim().length < 1 ||
    texto.trim().length > 20000
  ) {
    throw new Error('Informe título de 3 a 120 caracteres e texto de 1 a 20.000 caracteres.');
  }
}
export function imagemJpeg(base64: string): ArrayBuffer {
  if (!base64 || base64.length > Math.ceil(LIMITE_IMAGEM_DIARIO / 3) * 4) {
    throw new Error('Escolha uma imagem de até 5 MiB.');
  }
  let binario: string;
  try {
    binario = atob(base64);
  } catch {
    throw new Error('Não foi possível ler a imagem selecionada.');
  }
  if (binario.length > LIMITE_IMAGEM_DIARIO) throw new Error('Escolha uma imagem de até 5 MiB.');
  const bytes = Uint8Array.from(binario, c => c.charCodeAt(0));
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error('Não foi possível converter a imagem para JPEG. Escolha outra foto.');
  }
  return bytes.buffer;
}
// Upload e banco não compartilham transação. Falha de upload nunca publica.
export async function salvarDiarioComImagem(
  base64: string | null,
  caminhoAtual: string | null,
  enviar: (arquivo: ArrayBuffer) => Promise<string>,
  salvar: (caminho: string | null) => Promise<number>,
): Promise<number> {
  const caminho = base64 === null ? caminhoAtual : await enviar(imagemJpeg(base64));
  return salvar(caminho);
}

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
