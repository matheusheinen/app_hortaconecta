export async function executarAuth<T extends { error: unknown }>(
  acao: () => PromiseLike<T>,
  loading: (valor: boolean) => void,
): Promise<T> {
  loading(true);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const resultado = await Promise.race([
      Promise.resolve().then(acao),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('A conexão demorou demais. Tente novamente.')),
          30000,
        );
      }),
    ]);
    if (resultado.error) throw resultado.error;
    return resultado;
  } finally {
    if (timer) clearTimeout(timer);
    loading(false);
  }
}
export function erroAuth(erro: unknown): string {
  const msg =
    erro && typeof erro === 'object' && 'message' in erro
      ? String(erro.message)
      : 'Não foi possível concluir. Verifique a conexão e tente novamente.';
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('already registered')) return 'Este e-mail já tem conta.';
  if (/anonymous sign-ins are disabled/i.test(msg))
    return 'O acesso como convidado ainda não está disponível.';
  if (/rate limit|security purposes/i.test(msg))
    return 'Muitas tentativas. Aguarde um minuto e tente novamente.';
  if (/token has expired|otp_expired|token is invalid/i.test(msg))
    return 'Código inválido ou expirado. Peça um novo código.';
  if (/different from the old password/i.test(msg))
    return 'A nova senha precisa ser diferente da anterior.';
  if (msg.includes('Password should be')) return 'A senha precisa ter ao menos 6 caracteres.';
  return msg;
}
