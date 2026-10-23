/**
 * Upload e banco não compartilham transação. O arquivo vai primeiro; se o
 * registro da contribuição falhar, ele é removido e o erro original continua
 * valendo. Sem arquivo, só registra a contribuição.
 */
export async function declararComComprovante(
  arquivo: ArrayBuffer | null,
  enviar: (arquivo: ArrayBuffer) => Promise<string>,
  remover: (caminho: string) => Promise<void>,
  inserir: (caminho: string | null) => Promise<void>,
): Promise<void> {
  if (arquivo === null) return inserir(null);
  const caminho = await enviar(arquivo);
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
