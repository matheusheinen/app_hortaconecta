import { supabase } from '@/servicos/supabase';
import type { Json } from '@/servicos/database.types';
export async function salvarPerfilGestao(cargaValida: boolean, dados: Json) {
  if (!cargaValida) throw new Error('Recarregue o perfil antes de salvar.');
  const { data, error } = await supabase.rpc('gestao_salvar_perfil', { p_dados: dados });
  if (error) throw error;
  if (data !== true) throw new Error('O servidor não confirmou o salvamento do perfil.');
}
