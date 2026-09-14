import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { cores, espaco, tipo } from '../lib/tema';
import { Aviso, Botao, Campo } from '../componentes/Ui';

export function TelaLogin() {
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cadastrando = modo === 'cadastrar';

  async function enviar() {
    setErro(null);

    if (!email.trim() || !senha) {
      setErro('Informe e-mail e senha.');
      return;
    }
    if (cadastrando && nome.trim().length < 2) {
      setErro('Informe seu nome completo.');
      return;
    }

    setOcupado(true);

    // O nome viaja em raw_user_meta_data; o trigger handle_new_user()
    // no banco usa esse valor para criar a linha em `usuarios`.
    const resposta = cadastrando
      ? await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { nome: nome.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });

    setOcupado(false);

    if (resposta.error) {
      setErro(traduzErro(resposta.error.message));
      return;
    }

    if (cadastrando && !resposta.data.session) {
      setErro('Conta criada. Confirme o e-mail antes de entrar.');
      setModo('entrar');
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <View style={estilos.marca}>
          <Text style={estilos.marcaTexto}>Horta Conecta</Text>
          <Text style={[tipo.apoio, { marginTop: espaco.xs }]}>
            Centro Ocupacional Bruno José Campos · Guaporé/RS
          </Text>
        </View>

        <Text style={[tipo.titulo, { marginBottom: espaco.lg }]}>
          {cadastrando ? 'Criar conta' : 'Entrar'}
        </Text>

        {erro ? <Aviso mensagem={erro} /> : null}

        {cadastrando ? (
          <Campo
            rotulo="Nome"
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
          />
        ) : null}

        <Campo
          rotulo="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />

        <Campo
          rotulo="Senha"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoCapitalize="none"
        />

        <Botao
          titulo={cadastrando ? 'Criar conta' : 'Entrar'}
          onPress={enviar}
          carregando={ocupado}
        />

        <Pressable
          onPress={() => {
            setModo(cadastrando ? 'entrar' : 'cadastrar');
            setErro(null);
          }}
          style={estilos.alternar}
        >
          <Text style={[tipo.apoio, { color: cores.folha, fontWeight: '600' }]}>
            {cadastrando ? 'Já tenho conta' : 'Quero me cadastrar como voluntário'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function traduzErro(mensagem: string) {
  if (mensagem.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (mensagem.includes('already registered')) return 'Este e-mail já tem conta.';
  if (mensagem.includes('Password should be')) return 'A senha precisa ter ao menos 6 caracteres.';
  return mensagem;
}

const estilos = StyleSheet.create({
  conteudo: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: espaco.lg,
  },
  marca: {
    marginBottom: espaco.xl,
    paddingBottom: espaco.lg,
    borderBottomWidth: 1,
    borderBottomColor: cores.linha,
  },
  marcaTexto: {
    fontSize: 20,
    fontWeight: '700',
    color: cores.folha,
    letterSpacing: -0.3,
  },
  alternar: {
    marginTop: espaco.lg,
    alignItems: 'center',
    paddingVertical: espaco.sm,
  },
});
