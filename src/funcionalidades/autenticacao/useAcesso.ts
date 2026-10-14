import { useReducer, useState } from 'react';
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
  codigoConfirmado,
  faseInicial,
  proximaFase,
  rotuloAcao,
  validarEmailRecuperacao,
  validarEntrada,
  validarNovaSenha,
} from './regras';

/**
 * Estado e ações da tela de acesso: entrar, criar conta, entrar como convidado
 * e recuperar a senha por código. A fase da tela segue a máquina de estados de
 * regras.ts; a tela só desenha o que este hook devolve.
 */
export function useAcesso() {
  const [fase, despachar] = useReducer(proximaFase, faseInicial);
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const verificado = codigoConfirmado(fase);

  function limparMensagens() {
    setErro(null);
    setAviso(null);
  }

  function abrirRecuperacao() {
    despachar('abrirRecuperacao');
    setCodigo('');
    setSenha('');
    limparMensagens();
  }

  async function voltarAoLogin() {
    if (ocupado) return;
    // Com o código já validado há sessão aberta; sem fechá-la o app entraria sem a nova senha.
    if (verificado) await encerrarSessao().catch(() => {});
    definirRecuperacaoAtiva(false);
    despachar('voltarAoLogin');
    setCodigo('');
    setSenha('');
    limparMensagens();
  }

  function alternarCadastro() {
    despachar('alternarCadastro');
    limparMensagens();
  }

  async function enviarCodigo() {
    if (ocupado) return;
    limparMensagens();
    try {
      validarEmailRecuperacao(email);
      await executarAuth(() => enviarCodigoRecuperacao(email.trim()), setOcupado);
      despachar('codigoEnviado');
      setAviso('Se existir uma conta com este e-mail, enviamos um código de verificação.');
    } catch (f) {
      setErro(erroAuth(f));
    }
  }

  async function redefinirSenha() {
    if (ocupado) return;
    limparMensagens();
    let sessaoAberta = verificado;
    try {
      validarNovaSenha({ codigo, senha, codigoConfirmado: verificado });
      if (!sessaoAberta) {
        definirRecuperacaoAtiva(true);
        await executarAuth(
          () => verificarCodigoRecuperacao(email.trim(), codigo.trim()),
          setOcupado,
        );
        sessaoAberta = true;
        despachar('codigoConfirmado');
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
    const cadastrando = fase.modo === 'cadastrar';
    try {
      validarEntrada(fase.modo, { nome, email, senha });
      const resposta = await executarAuth(
        () =>
          cadastrando
            ? criarConta(nome.trim(), email.trim(), senha)
            : entrarComSenha(email.trim(), senha),
        setOcupado,
      );
      if (cadastrando && !resposta.data.session) {
        setAviso('Conta criada. Confirme seu e-mail antes de entrar.');
        despachar('contaCriada');
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

  /** Ação do botão principal, conforme a fase. */
  function confirmar() {
    if (fase.modo !== 'recuperar') return entrarOuCadastrar();
    return fase.etapa === 'email' ? enviarCodigo() : redefinirSenha();
  }

  return {
    modo: fase.modo,
    etapa: fase.modo === 'recuperar' ? fase.etapa : 'email',
    verificado,
    campos: { nome, email, senha, codigo },
    alterar: { nome: setNome, email: setEmail, senha: setSenha, codigo: setCodigo },
    erro,
    aviso,
    ocupado,
    rotuloAcao: rotuloAcao(fase),
    confirmar,
    enviarCodigo,
    abrirRecuperacao,
    voltarAoLogin,
    alternarCadastro,
    entrarConvidado,
  };
}
