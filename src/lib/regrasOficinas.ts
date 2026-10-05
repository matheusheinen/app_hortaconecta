export const rotuloOficina = { PENDENTE:'Aguardando análise', APROVADA:'Aprovada', REJEITADA:'Rejeitada', CANCELADA:'Cancelada' };
export type CamposOficina = { titulo: string; descricao: string; tema: string; objetivo: string; duracao: string; conhecimentos: string; observacoes: string };
export function validarOficina(c: CamposOficina): number {
 for(const [valor,min,max,nome] of [
  [c.titulo,3,120,'Título'],[c.descricao,1,5000,'Descrição'],[c.tema,1,120,'Tema'],[c.objetivo,1,2000,'Objetivo'],
  [c.conhecimentos,0,2000,'Conhecimentos'],[c.observacoes,0,2000,'Observações'],
 ] as const) {
  if(valor.trim().length<min || valor.trim().length>max) throw new Error(nome+' deve ter entre '+min+' e '+max+' caracteres.');
 }
 if(!/^[0-9]+$/.test(c.duracao.trim()) || Number(c.duracao)<1 || Number(c.duracao)>1440) {
  throw new Error('Informe uma duração inteira de 1 a 1.440 minutos.');
 }
 return Number(c.duracao);
}
