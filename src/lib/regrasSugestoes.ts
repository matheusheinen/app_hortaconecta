/**
 * Sugestões de tarefas para o voluntário. É uma recomendação de leitura no
 * Início, não atribuição: ninguém é inscrito ou escalado automaticamente.
 * Sem imports para rodar nos testes Node.
 */

type Slot = { dia: string; periodo: string };

/** Mesma ordem do getDay() do JavaScript. */
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

/** Antes das 5h conta como noite: na prática, é a madrugada do dia anterior. */
export function periodoDoHorario(data: Date): 'manha' | 'tarde' | 'noite' {
  const hora = data.getHours();
  if (hora >= 5 && hora < 12) return 'manha';
  if (hora >= 12 && hora < 18) return 'tarde';
  return 'noite';
}

/** Sem disponibilidade marcada nada combina: melhor não sugerir do que sugerir tudo. */
export function cabeNaDisponibilidade(dataHora: string, disponibilidade: Slot[]): boolean {
  if (!disponibilidade.length) return false;
  const data = new Date(dataHora);
  const dia = DIAS[data.getDay()];
  const periodo = periodoDoHorario(data);
  return disponibilidade.some((slot) => slot.dia === dia && slot.periodo === periodo);
}

export type CandidataSugestao = {
  id: number;
  data_hora_prevista: string;
  status: string;
  vagas_totais: number;
  vagas_ocupadas: number;
};

/**
 * Disponibilidade é obrigatória. A área (categoria das habilidades marcadas
 * na tarefa) só estreita: tarefa sem área passa só pela disponibilidade, para
 * um esquecimento da gestão não esconder a tarefa de todos.
 */
export function selecionarSugestoes<T extends CandidataSugestao>(params: {
  atividades: T[];
  disponibilidade: Slot[];
  areasDoVoluntario: string[];
  areasPorAtividade: Map<number, string[]>;
  jaPedidas: Set<number>;
  agora?: Date;
  limite?: number;
}): T[] {
  const { atividades, disponibilidade, areasDoVoluntario, areasPorAtividade, jaPedidas, agora = new Date(), limite = 3 } = params;
  return atividades
    .filter((a) => a.status === 'ABERTA'
      && Date.parse(a.data_hora_prevista) > agora.getTime()
      && a.vagas_totais > a.vagas_ocupadas
      && !jaPedidas.has(a.id)
      && cabeNaDisponibilidade(a.data_hora_prevista, disponibilidade))
    .filter((a) => {
      const areas = areasPorAtividade.get(a.id) ?? [];
      return areas.length === 0 || areas.some((area) => areasDoVoluntario.includes(area));
    })
    .sort((a, b) => Date.parse(a.data_hora_prevista) - Date.parse(b.data_hora_prevista) || a.id - b.id)
    .slice(0, limite);
}
