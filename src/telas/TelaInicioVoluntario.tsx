import React from 'react';
import { PainelInicioVoluntario, type AcoesInicio } from '../componentes/PainelInicioVoluntario';
import { useDadosVoluntariado } from '../lib/useDadosVoluntariado';
import { carregarResumoInicio } from '../lib/resumoInicio';

export function TelaInicioVoluntario(props: AcoesInicio) {
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(carregarResumoInicio);
  return <PainelInicioVoluntario {...props} resumo={dados} erro={erro} carregando={carregando} atualizar={() => { void carregar(); }} />;
}
