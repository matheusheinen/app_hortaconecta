import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { QUALIDADE_IMAGEM_DIARIO, dimensoesDiario, imagemJpeg } from './regras';

/**
 * Abre a galeria e devolve a imagem já comprimida no aparelho (RNF0005):
 * o maior lado é reduzido a 1600 px e o arquivo é salvo em JPEG, inclusive
 * quando a original é PNG ou HEIC. A conversão também vale no navegador.
 */
export async function selecionarImagemDiario(): Promise<{ uri: string; base64: string } | null> {
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
    allowsMultipleSelection: false,
  });
  if (resultado.canceled) return null;
  const imagem = resultado.assets[0];
  if (!imagem) throw new Error('Não foi possível ler a imagem selecionada. Escolha outra foto.');
  const destino = dimensoesDiario(imagem.width, imagem.height);
  const contexto = ImageManipulator.manipulate(imagem.uri);
  try {
    contexto.resize(destino);
    const renderizada = await contexto.renderAsync();
    try {
      const salva = await renderizada.saveAsync({
        format: SaveFormat.JPEG,
        compress: QUALIDADE_IMAGEM_DIARIO,
        base64: true,
      });
      if (!salva.base64) {
        throw new Error('Não foi possível preparar a imagem. Escolha outra foto.');
      }
      imagemJpeg(salva.base64);
      return { uri: salva.uri, base64: salva.base64 };
    } finally {
      renderizada.release();
    }
  } finally {
    contexto.release();
  }
}
