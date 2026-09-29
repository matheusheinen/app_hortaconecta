import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { mensagemErro } from './voluntariado';

/** Reconsulta ao voltar à tela e ignora respostas de requisições anteriores. */
export function useDadosVoluntariado<T>(consulta: () => Promise<T>) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const sequencia = useRef(0);
  const carregar = useCallback(async () => {
    const atual = ++sequencia.current;
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await consulta();
      if (atual === sequencia.current) setDados(resultado);
    } catch (falha) {
      if (atual === sequencia.current) {
        setDados(null);
        setErro(mensagemErro(falha));
      }
    } finally {
      if (atual === sequencia.current) setCarregando(false);
    }
  }, [consulta]);
  useFocusEffect(
    useCallback(() => {
      void carregar();
      return () => {
        sequencia.current++;
      };
    }, [carregar]),
  );
  return { dados, erro, carregando, carregar };
}
