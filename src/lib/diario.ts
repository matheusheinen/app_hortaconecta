import { supabase } from './supabase';
import type { Publicacao } from './diario.types';
import { salvarDiarioComImagem, validarPublicacao } from './regrasDiario';
export const BUCKET_DIARIO = 'diario-imagens';
export async function listarDiario(): Promise<Publicacao[]> {
  const { data, error } = await supabase.rpc('diario_listar');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar as publicações.');
  return data as unknown as Publicacao[];
}
export async function detalheDiario(id: number): Promise<Publicacao> {
  const { data, error } = await supabase.rpc('diario_detalhe', { p_id: id });
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('Publicação não encontrada ou indisponível.');
  return data as unknown as Publicacao;
}
export async function salvarDiario(dados: {
  revisao?: number | null;
  id: number | null;
  titulo: string;
  texto: string;
  status: 'PUBLICADA' | 'OCULTA';
  imagem: string | null;
  base64: string | null;
}): Promise<number> {
  validarPublicacao(dados.titulo, dados.texto);
  return salvarDiarioComImagem(
    dados.base64,
    dados.imagem,
    async arquivo => {
      const { data: caminho, error: erroCaminho } = await supabase.rpc('diario_caminho', {
        p_ext: 'jpg',
      });
      if (erroCaminho) throw erroCaminho;
      if (!caminho) throw new Error('Não foi possível preparar o envio da imagem.');
      const { error } = await supabase.storage.from(BUCKET_DIARIO).upload(caminho, arquivo, {
        contentType: 'image/jpeg',
        upsert: false,
        cacheControl: '60',
      });
      if (error) throw new Error('Falha no envio da imagem: ' + error.message);
      return caminho;
    },
    async caminho => {
      const { data, error } = await supabase.rpc('diario_salvar_revisao', {
        p_revisao: dados.revisao ?? null,
        p_id: dados.id,
        p_titulo: dados.titulo.trim(),
        p_texto: dados.texto.trim(),
        p_status: dados.status,
        p_imagem: caminho,
      });
      if (error) throw error;
      if (data === null)
        throw new Error('Não foi possível confirmar o salvamento. Recarregue o Diário.');
      return data;
    },
  );
}
export async function statusDiario(id: number, status: 'PUBLICADA' | 'OCULTA', revisao: number) {
  const { error } = await supabase.rpc('diario_status_revisao', {
    p_id: id,
    p_status: status,
    p_revisao: revisao,
  });
  if (error) throw error;
}
/**
 * A publicação sai do banco primeiro; só então a imagem fica sem vínculo e o
 * Storage aceita apagá-la. Se a remoção do arquivo falhar, ele fica solto
 * (invisível à comunidade) sem desfazer a exclusão já confirmada.
 */
export async function excluirDiario(id: number, revisao: number) {
  const { data: caminho, error } = await supabase.rpc('diario_excluir_revisao', {
    p_id: id,
    p_revisao: revisao,
  });
  if (error) throw error;
  if (!caminho) return;
  try {
    await supabase.storage.from(BUCKET_DIARIO).remove([caminho]);
  } catch {
    /* arquivo fica sem vínculo */
  }
}
export async function urlImagemDiario(caminho: string) {
  const { data, error } = await supabase.storage.from(BUCKET_DIARIO).createSignedUrl(caminho, 60);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Imagem indisponível.');
  return data.signedUrl;
}
