import { esquemaDe, z } from '@/compartilhado/esquemas';
import type { Certificado, CertificadoDisponivel, ListaCertificados } from './tipos';

// Formato das respostas jsonb de certificados_listar e certificados_detalhe.

export const esquemaCertificado = esquemaDe<Certificado>()(
  z.object({
    id: z.string(),
    participacao_id: z.number(),
    usuario_id: z.string(),
    emitido_em: z.string(),
    nome_voluntario: z.string(),
    instituicao: z.string(),
    atividade: z.string(),
    data_atividade: z.string(),
    carga_horaria_prevista: z.number(),
  }),
);

const esquemaCertificadoDisponivel = esquemaDe<CertificadoDisponivel>()(
  z.object({
    participacao_id: z.number(),
    atividade: z.string(),
    data_atividade: z.string(),
    carga_horaria_prevista: z.number(),
  }),
);

export const esquemaListaCertificados = esquemaDe<ListaCertificados>()(
  z.object({
    emitidos: z.array(esquemaCertificado),
    disponiveis: z.array(esquemaCertificadoDisponivel),
  }),
);
