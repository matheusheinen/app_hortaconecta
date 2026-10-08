import { supabase } from './supabase';
import type { PropostaOficina } from './oficinas.types';
import { validarOficina, type CamposOficina } from './regrasOficinas';
export async function listarOficinas(): Promise<PropostaOficina[]> {
  const { data, error } = await supabase.rpc('oficinas_listar');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar as propostas.');
  return data as unknown as PropostaOficina[];
}
export async function detalheOficina(id: number): Promise<PropostaOficina> {
  const { data, error } = await supabase.rpc('oficinas_detalhe', { p_id: id });
  if (error) throw error;
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('Proposta indisponível.');
  return data as unknown as PropostaOficina;
}
export async function salvarOficina(p: PropostaOficina | null, campos: CamposOficina) {
  const duracao = validarOficina(campos);
  const { data, error } = await supabase.rpc('oficinas_salvar', {
    p_id: p?.id ?? null,
    p_revisao: p?.revisao ?? null,
    p_titulo: campos.titulo.trim(),
    p_descricao: campos.descricao.trim(),
    p_tema: campos.tema.trim(),
    p_objetivo: campos.objetivo.trim(),
    p_duracao: duracao,
    p_conhecimentos: campos.conhecimentos.trim() || null,
    p_observacoes: campos.observacoes.trim() || null,
  });
  if (error) throw error;
  if (data === null)
    throw new Error('Não foi possível confirmar o envio. Recarregue suas propostas.');
  return data;
}
export async function cancelarOficina(p: PropostaOficina) {
  const { error } = await supabase.rpc('oficinas_cancelar', { p_id: p.id, p_revisao: p.revisao });
  if (error) throw error;
}
export async function decidirOficina(
  p: PropostaOficina,
  status: 'APROVADA' | 'REJEITADA',
  nota: string,
) {
  if (status === 'REJEITADA' && !nota.trim())
    throw new Error('Informe a justificativa da rejeição.');
  if (nota.trim().length > 2000) throw new Error('A observação pode ter até 2.000 caracteres.');
  const { error } = await supabase.rpc('oficinas_decidir', {
    p_id: p.id,
    p_revisao: p.revisao,
    p_status: status,
    p_observacao: nota.trim() || null,
  });
  if (error) throw error;
}
