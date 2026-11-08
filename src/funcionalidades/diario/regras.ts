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
/**
 * B26: imagem com crianças ou adolescentes só é publicada com a autorização dos
 * responsáveis. O banco repete a regra (diario_menores_com_autorizacao).
 */
export function validarMenores(temImagem: boolean, comMenores: boolean, autorizacao: boolean) {
  if (temImagem && comMenores && !autorizacao) {
    throw new Error(
      'Imagem com crianças ou adolescentes só pode ser publicada com a autorização dos responsáveis. Confirme a autorização ou remova a imagem.',
    );
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
