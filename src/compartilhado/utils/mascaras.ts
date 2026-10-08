import { apenasDigitos } from './validadores';

/**
 * Reconstrói o texto a partir só dos dígitos a cada tecla, encaixando os
 * literais da máscara ('#' = dígito) conforme os dígitos vão chegando.
 * Simples e previsível, mas não tenta reposicionar o cursor — apagar bem
 * em cima de um separador (ex.: o '.' do CPF) às vezes pede um backspace
 * a mais, já que apagar o literal sozinho não remove nenhum dígito.
 */
function aplicarMascara(digitos: string, mascara: string): string {
  let resultado = '';
  let indice = 0;

  for (let i = 0; i < mascara.length && indice < digitos.length; i++) {
    if (mascara[i] === '#') {
      resultado += digitos[indice];
      indice++;
    } else {
      resultado += mascara[i];
    }
  }

  return resultado;
}

export function mascararCpf(texto: string): string {
  return aplicarMascara(apenasDigitos(texto).slice(0, 11), '###.###.###-##');
}

export function mascararCnpj(texto: string): string {
  return aplicarMascara(apenasDigitos(texto).slice(0, 14), '##.###.###/####-##');
}

/** Alterna entre máscara de fixo (10 dígitos) e celular (11) conforme digita. */
export function mascararTelefone(texto: string): string {
  const digitos = apenasDigitos(texto).slice(0, 11);
  const mascara = digitos.length > 10 ? '(##) #####-####' : '(##) ####-####';
  return aplicarMascara(digitos, mascara);
}

export function mascararData(texto: string): string {
  return aplicarMascara(apenasDigitos(texto).slice(0, 8), '##/##/####');
}

export function mascararDataHora(texto: string): string {
  return aplicarMascara(apenasDigitos(texto).slice(0, 12), '##/##/#### ##:##');
}
