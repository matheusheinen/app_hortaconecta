import type { Enums, Tables } from '@/servicos/database.types';

// Tipos usados por mais de uma funcionalidade. Os de um só domínio ficam em
// src/funcionalidades/<dominio>/tipos.ts.

export type TipoPerfil = Enums<'tipo_perfil'>;

export type Usuario = Tables<'usuarios'>;

export type Habilidade = Tables<'habilidades'>;

export type DiaSemana = 'dom' | 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab';

export type PeriodoDia = 'manha' | 'tarde' | 'noite';

/** Formato livre guardado em `voluntarios.disponibilidade_horarios` (jsonb). */
export type SlotDisponibilidade = { dia: DiaSemana; periodo: PeriodoDia };

export const DIAS_SEMANA: { codigo: DiaSemana; rotulo: string }[] = [
  { codigo: 'dom', rotulo: 'Dom' },
  { codigo: 'seg', rotulo: 'Seg' },
  { codigo: 'ter', rotulo: 'Ter' },
  { codigo: 'qua', rotulo: 'Qua' },
  { codigo: 'qui', rotulo: 'Qui' },
  { codigo: 'sex', rotulo: 'Sex' },
  { codigo: 'sab', rotulo: 'Sáb' },
];

export const PERIODOS_DIA: { codigo: PeriodoDia; rotulo: string }[] = [
  { codigo: 'manha', rotulo: 'Manhã' },
  { codigo: 'tarde', rotulo: 'Tarde' },
  { codigo: 'noite', rotulo: 'Noite' },
];
