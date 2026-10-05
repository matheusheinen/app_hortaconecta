/**
 * Regras puras das metas e contribuições. Sem imports para rodar nos testes Node.
 * O total arrecadado é calculado pelo banco (trigger atualizar_arrecadacao_meta),
 * somando só contribuições APROVADA; aqui apenas se exibe e se valida a entrada.
 */

type MetaBase = {
  tipo: 'FINANCEIRA' | 'MATERIAL';
  unidade_medida: string | null;
  quantidade_meta: number;
  quantidade_arrecadada: number;
  data_limite: string | null;
  status: 'ABERTA' | 'ENCERRADA' | 'CANCELADA';
};

const reais = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** "R$ 12,50" para meta financeira; "3 pacotes" para material. */
export function descreverQuantidade(valor: number, meta: Pick<MetaBase, 'tipo' | 'unidade_medida'>): string {
  return meta.tipo === 'FINANCEIRA' ? reais(valor) : `${numero(valor)} ${meta.unidade_medida || 'un.'}`;
}

/** "R$ 30,00 de R$ 100,00" ou "3 de 10 kg". */
export function descreverProgresso(meta: Pick<MetaBase, 'tipo' | 'unidade_medida' | 'quantidade_meta' | 'quantidade_arrecadada'>): string {
  return meta.tipo === 'FINANCEIRA'
    ? `${reais(meta.quantidade_arrecadada)} de ${reais(meta.quantidade_meta)}`
    : `${numero(meta.quantidade_arrecadada)} de ${numero(meta.quantidade_meta)} ${meta.unidade_medida || 'un.'}`;
}

export function percentualMeta(meta: Pick<MetaBase, 'quantidade_meta' | 'quantidade_arrecadada'>): number {
  if (!(meta.quantidade_meta > 0)) return 0;
  return Math.min(100, Math.max(0, Math.round((meta.quantidade_arrecadada / meta.quantidade_meta) * 100)));
}

/** Prazo vencido não encerra a meta: a gestão decide; só deixa de convidar a doar. */
export function prazoVencido(meta: Pick<MetaBase, 'data_limite'>, hojeIso: string): boolean {
  return meta.data_limite !== null && meta.data_limite < hojeIso;
}

export function recebendoContribuicoes(meta: Pick<MetaBase, 'status' | 'data_limite'>, hojeIso: string): boolean {
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
