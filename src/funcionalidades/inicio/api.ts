import { supabase } from '@/servicos/supabase';
import { carregarMinhasInscricoes } from '@/funcionalidades/voluntariado/api';
import { listarMetas } from '@/funcionalidades/metas/api';
import { listarDiario } from '@/funcionalidades/diario/api';
import type { AtividadeComVagas } from '@/funcionalidades/voluntariado/tipos';
import type { StatusValidacao } from '@/funcionalidades/metas/tipos';
import { montarResumoInicio, type ResumoInicio } from './regras';

/** Mantém a autorização das consultas existentes. Uma falha nunca vira contagem zero. */
export async function carregarResumoInicio(): Promise<ResumoInicio> {
  const agora = new Date();
  const [perfilCompleto, inscricoes, contribuicoes, atividades, metas, diario] = await Promise.all([
    carregarElegibilidade(),
    carregarMinhasInscricoes(),
    carregarMinhasContribuicoes(),
    carregarProximasAtividades(agora),
    listarMetas(),
    listarDiario(),
  ]);
  return montarResumoInicio(
    { perfilCompleto, inscricoes, contribuicoes, atividades, metas, diario },
    agora,
  );
}

async function carregarElegibilidade(): Promise<boolean> {
  const { data, error } = await supabase.rpc('voluntariado_elegibilidade');
  if (error) throw error;
  if (typeof data !== 'boolean') throw new Error('Não foi possível verificar seu cadastro.');
  return data;
}

/** A RLS de contribuicoes devolve ao voluntário apenas as próprias. */
async function carregarMinhasContribuicoes(): Promise<{ status_validacao: StatusValidacao }[]> {
  const { data, error } = await supabase.from('contribuicoes').select('status_validacao');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar suas contribuições.');
  return data;
}

async function carregarProximasAtividades(agora: Date): Promise<AtividadeComVagas[]> {
  const { data, error } = await supabase
    .from('atividades')
    .select('*')
    .eq('status', 'ABERTA')
    .gte('data_hora_prevista', agora.toISOString())
    .order('data_hora_prevista', { ascending: true });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar as próximas atividades.');
  return data;
}
