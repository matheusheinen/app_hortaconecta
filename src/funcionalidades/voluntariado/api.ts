import { supabase } from '@/servicos/supabase';
import { validarResposta } from '@/compartilhado/esquemas';
import {
  esquemaCandidatos,
  esquemaDetalheAtividade,
  esquemaMinhasInscricoes,
  esquemaTokenCheckin,
} from './esquemas';
import type {
  AtividadeFormulario,
  Candidato,
  DetalheAtividade,
  MinhaInscricao,
  StatusAtividade,
  TokenCheckin,
} from './tipos';

// --- Atividades (gestão) ---

/** A visibilidade da listagem depende do RLS de atividades. */
export async function listarAtividades() {
  const { data, error } = await supabase
    .from('atividades')
    .select('*')
    .order('data_hora_prevista', { ascending: true });
  if (error) throw error;
  return data;
}

export async function listarHabilidades() {
  const { data, error } = await supabase
    .from('habilidades')
    .select('*')
    .order('categoria')
    .order('nome_habilidade');
  if (error) throw error;
  return data ?? [];
}

/**
 * Cria ou atualiza uma tarefa da ONG e devolve o id. O status não vem do
 * formulário: a tarefa nasce ABERTA, e o RLS confere autor_id contra o
 * usuário autenticado.
 */
export async function salvarAtividade(
  id: number | null,
  campos: AtividadeFormulario,
  autorId: string,
): Promise<number> {
  const { data, error } =
    id !== null
      ? await supabase.from('atividades').update(campos).eq('id', id).select('id').single()
      : await supabase
          .from('atividades')
          .insert({ ...campos, tipo: 'TAREFA_ONG', status: 'ABERTA', autor_id: autorId })
          .select('id')
          .single();
  if (error) throw error;
  if (!data) throw new Error('A atividade não foi salva. Recarregue e tente novamente.');
  return data.id;
}

export async function excluirAtividade(id: number): Promise<void> {
  const { data, error } = await supabase
    .from('atividades')
    .delete()
    .eq('id', id)
    .select('id')
    .single();
  if (error) throw error;
  if (!data) throw new Error('Nenhuma atividade foi removida. Recarregue a lista.');
}

export async function alterarStatusAtividade(
  id: number,
  status: Extract<StatusAtividade, 'ENCERRADA' | 'REALIZADA' | 'CANCELADA'>,
): Promise<void> {
  const { error } = await supabase.rpc('voluntariado_status_atividade', {
    p_atividade: id,
    p_status: status,
  });
  if (error) throw error;
}

export async function decidirCandidatura(
  inscricaoId: number,
  decisao: 'APROVADA' | 'RECUSADA',
  motivo: string,
): Promise<void> {
  const { error } = await supabase.rpc('voluntariado_decidir', {
    p_inscricao: inscricaoId,
    p_decisao: decisao,
    p_motivo: motivo,
  });
  if (error) throw error;
}

export async function gerarCheckin(id: number): Promise<TokenCheckin> {
  const { data, error } = await supabase.rpc('voluntariado_gerar_checkin', { p_atividade: id });
  if (error) throw error;
  return validarResposta(esquemaTokenCheckin, data, 'Resposta de check-in inválida.');
}

// --- Detalhe e candidaturas ---

export async function carregarDetalhe(id: number): Promise<DetalheAtividade> {
  const { data, error } = await supabase.rpc('voluntariado_detalhe', { p_atividade: id });
  if (error) throw error;
  return validarResposta(esquemaDetalheAtividade, data, 'Resposta de atividade inválida.');
}

export async function carregarCandidatos(id: number): Promise<Candidato[]> {
  const { data, error } = await supabase.rpc('voluntariado_candidatos', { p_atividade: id });
  if (error) throw error;
  return validarResposta(esquemaCandidatos, data, 'Resposta de candidaturas inválida.');
}

export async function carregarMinhasInscricoes(): Promise<MinhaInscricao[]> {
  const { data, error } = await supabase.rpc('voluntariado_minhas_inscricoes');
  if (error) throw error;
  return validarResposta(esquemaMinhasInscricoes, data, 'Resposta de candidaturas inválida.');
}

export async function candidatar(atividadeId: number): Promise<void> {
  const { error } = await supabase.rpc('voluntariado_candidatar', { p_atividade: atividadeId });
  if (error) throw error;
}

export async function cancelarCandidatura(inscricaoId: number): Promise<void> {
  const { error } = await supabase.rpc('voluntariado_cancelar', { p_inscricao: inscricaoId });
  if (error) throw error;
}

export async function confirmarCheckin(atividadeId: number, token: string): Promise<void> {
  const { error } = await supabase.rpc('voluntariado_checkin', {
    p_atividade: atividadeId,
    p_token: token,
  });
  if (error) throw error;
}
