import { supabase } from '@/servicos/supabase';
import type { Certificado, ListaCertificados } from './tipos';
export async function listarCertificados(): Promise<ListaCertificados> {
  const { data, error } = await supabase.rpc('certificados_listar');
  if (error) throw error;
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    !Array.isArray(data.emitidos) ||
    !Array.isArray(data.disponiveis)
  )
    throw new Error('Resposta de certificados inválida.');
  return data as unknown as ListaCertificados;
}
export async function detalheCertificado(id: string): Promise<Certificado> {
  const { data, error } = await supabase.rpc('certificados_detalhe', { p_id: id });
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.id !== 'string')
    throw new Error('Certificado indisponível.');
  return data as unknown as Certificado;
}
export async function emitirCertificado(id: number) {
  const { data, error } = await supabase.rpc('certificados_emitir', { p_participacao: id });
  if (error) throw error;
  if (!data) throw new Error('Não foi possível emitir o certificado.');
  return data;
}
