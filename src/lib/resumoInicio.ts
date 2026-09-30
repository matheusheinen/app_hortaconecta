import { supabase } from './supabase';
import { carregarMinhasInscricoes } from './voluntariado';
import { listarMateriais, minhasContribuicoes } from './materiais';
import { listarDiario } from './diario';
import type { Atividade } from './tipos';
import type { MinhaInscricao } from './voluntariado.types';
import type { MinhaContribuicao, SolicitacaoMaterial } from './materiais.types';
import type { Publicacao } from './diario.types';

export type AtividadeInicio = Atividade & { vagas_ocupadas: number };
export type ResumoInicio = {
  perfilCompleto: boolean;
  /** Carga prevista registrada no check-in; não mede tempo efetivamente trabalhado. */
  horasRegistradas: number;
  atividadesParticipadas: number;
  contribuicoesConfirmadas: number;
  destaques: { atividade: Atividade; vagasDisponiveis: number }[];
  material: SolicitacaoMaterial | null;
  publicacao: Publicacao | null;
};

type DadosInicio = {
  perfilCompleto: boolean;
  inscricoes: MinhaInscricao[];
  contribuicoes: MinhaContribuicao[];
  atividades: AtividadeInicio[];
  materiais: SolicitacaoMaterial[];
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
    .filter(atividade => atividade.status === 'ABERTA'
      && Date.parse(atividade.data_hora_prevista) >= agora.getTime()
      && atividade.vagas_totais > atividade.vagas_ocupadas)
    .sort((a, b) => Date.parse(a.data_hora_prevista) - Date.parse(b.data_hora_prevista) || a.id - b.id)
    .slice(0, 2)
    .map(atividade => ({
      atividade,
      // O banco mantém vagas_ocupadas como o total de candidaturas aprovadas.
      vagasDisponiveis: Math.max(0, atividade.vagas_totais - atividade.vagas_ocupadas),
    }));
  const material = dados.materiais
    .filter(item => (item.status === 'ABERTA' || item.status === 'EM_ANDAMENTO')
      && item.quantidade_necessaria > item.quantidade_recebida)
    .sort((a, b) => Date.parse(b.criado_em) - Date.parse(a.criado_em) || b.id - a.id)[0] ?? null;
  const publicacao = dados.diario
    .filter(item => item.status === 'PUBLICADA')
    .sort((a, b) => Date.parse(b.data_publicacao) - Date.parse(a.data_publicacao) || b.id - a.id)[0] ?? null;
  return {
    perfilCompleto: dados.perfilCompleto,
    horasRegistradas,
    atividadesParticipadas: presencas.length,
    contribuicoesConfirmadas: dados.contribuicoes.filter(({ contribuicao }) => contribuicao.status === 'CONFIRMADA').length,
    destaques,
    material,
    publicacao,
  };
}

/** Mantém a autorização das consultas existentes. Uma falha nunca vira contagem zero. */
export async function carregarResumoInicio(): Promise<ResumoInicio> {
  const agora = new Date();
  const [perfilCompleto, inscricoes, contribuicoes, atividades, materiais, diario] = await Promise.all([
    carregarElegibilidade(),
    carregarMinhasInscricoes(),
    minhasContribuicoes(),
    carregarProximasAtividades(agora),
    listarMateriais(),
    listarDiario(),
  ]);
  return montarResumoInicio({ perfilCompleto, inscricoes, contribuicoes, atividades, materiais, diario }, agora);
}

async function carregarElegibilidade(): Promise<boolean> {
  const { data, error } = await supabase.rpc('voluntariado_elegibilidade');
  if (error) throw error;
  if (typeof data !== 'boolean') throw new Error('Não foi possível verificar seu cadastro.');
  return data;
}

async function carregarProximasAtividades(agora: Date): Promise<AtividadeInicio[]> {
  const { data, error } = await supabase.from('atividades').select('*')
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

export function progressoMaterialInicio(material: SolicitacaoMaterial): number {
  if (material.quantidade_necessaria <= 0) return 0;
  return Math.min(100, Math.max(0,
    Math.round(material.quantidade_recebida / material.quantidade_necessaria * 100),
  ));
}
