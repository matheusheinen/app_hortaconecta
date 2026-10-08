import React, { useCallback } from 'react';
import { PainelInicioVoluntario, type AcoesInicio } from '../componentes/PainelInicioVoluntario';
import { useDadosVoluntariado } from '@/compartilhado/hooks/useConsulta';
import { carregarResumoInicio } from '../resumo';
import { carregarSugestoes } from '@/funcionalidades/voluntariado/areasAtividade';

export function TelaInicioVoluntario({ usuarioId, ...props }: AcoesInicio & { usuarioId: string }) {
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(carregarResumoInicio);
  // Sugestões são complementares: uma falha só esconde a seção, sem erro no Início.
  const consultaSugestoes = useCallback(() => carregarSugestoes(usuarioId), [usuarioId]);
  const sugestoes = useDadosVoluntariado(consultaSugestoes);
  return (
    <PainelInicioVoluntario
      {...props}
      resumo={dados}
      sugestoes={sugestoes.dados ?? []}
      erro={erro}
      carregando={carregando}
      atualizar={() => {
        void carregar();
        void sugestoes.carregar();
      }}
    />
  );
}
