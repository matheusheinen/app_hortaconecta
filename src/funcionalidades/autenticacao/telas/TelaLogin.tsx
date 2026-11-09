import React, { useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextInputInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import { Aviso } from '@/compartilhado/componentes/Ui';
import { cores } from '@/compartilhado/tema';
import { useAcesso } from '../useAcesso';
import { CampoAcesso } from '../componentes/CampoAcesso';
import { SimboloHorta } from '../componentes/SimboloHorta';

export const fundoLogin = cores.superficie;

export function TelaLogin({ erroSessao }: { erroSessao?: string | null }) {
  const acesso = useAcesso();
  const { modo, etapa, verificado, campos, alterar, erro, aviso, ocupado } = acesso;
  const campoEmail = useRef<TextInputInstance>(null);
  const campoSenha = useRef<TextInputInstance>(null);
  const { height } = useWindowDimensions();

  const cadastrando = modo === 'cadastrar';
  const recuperando = modo === 'recuperar';
  const senhaNova = cadastrando || recuperando;

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
          {cadastrando ? <Text style={estilos.titulo}>Crie sua conta</Text> : null}
          {recuperando ? <Text style={estilos.titulo}>Recuperar senha</Text> : null}
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
              value={campos.nome}
              onChangeText={alterar.nome}
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
            value={campos.email}
            onChangeText={alterar.email}
            placeholder="seuemail@exemplo.com"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => {
              if (recuperando) void acesso.enviarCodigo();
              else campoSenha.current?.focus();
            }}
            editable={!ocupado && !(recuperando && etapa === 'codigo')}
          />

          {recuperando && etapa === 'codigo' ? (
            <CampoAcesso
              rotulo="CÓDIGO DO E-MAIL"
              value={campos.codigo}
              onChangeText={alterar.codigo}
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
              value={campos.senha}
              onChangeText={alterar.senha}
              placeholder={
                cadastrando
                  ? 'Crie uma senha (mínimo 8 caracteres)'
                  : recuperando
                    ? 'Nova senha (mínimo 8 caracteres)'
                    : 'Digite sua senha'
              }
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={senhaNova ? 'new-password' : 'current-password'}
              textContentType={senhaNova ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={() => {
                void acesso.confirmar();
              }}
              editable={!ocupado}
            />
          ) : null}

          {modo === 'entrar' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Esqueci minha senha"
              disabled={ocupado}
              onPress={acesso.abrirRecuperacao}
              style={({ pressed }) => [estilos.esqueci, pressed && estilos.pressionado]}
            >
              <Text style={estilos.link}>Esqueci minha senha</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              void acesso.confirmar();
            }}
            disabled={ocupado}
            accessibilityRole="button"
            accessibilityLabel={acesso.rotuloAcao}
            accessibilityState={{ disabled: ocupado, busy: ocupado }}
            style={({ pressed }) => [
              estilos.botao,
              pressed && estilos.pressionado,
              ocupado && estilos.inativo,
            ]}
          >
            {ocupado ? (
              <ActivityIndicator color={cores.fundo} />
            ) : (
              <Text style={estilos.botaoTexto}>{acesso.rotuloAcao}</Text>
            )}
          </Pressable>
        </View>

        <View style={estilos.rodape}>
          {recuperando ? (
            <LinkRodape
              desabilitado={ocupado}
              onPress={() => {
                void acesso.voltarAoLogin();
              }}
            >
              <Text style={estilos.link}>Voltar para o login</Text>
            </LinkRodape>
          ) : null}
          {modo === 'entrar' ? (
            <LinkRodape
              desabilitado={ocupado}
              rotulo="Entrar como convidado"
              dica="Só visualização, sem criar conta"
              onPress={() => {
                void acesso.entrarConvidado();
              }}
            >
              Só quer conhecer? <Text style={estilos.link}>Entrar como convidado</Text>
            </LinkRodape>
          ) : null}
          {!recuperando ? (
            <LinkRodape desabilitado={ocupado} onPress={acesso.alternarCadastro}>
              {cadastrando ? 'Já tem conta? ' : 'Não tem conta? '}
              <Text style={estilos.link}>{cadastrando ? 'Entrar' : 'Criar conta'}</Text>
            </LinkRodape>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Link de texto centralizado no rodapé da tela de acesso. */
function LinkRodape({
  desabilitado,
  rotulo,
  dica,
  onPress,
  children,
}: {
  desabilitado: boolean;
  rotulo?: string;
  dica?: string;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint={dica}
      disabled={desabilitado}
      accessibilityState={{ disabled: desabilitado }}
      onPress={onPress}
      style={({ pressed }) => [estilos.alternar, pressed && estilos.pressionado]}
    >
      <Text style={estilos.rodapeTexto}>{children}</Text>
    </Pressable>
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
  marcaTexto: {
    fontSize: 28,
    fontWeight: '700',
    color: cores.tinta,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  chamada: {
    color: cores.tintaClara,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
  },
  formulario: { width: '100%', maxWidth: 380 },
  titulo: { fontSize: 20, fontWeight: '600', color: cores.tinta, marginBottom: 22 },
  botao: {
    minHeight: 56,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.folha,
    boxShadow: '0px 3px 5px rgba(28, 67, 48, 0.16)',
  },
  botaoTexto: { color: cores.fundo, fontSize: 16, fontWeight: '700' },
  pressionado: { opacity: 0.8 },
  inativo: { opacity: 0.6 },
  aviso: { padding: 16, marginBottom: 20, borderRadius: 16, backgroundColor: cores.avisoFundo },
  avisoTexto: { color: cores.folha, fontSize: 14, lineHeight: 21 },
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
  rodapeTexto: { color: cores.tintaClara, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  esqueci: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: -8,
    marginBottom: 4,
  },
  link: { color: cores.folha, fontWeight: '600' },
});
