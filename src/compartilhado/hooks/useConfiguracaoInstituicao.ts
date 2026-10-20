import { useEffect, useState } from 'react';
import { carregarConfiguracaoInstituicao, type ConfiguracaoInstituicao } from '../api';

/**
 * Nome, cores e contatos da instituição vêm daqui, e não fixos no código
 * (DOCUMENTACAO.md > RNF0008, Parametrização e Extensibilidade).
 */
export function useConfiguracaoInstituicao() {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoInstituicao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    carregarConfiguracaoInstituicao()
      .catch((falha: { message?: string }) => {
        console.warn('Falha ao carregar configuração da instituição:', falha?.message);
        return null;
      })
      .then(dados => {
        if (!ativo) return;
        setConfiguracao(dados);
        setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  return { configuracao, carregando };
}
