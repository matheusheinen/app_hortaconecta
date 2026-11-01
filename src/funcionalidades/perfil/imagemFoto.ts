import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { TAMANHO_FOTO_PERFIL, arquivoFotoPerfil } from './regrasFoto';

/** A biblioteca é aberta diretamente pelo toque, inclusive no navegador. */
export async function selecionarFotoPerfil(): Promise<string | null> {
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    exif: false,
    allowsMultipleSelection: false,
  });
  if (resultado.canceled) return null;
  const imagem = resultado.assets[0];
  if (!imagem || imagem.width <= 0 || imagem.height <= 0) {
    throw new Error('Não foi possível ler a foto selecionada. Escolha outra imagem.');
  }
  const lado = Math.min(imagem.width, imagem.height);
  const tamanho = Math.min(lado, TAMANHO_FOTO_PERFIL);
  const contexto = ImageManipulator.manipulate(imagem.uri);
  try {
    // O recorte também garante o formato quadrado na web, que não oferece editor nativo.
    contexto.crop({
      originX: Math.floor((imagem.width - lado) / 2),
      originY: Math.floor((imagem.height - lado) / 2),
      width: lado,
      height: lado,
    });
    contexto.resize({ width: tamanho, height: tamanho });
    const renderizada = await contexto.renderAsync();
    try {
      const foto = await renderizada.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.82,
        base64: true,
      });
      if (!foto.base64) throw new Error('Não foi possível preparar a foto. Tente outra imagem.');
      arquivoFotoPerfil(foto.base64);
      return foto.base64;
    } finally {
      renderizada.release();
    }
  } finally {
    contexto.release();
  }
}
