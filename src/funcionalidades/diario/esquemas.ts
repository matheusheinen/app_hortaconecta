import { esquemaDe, z } from '@/compartilhado/esquemas';
import type { Publicacao } from './tipos';

// Formato das respostas jsonb de diario_listar e diario_detalhe (to_jsonb da linha).

export const esquemaPublicacao = esquemaDe<Publicacao>()(
  z.object({
    revisao: z.number(),
    id: z.number(),
    titulo: z.string(),
    texto: z.string().nullable(),
    descricao_curta: z.string().nullable(),
    status: z.enum(['PUBLICADA', 'OCULTA']),
    imagem_caminho: z.string().nullable(),
    data_publicacao: z.string(),
    autor_id: z.string(),
    atualizado_em: z.string(),
  }),
);

export const esquemaListaPublicacoes = esquemaDe<Publicacao[]>()(z.array(esquemaPublicacao));
