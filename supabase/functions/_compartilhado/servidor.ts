// Partes das Edge Functions que dependem do Deno: segredo, cliente Supabase e respostas.
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** As functions de notificação só são chamadas pelo banco (pg_net) com este segredo. */
export function autorizado(req: Request): boolean {
  const esperado = Deno.env.get('NOTIFICACOES_SEGREDO') ?? '';
  const recebido = req.headers.get('x-notificacoes-segredo') ?? '';
  if (!esperado || esperado.length !== recebido.length) return false;
  // Comparação em tempo constante.
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  }
  return diferenca === 0;
}

/** Cliente com service_role: só ele executa as RPCs da fila. */
export function clienteServidor() {
  const url = Deno.env.get('SUPABASE_URL');
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !chave) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.');
  return createClient(url, chave, { auth: { persistSession: false } });
}

export const tokenExpo = () => Deno.env.get('EXPO_ACCESS_TOKEN') || undefined;

export function responder(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function servir(executar: () => Promise<unknown>) {
  Deno.serve(async req => {
    if (req.method !== 'POST') return responder({ erro: 'Método não permitido' }, 405);
    if (!autorizado(req)) return responder({ erro: 'Não autorizado' }, 401);
    try {
      return responder(await executar());
    } catch (falha) {
      console.error(falha);
      return responder({ erro: String(falha) }, 500);
    }
  });
}
