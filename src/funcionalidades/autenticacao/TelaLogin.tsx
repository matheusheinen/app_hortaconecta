import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputProps,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { executarAuth, erroAuth } from './operacaoAuth';
import { supabase } from '@/servicos/supabase';
import { codigoRecuperacaoValido, definirRecuperacaoAtiva } from './recuperacaoSenha';
import { Aviso } from '@/compartilhado/componentes/Ui';

export const fundoLogin = '#F7F5EF';
const verde = '#2D6B51';

function CampoAcesso({
  rotulo,
  referencia,
  ...props
}: TextInputProps & {
  rotulo: string;
  referencia?: React.Ref<TextInput>;
}) {
  return (
    <View style={estilos.campo}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        ref={referencia}
        accessibilityLabel={rotulo}
        placeholderTextColor="#7A9386"
        selectionColor={verde}
        {...props}
        style={estilos.entrada}
      />
    </View>
  );
}

function SimboloHorta() {
  return (
    <View
      style={estilos.simbolo}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={44} height={44} viewBox="0 0 48 48" fill="none">
        <Path
          d="M14 40C18 32 25 25 33 9"
          stroke="#C4DD69"
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <Path d="M21 31C13 30 11 25 12 19C18 20 23 25 21 31Z" fill="#B6D557" />
        <Path d="M26 23C19 20 18 15 20 10C26 13 29 18 26 23Z" fill="#D5E77E" />
        <Path d="M31 15C28 10 30 6 35 4C36 10 35 13 31 15Z" fill="#B6D557" />
        <Path d="M19 34C24 29 31 29 36 31C31 37 25 39 19 34Z" fill="#D5E77E" />
        <Path d="M26 25C30 19 36 18 41 20C37 25 32 28 26 25Z" fill="#B6D557" />
      </Svg>
    </View>
  );
}

export function TelaLogin({ erroSessao }: { erroSessao?: string | null }) {
  const [modo, setModo] = useState<'entrar' | 'cadastrar' | 'recuperar'>('entrar');
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [codigo, setCodigo] = useState('');
  const [verificado, setVerificado] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const campoEmail = useRef<TextInput>(null);
  const campoSenha = useRef<TextInput>(null);
  const { height } = useWindowDimensions();

  const cadastrando = modo === 'cadastrar';
  const recuperando = modo === 'recuperar';
  const botaoRotulo = recuperando
    ? etapa === 'email'
      ? 'Enviar código'
      : 'Redefinir senha'
    : cadastrando
      ? 'Criar conta'
      : 'Entrar';

  function abrirRecuperacao() {
    setModo('recuperar');
    setEtapa('email');
    setCodigo('');
    setSenha('');
    setVerificado(false);
    setErro(null);
    setAviso(null);
  }

  async function voltarAoLogin() {
    if (ocupado) return;
    // Com o código já validado há sessão aberta; sem fechá-la o app entraria sem a nova senha.
    if (verificado) await supabase.auth.signOut().catch(() => {});
    definirRecuperacaoAtiva(false);
    setModo('entrar');
    setVerificado(false);
    setCodigo('');
    setSenha('');
    setErro(null);
    setAviso(null);
  }

  async function enviarCodigo() {
    if (ocupado) return;
    setErro(null);
    setAviso(null);
    if (!email.trim()) {
      setErro('Informe o e-mail da conta.');
      return;
    }
    try {
      await executarAuth(() => supabase.auth.resetPasswordForEmail(email.trim()), setOcupado);
      setEtapa('codigo');
      setAviso('Se existir uma conta com este e-mail, enviamos um código de verificação.');
    } catch (f) {
      setErro(erroAuth(f));
    }
  }

  async function redefinirSenha() {
    if (ocupado) return;
    setErro(null);
    setAviso(null);
    if (!verificado && !codigoRecuperacaoValido(codigo)) {
      setErro('Informe o código recebido por e-mail.');
      return;
    }
    if (senha.length < 6) {
      setErro('A senha precisa ter ao menos 6 caracteres.');
      return;
    }
    let sessaoAberta = verificado;
    try {
      if (!sessaoAberta) {
        definirRecuperacaoAtiva(true);
        await executarAuth(
          () =>
            supabase.auth.verifyOtp({
              email: email.trim(),
              token: codigo.trim(),
              type: 'recovery',
            }),
          setOcupado,
        );
        sessaoAberta = true;
        setVerificado(true);
      }
      await executarAuth(() => supabase.auth.updateUser({ password: senha }), setOcupado);
      // Senha trocada: libera o App, que já encontra a sessão aberta.
      definirRecuperacaoAtiva(false);
    } catch (f) {
      if (!sessaoAberta) definirRecuperacaoAtiva(false);
      setErro(erroAuth(f));
    }
  }

  async function enviar() {
    if (ocupado) return;
    setErro(null);
    setAviso(null);

    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.');
      return;
    }
    if (cadastrando && nome.trim().length < 2) {
      setErro('Informe seu nome completo.');
      return;
    }

    try {
      const resposta = await executarAuth(
        () =>
          cadastrando
            ? supabase.auth.signUp({
                email: email.trim(),
                password: senha,
                options: { data: { nome: nome.trim() } },
              })
            : supabase.auth.signInWithPassword({ email: email.trim(), password: senha }),
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
    setErro(null);
    setAviso(null);
    try {
      await executarAuth(() => supabase.auth.signInAnonymously(), setOcupado);
    } catch (f) {
      setErro(erroAuth(f));
    }
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            estilos.marca,
            { paddingTop: cadastrando ? 24 : Math.min(96, Math.max(32, height * 0.09)) },
          ]}
        >
          <SimboloHorta />
          <Text accessibilityRole="header" style={estilos.marcaTexto}>
            Horta Conecta
          </Text>
          <Text style={estilos.chamada}>Comunidade, natureza e impacto social</Text>
        </View>

        <View style={estilos.formulario}>
          {cadastrando ? <Text style={estilos.tituloCadastro}>Crie sua conta</Text> : null}
          {recuperando ? <Text style={estilos.tituloCadastro}>Recuperar senha</Text> : null}
          {erro || erroSessao ? (
            <View accessibilityLiveRegion="polite">
              <Aviso mensagem={erro ?? erroSessao!} />
            </View>
          ) : null}
          {aviso ? (
            <View style={estilos.aviso} accessibilityLiveRegion="polite">
              <Text style={estilos.avisoTexto}>{aviso}</Text>
            </View>
          ) : null}

          {cadastrando ? (
            <CampoAcesso
              rotulo="NOME COMPLETO"
              value={nome}
              onChangeText={setNome}
              placeholder="Como você se chama?"
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => campoEmail.current?.focus()}
              editable={!ocupado}
            />
          ) : null}

          <CampoAcesso
            rotulo="E-MAIL"
            referencia={campoEmail}
            value={email}
            onChangeText={setEmail}
            placeholder="seuemail@exemplo.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => {
              if (recuperando) void enviarCodigo();
              else campoSenha.current?.focus();
            }}
            editable={!ocupado && !(recuperando && etapa === 'codigo')}
          />

          {recuperando && etapa === 'codigo' ? (
            <CampoAcesso
              rotulo="CÓDIGO DO E-MAIL"
              value={codigo}
              onChangeText={setCodigo}
              placeholder="Código recebido"
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={10}
              returnKeyType="next"
              onSubmitEditing={() => campoSenha.current?.focus()}
              editable={!ocupado && !verificado}
            />
          ) : null}

          {!recuperando || etapa === 'codigo' ? (
            <CampoAcesso
              rotulo={recuperando ? 'NOVA SENHA' : 'SENHA'}
              referencia={campoSenha}
              value={senha}
              onChangeText={setSenha}
              placeholder={
                cadastrando
                  ? 'Crie sua senha'
                  : recuperando
                    ? 'Crie a nova senha'
                    : 'Digite sua senha'
              }
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={cadastrando || recuperando ? 'new-password' : 'current-password'}
              textContentType={cadastrando || recuperando ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={() => {
                void (recuperando ? redefinirSenha() : enviar());
              }}
              editable={!ocupado}
            />
          ) : null}

          {modo === 'entrar' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Esqueci minha senha"
              disabled={ocupado}
              onPress={abrirRecuperacao}
              style={({ pressed }) => [estilos.esqueci, pressed && estilos.pressionado]}
            >
              <Text style={estilos.link}>Esqueci minha senha</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              void (recuperando
                ? etapa === 'email'
                  ? enviarCodigo()
                  : redefinirSenha()
                : enviar());
            }}
            disabled={ocupado}
            accessibilityRole="button"
            accessibilityLabel={botaoRotulo}
            accessibilityState={{ disabled: ocupado, busy: ocupado }}
            style={({ pressed }) => [
              estilos.botao,
              pressed && estilos.pressionado,
              ocupado && estilos.inativo,
            ]}
          >
            {ocupado ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={estilos.botaoTexto}>{botaoRotulo}</Text>
            )}
          </Pressable>
        </View>

        <View style={estilos.rodape}>
          {recuperando ? (
            <Pressable
              accessibilityRole="button"
              disabled={ocupado}
              accessibilityState={{ disabled: ocupado }}
              onPress={() => {
                void voltarAoLogin();
              }}
              style={({ pressed }) => [estilos.alternar, pressed && estilos.pressionado]}
            >
              <Text style={estilos.rodapeTexto}>
                <Text style={estilos.link}>Voltar para o login</Text>
              </Text>
            </Pressable>
          ) : null}
          {modo === 'entrar' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Entrar como convidado"
              accessibilityHint="Só visualização, sem criar conta"
              disabled={ocupado}
              accessibilityState={{ disabled: ocupado }}
              onPress={() => {
                void entrarConvidado();
              }}
              style={({ pressed }) => [estilos.alternar, pressed && estilos.pressionado]}
            >
              <Text style={estilos.rodapeTexto}>
                Só quer conhecer? <Text style={estilos.link}>Entrar como convidado</Text>
              </Text>
            </Pressable>
          ) : null}
          {!recuperando ? (
            <Pressable
              accessibilityRole="button"
              disabled={ocupado}
              accessibilityState={{ disabled: ocupado }}
              onPress={() => {
                setModo(cadastrando ? 'entrar' : 'cadastrar');
                setErro(null);
                setAviso(null);
              }}
              style={({ pressed }) => [estilos.alternar, pressed && estilos.pressionado]}
            >
              <Text style={estilos.rodapeTexto}>
                {cadastrando ? 'Já tem conta? ' : 'Não tem conta? '}
                <Text style={estilos.link}>{cadastrando ? 'Entrar' : 'Criar conta'}</Text>
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: fundoLogin },
  conteudo: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 24,
  },
  marca: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 44,
  },
  simbolo: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: verde,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    boxShadow: '0px 4px 8px rgba(28, 67, 48, 0.12)',
  },
  marcaTexto: {
    fontSize: 28,
    fontWeight: '700',
    color: '#143E37',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  chamada: { color: '#718578', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 6 },
  formulario: { width: '100%', maxWidth: 380 },
  tituloCadastro: { fontSize: 20, fontWeight: '600', color: '#143E37', marginBottom: 22 },
  campo: { marginBottom: 18 },
  rotulo: {
    color: '#4D7062',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  entrada: {
    minHeight: 54,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#DCE9E0',
    backgroundColor: '#EFF7F2',
    color: '#143E37',
    fontSize: 15,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  botao: {
    minHeight: 56,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: verde,
    boxShadow: '0px 3px 5px rgba(28, 67, 48, 0.16)',
  },
  botaoTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pressionado: { opacity: 0.8 },
  inativo: { opacity: 0.6 },
  aviso: { padding: 16, marginBottom: 20, borderRadius: 16, backgroundColor: '#E5EFE5' },
  avisoTexto: { color: verde, fontSize: 14, lineHeight: 21 },
  rodape: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: 48,
    width: '100%',
  },
  alternar: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rodapeTexto: { color: '#718578', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  esqueci: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: -8,
    marginBottom: 4,
  },
  link: { color: verde, fontWeight: '600' },
});
