import { supabase } from './supabase';
import { carregarMinhasInscricoes } from './voluntariado';
import { disponibilidadeValida } from './regrasVoluntariado';
import { selecionarSugestoes } from './regrasSugestoes';
import type { AtividadeInicio } from './resumoInicio';

/** Habilidades marcadas como área da tarefa (`atividade_habilidades`). */
export async function carregarAreasAtividade(atividadeId: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('atividade_habilidades')
    .select('habilidade_id')
    .eq('atividade_id', atividadeId);
  if (error) throw error;
  return (data ?? []).map(linha => linha.habilidade_id);
}

/**
 * Grava a diferença entre a seleção anterior e a nova. A RLS só permite à
 * gestão; a escrita é separada da atividade, então uma falha aqui não desfaz
 * a tarefa já salva — o formulário avisa e permite tentar de novo.
 */
export async function salvarAreasAtividade(
  atividadeId: number,
  anteriores: number[],
  escolhidas: number[],
): Promise<void> {
  const remover = anteriores.filter(id => !escolhidas.includes(id));
  const incluir = escolhidas.filter(id => !anteriores.includes(id));
  if (remover.length) {
    const { error } = await supabase
      .from('atividade_habilidades')
      .delete()
      .eq('atividade_id', atividadeId)
      .in('habilidade_id', remover);
    if (error) throw error;
  }
  if (incluir.length) {
    const { error } = await supabase
      .from('atividade_habilidades')
      .insert(incluir.map(habilidade_id => ({ atividade_id: atividadeId, habilidade_id })));
    if (error) throw error;
  }
}

/** Tarefas abertas que cabem na disponibilidade e nas áreas do voluntário. */
export async function carregarSugestoes(usuarioId: string): Promise<AtividadeInicio[]> {
  const agora = new Date();
  const [atividades, voluntario, habilidades, inscricoes] = await Promise.all([
    supabase
      .from('atividades')
      .select('*')
      .eq('status', 'ABERTA')
      .gte('data_hora_prevista', agora.toISOString())
      .order('data_hora_prevista', { ascending: true })
      .limit(50),
    supabase
      .from('voluntarios')
      .select('disponibilidade_horarios')
      .eq('usuario_id', usuarioId)
      .maybeSingle(),
    supabase
      .from('usuario_habilidades')
      .select('habilidades(categoria)')
      .eq('usuario_id', usuarioId),
    carregarMinhasInscricoes(),
  ]);
  if (atividades.error) throw atividades.error;
  if (voluntario.error) throw voluntario.error;
  if (habilidades.error) throw habilidades.error;
  const lista = (atividades.data ?? []) as AtividadeInicio[];
  if (!lista.length) return [];

  const disponibilidade = disponibilidadeValida(voluntario.data?.disponibilidade_horarios)
    ? voluntario.data.disponibilidade_horarios
    : [];
  const areasDoVoluntario = (habilidades.data ?? [])
    .map(linha => linha.habilidades?.categoria)
    .filter((area): area is string => !!area);

  const vinculos = await supabase
    .from('atividade_habilidades')
    .select('atividade_id, habilidades(categoria)')
    .in(
      'atividade_id',
      lista.map(a => a.id),
    );
  if (vinculos.error) throw vinculos.error;
  const areasPorAtividade = new Map<number, string[]>();
  for (const vinculo of vinculos.data ?? []) {
    const area = vinculo.habilidades?.categoria;
    if (!area) continue;
    const atuais = areasPorAtividade.get(vinculo.atividade_id) ?? [];
    if (!atuais.includes(area)) atuais.push(area);
    areasPorAtividade.set(vinculo.atividade_id, atuais);
  }

  // O que já foi pedido (em análise, aprovado ou recusado) não é sugestão.
  const jaPedidas = new Set(
    inscricoes
      .filter(({ inscricao }) => inscricao.status_inscricao !== 'CANCELADA')
      .map(({ atividade }) => atividade.id),
  );

  return selecionarSugestoes({
    atividades: lista,
    disponibilidade,
    areasDoVoluntario,
    areasPorAtividade,
    jaPedidas,
    agora,
  });
}
