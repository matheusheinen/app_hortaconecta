import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Usuario } from '../lib/tipos';

/**
 * Mantém a sessão do Supabase Auth e o perfil correspondente na tabela
 * `usuarios`. O perfil é criado por trigger no banco no momento do
 * cadastro, então aqui só lemos.
 */
export function useSessao() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      if (!data.session) setCarregando(false);
    });

    const { data: escuta } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao);
      if (!novaSessao) {
        setPerfil(null);
        setCarregando(false);
      }
    });

    return () => escuta.subscription.unsubscribe();
  }, []);

  const carregarPerfil = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) console.warn('Falha ao carregar perfil:', error.message);
    setPerfil(data ?? null);
  }, []);

  useEffect(() => {
    if (!sessao?.user) return;

    let ativo = true;
    setCarregando(true);

    carregarPerfil(sessao.user.id).then(() => {
      if (ativo) setCarregando(false);
    });

    return () => {
      ativo = false;
    };
  }, [sessao?.user?.id, carregarPerfil]);

  return {
    sessao,
    perfil,
    carregando,
    ehGestao: perfil?.tipo_perfil === 'ONG',
    sair: () => supabase.auth.signOut(),
    // Chamado depois de salvar a tela de Perfil, pra refletir mudanças de
    // nome/etc. no resto do app sem precisar deslogar e logar de novo.
    recarregarPerfil: () => (sessao?.user ? carregarPerfil(sessao.user.id) : Promise.resolve()),
  };
}
