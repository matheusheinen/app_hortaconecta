import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { listarDiarioPagina } from './api';
import { juntarPaginas } from './paginas';
import type { Publicacao } from './tipos';

/**
 * Feed paginado do Diário (RF0013): carrega a primeira página ao focar a tela
 * e as seguintes em "Carregar mais". Respostas de uma carga anterior são
 * ignoradas, como em useConsulta.
 */
export function usePaginasDiario() {
  const [itens, setItens] = useState<Publicacao[] | null>(null);
  const [temMais, setTemMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const sequencia = useRef(0);
  const ocupado = useRef(false);

  const carregar = useCallback(async () => {
    const atual = ++sequencia.current;
    setCarregando(true);
    setErro(null);
    try {
      const pagina = await listarDiarioPagina(null);
      if (atual !== sequencia.current) return;
      setItens(pagina.itens);
      setTemMais(pagina.temMais);
    } catch (falha) {
      if (atual !== sequencia.current) return;
      setItens(null);
      setErro(mensagemErro(falha));
    } finally {
      if (atual === sequencia.current) setCarregando(false);
    }
  }, []);

  const carregarMais = useCallback(async () => {
    const ultimo = itens?.at(-1);
    if (!ultimo || ocupado.current) return;
    const atual = sequencia.current;
    ocupado.current = true;
    setCarregandoMais(true);
    setErro(null);
    try {
      const pagina = await listarDiarioPagina({ data: ultimo.data_publicacao, id: ultimo.id });
      if (atual !== sequencia.current) return;
      setItens(anteriores => juntarPaginas(anteriores ?? [], pagina.itens));
      setTemMais(pagina.temMais);
    } catch (falha) {
      if (atual === sequencia.current) setErro(mensagemErro(falha));
    } finally {
      ocupado.current = false;
      setCarregandoMais(false);
    }
  }, [itens]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
      return () => {
        sequencia.current++;
      };
    }, [carregar]),
  );

  return { itens, temMais, erro, carregando, carregandoMais, carregar, carregarMais };
}
