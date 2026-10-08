import { useRef, useState } from 'react';
import { mensagemErro } from '../utils/erros';

/**
 * Executa uma ação assíncrona por vez (ex.: salvar, excluir). Ignora toques
 * repetidos enquanto a anterior não termina e guarda a mensagem de erro.
 */

export function useAcao() {
  const trava = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function executar(acao: () => Promise<void>) {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (falha) {
      setErro(mensagemErro(falha));
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  return { ocupado, erro, executar, limpar: () => setErro(null) };
}
