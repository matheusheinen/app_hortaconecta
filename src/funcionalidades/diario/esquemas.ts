import { esquemaDe, z } from '@/compartilhado/esquemas';
import type { AutorPublicacao, Publicacao } from './tipos';

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
    // Ausentes antes da migration 20261108120000_diario_menores.sql.
    imagem_com_menores: z.boolean().default(false),
    autorizacao_responsaveis: z.boolean().default(false),
    data_publicacao: z.string(),
    autor_id: z.string(),
    atualizado_em: z.string(),
  }),
);

export const esquemaListaPublicacoes = esquemaDe<Publicacao[]>()(z.array(esquemaPublicacao));

export const esquemaAutoresPublicacao = esquemaDe<Omit<AutorPublicacao, 'foto_url'>[]>()(
  z.array(
    z.object({
      id: z.string().uuid(),
      nome: z.string(),
      foto_perfil: z.string().nullable(),
    }),
  ),
);
