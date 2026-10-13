import { supabase } from '@/servicos/supabase';
import type { Tables } from '@/servicos/database.types';

export type ConfiguracaoInstituicao = Tables<'configuracao_instituicao'>;

/** Registro único de `configuracao_instituicao`. */
export async function carregarConfiguracaoInstituicao(): Promise<ConfiguracaoInstituicao | null> {
  const { data, error } = await supabase.from('configuracao_instituicao').select('*').single();
  if (error) throw error;
  return data;
}
