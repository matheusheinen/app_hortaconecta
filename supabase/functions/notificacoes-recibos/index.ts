// Confere os recibos do Expo (~15 min depois do envio) e apaga tokens de aparelhos que não
// recebem mais (DeviceNotRegistered). Chamada pelo pg_cron.
// Deploy: supabase functions deploy notificacoes-recibos --no-verify-jwt
import { consultarRecibos } from '../_compartilhado/canais/expoPush.ts';
import { clienteServidor, servir, tokenExpo } from '../_compartilhado/servidor.ts';

servir(async () => {
  const supabase = clienteServidor();
  const { data, error } = await supabase.rpc('notificacoes_recibos_pendentes');
  if (error) throw error;
  const pendentes = (data ?? []) as { id: number; id_externo: string }[];
  if (pendentes.length === 0) return { consultados: 0, registrados: 0 };

  const resultados = await consultarRecibos(fetch, pendentes, tokenExpo());
  if (resultados.length > 0) {
    const { error: erroRegistrar } = await supabase.rpc('notificacoes_recibos_registrar', {
      p_resultados: resultados,
    });
    if (erroRegistrar) throw erroRegistrar;
  }
  return { consultados: pendentes.length, registrados: resultados.length };
});
