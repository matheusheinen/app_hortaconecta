import type { Certificado } from './tipos';
export function textoCertificado(c: Certificado) {
  const data = (v: string) =>
    new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `HORTA CONECTA — CERTIFICADO DE PARTICIPAÇÃO\n\n${c.instituicao}\n\nCertificamos a participação de ${c.nome_voluntario} na atividade “${c.atividade}”, com candidatura aprovada e presença confirmada por check-in.\n\nData prevista da atividade: ${data(c.data_atividade)} (horário de Brasília).\nCarga horária prevista registrada no check-in: ${c.carga_horaria_prevista} horas.\nEste registro não comprova a quantidade de horas efetivamente realizadas.\n\nEmitido em: ${data(c.emitido_em)} (horário de Brasília).\nIdentificador: HC-${c.id}`;
}
