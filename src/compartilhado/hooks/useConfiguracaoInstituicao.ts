import { useEffect, useState } from 'react';
import { supabase } from '@/servicos/supabase';
import type { Tables } from '@/servicos/database.types';

type ConfiguracaoInstituicao = Tables<'configuracao_instituicao'>;

/**
 * Registro único de `configuracao_instituicao`. Nome, cores e contatos da
 * instituição vêm daqui — ver CLAUDE.md > RNF0005 (não fixar no código).
 */
export function useConfiguracaoInstituicao() {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoInstituicao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    supabase
      .from('configuracao_instituicao')
      .select('*')
      .single()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) console.warn('Falha ao carregar configuração da instituição:', error.message);
        setConfiguracao(data ?? null);
        setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  return { configuracao, carregando };
}
