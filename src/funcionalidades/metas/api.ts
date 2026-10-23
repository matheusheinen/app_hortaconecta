import { supabase } from '@/servicos/supabase';
import { imagemJpeg } from '@/funcionalidades/diario/regras';
import { declararComComprovante } from './comprovante';
import type { Contribuicao, Meta, MetaFormulario, TipoMeta } from './tipos';

export type ContribuicaoComDoador = Contribuicao & { usuarios: { nome: string } | null };
export type MinhaContribuicaoMeta = Contribuicao & {
  metas_demandas: Pick<Meta, 'id' | 'titulo' | 'tipo' | 'unidade_medida' | 'status'> | null;
};
export const BUCKET_COMPROVANTES = 'comprovantes';
export type Pix = { chave_pix: string | null; nome_beneficiario_pix: string | null };

const colunasMeta =
  'id, titulo, descricao, tipo, unidade_medida, quantidade_meta, quantidade_arrecadada, data_limite, status, criado_em';

function comoMeta(linha: Record<string, unknown>): Meta {
  // numeric chega como número pelo PostgREST; Number() protege contra string.
  return {
    ...(linha as Meta),
    quantidade_meta: Number(linha.quantidade_meta),
    quantidade_arrecadada: Number(linha.quantidade_arrecadada),
  };
}

/** Voluntários veem metas abertas primeiro; a gestão também vê as encerradas. */
export async function listarMetas(): Promise<Meta[]> {
  const { data, error } = await supabase
    .from('metas_demandas')
    .select(colunasMeta)
    .order('status', { ascending: true })
    .order('criado_em', { ascending: false });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar as metas.');
  return data.map(comoMeta);
}

export async function carregarMeta(
  id: number,
): Promise<{ meta: Meta; contribuicoes: ContribuicaoComDoador[] }> {
  const [meta, contribuicoes] = await Promise.all([
    supabase.from('metas_demandas').select(colunasMeta).eq('id', id).single(),
    // contribuicoes aponta duas vezes para usuarios (doador e validador): a FK define o embed.
    // A RLS já limita: a gestão vê todas; o voluntário, só as próprias.
    supabase
      .from('contribuicoes')
      .select('*, usuarios!contribuicoes_usuario_id_fkey(nome)')
      .eq('meta_id', id)
      .order('data_envio', { ascending: false }),
  ]);
  if (meta.error) throw meta.error;
  if (contribuicoes.error) throw contribuicoes.error;
  return {
    meta: comoMeta(meta.data),
    contribuicoes: (contribuicoes.data ?? []).map(c => ({
      ...c,
      quantidade_oferecida: Number(c.quantidade_oferecida),
    })) as ContribuicaoComDoador[],
  };
}

export async function minhasContribuicoesMetas(
  usuarioId: string,
): Promise<MinhaContribuicaoMeta[]> {
  const { data, error } = await supabase
    .from('contribuicoes')
    .select('*, metas_demandas(id, titulo, tipo, unidade_medida, status)')
    .eq('usuario_id', usuarioId)
    .order('data_envio', { ascending: false });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Não foi possível carregar suas contribuições.');
  return data.map(c => ({
    ...c,
    quantidade_oferecida: Number(c.quantidade_oferecida),
  })) as MinhaContribuicaoMeta[];
}

export async function salvarMeta(id: number | null, campos: MetaFormulario): Promise<void> {
  const { data, error } =
    id === null
      ? await supabase.from('metas_demandas').insert(campos).select('id')
      : await supabase.from('metas_demandas').update(campos).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('A meta não foi salva. Confira se sua conta é da gestão.');
}

export async function alterarStatusMeta(id: number, status: Meta['status']): Promise<void> {
  const { data, error } = await supabase
    .from('metas_demandas')
    .update({ status })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('A meta não foi atualizada.');
}

/**
 * Voluntário declara o que enviou; fica PENDENTE até a gestão conferir. O
 * comprovante é opcional: JPEG em base64, enviado ao bucket privado antes do registro.
 */
export async function declararContribuicao(
  metaId: number,
  usuarioId: string,
  quantidade: number,
  comprovanteBase64: string | null = null,
): Promise<void> {
  await declararComComprovante(
    comprovanteBase64 === null ? null : imagemJpeg(comprovanteBase64),
    async arquivo => {
      const { data: caminho, error: erroCaminho } = await supabase.rpc('comprovante_caminho');
      if (erroCaminho) throw erroCaminho;
      if (!caminho) throw new Error('Não foi possível preparar o envio do comprovante.');
      const { error } = await supabase.storage.from(BUCKET_COMPROVANTES).upload(caminho, arquivo, {
        contentType: 'image/jpeg',
        upsert: false,
        cacheControl: '60',
      });
      if (error) throw new Error('Falha no envio do comprovante: ' + error.message);
      return caminho;
    },
    async caminho => {
      await supabase.storage.from(BUCKET_COMPROVANTES).remove([caminho]);
    },
    async caminho => {
      const { error } = await supabase.from('contribuicoes').insert({
        meta_id: metaId,
        usuario_id: usuarioId,
        quantidade_oferecida: quantidade,
        ...(caminho ? { url_comprovante: caminho } : {}),
      });
      if (error) throw error;
    },
  );
}

/** URL assinada de curta duração; o bucket é privado. */
export async function urlComprovante(caminho: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_COMPROVANTES)
    .createSignedUrl(caminho, 60);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('Comprovante indisponível.');
  return data.signedUrl;
}

/** Gestão registra o que recebeu em mãos; entra APROVADA com ela como validadora. */
export async function registrarRecebimento(params: {
  metaId: number;
  doadorId: string;
  gestaoId: string;
  quantidade: number;
  observacao: string | null;
}): Promise<void> {
  const { error } = await supabase.from('contribuicoes').insert({
    meta_id: params.metaId,
    usuario_id: params.doadorId,
    quantidade_oferecida: params.quantidade,
    status_validacao: 'APROVADA',
    validado_por: params.gestaoId,
    validado_em: new Date().toISOString(),
    observacao_validacao: params.observacao,
  });
  if (error) throw error;
}

export async function validarContribuicao(
  id: number,
  gestaoId: string,
  aprovada: boolean,
  observacao: string | null,
): Promise<void> {
  const { data, error } = await supabase
    .from('contribuicoes')
    .update({
      status_validacao: aprovada ? 'APROVADA' : 'RECUSADA',
      validado_por: gestaoId,
      validado_em: new Date().toISOString(),
      observacao_validacao: observacao,
    })
    .eq('id', id)
    .eq('status_validacao', 'PENDENTE')
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Esta contribuição já foi conferida. Atualize a tela.');
}

export async function listarVoluntarios(): Promise<{ id: string; nome: string }[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome')
    .eq('tipo_perfil', 'VOLUNTARIO')
    .order('nome');
  if (error) throw error;
  return data ?? [];
}

export async function carregarPix(): Promise<Pix> {
  const { data, error } = await supabase
    .from('configuracao_instituicao')
    .select('chave_pix, nome_beneficiario_pix')
    .maybeSingle();
  if (error) throw error;
  return {
    chave_pix: data?.chave_pix ?? null,
    nome_beneficiario_pix: data?.nome_beneficiario_pix ?? null,
  };
}

export const rotuloTipoMeta: Record<TipoMeta, string> = {
  FINANCEIRA: 'Em dinheiro (PIX)',
  MATERIAL: 'Material',
};
