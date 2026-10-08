import { supabase } from '@/servicos/supabase';

/** Alterna o tipo de perfil da gestão entre ONG e voluntário (RPC com checagem no servidor). */
export async function alternarModoGestor(gestor: boolean): Promise<void> {
  const { error } = await supabase.rpc('gestor_alternar_modo', { p_gestor: gestor });
  if (error) throw error;
}

export async function gestorPodeAlternarModo(): Promise<boolean> {
  const { data, error } = await supabase.rpc('gestor_pode_alternar_modo');
  if (error) throw error;
  return data === true;
}
