import { supabase } from '@/servicos/supabase';
import { validarResposta } from '@/compartilhado/esquemas';
import type { Certificado, ListaCertificados } from './tipos';
import { esquemaCertificado, esquemaListaCertificados } from './esquemas';
export async function listarCertificados(): Promise<ListaCertificados> {
  const { data, error } = await supabase.rpc('certificados_listar');
  if (error) throw error;
  return validarResposta(esquemaListaCertificados, data, 'Resposta de certificados inválida.');
}
export async function detalheCertificado(id: string): Promise<Certificado> {
  const { data, error } = await supabase.rpc('certificados_detalhe', { p_id: id });
  if (error) throw error;
  return validarResposta(esquemaCertificado, data, 'Certificado indisponível.');
}
export async function emitirCertificado(id: number) {
  const { data, error } = await supabase.rpc('certificados_emitir', { p_participacao: id });
  if (error) throw error;
  if (!data) throw new Error('Não foi possível emitir o certificado.');
  return data;
}
