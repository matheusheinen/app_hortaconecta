import { supabase } from './supabase';
import type { Json } from './database.types';
import { salvarPerfilGestao } from './perfilGestao';

/**
 * Campos editáveis pela gestão. WhatsApp e PIX são contatos públicos da
 * instituição (`configuracao_instituicao`): voluntários não leem `ongs` por
 * RLS, e precisam deles para falar com a gestão e para doar. `ongs.whatsapp`
 * e `ongs.chave_pix` ficam como legado, preservados no banco e fora das telas.
 */
export type DadosPerfilOng = {
  nome: string;
  telefone: string | null;
  perfil_instagram: string | null;
  descricao: string | null;
  cnpj: string | null;
  razao_social: string | null;
  data_criacao: string | null;
  responsavel_legal: string | null;
  whatsapp: string | null;
  chave_pix: string | null;
  nome_beneficiario_pix: string | null;
};

export type PerfilOngCarregado = DadosPerfilOng & {
  /** False enquanto a reconciliação que move o PIX não foi aplicada no remoto. */
  pixDisponivel: boolean;
};

export type SecaoPerfilOng = 'conta' | 'institucional' | 'whatsapp' | 'recebimento';

export const SECOES_PERFIL_ONG: { chave: SecaoPerfilOng; titulo: string; resumo: string }[] = [
  {
    chave: 'conta',
    titulo: 'Conta e apresentação',
    resumo: 'Nome de exibição, telefone, Instagram e sobre a horta.',
  },
  {
    chave: 'institucional',
    titulo: 'Dados institucionais',
    resumo: 'CNPJ, razão social, fundação e responsável legal.',
  },
  {
    chave: 'whatsapp',
    titulo: 'WhatsApp para voluntários',
    resumo: 'Número usado no botão de contato das atividades e metas.',
  },
  {
    chave: 'recebimento',
    titulo: 'Recebimento de doações (PIX)',
    resumo: 'Chave PIX mostrada nas metas em dinheiro.',
  },
];

const preenchido = (valor: string | null) => !!valor && valor.trim() !== '';
const CAMPOS_INSTITUICAO = ['whatsapp', 'chave_pix', 'nome_beneficiario_pix'] as const;

export function secaoOngCompleta(secao: SecaoPerfilOng, dados: DadosPerfilOng): boolean {
  if (secao === 'conta') return dados.nome.trim().length >= 2;
  if (secao === 'institucional') return preenchido(dados.cnpj) && preenchido(dados.razao_social);
  if (secao === 'recebimento') return preenchido(dados.chave_pix);
  return preenchido(dados.whatsapp);
}

export async function carregarPerfilOng(usuarioId: string): Promise<PerfilOngCarregado> {
  const [usuario, ong, instituicao, pix] = await Promise.all([
    supabase
      .from('usuarios')
      .select('nome, telefone, perfil_instagram, descricao')
      .eq('id', usuarioId)
      .single(),
    supabase
      .from('ongs')
      .select('cnpj, razao_social, data_criacao, responsavel_legal')
      .eq('usuario_id', usuarioId)
      .maybeSingle(),
    supabase.from('configuracao_instituicao').select('whatsapp').maybeSingle(),
    supabase
      .from('configuracao_instituicao')
      .select('chave_pix, nome_beneficiario_pix')
      .maybeSingle(),
  ]);
  if (usuario.error) throw usuario.error;
  if (ong.error) throw ong.error;
  if (instituicao.error) throw instituicao.error;
  // 42703: coluna inexistente, ou seja, a reconciliação do PIX ainda não foi aplicada.
  const pixDisponivel = !pix.error;
  if (pix.error && pix.error.code !== '42703') throw pix.error;
  // Conta de gestão sem complemento: a RPC cria a linha de ongs no primeiro salvamento.
  return {
    ...usuario.data,
    cnpj: ong.data?.cnpj ?? null,
    razao_social: ong.data?.razao_social ?? null,
    data_criacao: ong.data?.data_criacao ?? null,
    responsavel_legal: ong.data?.responsavel_legal ?? null,
    whatsapp: instituicao.data?.whatsapp ?? null,
    chave_pix: pixDisponivel ? (pix.data?.chave_pix ?? null) : null,
    nome_beneficiario_pix: pixDisponivel ? (pix.data?.nome_beneficiario_pix ?? null) : null,
    pixDisponivel,
  };
}

/**
 * Envia só as chaves da seção. A RPC preserva as omitidas; WhatsApp e PIX vão
 * para o registro único da instituição.
 */
export async function salvarPerfilOng(parcial: Partial<DadosPerfilOng>): Promise<void> {
  const instituicao: Partial<Pick<DadosPerfilOng, (typeof CAMPOS_INSTITUICAO)[number]>> = {};
  const perfil: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(parcial)) {
    if ((CAMPOS_INSTITUICAO as readonly string[]).includes(chave))
      Object.assign(instituicao, { [chave]: valor ?? null });
    else perfil[chave] = valor;
  }
  if (Object.keys(instituicao).length) {
    const { data, error } = await supabase
      .from('configuracao_instituicao')
      .update(instituicao)
      .eq('id', 1)
      .select('id');
    if (error) throw error;
    // RLS sem permissão não gera erro: devolve zero linhas atualizadas.
    if (!data?.length)
      throw new Error(
        'Os contatos da instituição não foram atualizados. Confira se a configuração existe.',
      );
  }
  if (Object.keys(perfil).length) await salvarPerfilGestao(true, perfil as Json);
}
