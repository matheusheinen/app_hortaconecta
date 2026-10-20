import * as z from 'zod';

/**
 * Base dos esquemas Zod que validam as respostas jsonb das RPCs (ver
 * DOCUMENTACAO.md > Validação das respostas do servidor).
 *
 * jitless: o Zod 4 tenta gerar código com `new Function` para validar mais
 * rápido, recurso que o Hermes pode não ter. O Zod detecta e recua sozinho,
 * mas desligar deixa o comportamento igual no celular, no web e nos testes.
 */
z.config({ jitless: true });

export { z };

type Igual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/**
 * Amarra o esquema ao tipo do app: não compila se o que o esquema produz
 * diferir de T em qualquer campo (nome, opcionalidade ou nulidade). Assim o
 * esquema não descarta um campo que o tipo promete, nem aceita null onde a
 * tela não espera.
 *
 *   export const esquemaPublicacao = esquemaDe<Publicacao>()(z.object({ … }));
 */
export function esquemaDe<T>() {
  return <E extends z.ZodType>(
    esquema: E & (Igual<z.output<E>, T> extends true ? unknown : 'Esquema difere do tipo'),
  ): z.ZodType<T> => esquema as unknown as z.ZodType<T>;
}

/**
 * Valida a resposta de uma RPC. Fora do formato esperado, lança `mensagem`
 * para o usuário; o detalhe técnico vai para o console de desenvolvimento.
 */
export function validarResposta<T>(esquema: z.ZodType<T>, dados: unknown, mensagem: string): T {
  const resultado = esquema.safeParse(dados);
  if (resultado.success) return resultado.data;
  // typeof: nos testes em Node não existe __DEV__.
  if (typeof __DEV__ === 'undefined' || __DEV__)
    console.warn(`${mensagem}\n${z.prettifyError(resultado.error)}`);
  throw new Error(mensagem);
}
