import { supabase } from './supabase';
import type { Json } from './database.types';
import { salvarPerfilGestao } from './perfilGestao';

/** Campos editáveis pela gestão. PIX é legado: preservado no banco, fora das telas. */
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
  const [usuario, ong] = await Promise.all([
    supabase.from('usuarios').select('nome, telefone, perfil_instagram, descricao').eq('id', usuarioId).single(),
    supabase.from('ongs').select('cnpj, razao_social, data_criacao, responsavel_legal, whatsapp').eq('usuario_id', usuarioId).maybeSingle(),
  ]);
  if (usuario.error) throw usuario.error;
  if (ong.error) throw ong.error;
  // Conta de gestão sem complemento: a RPC cria a linha de ongs no primeiro salvamento.
  return {
    ...usuario.data,
    cnpj: ong.data?.cnpj ?? null,
    razao_social: ong.data?.razao_social ?? null,
    data_criacao: ong.data?.data_criacao ?? null,
    responsavel_legal: ong.data?.responsavel_legal ?? null,
    whatsapp: ong.data?.whatsapp ?? null,
  };
}

/** Envia só as chaves da seção; a RPC preserva as demais, inclusive o PIX legado. */
export async function salvarPerfilOng(parcial: Partial<DadosPerfilOng>): Promise<void> {
  await salvarPerfilGestao(true, parcial as Json);
}
