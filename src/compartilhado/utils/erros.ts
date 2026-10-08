/** Traduz erros do Supabase/PostgREST e de rede em mensagens para o usuário. */
export function mensagemErro(erro: unknown): string {
  if (erro && typeof erro === 'object' && 'message' in erro) {
    const mensagem = String(erro.message);
    const codigo = 'code' in erro ? String(erro.code) : '';
    if (codigo === '23505')
      return mensagem.includes('cpf')
        ? 'Este CPF já está cadastrado.'
        : 'Este registro já existe. Recarregue a tela.';
    if (codigo === '42501') return 'Sua conta não tem permissão para esta operação.';
    if (codigo === '23514') return 'Os dados não atendem às regras do cadastro. Confira os campos.';
    if (codigo === '23503')
      return 'Um dos registros relacionados não está disponível. Recarregue a tela.';
    if (codigo === 'PGRST116') return 'Registro não encontrado ou indisponível para sua conta.';
    if (codigo === '40001' || codigo === '40P01')
      return 'Os dados foram alterados por outra operação. Atualize e tente novamente.';
    if (/failed to fetch|network request failed|networkerror/i.test(mensagem))
      return 'Não foi possível acessar o servidor. Verifique sua conexão.';
    if (mensagem.includes('schema cache') || mensagem.includes('does not exist')) {
      return 'O servidor precisa das migrations desta funcionalidade. Avise a gestão.';
    }
    return mensagem;
  }
  return 'Não foi possível concluir. Verifique sua conexão e tente novamente.';
}
