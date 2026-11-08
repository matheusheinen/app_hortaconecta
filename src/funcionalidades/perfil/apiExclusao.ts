import { supabase } from '@/servicos/supabase';

/** Data em que o usuário pediu a exclusão dos dados (RNF0004), ou null. */
export async function carregarSolicitacaoExclusao(usuarioId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('exclusao_solicitada_em')
    .eq('id', usuarioId)
    .single();
  if (error) throw error;
  return data.exclusao_solicitada_em;
}

/**
 * Só registra o pedido em `usuarios.exclusao_solicitada_em`; a remoção dos
 * dados é feita pela gestão, que guarda o que a lei exige manter.
 */
export async function solicitarExclusaoConta(): Promise<void> {
  const { error } = await supabase.rpc('solicitar_exclusao_conta');
  if (error) throw error;
}
