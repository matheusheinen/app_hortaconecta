import { supabase } from '@/servicos/supabase';
import type { Candidato, DetalheAtividade, MinhaInscricao, TokenCheckin } from './tipos';

export async function carregarDetalhe(id: number): Promise<DetalheAtividade> {
  const { data, error } = await supabase.rpc('voluntariado_detalhe', { p_atividade: id });
  if (error) throw error;
  if (!data || typeof data !== 'object' || !('atividade' in data))
    throw new Error('Resposta de atividade inválida.');
  return data as unknown as DetalheAtividade;
}
export async function carregarCandidatos(id: number): Promise<Candidato[]> {
  const { data, error } = await supabase.rpc('voluntariado_candidatos', { p_atividade: id });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Resposta de candidaturas inválida.');
  return data as unknown as Candidato[];
}
export async function carregarMinhasInscricoes(): Promise<MinhaInscricao[]> {
  const { data, error } = await supabase.rpc('voluntariado_minhas_inscricoes');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Resposta de candidaturas inválida.');
  return data as unknown as MinhaInscricao[];
}
export async function gerarCheckin(id: number): Promise<TokenCheckin> {
  const { data, error } = await supabase.rpc('voluntariado_gerar_checkin', { p_atividade: id });
  if (error) throw error;
  if (!data || typeof data !== 'object' || !('token' in data))
    throw new Error('Resposta de check-in inválida.');
  return data as unknown as TokenCheckin;
}
