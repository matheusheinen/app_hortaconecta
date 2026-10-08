/** Valida CPF pelo algoritmo padrão dos dois dígitos verificadores. */
export function validarCpf(valor: string): boolean {
  const cpf = valor.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digitos = cpf.split('').map(Number);

  const calcularDigito = (fatorInicial: number, quantidade: number) => {
    let soma = 0;
    for (let i = 0; i < quantidade; i++) soma += digitos[i] * (fatorInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(10, 9) === digitos[9] && calcularDigito(11, 10) === digitos[10];
}

/** Valida CNPJ pelo algoritmo padrão dos dois dígitos verificadores. */
export function validarCnpj(valor: string): boolean {
  const cnpj = valor.replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

  const digitos = cnpj.split('').map(Number);

  const calcularDigito = (pesos: number[]) => {
    const soma = pesos.reduce((acc, peso, i) => acc + peso * digitos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const d1 = calcularDigito([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcularDigito([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return d1 === digitos[12] && d2 === digitos[13];
}

/** Telefone/WhatsApp: só DDD + número, 10 ou 11 dígitos — igual ao CHECK do banco. */
export function validarTelefone(valor: string): boolean {
  return /^[0-9]{10,11}$/.test(valor.replace(/\D/g, ''));
}

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}
