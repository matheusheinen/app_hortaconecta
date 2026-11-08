import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { TAMANHO_LOGO, logoDataUri } from './regras';

/**
 * B28: abre a galeria e devolve o logotipo reduzido (maior lado em 256 px) como
 * PNG em data URI, preservando a transparência. Não recorta: logos costumam ser
 * mais largos que altos.
 */
export async function selecionarLogo(): Promise<string | null> {
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
    allowsMultipleSelection: false,
  });
  if (resultado.canceled) return null;
  const imagem = resultado.assets[0];
  if (!imagem || !(imagem.width > 0) || !(imagem.height > 0)) {
    throw new Error('Não foi possível ler o logotipo. Escolha outra imagem.');
  }
  const escala = Math.min(1, TAMANHO_LOGO / Math.max(imagem.width, imagem.height));
  const contexto = ImageManipulator.manipulate(imagem.uri);
  try {
    contexto.resize({
      width: Math.max(1, Math.round(imagem.width * escala)),
      height: Math.max(1, Math.round(imagem.height * escala)),
    });
    const renderizada = await contexto.renderAsync();
    try {
      const salva = await renderizada.saveAsync({ format: SaveFormat.PNG, base64: true });
      if (!salva.base64) {
        throw new Error('Não foi possível preparar o logotipo. Escolha outra imagem.');
      }
      return logoDataUri(salva.base64);
    } finally {
      renderizada.release();
    }
  } finally {
    contexto.release();
  }
}
