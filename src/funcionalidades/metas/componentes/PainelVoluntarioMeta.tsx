import React, { useEffect, useState } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { Alert, Image, StyleSheet, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Aviso, Botao, Campo } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useAcao } from '@/compartilhado/hooks/useAcao';
import { useConfiguracaoInstituicao } from '@/compartilhado/hooks/useConfiguracaoInstituicao';
import { formatarDataCurta, formatarDataHora } from '@/compartilhado/utils/datas';
import { mascararTelefone } from '@/compartilhado/utils/mascaras';
import { abrirWhatsApp } from '@/compartilhado/utils/whatsapp';
import { cores, tipo } from '@/compartilhado/tema';
import { rotuloStatusValidacao, type Meta } from '../tipos';
import { carregarPix, declararContribuicao, type ContribuicaoComDoador, type Pix } from '../api';
import { descreverQuantidade, interpretarQuantidade } from '../regras';
import { estilosMeta } from './IndicadoresMeta';
import { ComprovanteContribuicao } from './ComprovanteContribuicao';

export function PainelVoluntarioMeta({
  meta,
  contribuicoes,
  recebendo,
  vencido,
  aoDeclarar,
  minhas,
}: {
  meta: Meta;
  contribuicoes: ContribuicaoComDoador[];
  recebendo: boolean;
  vencido: boolean;
  aoDeclarar: () => Promise<void>;
  minhas: () => void;
}) {
  const { usuarioId } = useSessaoAtual();
  const { configuracao } = useConfiguracaoInstituicao();
  const [pix, setPix] = useState<Pix | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [quantidade, setQuantidade] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [comprovante, setComprovante] = useState<{ uri: string; base64: string } | null>(null);
  const acao = useAcao();
  const financeira = meta.tipo === 'FINANCEIRA';

  useEffect(() => {
    if (!financeira) return;
    let ativo = true;
    carregarPix()
      .then(r => {
        if (ativo) setPix(r);
      })
      .catch(() => {
        if (ativo) setPix({ chave_pix: null, nome_beneficiario_pix: null });
      });
    return () => {
      ativo = false;
    };
  }, [financeira]);

  async function copiar() {
    if (!pix?.chave_pix) return;
    await Clipboard.setStringAsync(pix.chave_pix);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }
  async function falar() {
    const numero = configuracao?.whatsapp;
    if (!numero) return;
    const mensagem = financeira
      ? `Olá! Vi a meta "${meta.titulo}" no app e tenho uma dúvida sobre a doação.`
      : `Olá! Vi a meta "${meta.titulo}" no app e quero contribuir com material. Como combinamos a entrega?`;
    if (!(await abrirWhatsApp(numero, mensagem))) {
      Alert.alert(
        'Não foi possível abrir o WhatsApp',
        `Fale com a gestão pelo número ${mascararTelefone(numero)}.`,
      );
    }
  }
  async function escolherComprovante() {
    try {
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
        exif: false,
        allowsMultipleSelection: false,
      });
      if (resultado.canceled) return;
      const asset = resultado.assets[0];
      if (!asset.base64) throw new Error('Não foi possível ler a imagem. Escolha outra foto.');
      setComprovante({ uri: asset.uri, base64: asset.base64 });
    } catch (falha) {
      Alert.alert('Comprovante', falha instanceof Error ? falha.message : 'Tente outra imagem.');
    }
  }
  function declarar() {
    const valor = interpretarQuantidade(quantidade);
    if (valor === null) {
      Alert.alert('Valor inválido', 'Informe um valor positivo, com até duas casas decimais.');
      return;
    }
    Alert.alert(
      'Informar doação?',
      `Você informa que transferiu ${descreverQuantidade(valor, meta)}. A gestão confere no extrato antes de somar ao total.`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Informar',
          onPress: () => {
            void acao.executar(async () => {
              await declararContribuicao(meta.id, usuarioId, valor, comprovante?.base64 ?? null);
              setQuantidade('');
              setComprovante(null);
              setSucesso(true);
              await aoDeclarar();
            });
          },
        },
      ],
    );
  }

  return (
    <>
      {!recebendo ? (
        <CartaoFluxo>
          <Text style={tipo.apoio}>
            {vencido && meta.data_limite
              ? `O prazo desta meta terminou em ${formatarDataCurta(meta.data_limite)}. Se ainda quiser ajudar, fale com a gestão.`
              : 'Esta meta não está mais recebendo contribuições.'}
          </Text>
        </CartaoFluxo>
      ) : financeira ? (
        <>
          <Text style={tipo.secao}>Como apadrinhar</Text>
          <Text style={tipo.corpo}>
            1. Copie a chave PIX da instituição.{'\n'}2. Faça a transferência no app do seu banco.
            {'\n'}3. Volte aqui e informe o valor transferido.
          </Text>
          <CartaoFluxo>
            {pix === null ? (
              <Text style={tipo.apoio}>Carregando chave PIX…</Text>
            ) : pix.chave_pix ? (
              <>
                <Text style={tipo.apoio}>
                  Chave PIX{pix.nome_beneficiario_pix ? ` · ${pix.nome_beneficiario_pix}` : ''}
                </Text>
                <Text style={estilos.chave} selectable>
                  {pix.chave_pix}
                </Text>
                <Botao
                  titulo={copiado ? 'Copiada!' : 'Copiar chave'}
                  variante="contorno"
                  onPress={() => {
                    void copiar();
                  }}
                />
              </>
            ) : (
              <Text style={tipo.apoio}>A chave PIX ainda não foi cadastrada pela gestão.</Text>
            )}
          </CartaoFluxo>
          {acao.erro ? <Aviso mensagem={acao.erro} /> : null}
          <Campo
            rotulo="Valor transferido (R$)"
            value={quantidade}
            onChangeText={setQuantidade}
            keyboardType="decimal-pad"
            placeholder="Ex.: 25,00"
          />
          {comprovante ? (
            <>
              <Image
                source={{ uri: comprovante.uri }}
                style={{ height: 180, width: '100%', borderRadius: 10 }}
                resizeMode="contain"
                accessibilityLabel="Comprovante selecionado"
              />
              <Botao
                titulo="Remover comprovante"
                variante="contorno"
                onPress={() => setComprovante(null)}
                desabilitado={acao.ocupado}
              />
            </>
          ) : (
            <Botao
              titulo="Anexar comprovante (opcional)"
              variante="contorno"
              onPress={() => {
                void escolherComprovante();
              }}
              desabilitado={acao.ocupado}
            />
          )}
          <Botao
            titulo="Informar doação"
            carregando={acao.ocupado}
            onPress={declarar}
            desabilitado={!pix?.chave_pix}
          />
          {sucesso ? (
            <Text style={[tipo.corpo, { color: cores.folha }]}>
              Doação informada! A gestão vai conferir e confirmar.
            </Text>
          ) : null}
        </>
      ) : (
        <>
          <Text style={tipo.secao}>Como ajudar</Text>
          <Text style={tipo.corpo}>
            Esta meta é de material. Combine com a gestão o que entregar e quando; ela registra a
            doação ao receber.
          </Text>
        </>
      )}
      {configuracao?.whatsapp ? (
        <Botao
          titulo="Falar com a gestão no WhatsApp"
          variante="contorno"
          onPress={() => {
            void falar();
          }}
        />
      ) : null}
      <Text style={tipo.secao}>Suas contribuições nesta meta</Text>
      {!contribuicoes.length ? (
        <Text style={tipo.apoio}>Você ainda não contribuiu com esta meta.</Text>
      ) : null}
      {contribuicoes.map(c => (
        <CartaoFluxo key={c.id}>
          <Text style={estilosMeta.destaque}>
            {descreverQuantidade(c.quantidade_oferecida, meta)}
          </Text>
          <Text style={tipo.apoio}>
            {rotuloStatusValidacao[c.status_validacao]} · {formatarDataHora(c.data_envio)}
          </Text>
          {c.observacao_validacao ? <Text style={tipo.apoio}>{c.observacao_validacao}</Text> : null}
          {c.url_comprovante ? <ComprovanteContribuicao caminho={c.url_comprovante} /> : null}
        </CartaoFluxo>
      ))}
      <Botao titulo="Minhas contribuições" variante="contorno" onPress={minhas} />
    </>
  );
}

const estilos = StyleSheet.create({
  chave: { fontSize: 16, fontWeight: '700', color: cores.tinta },
});
