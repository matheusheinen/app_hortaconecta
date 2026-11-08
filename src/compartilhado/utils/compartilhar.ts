import { Share } from 'react-native';
import { avisar } from './confirmar';

/**
 * Abre o menu de compartilhamento do sistema (WhatsApp, Instagram, e-mail...).
 * No navegador sem suporte a compartilhamento, avisa em vez de falhar em silêncio.
 */
export async function compartilharTexto(titulo: string, mensagem: string): Promise<void> {
  try {
    await Share.share({ title: titulo, message: mensagem });
  } catch {
    avisar('Não foi possível compartilhar', 'Copie o texto e envie pelo aplicativo que preferir.');
  }
}
