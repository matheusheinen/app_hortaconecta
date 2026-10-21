import { supabase } from '@/servicos/supabase';
import { arquivoFotoPerfil, caminhoFotoDoUsuario } from './regrasFoto';

export const BUCKET_FOTO_PERFIL = 'perfil-fotos';
export type ResultadoFotoPerfil = { caminho: string | null; aviso: string | null };

export async function carregarCaminhoFoto(usuarioId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('foto_perfil')
    .eq('id', usuarioId)
    .single();
  if (error) throw error;
  return data.foto_perfil;
}

export async function urlFotoPerfil(
  caminho: string | null,
  usuarioId: string,
): Promise<string | null> {
  if (!caminhoFotoDoUsuario(caminho, usuarioId)) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET_FOTO_PERFIL)
    .createSignedUrl(caminho, 300);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Não foi possível carregar sua foto. Tente novamente.');
  return data.signedUrl;
}

async function apagarArquivo(caminho: string | null, usuarioId: string): Promise<boolean> {
  if (!caminhoFotoDoUsuario(caminho, usuarioId)) return true;
  try {
    const { error } = await supabase.storage.from(BUCKET_FOTO_PERFIL).remove([caminho]);
    return !error;
  } catch {
    return false;
  }
}

async function vincularFoto(usuarioId: string, caminho: string | null, anterior: string | null) {
  const { data, error } = await supabase.rpc('perfil_foto_salvar', {
    p_usuario_id: usuarioId,
    p_caminho: caminho,
    p_anterior: anterior,
  });
  if (error) throw error;
  if (data !== true) throw new Error('Não foi possível confirmar a alteração da foto. Recarregue.');
}

export async function salvarFotoPerfil(
  usuarioId: string,
  anterior: string | null,
  base64: string,
): Promise<ResultadoFotoPerfil> {
  const arquivo = arquivoFotoPerfil(base64);
  const { data: caminho, error } = await supabase.rpc('perfil_foto_caminho');
  if (error) throw error;
  if (!caminhoFotoDoUsuario(caminho, usuarioId)) {
    throw new Error('Sua sessão mudou. Reabra o perfil antes de escolher uma foto.');
  }
  try {
    const { error: erroUpload } = await supabase.storage
      .from(BUCKET_FOTO_PERFIL)
      .upload(caminho, arquivo, { contentType: 'image/jpeg', upsert: false, cacheControl: '300' });
    if (erroUpload) throw erroUpload;
    await vincularFoto(usuarioId, caminho, anterior);
  } catch (falha) {
    // A policy impede apagar um arquivo já vinculado, inclusive se a resposta da RPC se perdeu.
    await apagarArquivo(caminho, usuarioId);
    throw falha;
  }
  const limpou = await apagarArquivo(anterior, usuarioId);
  return {
    caminho,
    aviso: limpou
      ? null
      : 'Foto atualizada. A imagem anterior continua privada e sua limpeza ficou pendente.',
  };
}

export async function removerFotoPerfil(
  usuarioId: string,
  anterior: string,
): Promise<ResultadoFotoPerfil> {
  await vincularFoto(usuarioId, null, anterior);
  const limpou = await apagarArquivo(anterior, usuarioId);
  return {
    caminho: null,
    aviso: limpou
      ? null
      : 'Foto removida do perfil. O arquivo continua privado e sua limpeza ficou pendente.',
  };
}
