import { supabase } from '@/servicos/supabase';
import type { Candidato, DetalheAtividade, MinhaInscricao, TokenCheckin } from './tipos';

export function mensagemErro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'message' in erro) {
    const mensagem = String(erro.message);
    const codigo = 'code' in erro ? String(erro.code) : '';
    if (codigo === '23505')
      return mensagem.includes('cpf')
        ? 'Este CPF já está cadastrado.'
        : 'Este registro já existe. Recarregue a tela.';
    if (codigo === '42501') return 'Sua conta não tem permissão para esta operação.';
    if (codigo === '23514') return 'Os dados não atendem às regras do cadastro. Confira os campos.';
    if (codigo === '23503')
      return 'Um dos registros relacionados não está disponível. Recarregue a tela.';
    if (codigo === 'PGRST116') return 'Registro não encontrado ou indisponível para sua conta.';
    if (codigo === '40001' || codigo === '40P01')
      return 'Os dados foram alterados por outra operação. Atualize e tente novamente.';
    if (/failed to fetch|network request failed|networkerror/i.test(mensagem))
      return 'Não foi possível acessar o servidor. Verifique sua conexão.';
    if (mensagem.includes('schema cache') || mensagem.includes('does not exist')) {
      return 'O servidor precisa das migrations desta funcionalidade. Avise a gestão.';
    }
    return mensagem;
  }
  return 'Não foi possível concluir. Verifique sua conexão e tente novamente.';
}

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
