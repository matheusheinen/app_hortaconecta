import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { mensagemErro } from '@/compartilhado/utils/erros';
import {
  carregarCaminhoFoto,
  removerFotoPerfil,
  salvarFotoPerfil,
  urlFotoPerfil,
  type ResultadoFotoPerfil,
} from './apiFoto';
import { selecionarFotoPerfil } from './imagemFoto';

type Identidade = { usuarioId: string };
type Foto = { identidade: Identidade; caminho: string | null; url: string | null };
type Mensagem = { identidade: Identidade; texto: string | null };

export function useFotoPerfil() {
  const { usuarioId, convidado } = useSessaoAtual();
  const identidade = useMemo(() => ({ usuarioId }), [usuarioId]);
  const [foto, setFoto] = useState<Foto | null>(null);
  const [falha, setFalha] = useState<Mensagem | null>(null);
  const [recado, setRecado] = useState<Mensagem | null>(null);
  const [carga, setCarga] = useState<Identidade | null>(identidade);
  const [acao, setAcao] = useState<Identidade | null>(null);
  const montado = useRef(true);
  const identidadeAtual = useRef(identidade);
  const carregada = useRef<{ identidade: Identidade; caminho: string | null } | null>(null);
  const trava = useRef<{ identidade: Identidade } | null>(null);
  const sequencia = useRef(0);
  const urlAtual = useRef<string | null>(null);
  useLayoutEffect(() => {
    identidadeAtual.current = identidade;
    montado.current = true;
    return () => {
      montado.current = false;
      // Revisão de requisição, não uma ref de elemento; invalida a sessão antiga.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      sequencia.current++;
    };
  }, [identidade]);

  const vigente = useCallback(
    () => montado.current && identidadeAtual.current === identidade,
    [identidade],
  );
  const setErro = useCallback(
    (texto: string | null) => setFalha({ identidade, texto }),
    [identidade],
  );
  const setAviso = useCallback(
    (texto: string | null) => setRecado({ identidade, texto }),
    [identidade],
  );

  const mostrar = useCallback(
    async (caminho: string | null, conferir: () => boolean) => {
      if (!conferir()) return;
      carregada.current = { identidade, caminho };
      urlAtual.current = null;
      setFoto(anterior => ({
        identidade,
        caminho,
        url:
          anterior?.identidade === identidade && anterior.caminho === caminho ? anterior.url : null,
      }));
      const url = await urlFotoPerfil(caminho, usuarioId);
      if (!conferir()) return;
      urlAtual.current = url;
      setFoto({ identidade, caminho, url });
    },
    [identidade, usuarioId],
  );

  const recarregar = useCallback(async () => {
    if (!vigente() || trava.current?.identidade === identidade || convidado) return;
    const atual = ++sequencia.current;
    const conferir = () => vigente() && sequencia.current === atual;
    setCarga(identidade);
    setErro(null);
    try {
      const caminho = await carregarCaminhoFoto(usuarioId);
      await mostrar(caminho, conferir);
    } catch (falha) {
      if (conferir()) setErro(mensagemErro(falha));
    } finally {
      if (conferir()) setCarga(null);
    }
  }, [usuarioId, identidade, convidado, vigente, mostrar, setErro]);

  useFocusEffect(
    useCallback(() => {
      void recarregar();
      return () => {
        sequencia.current++;
      };
    }, [recarregar]),
  );

  async function executar(
    operacao: (anterior: string | null) => Promise<ResultadoFotoPerfil | null>,
    sucesso: string,
  ) {
    if (!vigente() || trava.current?.identidade === identidade) return;
    if (convidado || carregada.current?.identidade !== identidade) {
      setErro('Carregue seu perfil antes de alterar a foto.');
      return;
    }
    const estaAcao = { identidade };
    const anterior = carregada.current.caminho;
    trava.current = estaAcao;
    sequencia.current++;
    setCarga(null);
    setAcao(identidade);
    setErro(null);
    setAviso(null);
    try {
      const resultado = await operacao(anterior);
      if (!resultado || !vigente()) return;
      setAviso(resultado.aviso ?? sucesso);
      // A alteração já foi confirmada, mesmo se falhar apenas a prévia assinada.
      await mostrar(resultado.caminho, vigente);
    } catch (falha) {
      if (!vigente()) return;
      // Uma resposta perdida pode ocultar um salvamento concluído no servidor.
      try {
        const caminho = await carregarCaminhoFoto(usuarioId);
        await mostrar(caminho, vigente);
      } catch {
        // Conserva a última foto conhecida e oferece nova tentativa.
      }
      if (vigente()) setErro(mensagemErro(falha));
    } finally {
      if (trava.current === estaAcao) trava.current = null;
      if (vigente()) setAcao(null);
    }
  }

  function selecionar() {
    return executar(async anterior => {
      const base64 = await selecionarFotoPerfil();
      if (!base64 || !vigente()) return null;
      return salvarFotoPerfil(usuarioId, anterior, base64);
    }, 'Foto de perfil atualizada.');
  }

  function remover() {
    return executar(
      anterior => (anterior ? removerFotoPerfil(usuarioId, anterior) : Promise.resolve(null)),
      'Foto de perfil removida.',
    );
  }

  const imagemFalhou = useCallback(
    (url: string | null) => {
      if (vigente() && url && urlAtual.current === url) {
        setErro('Não foi possível mostrar sua foto. Tente carregar novamente.');
      }
    },
    [vigente, setErro],
  );

  const atual = foto?.identidade === identidade ? foto : null;
  return {
    fotoUrl: atual?.url ?? null,
    temFoto: !!atual?.caminho,
    carregando: carga === identidade,
    ocupado: acao === identidade,
    erro: falha?.identidade === identidade ? falha.texto : null,
    aviso: recado?.identidade === identidade ? recado.texto : null,
    selecionar,
    remover,
    recarregar,
    imagemFalhou,
  };
}
