export type Certificado = {
  id: string;
  participacao_id: number;
  usuario_id: string;
  emitido_em: string;
  nome_voluntario: string;
  instituicao: string;
  atividade: string;
  data_atividade: string;
  carga_horaria_prevista: number;
};
export type CertificadoDisponivel = Pick<
  Certificado,
  'participacao_id' | 'atividade' | 'data_atividade' | 'carga_horaria_prevista'
>;
export type ListaCertificados = { emitidos: Certificado[]; disponiveis: CertificadoDisponivel[] };
