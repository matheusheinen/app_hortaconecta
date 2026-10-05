import { supabase } from './supabase';
import type { Habilidade } from './tipos';
import { disponibilidadeValida } from './regrasVoluntariado';
import { enderecoDoViaCep, type DadosPerfilVoluntario, type EnderecoDoCep } from './regrasPerfil';

export type PerfilVoluntarioCarregado = {
  dados: DadosPerfilVoluntario;
  catalogo: Habilidade[];
  habilidades: number[];
  elegivel: boolean;
};

export async function carregarPerfilVoluntario(usuarioId: string): Promise<PerfilVoluntarioCarregado> {
  const [voluntario, catalogo, selecionadas, usuario, elegibilidade] = await Promise.all([
    supabase
      .from('voluntarios')
      .select('cpf, data_nascimento, profissao, disponibilidade_horarios, cep, logradouro, numero, complemento, bairro, cidade, uf')
      .eq('usuario_id', usuarioId)
      .single(),
    supabase.from('habilidades').select('*').order('categoria').order('nome_habilidade'),
    supabase.from('usuario_habilidades').select('habilidade_id').eq('usuario_id', usuarioId),
    supabase.from('usuarios').select('nome, telefone, perfil_instagram, descricao').eq('id', usuarioId).single(),
    supabase.rpc('voluntariado_elegibilidade'),
  ]);
  if (voluntario.error) throw voluntario.error;
  if (catalogo.error) throw catalogo.error;
  if (selecionadas.error) throw selecionadas.error;
  if (usuario.error) throw usuario.error;
  if (elegibilidade.error) throw elegibilidade.error;
  if (!disponibilidadeValida(voluntario.data.disponibilidade_horarios)) {
    throw new Error('A disponibilidade salva está em formato inválido. Solicite suporte à gestão.');
  }
  return {
    dados: { ...usuario.data, ...voluntario.data, disponibilidade_horarios: voluntario.data.disponibilidade_horarios },
    catalogo: catalogo.data ?? [],
    habilidades: (selecionadas.data ?? []).map((linha) => linha.habilidade_id),
    elegivel: elegibilidade.data === true,
  };
}

/**
 * A RPC preserva as chaves omitidas em `parcial`, mas sempre substitui o
 * conjunto de habilidades — por isso cada seção reenvia a seleção atual.
 * Devolve a elegibilidade calculada pelo banco após o salvamento.
 */
export async function salvarPerfilVoluntario(
  parcial: Partial<DadosPerfilVoluntario>,
  habilidades: number[],
): Promise<boolean> {
  const { data, error } = await supabase.rpc('voluntariado_salvar_perfil', {
    p_dados: parcial,
    p_habilidades: habilidades,
  });
  if (error) throw error;
  if (data === null) throw new Error('O servidor não confirmou o salvamento.');
  return data;
}

/**
 * ViaCEP é público e sem chave. Devolve null quando o CEP não existe ou a rede
 * falha: o endereço continua podendo ser preenchido à mão.
 */
export async function buscarCep(cep: string): Promise<EnderecoDoCep | null> {
  const digitos = cep.replace(/\D/g, '');
  if (digitos.length !== 8) return null;
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (!resposta.ok) return null;
    return enderecoDoViaCep(await resposta.json());
  } catch {
    return null;
  }
}
