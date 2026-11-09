import { supabase } from '@/servicos/supabase';
import type {
  CanalNotificacao,
  CategoriaNotificacao,
  Notificacao,
  PreferenciaNotificacao,
} from './tipos';

export type PlataformaPush = 'ios' | 'android';

export async function registrarTokenPush(token: string, plataforma: PlataformaPush): Promise<void> {
  const { error } = await supabase.rpc('push_registrar_token', {
    p_token: token,
    p_plataforma: plataforma,
  });
  if (error) throw error;
}

export async function removerTokenPush(token: string): Promise<void> {
  const { error } = await supabase.rpc('push_remover_token', { p_token: token });
  if (error) throw error;
}

// --- Notificações dentro do app (tabela public.notificacoes) ---

/** A RLS devolve só as notificações do próprio usuário. */
export async function listarNotificacoes(limite = 50): Promise<Notificacao[]> {
  const { data, error } = await supabase
    .from('notificacoes')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(limite);
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar suas notificações.');
  return data as Notificacao[];
}

export async function contarNaoLidas(): Promise<number> {
  const { count, error } = await supabase
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .is('lida_em', null);
  if (error) throw error;
  return count ?? 0;
}

export async function marcarNotificacaoLida(id: number): Promise<void> {
  const { error } = await supabase.rpc('notificacoes_marcar_lida', { p_id: id });
  if (error) throw error;
}

export async function marcarTodasLidas(): Promise<void> {
  const { error } = await supabase.rpc('notificacoes_marcar_todas_lidas');
  if (error) throw error;
}

/** Recebe cada notificação nova do usuário em tempo real. Devolve a função que cancela. */
export function assinarNotificacoes(
  usuarioId: string,
  aoReceber: (notificacao: Notificacao) => void,
): () => void {
  const canal = supabase
    .channel(`notificacoes:${usuarioId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notificacoes',
        filter: `usuario_id=eq.${usuarioId}`,
      },
      carga => aoReceber(carga.new as Notificacao),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(canal);
  };
}

// --- Preferências por categoria e canal ---

/** Uma linha por categoria × canal ligado no servidor, já com o padrão aplicado. */
export async function listarPreferencias(): Promise<PreferenciaNotificacao[]> {
  const { data, error } = await supabase.rpc('notificacoes_preferencias');
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as PreferenciaNotificacao[];
}

export async function salvarPreferencia(
  categoria: CategoriaNotificacao,
  canal: CanalNotificacao,
  ativo: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('notificacoes_salvar_preferencia', {
    p_categoria: categoria,
    p_canal: canal,
    p_ativo: ativo,
  });
  if (error) throw error;
}
