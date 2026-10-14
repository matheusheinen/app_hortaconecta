import React, { useCallback } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { memoTela } from '@/compartilhado/componentes/memoTela';
import { PainelInicioVoluntario, type AcoesInicio } from '../componentes/PainelInicioVoluntario';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { carregarResumoInicio } from '../api';
import { carregarSugestoes } from '@/funcionalidades/voluntariado/areasAtividade';

export const TelaInicioVoluntario = memoTela(function TelaInicioVoluntario(props: AcoesInicio) {
  const { usuarioId, nome } = useSessaoAtual();
  const { dados, erro, carregando, carregar } = useConsulta(carregarResumoInicio);
  // Sugestões são complementares: uma falha só esconde a seção, sem erro no Início.
  const consultaSugestoes = useCallback(() => carregarSugestoes(usuarioId), [usuarioId]);
  const sugestoes = useConsulta(consultaSugestoes);
  return (
    <PainelInicioVoluntario
      {...props}
      nome={nome}
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
});
