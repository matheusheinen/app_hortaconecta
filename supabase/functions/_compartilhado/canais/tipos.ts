// Contrato comum a todos os canais (push, e-mail, WhatsApp). Um canal novo é só um arquivo
// que implementa `Canal` e entra no registro em ./index.ts. Sem dependências do Deno.

/** Uma linha reservada de notificacoes_entregues, já com o conteúdo da notificação. */
export type Entrega = {
  id: number;
  canal: string;
  destino: string;
  tentativas: number;
  notificacao_id: number;
  tipo: string;
  titulo: string;
  corpo: string;
  atividade_id: number | null;
  meta_id: number | null;
};

/** O que volta para notificacoes_entregues_concluir. */
export type ResultadoEnvio = {
  id: number;
  ok: boolean;
  /** Identificador no provedor; com ele a entrega espera o recibo (status ENVIADA). */
  id_externo?: string;
  erro?: string;
  /** Não adianta tentar de novo (token inválido, mensagem grande demais...). */
  definitivo?: boolean;
  /** O destino não existe mais: apaga o token do aparelho. */
  remover_destino?: boolean;
};

/** O que volta para notificacoes_recibos_registrar. */
export type ResultadoRecibo = {
  id: number;
  ok: boolean;
  erro?: string;
  remover_destino?: boolean;
};

export type Canal = {
  nome: string;
  /** Envia um lote do próprio canal. Nunca lança: falhas viram resultados. */
  enviar(entregas: Entrega[]): Promise<ResultadoEnvio[]>;
};

export type Buscar = (url: string, init: RequestInit) => Promise<Response>;
