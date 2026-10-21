export const LIMITE_FOTO_PERFIL = 2 * 1024 * 1024;
export const TAMANHO_FOTO_PERFIL = 512;

/** Caminhos novos são privados; URLs antigas nunca são apagadas como arquivos. */
export function caminhoFotoDoUsuario(caminho: string | null, usuarioId: string): caminho is string {
  return (
    !!caminho &&
    caminho.startsWith(`${usuarioId}/`) &&
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(caminho)
  );
}

export function arquivoFotoPerfil(base64: string): ArrayBuffer {
  if (!base64 || base64.length > Math.ceil(LIMITE_FOTO_PERFIL / 3) * 4) {
    throw new Error('A foto ficou muito grande. Escolha outra imagem.');
  }
  let binario: string;
  try {
    binario = atob(base64);
  } catch {
    throw new Error('Não foi possível ler a foto. Escolha outra imagem.');
  }
  if (binario.length > LIMITE_FOTO_PERFIL) {
    throw new Error('A foto ficou muito grande. Escolha outra imagem.');
  }
  const bytes = Uint8Array.from(binario, caractere => caractere.charCodeAt(0));
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error('Não foi possível preparar a foto. Escolha outra imagem.');
  }
  return bytes.buffer;
}
