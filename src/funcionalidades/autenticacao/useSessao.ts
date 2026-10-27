import { useCallback, useEffect, useRef, useState } from 'react';
import { avisar } from '@/compartilhado/utils/confirmar';
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
      // De propósito: invalida a revisão atual (não é ref de elemento), descartando respostas pendentes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const usuarioId = sessao?.user?.id;
  useEffect(() => {
    if (!usuarioId) return;
    let ativo = true;
    // Reset intencional: a tela de carregamento cobre a troca de usuário.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true);
    void carregarPerfil(usuarioId)
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [usuarioId, carregarPerfil]);
  // O servidor decide quem é da gestão; vale também quando já está em modo voluntário.
  // Repete ao trocar de perfil ou de modo (tipo_perfil), não a cada novo objeto de perfil.
  const perfilId = perfil?.id;
  const tipoPerfil = perfil?.tipo_perfil;
  const convidado = !!sessao?.user.is_anonymous;
  useEffect(() => {
    if (!perfilId || !tipoPerfil || convidado) {
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
  }, [perfilId, tipoPerfil, convidado]);
  // Funções estáveis: entram no contexto de sessão, que não deve mudar a cada render.
  const alternarModo = useCallback(
    async (gestor: boolean) => {
      if (!usuarioId) return;
      await alternarModoGestor(gestor);
      await carregarPerfil(usuarioId);
    },
    [usuarioId, carregarPerfil],
  );
  const sair = useCallback(async () => {
    if (saindo.current) return;
    const versao = revisaoSessao.current;
    try {
      await executarAuth(encerrarSessao, v => {
        saindo.current = v;
      });
    } catch (f) {
      if (versao === revisaoSessao.current) avisar('Não foi possível sair', erroAuth(f));
    }
  }, []);
  const recarregarPerfil = useCallback(
    (propagarErro = false) =>
      usuarioId
        ? carregarPerfil(usuarioId).catch(f => {
            if (propagarErro) throw f;
          })
        : Promise.resolve(),
    [usuarioId, carregarPerfil],
  );
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
    recarregarPerfil,
  };
}
