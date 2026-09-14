import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Tables } from './database.types';

type Ong = Tables<'ongs'>;

/**
 * MVP tem uma só ONG, então lemos a primeira linha de `ongs`. A linha só
 * existe depois que a gestão preenche o próprio perfil (aba Perfil, ainda
 * não implementada) — até lá isso devolve null e as telas tratam esse caso.
 */
export function useOng() {
  const [ong, setOng] = useState<Ong | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    supabase
      .from('ongs')
      .select('*')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) console.warn('Falha ao carregar dados da ONG:', error.message);
        setOng(data ?? null);
        setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  return { ong, carregando };
}
