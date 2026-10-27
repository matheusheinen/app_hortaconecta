/**
 * Regras puras do comprovante: formato reconhecido pelos bytes do arquivo (não
 * pela extensão, que o cliente pode errar), limite de tamanho e a ordem de
 * envio. SVG fica de fora de propósito: é código, não imagem.
 */
export const LIMITE_COMPROVANTE = 5 * 1024 * 1024;

export type ExtensaoComprovante = 'jpg' | 'png' | 'webp';
export type ImagemComprovante = {
  arquivo: ArrayBuffer;
  extensao: ExtensaoComprovante;
  tipo: 'image/jpeg' | 'image/png' | 'image/webp';
};

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const comeca = (bytes: Uint8Array, prefixo: number[], deslocamento = 0) =>
  prefixo.every((b, i) => bytes[deslocamento + i] === b);

export function imagemComprovante(base64: string): ImagemComprovante {
  const erroTamanho = new Error('Escolha uma imagem de até 5 MiB.');
  if (!base64 || base64.length > Math.ceil(LIMITE_COMPROVANTE / 3) * 4) throw erroTamanho;
  let binario: string;
  try {
    binario = atob(base64);
  } catch {
    throw new Error('Não foi possível ler a imagem selecionada.');
  }
  if (binario.length > LIMITE_COMPROVANTE) throw erroTamanho;
  const bytes = Uint8Array.from(binario, c => c.charCodeAt(0));
  const arquivo = bytes.buffer;
  if (comeca(bytes, [0xff, 0xd8, 0xff])) return { arquivo, extensao: 'jpg', tipo: 'image/jpeg' };
  if (comeca(bytes, PNG)) return { arquivo, extensao: 'png', tipo: 'image/png' };
  // WebP: "RIFF" + tamanho de 4 bytes + "WEBP".
  if (comeca(bytes, [0x52, 0x49, 0x46, 0x46]) && comeca(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return { arquivo, extensao: 'webp', tipo: 'image/webp' };
  throw new Error('Formato não aceito. Envie uma imagem JPEG, PNG ou WebP.');
}

/**
 * Upload e banco não compartilham transação. O arquivo vai primeiro; se o
 * registro da contribuição falhar, ele é removido e o erro original continua
 * valendo. Sem arquivo, só registra a contribuição.
 */
export async function declararComComprovante(
  imagem: ImagemComprovante | null,
  enviar: (imagem: ImagemComprovante) => Promise<string>,
  remover: (caminho: string) => Promise<void>,
  inserir: (caminho: string | null) => Promise<void>,
): Promise<void> {
  if (imagem === null) return inserir(null);
  const caminho = await enviar(imagem);
  try {
    await inserir(caminho);
  } catch (falha) {
    try {
      await remover(caminho);
    } catch {
      /* arquivo fica solto, invisível à gestão e sem vínculo */
    }
    throw falha;
  }
}
