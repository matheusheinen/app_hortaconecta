import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/servicos/supabase';

// Devolvem a resposta do Supabase ({ data, error }) sem lançar: quem chama
// passa por executarAuth, que aplica o tempo limite e lança o erro.

export function entrarComSenha(email: string, senha: string) {
  return supabase.auth.signInWithPassword({ email, password: senha });
}

export function criarConta(nome: string, email: string, senha: string) {
  return supabase.auth.signUp({ email, password: senha, options: { data: { nome } } });
}

export function entrarComoConvidado() {
  return supabase.auth.signInAnonymously();
}

export function enviarCodigoRecuperacao(email: string) {
  return supabase.auth.resetPasswordForEmail(email);
}

export function verificarCodigoRecuperacao(email: string, codigo: string) {
  return supabase.auth.verifyOtp({ email, token: codigo, type: 'recovery' });
}

export function definirNovaSenha(senha: string) {
  return supabase.auth.updateUser({ password: senha });
}

export function encerrarSessao() {
  return supabase.auth.signOut();
}

export function obterSessao() {
  return supabase.auth.getSession();
}

/** Avisa a cada mudança de sessão; devolve a função que cancela a escuta. */
export function observarSessao(aoMudar: (sessao: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => aoMudar(sessao));
  return () => data.subscription.unsubscribe();
}

export function carregarUsuario(id: string) {
  return supabase.from('usuarios').select('*').eq('id', id).single();
}
