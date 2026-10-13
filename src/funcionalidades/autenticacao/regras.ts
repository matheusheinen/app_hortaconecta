/** Regras puras do acesso (login, cadastro e recuperação), sem React nem Supabase. */

export type ModoAcesso = 'entrar' | 'cadastrar' | 'recuperar';
export type EtapaRecuperacao = 'email' | 'codigo';

/** Código numérico enviado por e-mail (o Supabase aceita de 6 a 10 dígitos). */
export function codigoRecuperacaoValido(codigo: string) {
  return /^\d{6,10}$/.test(codigo.trim());
}

/** Mensagem do primeiro problema ao entrar ou criar conta; null quando pode enviar. */
export function validarEntrada(
  modo: ModoAcesso,
  campos: { nome: string; email: string; senha: string },
): string | null {
  if (!campos.email.trim() || !campos.senha) return 'Informe e-mail e senha.';
  if (modo === 'cadastrar' && campos.nome.trim().length < 2) return 'Informe seu nome completo.';
  return null;
}

/** Com o código já confirmado, só a senha nova é conferida. */
export function validarNovaSenha(campos: {
  codigo: string;
  senha: string;
  codigoConfirmado: boolean;
}): string | null {
  if (!campos.codigoConfirmado && !codigoRecuperacaoValido(campos.codigo))
    return 'Informe o código recebido por e-mail.';
  if (campos.senha.length < 6) return 'A senha precisa ter ao menos 6 caracteres.';
  return null;
}

/** Texto do botão principal em cada modo e etapa. */
export function rotuloAcao(modo: ModoAcesso, etapa: EtapaRecuperacao): string {
  if (modo === 'recuperar') return etapa === 'email' ? 'Enviar código' : 'Redefinir senha';
  return modo === 'cadastrar' ? 'Criar conta' : 'Entrar';
}
