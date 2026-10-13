/**
 * Regras puras do perfil em seções, sem React nem Supabase.
 * A elegibilidade oficial continua sendo `voluntariado_elegibilidade` no banco;
 * estas funções só orientam o voluntário sobre o que falta em cada seção.
 */
import {
  apenasDigitos,
  validarCnpj,
  validarCpf,
  validarTelefone,
} from '@/compartilhado/utils/validadores';
import { hojeIso, interpretarData } from '@/compartilhado/utils/datas';

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

// Validação das seções. Cada função devolve os campos já normalizados, prontos
// para salvar, ou lança a primeira mensagem de erro para o usuário — o mesmo
// padrão de validarMeta e validarPublicacao. SecaoPerfil mostra a mensagem.

/** Nome, telefone, Instagram e apresentação: iguais no voluntário e na gestão. */
export function validarConta(
  campos: { nome: string; telefone: string; instagram: string; descricao: string },
  /** Como a tela chama o texto livre: "A apresentação" ou "A descrição". */
  rotuloDescricao: string,
): {
  nome: string;
  telefone: string | null;
  perfil_instagram: string | null;
  descricao: string | null;
} {
  const nome = campos.nome.trim();
  const telefone = campos.telefone.trim();
  const instagram = campos.instagram.trim().replace(/^@/, '');
  const descricao = campos.descricao.trim();
  if (nome.length < 2 || nome.length > 120)
    throw new Error('O nome precisa ter entre 2 e 120 caracteres.');
  if (telefone && !validarTelefone(telefone))
    throw new Error('Telefone inválido. Informe DDD + número (10 ou 11 dígitos).');
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram))
    throw new Error('Instagram inválido. Use só letras, números, ponto e underline.');
  if (descricao.length > 500)
    throw new Error(`${rotuloDescricao} pode ter no máximo 500 caracteres.`);
  return {
    nome,
    telefone: telefone ? apenasDigitos(telefone) : null,
    perfil_instagram: instagram || null,
    descricao: descricao || null,
  };
}

export function validarCadastroVoluntario(
  campos: { cpf: string; nascimento: string; profissao: string },
  hoje = hojeIso(),
): Pick<DadosPerfilVoluntario, 'cpf' | 'data_nascimento' | 'profissao'> {
  const cpf = campos.cpf.trim();
  const nascimento = campos.nascimento.trim();
  if (cpf && !validarCpf(cpf)) throw new Error('CPF inválido.');
  const iso = nascimento ? interpretarData(nascimento) : null;
  if (nascimento && !iso) throw new Error('Use o formato DD/MM/AAAA na data de nascimento.');
  if (iso && iso <= '1900-01-01')
    throw new Error('A data de nascimento precisa ser posterior a 01/01/1900.');
  if (iso && iso >= hoje) throw new Error('A data de nascimento precisa ser no passado.');
  return {
    cpf: cpf ? apenasDigitos(cpf) : null,
    data_nascimento: iso,
    profissao: campos.profissao.trim() || null,
  };
}

type CamposEndereco = Pick<
  DadosPerfilVoluntario,
  'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'uf'
>;

export function validarEndereco(campos: {
  [campo in keyof CamposEndereco]: string;
}): CamposEndereco {
  const cep = campos.cep.trim();
  const uf = campos.uf.trim().toUpperCase();
  if (cep && apenasDigitos(cep).length !== 8)
    throw new Error('CEP inválido. Informe os 8 dígitos.');
  if (uf && !/^[A-Z]{2}$/.test(uf))
    throw new Error('UF inválida. Informe a sigla com duas letras, como RS.');
  return {
    cep: cep ? apenasDigitos(cep) : null,
    logradouro: campos.logradouro.trim() || null,
    numero: campos.numero.trim() || null,
    complemento: campos.complemento.trim() || null,
    bairro: campos.bairro.trim() || null,
    cidade: campos.cidade.trim() || null,
    uf: uf || null,
  };
}

export function validarInstitucional(
  campos: { cnpj: string; razaoSocial: string; fundacao: string; responsavel: string },
  hoje = hojeIso(),
): {
  cnpj: string | null;
  razao_social: string | null;
  data_criacao: string | null;
  responsavel_legal: string | null;
} {
  const cnpj = campos.cnpj.trim();
  const fundacao = campos.fundacao.trim();
  if (cnpj && !validarCnpj(cnpj)) throw new Error('CNPJ inválido.');
  const iso = fundacao ? interpretarData(fundacao) : null;
  if (fundacao && !iso) throw new Error('Use o formato DD/MM/AAAA na data de fundação.');
  if (iso && iso > hoje) throw new Error('A data de fundação não pode ser no futuro.');
  return {
    cnpj: cnpj ? apenasDigitos(cnpj) : null,
    razao_social: campos.razaoSocial.trim() || null,
    data_criacao: iso,
    responsavel_legal: campos.responsavel.trim() || null,
  };
}

export function validarWhatsapp(texto: string): { whatsapp: string | null } {
  const whatsapp = texto.trim();
  if (whatsapp && !validarTelefone(whatsapp))
    throw new Error('WhatsApp inválido. Informe DDD + número (10 ou 11 dígitos).');
  return { whatsapp: whatsapp ? apenasDigitos(whatsapp) : null };
}

export function validarRecebimento(campos: { chave: string; beneficiario: string }): {
  chave_pix: string | null;
  nome_beneficiario_pix: string | null;
} {
  const chave = campos.chave.trim();
  const beneficiario = campos.beneficiario.trim();
  if (chave.length > 140) throw new Error('A chave PIX pode ter no máximo 140 caracteres.');
  if (beneficiario && (beneficiario.length < 2 || beneficiario.length > 120))
    throw new Error('O nome do beneficiário precisa ter entre 2 e 120 caracteres.');
  return { chave_pix: chave || null, nome_beneficiario_pix: beneficiario || null };
}
