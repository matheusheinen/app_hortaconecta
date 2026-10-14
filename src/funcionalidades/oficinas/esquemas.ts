import { esquemaDe, z } from '@/compartilhado/esquemas';
import type { PropostaOficina } from './tipos';

// Formato das respostas jsonb de oficinas_listar e oficinas_detalhe (to_jsonb da linha;
// o detalhe acrescenta nome_autor).

export const esquemaPropostaOficina = esquemaDe<PropostaOficina>()(
  z.object({
    id: z.number(),
    autor_id: z.string(),
    nome_autor: z.string().nullable().optional(),
    titulo: z.string(),
    descricao: z.string(),
    tema: z.string(),
    objetivo: z.string(),
    duracao_minutos: z.number(),
    conhecimentos: z.string().nullable(),
    observacoes: z.string().nullable(),
    status: z.enum(['PENDENTE', 'APROVADA', 'REJEITADA', 'CANCELADA']),
    criado_em: z.string(),
    atualizado_em: z.string(),
    revisao: z.number(),
    decidido_em: z.string().nullable(),
    decidido_por: z.string().nullable(),
    observacao_decisao: z.string().nullable(),
    cancelado_em: z.string().nullable(),
  }),
);

export const esquemaListaOficinas = esquemaDe<PropostaOficina[]>()(z.array(esquemaPropostaOficina));
