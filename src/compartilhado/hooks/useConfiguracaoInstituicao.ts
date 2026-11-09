import { useEffect, useState } from 'react';
import { carregarConfiguracaoInstituicao, type ConfiguracaoInstituicao } from '../api';

const ouvintes = new Set<() => void>();

/**
 * Avisa as telas abertas que a gestão alterou a configuração (B28), para que
 * nome e logotipo novos apareçam sem reiniciar o app.
 */
export function avisarConfiguracaoAlterada() {
  ouvintes.forEach(recarregar => recarregar());
}

/**
 * Nome, cores e contatos da instituição vêm daqui, e não fixos no código
 * (DOCUMENTACAO.md > RNF0008, Parametrização e Extensibilidade).
 */
export function useConfiguracaoInstituicao() {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoInstituicao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    function carregar() {
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
    }

    carregar();
    ouvintes.add(carregar);
    return () => {
      ativo = false;
      ouvintes.delete(carregar);
    };
  }, []);

  return { configuracao, carregando };
}
