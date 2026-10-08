import { supabase } from '@/servicos/supabase';
import { carregarMinhasInscricoes } from '@/funcionalidades/voluntariado/api';
import { listarMetas } from '@/funcionalidades/metas/api';
import { listarDiario } from '@/funcionalidades/diario/api';
import type { Atividade, MinhaInscricao } from '@/funcionalidades/voluntariado/tipos';
import type { Meta, StatusValidacao } from '@/funcionalidades/metas/tipos';
import type { Publicacao } from '@/funcionalidades/diario/tipos';

export type AtividadeInicio = Atividade & { vagas_ocupadas: number };
export type ResumoInicio = {
  perfilCompleto: boolean;
  /** Carga prevista registrada no check-in; não mede tempo efetivamente trabalhado. */
  horasRegistradas: number;
  atividadesParticipadas: number;
  contribuicoesConfirmadas: number;
  destaques: { atividade: Atividade; vagasDisponiveis: number }[];
  /** Meta aberta mais recente ainda não atingida e dentro do prazo. */
  meta: Meta | null;
  publicacao: Publicacao | null;
};

type DadosInicio = {
  perfilCompleto: boolean;
  inscricoes: MinhaInscricao[];
  contribuicoes: { status_validacao: StatusValidacao }[];
  atividades: AtividadeInicio[];
  metas: Meta[];
  diario: Publicacao[];
};

/** Agrega somente confirmações reais, sem substituir snapshots antigos pela carga atual. */
export function montarResumoInicio(dados: DadosInicio, agora = new Date()): ResumoInicio {
  const presencas = dados.inscricoes.filter(({ inscricao }) => inscricao.presenca_confirmada);
  const horasRegistradas = presencas.reduce((total, { inscricao }) => {
    const carga = inscricao.carga_horaria_registrada;
    const checkin = inscricao.checkin_em ? Date.parse(inscricao.checkin_em) : NaN;
    return carga !== null && Number.isFinite(carga) && carga > 0 && checkin <= agora.getTime()
      ? total + carga
      : total;
  }, 0);
  const destaques = dados.atividades
    .filter(
      atividade =>
        atividade.status === 'ABERTA' &&
        Date.parse(atividade.data_hora_prevista) >= agora.getTime() &&
        atividade.vagas_totais > atividade.vagas_ocupadas,
    )
    .sort(
      (a, b) => Date.parse(a.data_hora_prevista) - Date.parse(b.data_hora_prevista) || a.id - b.id,
    )
    .slice(0, 2)
    .map(atividade => ({
      atividade,
      // O banco mantém vagas_ocupadas como o total de candidaturas aprovadas.
      vagasDisponiveis: Math.max(0, atividade.vagas_totais - atividade.vagas_ocupadas),
    }));
  const p = (n: number) => String(n).padStart(2, '0');
  const hoje = `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
  const meta =
    dados.metas
      .filter(
        item =>
          item.status === 'ABERTA' &&
          item.quantidade_meta > item.quantidade_arrecadada &&
          (item.data_limite === null || item.data_limite >= hoje),
      )
      .sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em) || b.id - a.id)[0] ?? null;
  const publicacao =
    dados.diario
      .filter(item => item.status === 'PUBLICADA')
      .sort(
        (a, b) => Date.parse(b.data_publicacao) - Date.parse(a.data_publicacao) || b.id - a.id,
      )[0] ?? null;
  return {
    perfilCompleto: dados.perfilCompleto,
    horasRegistradas,
    atividadesParticipadas: presencas.length,
    contribuicoesConfirmadas: dados.contribuicoes.filter(c => c.status_validacao === 'APROVADA')
      .length,
    destaques,
    meta,
    publicacao,
  };
}

/** Mantém a autorização das consultas existentes. Uma falha nunca vira contagem zero. */
export async function carregarResumoInicio(): Promise<ResumoInicio> {
  const agora = new Date();
  const [perfilCompleto, inscricoes, contribuicoes, atividades, metas, diario] = await Promise.all([
    carregarElegibilidade(),
    carregarMinhasInscricoes(),
    carregarMinhasContribuicoes(),
    carregarProximasAtividades(agora),
    listarMetas(),
    listarDiario(),
  ]);
  return montarResumoInicio(
    { perfilCompleto, inscricoes, contribuicoes, atividades, metas, diario },
    agora,
  );
}

async function carregarElegibilidade(): Promise<boolean> {
  const { data, error } = await supabase.rpc('voluntariado_elegibilidade');
  if (error) throw error;
  if (typeof data !== 'boolean') throw new Error('Não foi possível verificar seu cadastro.');
  return data;
}

/** A RLS de contribuicoes devolve ao voluntário apenas as próprias. */
async function carregarMinhasContribuicoes(): Promise<{ status_validacao: StatusValidacao }[]> {
  const { data, error } = await supabase.from('contribuicoes').select('status_validacao');
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar suas contribuições.');
  return data;
}

async function carregarProximasAtividades(agora: Date): Promise<AtividadeInicio[]> {
  const { data, error } = await supabase
    .from('atividades')
    .select('*')
    .eq('status', 'ABERTA')
    .gte('data_hora_prevista', agora.toISOString())
    .order('data_hora_prevista', { ascending: true });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar as próximas atividades.');
  return data;
}

export function formatarHorasInicio(horas: number): string {
  return `${horas.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}h`;
}

export function progressoMetaInicio(
  meta: Pick<Meta, 'quantidade_meta' | 'quantidade_arrecadada'>,
): number {
  if (!(meta.quantidade_meta > 0)) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((meta.quantidade_arrecadada / meta.quantidade_meta) * 100)),
  );
}
