import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { Aviso, Botao } from '@/compartilhado/componentes/Ui';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { confirmarExclusao } from '@/compartilhado/utils/confirmar';
import { useFotoPerfil } from '../useFotoPerfil';

/** A foto é opcional e não faz parte das condições para se candidatar. */
export function FotoPerfil({ nome, papel }: { nome: string; papel: string }) {
  const {
    fotoUrl,
    temFoto,
    carregando,
    ocupado,
    erro,
    aviso,
    selecionar,
    remover,
    recarregar,
    imagemFalhou,
  } = useFotoPerfil();
  const [imagemCarregada, setImagemCarregada] = useState<string | null>(null);
  const [imagemComFalha, setImagemComFalha] = useState<string | null>(null);
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  const iniciais = palavras.length
    ? `${palavras[0][0]}${palavras.length > 1 ? palavras[palavras.length - 1][0] : ''}`.toLocaleUpperCase(
        'pt-BR',
      )
    : 'HC';
  const falhaImagem = !!fotoUrl && imagemComFalha === fotoUrl;
  const mostrandoFoto = !!fotoUrl && !falhaImagem;
  const abrindoImagem = mostrandoFoto && imagemCarregada !== fotoUrl;
  const inativo = ocupado || carregando;
  const aoCarregarImagem = useCallback(() => setImagemCarregada(fotoUrl), [fotoUrl]);
  const aoFalharImagem = useCallback(() => {
    setImagemComFalha(fotoUrl);
    imagemFalhou(fotoUrl);
  }, [fotoUrl, imagemFalhou]);

  function tentarNovamente() {
    setImagemComFalha(null);
    setImagemCarregada(null);
    void recarregar();
  }

  return (
    <View style={estilos.cartao}>
      <View style={estilos.identidade}>
        <View style={estilos.avatar}>
          <Text style={estilos.iniciais} accessible={false}>
            {iniciais}
          </Text>
          {mostrandoFoto ? (
            <Image
              key={fotoUrl}
              source={{ uri: fotoUrl }}
              style={estilos.imagem}
              resizeMode="cover"
              accessibilityLabel={`Foto de perfil de ${nome}`}
              onLoad={aoCarregarImagem}
              onError={aoFalharImagem}
            />
          ) : null}
          {carregando || ocupado || abrindoImagem ? (
            <View style={estilos.carregamento}>
              <ActivityIndicator
                color={cores.folha}
                accessibilityLabel={
                  ocupado ? 'Atualizando foto de perfil' : 'Carregando foto de perfil'
                }
              />
            </View>
          ) : null}
        </View>
        <View style={estilos.identificacao}>
          <Text style={estilos.nome}>{nome}</Text>
          <Text style={[estilos.papel, estilos.papelTexto]}>{papel}</Text>
          <Text style={[tipo.apoio, estilos.dicaOpcional]}>Sua foto de perfil é opcional.</Text>
        </View>
      </View>
      <View style={estilos.acoes}>
        <View style={estilos.acao}>
          <Botao
            titulo={temFoto ? 'Alterar foto' : 'Adicionar foto'}
            variante="primario"
            carregando={ocupado}
            desabilitado={carregando}
            onPress={() => {
              void selecionar();
            }}
          />
        </View>
        {temFoto ? (
          <View style={estilos.acao}>
            <Botao
              titulo="Remover foto"
              variante="destrutivo"
              desabilitado={inativo}
              onPress={() =>
                confirmarExclusao(
                  'Remover foto de perfil?',
                  'Sua foto será removida. As iniciais do seu nome aparecem no lugar dela.',
                  () => {
                    void remover();
                  },
                )
              }
            />
          </View>
        ) : null}
      </View>
      {erro ? <Aviso mensagem={erro} /> : null}
      {falhaImagem && !erro ? (
        <Aviso mensagem="Não foi possível mostrar sua foto. Tente carregar novamente." />
      ) : null}
      {erro || falhaImagem ? (
        <Botao
          titulo="Tentar carregar foto"
          variante="contorno"
          desabilitado={inativo}
          onPress={tentarNovamente}
        />
      ) : null}
      {aviso ? (
        <Text style={estilos.aviso} accessibilityLiveRegion="polite">
          {aviso}
        </Text>
      ) : null}
      {!carregando && !ocupado ? (
        <Text style={estilos.dica}>
          Ao escolher ou remover uma foto, a alteração é salva na hora.
        </Text>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    padding: espaco.md,
    gap: espaco.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.fundo,
  },
  identidade: { alignItems: 'center', gap: espaco.md },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: cores.folhaClara,
  },
  iniciais: { fontSize: 28, fontWeight: '700', color: cores.folha },
  imagem: { position: 'absolute', top: 0, left: 0, width: 88, height: 88 },
  carregamento: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  identificacao: { alignItems: 'center', gap: espaco.xs, minWidth: 0 },
  nome: { fontSize: 20, fontWeight: '700', color: cores.tinta, textAlign: 'center' },
  papelTexto: { textAlign: 'center' },
  dicaOpcional: { textAlign: 'center' },
  papel: { ...tipo.apoio, color: cores.folha, fontWeight: '600' },
  acoes: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: espaco.sm,
  },
  acao: { width: '100%', maxWidth: 280 },
  aviso: { ...tipo.apoio, color: cores.folha, textAlign: 'center' },
  dica: { ...tipo.apoio, fontSize: 12, textAlign: 'center' },
});
