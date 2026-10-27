/**
 * Regras puras das metas e contribuições, sem React nem Supabase.
 * O total arrecadado é calculado pelo banco (trigger atualizar_arrecadacao_meta),
 * somando só contribuições APROVADA; aqui apenas se exibe e se valida a entrada.
 */
import { hojeIso, interpretarData } from '@/compartilhado/utils/datas';
import type { MetaFormulario, StatusValidacao } from './tipos';

type MetaBase = {
  tipo: 'FINANCEIRA' | 'MATERIAL';
  unidade_medida: string | null;
  quantidade_meta: number;
  quantidade_arrecadada: number;
  data_limite: string | null;
  status: 'ABERTA' | 'ENCERRADA' | 'CANCELADA';
};

const reais = (valor: number) =>
  valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** "R$ 12,50" para meta financeira; "3 pacotes" para material. */
export function descreverQuantidade(
  valor: number,
  meta: Pick<MetaBase, 'tipo' | 'unidade_medida'>,
): string {
  return meta.tipo === 'FINANCEIRA'
    ? reais(valor)
    : `${numero(valor)} ${meta.unidade_medida || 'un.'}`;
}

/** "R$ 30,00 de R$ 100,00" ou "3 de 10 kg". */
export function descreverProgresso(
  meta: Pick<MetaBase, 'tipo' | 'unidade_medida' | 'quantidade_meta' | 'quantidade_arrecadada'>,
): string {
  return meta.tipo === 'FINANCEIRA'
    ? `${reais(meta.quantidade_arrecadada)} de ${reais(meta.quantidade_meta)}`
    : `${numero(meta.quantidade_arrecadada)} de ${numero(meta.quantidade_meta)} ${meta.unidade_medida || 'un.'}`;
}

export function percentualMeta(
  meta: Pick<MetaBase, 'quantidade_meta' | 'quantidade_arrecadada'>,
): number {
  if (!(meta.quantidade_meta > 0)) return 0;
  return Math.min(
    100,
    Math.max(0, Math.round((meta.quantidade_arrecadada / meta.quantidade_meta) * 100)),
  );
}

/** Prazo vencido não encerra a meta: a gestão decide; só deixa de convidar a doar. */
export function prazoVencido(meta: Pick<MetaBase, 'data_limite'>, hojeIso: string): boolean {
  return meta.data_limite !== null && meta.data_limite < hojeIso;
}

/** Aba da listagem: encerradas e canceladas saem das abertas. */
export function metaFinalizada(meta: Pick<MetaBase, 'status'>): boolean {
  return meta.status !== 'ABERTA';
}

export function recebendoContribuicoes(
  meta: Pick<MetaBase, 'status' | 'data_limite'>,
  hojeIso: string,
): boolean {
  return meta.status === 'ABERTA' && !prazoVencido(meta, hojeIso);
}

/**
 * Valor ou quantidade digitados: vírgula ou ponto decimal, até 2 casas, dentro
 * do numeric(12,2) do banco. Separador de milhar não é aceito, para "1.000"
 * não virar 1 em silêncio.
 */
export function interpretarQuantidade(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/i, '');
  if (!/^\d{1,10}(?:[.,]\d{1,2})?$/.test(limpo)) return null;
  const valor = Number(limpo.replace(',', '.'));
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

/** O que o formulário de meta digita, ainda como texto. */
export type EntradaMeta = {
  tipo: MetaBase['tipo'];
  titulo: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  /** DD/MM/AAAA ou vazio. */
  prazo: string;
};

/**
 * Valida o formulário e devolve os campos prontos para salvar. Lança a
 * primeira mensagem de erro para o usuário. Só a meta nova exige prazo futuro:
 * ao editar, um prazo já vencido pode continuar como está.
 */
export function validarMeta(entrada: EntradaMeta, nova: boolean, hoje = hojeIso()): MetaFormulario {
  const valor = interpretarQuantidade(entrada.quantidade);
  const prazo = entrada.prazo.trim();
  const prazoIso = prazo ? interpretarData(prazo) : null;
  if (entrada.titulo.trim().length < 3)
    throw new Error('O título precisa de ao menos 3 caracteres.');
  if (!entrada.descricao.trim()) throw new Error('Descreva a meta.');
  if (entrada.tipo === 'MATERIAL' && !entrada.unidade.trim())
    throw new Error('Informe a unidade de medida (ex.: kg, unidades).');
  if (valor === null)
    throw new Error('Informe a quantidade da meta: número positivo, com até duas casas decimais.');
  if (prazo && !prazoIso) throw new Error('Use o formato DD/MM/AAAA no prazo.');
  if (nova && prazoIso && prazoIso < hoje)
    throw new Error('O prazo precisa ser hoje ou uma data futura.');
  return {
    titulo: entrada.titulo.trim(),
    descricao: entrada.descricao.trim(),
    tipo: entrada.tipo,
    unidade_medida: entrada.tipo === 'MATERIAL' ? entrada.unidade.trim() : null,
    quantidade_meta: valor,
    data_limite: prazoIso,
  };
}

/**
 * Observação da conferência. Aprovar aceita nota opcional; recusar exige o
 * motivo, que o voluntário lê em "Minhas contribuições". O banco repete a regra.
 */
export function validarConferencia(aprovada: boolean, observacao: string): string | null {
  const texto = observacao.trim();
  if (texto.length > 500) throw new Error('A observação pode ter até 500 caracteres.');
  if (!aprovada && texto.length < 3) throw new Error('Informe o motivo da recusa.');
  return texto || null;
}

export type FiltroContribuicoes = 'TODAS' | StatusValidacao;

/** Contagem por situação de conferência, para as abas de "Minhas contribuições". */
export function contarPorSituacao(
  contribuicoes: { status_validacao: StatusValidacao }[],
): Record<FiltroContribuicoes, number> {
  const contagem: Record<FiltroContribuicoes, number> = {
    TODAS: contribuicoes.length,
    PENDENTE: 0,
    APROVADA: 0,
    RECUSADA: 0,
  };
  for (const c of contribuicoes) contagem[c.status_validacao] += 1;
  return contagem;
}

export function filtrarPorSituacao<T extends { status_validacao: StatusValidacao }>(
  contribuicoes: T[],
  filtro: FiltroContribuicoes,
): T[] {
  return filtro === 'TODAS'
    ? contribuicoes
    : contribuicoes.filter(c => c.status_validacao === filtro);
}
