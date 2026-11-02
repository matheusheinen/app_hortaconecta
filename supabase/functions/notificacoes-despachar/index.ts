// Esvazia a fila de entregas: reserva lotes, envia por canal e devolve os resultados.
// Chamada pelo banco (pg_net) logo após cada notificação e a cada minuto pelo pg_cron
// quando há retentativas. Deploy: supabase functions deploy notificacoes-despachar --no-verify-jwt
import { canaisDisponiveis } from '../_compartilhado/canais/index.ts';
import type { Entrega, ResultadoEnvio } from '../_compartilhado/canais/tipos.ts';
import { clienteServidor, servir, tokenExpo } from '../_compartilhado/servidor.ts';

const LOTE = 100;
const MAX_RODADAS = 10; // até 1000 entregas por chamada; o resto fica para a próxima

servir(async () => {
  const supabase = clienteServidor();
  const canais = canaisDisponiveis(tokenExpo());
  const resumo = { reservadas: 0, enviadas: 0, falhas: 0 };

  for (let rodada = 0; rodada < MAX_RODADAS; rodada++) {
    const { data, error } = await supabase.rpc('notificacoes_entregues_reservar', {
      p_canais: [...canais.keys()],
      p_limite: LOTE,
    });
    if (error) throw error;
    const lote = (data ?? []) as Entrega[];
    if (lote.length === 0) break;
    resumo.reservadas += lote.length;

    const porCanal = new Map<string, Entrega[]>();
    for (const e of lote) porCanal.set(e.canal, [...(porCanal.get(e.canal) ?? []), e]);

    const resultados: ResultadoEnvio[] = [];
    for (const [nome, entregas] of porCanal) {
      resultados.push(...(await canais.get(nome)!.enviar(entregas)));
    }
    resumo.enviadas += resultados.filter(r => r.ok).length;
    resumo.falhas += resultados.filter(r => !r.ok).length;

    const { error: erroConcluir } = await supabase.rpc('notificacoes_entregues_concluir', {
      p_resultados: resultados,
    });
    if (erroConcluir) throw erroConcluir;
    if (lote.length < LOTE) break;
  }
  return resumo;
});
