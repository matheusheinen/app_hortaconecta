/**
 * Regras puras do perfil em seções. Sem imports para rodar nos testes Node.
 * A elegibilidade oficial continua sendo `voluntariado_elegibilidade` no banco;
 * estas funções só orientam o voluntário sobre o que falta em cada seção.
 */

export type SecaoPerfil = 'pessoais' | 'cadastro' | 'endereco' | 'disponibilidade' | 'habilidades';

export type DadosPerfilVoluntario = {
  nome: string;
  telefone: string | null;
  perfil_instagram: string | null;
  descricao: string | null;
  cpf: string | null;
  data_nascimento: string | null;
  profissao: string | null;
  disponibilidade_horarios: { dia: string; periodo: string }[];
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
};

export const SECOES_PERFIL: { chave: SecaoPerfil; titulo: string; resumo: string }[] = [
  {
    chave: 'pessoais',
    titulo: 'Dados pessoais',
    resumo: 'Nome, telefone, Instagram e uma apresentação.',
  },
  {
    chave: 'cadastro',
    titulo: 'Cadastro de voluntário',
    resumo: 'CPF, data de nascimento e profissão.',
  },
  { chave: 'endereco', titulo: 'Endereço', resumo: 'Busque pelo CEP ou preencha à mão.' },
  {
    chave: 'disponibilidade',
    titulo: 'Disponibilidade',
    resumo: 'Dias e períodos em que você pode ajudar.',
  },
  { chave: 'habilidades', titulo: 'Habilidades', resumo: 'Áreas em que você pode contribuir.' },
];

const preenchido = (valor: string | null | undefined) => !!valor && valor.trim() !== '';

/** Mesmos campos que `voluntariado_privado.elegivel` exige, agrupados por seção. */
export function secaoCompleta(
  secao: SecaoPerfil,
  dados: DadosPerfilVoluntario,
  totalHabilidades: number,
): boolean {
  switch (secao) {
    case 'pessoais':
      return dados.nome.trim().length >= 2;
    case 'cadastro':
      return (
        preenchido(dados.cpf) && preenchido(dados.data_nascimento) && preenchido(dados.profissao)
      );
    case 'endereco':
      return preenchido(dados.logradouro) && preenchido(dados.numero) && preenchido(dados.cidade);
    case 'disponibilidade':
      return dados.disponibilidade_horarios.length > 0;
    case 'habilidades':
      return totalHabilidades > 0;
  }
}

export function secoesPendentes(
  dados: DadosPerfilVoluntario,
  totalHabilidades: number,
): SecaoPerfil[] {
  return SECOES_PERFIL.map(s => s.chave).filter(s => !secaoCompleta(s, dados, totalHabilidades));
}

export function mascararCep(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

export type EnderecoDoCep = { logradouro: string; bairro: string; cidade: string; uf: string };

/** Interpreta a resposta do ViaCEP; `{ erro: true }` significa CEP inexistente. */
export function enderecoDoViaCep(resposta: unknown): EnderecoDoCep | null {
  if (!resposta || typeof resposta !== 'object' || 'erro' in resposta) return null;
  const texto = (chave: string) => {
    const valor = (resposta as Record<string, unknown>)[chave];
    return typeof valor === 'string' ? valor.trim() : '';
  };
  const uf = texto('uf').toUpperCase();
  const endereco = {
    logradouro: texto('logradouro'),
    bairro: texto('bairro'),
    cidade: texto('localidade'),
    uf,
  };
  if (!endereco.cidade || !/^[A-Z]{2}$/.test(uf)) return null;
  return endereco;
}
