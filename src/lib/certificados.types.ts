import type { DatabaseOficinas } from './oficinas.types';
import type { Json } from './database.types';
export type Certificado = {
 id:string; participacao_id:number; usuario_id:string; emitido_em:string;
 nome_voluntario:string; instituicao:string; atividade:string; data_atividade:string; carga_horaria_prevista:number;
};
export type CertificadoDisponivel = Pick<Certificado,'participacao_id'|'atividade'|'data_atividade'|'carga_horaria_prevista'>;
export type ListaCertificados = {emitidos:Certificado[];disponiveis:CertificadoDisponivel[]};
export type DatabaseCertificados = Omit<DatabaseOficinas,'public'> & {
 public: Omit<DatabaseOficinas['public'],'Functions'> & {
  Functions: DatabaseOficinas['public']['Functions'] & {
   gestao_salvar_perfil:{Args:{p_dados:Json};Returns:boolean};
   certificados_listar:{Args:Record<string,never>;Returns:Json};
   certificados_detalhe:{Args:{p_id:string};Returns:Json};
   certificados_emitir:{Args:{p_participacao:number};Returns:string};
  };
 };
};
