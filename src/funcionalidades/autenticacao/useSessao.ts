import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import type { Usuario } from '@/compartilhado/tipos';
import { carregarUsuario, encerrarSessao, observarSessao, obterSessao } from './api';
import { executarAuth, erroAuth } from './operacaoAuth';
import { alternarModoGestor, gestorPodeAlternarModo } from '@/funcionalidades/modoGestor/api';

export function useSessao() {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);
  const [podeAlternarModo, setPodeAlternarModo] = useState(false);
  // Respostas de uma sessão anterior (troca de usuário, logout) são descartadas
  // comparando o usuário e a revisão do momento da chamada com os atuais.
  const usuarioAtual = useRef<string | null>(null);
  const revisaoSessao = useRef(0);
  const saindo = useRef(false);

  useEffect(() => {
    let ativo = true;
    let recebeuEvento = false;
    const aplicar = (s: Session | null) => {
      if (!ativo) return;
      const id = s?.user.id ?? null;
      if (usuarioAtual.current !== id) {
        revisaoSessao.current++;
        setPerfil(null);
        setErroPerfil(null);
        setCarregando(!!s);
      }
      usuarioAtual.current = id;
      setSessao(s);
      if (!s) {
        setPerfil(null);
        setCarregando(false);
      }
    };
    const pararEscuta = observarSessao(s => {
      recebeuEvento = true;
      aplicar(s);
    });
    void executarAuth(obterSessao, () => {})
      .then(({ data }) => {
        if (!recebeuEvento) aplicar(data.session);
      })
      .catch(f => {
        if (ativo && !recebeuEvento) {
          setErroPerfil(erroAuth(f));
          setCarregando(false);
        }
      });
    return () => {
      ativo = false;
      revisaoSessao.current++;
      pararEscuta();
    };
  }, []);
  const carregarPerfil = useCallback(async (userId: string) => {
    const versao = revisaoSessao.current;
    try {
      const { data } = await executarAuth(
        () => carregarUsuario(userId),
        () => {},
      );
      if (usuarioAtual.current !== userId || versao !== revisaoSessao.current) return;
      if (!data) throw new Error('Perfil não encontrado.');
      setPerfil(data);
      setErroPerfil(null);
    } catch (f) {
      if (usuarioAtual.current === userId && versao === revisaoSessao.current)
        setErroPerfil(erroAuth(f));
      throw f;
    }
  }, []);
  useEffect(() => {
    if (!sessao?.user) return;
    let ativo = true;
    // Reset intencional: a tela de carregamento cobre a troca de usuário.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true);
    void carregarPerfil(sessao.user.id)
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [sessao?.user?.id, carregarPerfil]);
  // O servidor decide quem é da gestão; vale também quando já está em modo voluntário.
  useEffect(() => {
    if (!perfil || sessao?.user.is_anonymous) {
      // Reset intencional: sem perfil (ou convidado) não há modo gestor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPodeAlternarModo(false);
      return;
    }
    let ativo = true;
    gestorPodeAlternarModo()
      .then(v => {
        if (ativo) setPodeAlternarModo(v);
      })
      .catch(() => {
        if (ativo) setPodeAlternarModo(false);
      });
    return () => {
      ativo = false;
    };
  }, [perfil?.id, perfil?.tipo_perfil, sessao?.user.is_anonymous]);
  async function alternarModo(gestor: boolean) {
    const id = sessao?.user?.id;
    if (!id) return;
    await alternarModoGestor(gestor);
    await carregarPerfil(id);
  }
  async function sair() {
    if (saindo.current) return;
    const versao = revisaoSessao.current;
    try {
      await executarAuth(encerrarSessao, v => {
        saindo.current = v;
      });
    } catch (f) {
      if (versao === revisaoSessao.current) Alert.alert('Não foi possível sair', erroAuth(f));
    }
  }
  return {
    sessao,
    perfil,
    carregando,
    erroPerfil,
    ehConvidado: !!sessao?.user.is_anonymous,
    ehGestao: perfil?.tipo_perfil === 'ONG',
    podeAlternarModo: podeAlternarModo || perfil?.tipo_perfil === 'ONG',
    alternarModo,
    sair,
    recarregarPerfil: (propagarErro = false) =>
      sessao?.user
        ? carregarPerfil(sessao.user.id).catch(f => {
            if (propagarErro) throw f;
          })
        : Promise.resolve(),
  };
}
