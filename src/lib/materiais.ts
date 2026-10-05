import { supabase } from './supabase';
import type { DetalheMaterial, MinhaContribuicao, SolicitacaoMaterial } from './materiais.types';

export async function listarMateriais(): Promise<SolicitacaoMaterial[]> {
  const { data, error } = await supabase.rpc('materiais_listar');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar os materiais.');
  return data as unknown as SolicitacaoMaterial[];
}
export async function detalheMaterial(id: number): Promise<DetalheMaterial> {
  const { data, error } = await supabase.rpc('materiais_detalhe', { p_solicitacao: id });
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data) || !data.solicitacao || !Array.isArray(data.contribuicoes)) {
    throw new Error('Solicitação não encontrada ou indisponível para sua conta.');
  }
  return data as unknown as DetalheMaterial;
}
export async function minhasContribuicoes(): Promise<MinhaContribuicao[]> {
  const { data, error } = await supabase.rpc('materiais_minhas');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar suas contribuições.');
  return data as unknown as MinhaContribuicao[];
}
