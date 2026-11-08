/** Regras puras do acesso (login, cadastro e recuperação), sem React nem Supabase. */

/**
 * Em que ponto da tela de acesso a pessoa está. Cada fase só carrega o que faz
 * sentido nela: não existe, por exemplo, "código confirmado" fora da recuperação.
 */
export type FaseAcesso =
  | { modo: 'entrar' }
  | { modo: 'cadastrar' }
  | { modo: 'recuperar'; etapa: 'email' }
  | { modo: 'recuperar'; etapa: 'codigo'; codigoConfirmado: boolean };

export type ModoAcesso = FaseAcesso['modo'];

export type EventoAcesso =
  | 'abrirRecuperacao'
  | 'voltarAoLogin'
  | 'alternarCadastro'
  | 'codigoEnviado'
  | 'codigoConfirmado'
  | 'contaCriada';

export const faseInicial: FaseAcesso = { modo: 'entrar' };

/** Máquina de estados da tela de acesso; eventos fora de hora não mudam nada. */
export function proximaFase(fase: FaseAcesso, evento: EventoAcesso): FaseAcesso {
  switch (evento) {
    case 'abrirRecuperacao':
      return fase.modo === 'entrar' ? { modo: 'recuperar', etapa: 'email' } : fase;
    case 'voltarAoLogin':
      return fase.modo === 'recuperar' ? faseInicial : fase;
    case 'alternarCadastro':
      if (fase.modo === 'entrar') return { modo: 'cadastrar' };
      return fase.modo === 'cadastrar' ? faseInicial : fase;
    case 'codigoEnviado':
      return fase.modo === 'recuperar' && fase.etapa === 'email'
        ? { modo: 'recuperar', etapa: 'codigo', codigoConfirmado: false }
        : fase;
    case 'codigoConfirmado':
      return fase.modo === 'recuperar' && fase.etapa === 'codigo'
        ? { ...fase, codigoConfirmado: true }
        : fase;
    case 'contaCriada':
      return fase.modo === 'cadastrar' ? faseInicial : fase;
  }
}

/** Código já validado: há sessão aberta à espera da nova senha. */
export function codigoConfirmado(fase: FaseAcesso): boolean {
  return fase.modo === 'recuperar' && fase.etapa === 'codigo' && fase.codigoConfirmado;
}

/** Código numérico enviado por e-mail (o Supabase aceita de 6 a 10 dígitos). */
export function codigoRecuperacaoValido(codigo: string) {
  return /^\d{6,10}$/.test(codigo.trim());
}

// As validações lançam a mensagem para o usuário, como no resto do app.

/** RNF0011: senha nova com pelo menos 8 caracteres. O login não confere, para não barrar contas antigas. */
export const SENHA_MINIMA = 8;
const MENSAGEM_SENHA_CURTA = `A senha precisa ter ao menos ${SENHA_MINIMA} caracteres.`;

export function validarEntrada(
  modo: ModoAcesso,
  campos: { nome: string; email: string; senha: string },
): void {
  if (!campos.email.trim() || !campos.senha) throw new Error('Informe e-mail e senha.');
  if (modo === 'cadastrar' && campos.nome.trim().length < 2)
    throw new Error('Informe seu nome completo.');
  if (modo === 'cadastrar' && campos.senha.length < SENHA_MINIMA)
    throw new Error(MENSAGEM_SENHA_CURTA);
}

export function validarEmailRecuperacao(email: string): void {
  if (!email.trim()) throw new Error('Informe o e-mail da conta.');
}

/** Com o código já confirmado, só a senha nova é conferida. */
export function validarNovaSenha(campos: {
  codigo: string;
  senha: string;
  codigoConfirmado: boolean;
}): void {
  if (!campos.codigoConfirmado && !codigoRecuperacaoValido(campos.codigo))
    throw new Error('Informe o código recebido por e-mail.');
  if (campos.senha.length < SENHA_MINIMA) throw new Error(MENSAGEM_SENHA_CURTA);
}

/** Texto do botão principal em cada fase. */
export function rotuloAcao(fase: FaseAcesso): string {
  if (fase.modo === 'recuperar')
    return fase.etapa === 'email' ? 'Enviar código' : 'Redefinir senha';
  return fase.modo === 'cadastrar' ? 'Criar conta' : 'Entrar';
}
