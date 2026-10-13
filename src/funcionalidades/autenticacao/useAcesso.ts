import { useState } from 'react';
import { executarAuth, erroAuth } from './operacaoAuth';
import {
  criarConta,
  definirNovaSenha,
  encerrarSessao,
  entrarComoConvidado,
  entrarComSenha,
  enviarCodigoRecuperacao,
  verificarCodigoRecuperacao,
} from './api';
import { definirRecuperacaoAtiva } from './recuperacaoSenha';
import {
  rotuloAcao,
  validarEntrada,
  validarNovaSenha,
  type EtapaRecuperacao,
  type ModoAcesso,
} from './regras';

/**
 * Estado e ações da tela de acesso: entrar, criar conta, entrar como convidado
 * e recuperar a senha por código. A tela só desenha o que este hook devolve.
 */
export function useAcesso() {
  const [modo, setModo] = useState<ModoAcesso>('entrar');
  const [etapa, setEtapa] = useState<EtapaRecuperacao>('email');
  const [codigo, setCodigo] = useState('');
  // Código já confirmado: há sessão aberta à espera da nova senha.
  const [verificado, setVerificado] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function limparMensagens() {
    setErro(null);
    setAviso(null);
  }

  function abrirRecuperacao() {
    setModo('recuperar');
    setEtapa('email');
    setCodigo('');
    setSenha('');
    setVerificado(false);
    limparMensagens();
  }

  async function voltarAoLogin() {
    if (ocupado) return;
    // Com o código já validado há sessão aberta; sem fechá-la o app entraria sem a nova senha.
    if (verificado) await encerrarSessao().catch(() => {});
    definirRecuperacaoAtiva(false);
    setModo('entrar');
    setVerificado(false);
    setCodigo('');
    setSenha('');
    limparMensagens();
  }

  function alternarCadastro() {
    setModo(modo === 'cadastrar' ? 'entrar' : 'cadastrar');
    limparMensagens();
  }

  async function enviarCodigo() {
    if (ocupado) return;
    limparMensagens();
    if (!email.trim()) {
      setErro('Informe o e-mail da conta.');
      return;
    }
    try {
      await executarAuth(() => enviarCodigoRecuperacao(email.trim()), setOcupado);
      setEtapa('codigo');
      setAviso('Se existir uma conta com este e-mail, enviamos um código de verificação.');
    } catch (f) {
      setErro(erroAuth(f));
    }
  }

  async function redefinirSenha() {
    if (ocupado) return;
    limparMensagens();
    const problema = validarNovaSenha({ codigo, senha, codigoConfirmado: verificado });
    if (problema) {
      setErro(problema);
      return;
    }
    let sessaoAberta = verificado;
    try {
      if (!sessaoAberta) {
        definirRecuperacaoAtiva(true);
        await executarAuth(
          () => verificarCodigoRecuperacao(email.trim(), codigo.trim()),
          setOcupado,
        );
        sessaoAberta = true;
        setVerificado(true);
      }
      await executarAuth(() => definirNovaSenha(senha), setOcupado);
      // Senha trocada: libera o App, que já encontra a sessão aberta.
      definirRecuperacaoAtiva(false);
    } catch (f) {
      if (!sessaoAberta) definirRecuperacaoAtiva(false);
      setErro(erroAuth(f));
    }
  }

  async function entrarOuCadastrar() {
    if (ocupado) return;
    limparMensagens();
    const problema = validarEntrada(modo, { nome, email, senha });
    if (problema) {
      setErro(problema);
      return;
    }
    const cadastrando = modo === 'cadastrar';
    try {
      const resposta = await executarAuth(
        () =>
          cadastrando
            ? criarConta(nome.trim(), email.trim(), senha)
            : entrarComSenha(email.trim(), senha),
        setOcupado,
      );
      if (cadastrando && !resposta.data.session) {
        setAviso('Conta criada. Confirme seu e-mail antes de entrar.');
        setModo('entrar');
      }
    } catch (f) {
      setErro(erroAuth(f));
    }
  }

  async function entrarConvidado() {
    if (ocupado) return;
    limparMensagens();
    try {
      await executarAuth(entrarComoConvidado, setOcupado);
    } catch (f) {
      setErro(erroAuth(f));
    }
  }

  /** Ação do botão principal, conforme o modo e a etapa. */
  function confirmar() {
    if (modo !== 'recuperar') return entrarOuCadastrar();
    return etapa === 'email' ? enviarCodigo() : redefinirSenha();
  }

  return {
    modo,
    etapa,
    verificado,
    campos: { nome, email, senha, codigo },
    alterar: { nome: setNome, email: setEmail, senha: setSenha, codigo: setCodigo },
    erro,
    aviso,
    ocupado,
    rotuloAcao: rotuloAcao(modo, etapa),
    confirmar,
    enviarCodigo,
    abrirRecuperacao,
    voltarAoLogin,
    alternarCadastro,
    entrarConvidado,
  };
}
