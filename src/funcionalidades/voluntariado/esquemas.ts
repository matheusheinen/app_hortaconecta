import { esquemaDe, z } from '@/compartilhado/esquemas';
import { Constants } from '@/servicos/database.types';
import type {
  Atividade,
  Candidato,
  DetalheAtividade,
  Inscricao,
  MinhaInscricao,
  TokenCheckin,
} from './tipos';

// Formato das respostas jsonb das RPCs de voluntariado (to_jsonb das linhas).
// Os enums vêm de Constants, gerado do banco junto com database.types.ts.

const enums = Constants.public.Enums;

export const esquemaAtividade = esquemaDe<Atividade>()(
  z.object({
    id: z.number(),
    autor_id: z.string(),
    titulo: z.string(),
    descricao: z.string(),
    tipo: z.enum(enums.tipo_atividade),
    status: z.enum(enums.status_atividade),
    data_hora_prevista: z.string(),
    carga_horaria: z.number(),
    vagas_totais: z.number(),
    criado_em: z.string(),
  }),
);

export const esquemaInscricao = esquemaDe<Inscricao>()(
  z.object({
    id: z.number(),
    atividade_id: z.number(),
    usuario_id: z.string(),
    status_inscricao: z.enum(enums.status_inscricao),
    data_inscricao: z.string(),
    presenca_confirmada: z.boolean(),
    checkin_em: z.string().nullable(),
    carga_horaria_registrada: z.number().nullable(),
    decidido_em: z.string().nullable(),
    decidido_por: z.string().nullable(),
    motivo_decisao: z.string().nullable(),
  }),
);

export const esquemaDetalheAtividade = esquemaDe<DetalheAtividade>()(
  z.object({
    atividade: esquemaAtividade.and(z.object({ local: z.string().nullable().optional() })),
    inscricao: esquemaInscricao.nullable(),
    aprovados: z.number(),
    elegivel: z.boolean(),
    agora: z.string(),
  }),
);

export const esquemaCandidatos = esquemaDe<Candidato[]>()(
  z.array(
    esquemaInscricao.and(
      z.object({
        nome: z.string(),
        descricao: z.string().nullable(),
        // LEFT JOIN com voluntarios: pode vir null. A tela valida o formato.
        profissao: z.string().nullable(),
        disponibilidade_horarios: z.unknown(),
        habilidades: z.array(z.string()),
      }),
    ),
  ),
);

export const esquemaMinhasInscricoes = esquemaDe<MinhaInscricao[]>()(
  z.array(z.object({ atividade: esquemaAtividade, inscricao: esquemaInscricao })),
);

export const esquemaTokenCheckin = esquemaDe<TokenCheckin>()(
  z.object({ atividade_id: z.number(), token: z.string(), expira_em: z.string() }),
);
