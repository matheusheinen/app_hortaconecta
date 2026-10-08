import { Linking } from 'react-native';

/**
 * O contato vem de `configuracao_instituicao.whatsapp` (DDD + número). O wa.me
 * exige o código do país; números já salvos com 55 não recebem outro prefixo.
 */
export function linkWhatsApp(numero: string, mensagem: string): string | null {
  const digitos = numero.replace(/\D/g, '');
  const completo =
    digitos.length === 10 || digitos.length === 11
      ? `55${digitos}`
      : digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)
        ? digitos
        : null;
  return completo ? `https://wa.me/${completo}?text=${encodeURIComponent(mensagem)}` : null;
}

/** Devolve false quando o número é inválido ou não há app/navegador para abrir o link. */
export async function abrirWhatsApp(numero: string, mensagem: string): Promise<boolean> {
  const link = linkWhatsApp(numero, mensagem);
  if (!link) return false;
  try {
    await Linking.openURL(link);
    return true;
  } catch {
    return false;
  }
}
