import { supabase } from './supabase';
import type { Json } from './database.types';
import { salvarPerfilGestao } from './perfilGestao';

/**
 * Campos editáveis pela gestão. `whatsapp` é o contato público da instituição
 * (`configuracao_instituicao`): voluntários não leem `ongs` por RLS, então o
 * botão de contato das atividades depende dele. `ongs.whatsapp` e PIX são
 * legado, preservados no banco e fora das telas.
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
};

export type SecaoPerfilOng = 'conta' | 'institucional' | 'whatsapp';

export const SECOES_PERFIL_ONG: { chave: SecaoPerfilOng; titulo: string; resumo: string }[] = [
  { chave: 'conta', titulo: 'Conta e apresentação', resumo: 'Nome de exibição, telefone, Instagram e sobre a horta.' },
  { chave: 'institucional', titulo: 'Dados institucionais', resumo: 'CNPJ, razão social, fundação e responsável legal.' },
  { chave: 'whatsapp', titulo: 'WhatsApp para voluntários', resumo: 'Número usado no botão de contato das atividades.' },
];

const preenchido = (valor: string | null) => !!valor && valor.trim() !== '';

export function secaoOngCompleta(secao: SecaoPerfilOng, dados: DadosPerfilOng): boolean {
  if (secao === 'conta') return dados.nome.trim().length >= 2;
  if (secao === 'institucional') return preenchido(dados.cnpj) && preenchido(dados.razao_social);
  return preenchido(dados.whatsapp);
}

export async function carregarPerfilOng(usuarioId: string): Promise<DadosPerfilOng> {
  const [usuario, ong, instituicao] = await Promise.all([
    supabase.from('usuarios').select('nome, telefone, perfil_instagram, descricao').eq('id', usuarioId).single(),
    supabase.from('ongs').select('cnpj, razao_social, data_criacao, responsavel_legal').eq('usuario_id', usuarioId).maybeSingle(),
    supabase.from('configuracao_instituicao').select('whatsapp').maybeSingle(),
  ]);
  if (usuario.error) throw usuario.error;
  if (ong.error) throw ong.error;
  if (instituicao.error) throw instituicao.error;
  // Conta de gestão sem complemento: a RPC cria a linha de ongs no primeiro salvamento.
  return {
    ...usuario.data,
    cnpj: ong.data?.cnpj ?? null,
    razao_social: ong.data?.razao_social ?? null,
    data_criacao: ong.data?.data_criacao ?? null,
    responsavel_legal: ong.data?.responsavel_legal ?? null,
    whatsapp: instituicao.data?.whatsapp ?? null,
  };
}

/**
 * Envia só as chaves da seção. A RPC preserva as omitidas, inclusive o PIX
 * legado; o WhatsApp vai para o registro único da instituição.
 */
export async function salvarPerfilOng(parcial: Partial<DadosPerfilOng>): Promise<void> {
  const { whatsapp, ...perfil } = parcial;
  if ('whatsapp' in parcial) {
    const { data, error } = await supabase
      .from('configuracao_instituicao')
      .update({ whatsapp: whatsapp ?? null })
      .eq('id', 1)
      .select('id');
    if (error) throw error;
    // RLS sem permissão não gera erro: devolve zero linhas atualizadas.
    if (!data?.length) throw new Error('O contato da instituição não foi atualizado. Confira se a configuração existe.');
  }
  if (Object.keys(perfil).length) await salvarPerfilGestao(true, perfil as Json);
}
