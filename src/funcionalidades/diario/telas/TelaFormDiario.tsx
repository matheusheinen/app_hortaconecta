import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Text } from 'react-native';
import { Aviso, Botao, Campo } from '@/compartilhado/componentes/Ui';
import { TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { tipo } from '@/compartilhado/tema';
import { detalheDiario, salvarDiario } from '../api';
import { selecionarImagemDiario } from '../imagemDiario';
import type { Publicacao } from '../tipos';
import { ImagemDiario } from '../componentes/ImagemDiario';
import { OpcaoMarcavel } from '@/funcionalidades/perfil/componentes/PerfilSecoes';

export function TelaFormDiario({ id, voltar }: { id: number | null; voltar: () => void }) {
  const { dados, erro, carregando, carregar } = useConsulta(
    useCallback(async () => (id === null ? null : detalheDiario(id)), [id]),
  );
  return (
    <TelaFluxo
      titulo={id === null ? 'Criar publicação' : 'Editar publicação'}
      voltar={voltar}
      erro={erro}
      carregando={carregando}
      atualizar={carregar}
    >
      {!erro && !carregando ? (
        <Formulario
          key={dados?.atualizado_em ?? 'nova'}
          p={dados}
          voltar={voltar}
          recarregar={carregar}
        />
      ) : null}
    </TelaFluxo>
  );
}

// Não usa useAcao: se a tela fechar durante o envio, voltar() não pode rodar.
function Formulario({
  p,
  voltar,
  recarregar,
}: {
  p: Publicacao | null;
  voltar: () => void;
  recarregar: () => Promise<void>;
}) {
  const [titulo, setTitulo] = useState(p?.titulo ?? '');
  const [texto, setTexto] = useState(p?.texto ?? p?.descricao_curta ?? '');
  const [status, setStatus] = useState<'PUBLICADA' | 'OCULTA'>(p?.status ?? 'PUBLICADA');
  const [caminho, setCaminho] = useState(p?.imagem_caminho ?? null);
  const [foto, setFoto] = useState<{ uri: string; base64: string } | null>(null);
  const [comMenores, setComMenores] = useState(p?.imagem_com_menores ?? false);
  const [autorizacao, setAutorizacao] = useState(p?.autorizacao_responsaveis ?? false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const trava = useRef(false),
    montado = useRef(true);
  // Imagem nova: a gestão precisa avaliar de novo (B26). Ajuste durante a
  // renderização, como recomenda o React, em vez de um efeito.
  const [fotoAvaliada, setFotoAvaliada] = useState(foto);
  if (foto !== fotoAvaliada) {
    setFotoAvaliada(foto);
    if (foto) {
      setComMenores(false);
      setAutorizacao(false);
    }
  }
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  async function escolher() {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro(null);
    try {
      const imagem = await selecionarImagemDiario();
      if (!imagem || !montado.current) return;
      setFoto(imagem);
    } catch (f) {
      if (montado.current) setErro(mensagemErro(f));
    } finally {
      trava.current = false;
      if (montado.current) setOcupado(false);
    }
  }
  async function salvar() {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro(null);
    try {
      await salvarDiario({
        revisao: p?.revisao ?? null,
        id: p?.id ?? null,
        titulo,
        texto,
        status,
        imagem: caminho,
        base64: foto?.base64 ?? null,
        comMenores,
        autorizacao,
      });
      if (montado.current) voltar();
    } catch (f) {
      if (montado.current) setErro(mensagemErro(f));
    } finally {
      trava.current = false;
      if (montado.current) setOcupado(false);
    }
  }
  return (
    <>
      {erro ? (
        <>
          <Aviso mensagem={erro} />
          <Botao
            titulo="Recarregar dados (descartar edição)"
            onPress={() => {
              void recarregar();
            }}
          />
        </>
      ) : null}
      <Campo
        rotulo="Título"
        value={titulo}
        onChangeText={setTitulo}
        maxLength={120}
        editable={!ocupado}
      />
      <Campo
        rotulo="Relato da instituição"
        value={texto}
        onChangeText={setTexto}
        multiline
        maxLength={20000}
        editable={!ocupado}
        style={{ minHeight: 160, textAlignVertical: 'top' }}
      />
      <Text style={tipo.apoio}>
        Imagem opcional. Ela é reduzida e comprimida no aparelho antes do envio. Publique registros
        institucionais das atividades.
      </Text>
      {foto ? (
        <Image
          source={{ uri: foto.uri }}
          style={{ height: 220, width: '100%', borderRadius: 10 }}
          accessibilityLabel="Prévia da imagem selecionada"
        />
      ) : caminho ? (
        <ImagemDiario caminho={caminho} />
      ) : (
        <Text style={tipo.apoio}>Publicação sem imagem.</Text>
      )}
      <Botao
        titulo={foto || caminho ? 'Substituir imagem' : 'Adicionar imagem'}
        variante="contorno"
        desabilitado={ocupado}
        onPress={() => {
          void escolher();
        }}
      />
      {foto || caminho ? (
        <Botao
          titulo="Remover imagem da publicação"
          variante="contorno"
          desabilitado={ocupado}
          onPress={() => {
            setFoto(null);
            setCaminho(null);
            setComMenores(false);
            setAutorizacao(false);
          }}
        />
      ) : null}
      {foto || caminho ? (
        <>
          <Text style={tipo.corpo}>A imagem mostra crianças ou adolescentes?</Text>
          <OpcaoMarcavel
            rotulo="Não"
            rotuloAcessivel="A imagem não mostra crianças ou adolescentes"
            ativa={!comMenores}
            onPress={() => {
              setComMenores(false);
              setAutorizacao(false);
            }}
          />
          <OpcaoMarcavel
            rotulo="Sim"
            rotuloAcessivel="A imagem mostra crianças ou adolescentes"
            ativa={comMenores}
            onPress={() => setComMenores(true)}
          />
          {comMenores ? (
            <>
              <OpcaoMarcavel
                rotulo="Tenho a autorização dos responsáveis para publicar esta imagem"
                ativa={autorizacao}
                onPress={() => setAutorizacao(!autorizacao)}
              />
              <Text style={tipo.apoio}>
                Guarde a autorização assinada com a instituição. Sem ela, remova a imagem e publique
                só o relato.
              </Text>
            </>
          ) : null}
        </>
      ) : null}
      <Text style={tipo.corpo}>
        Visibilidade:{' '}
        {status === 'PUBLICADA' ? 'Publicada para usuários autenticados' : 'Oculta, somente gestão'}
      </Text>
      <Botao
        titulo={status === 'PUBLICADA' ? 'Manter oculta' : 'Publicar para usuários autenticados'}
        variante="contorno"
        desabilitado={ocupado}
        onPress={() => setStatus(status === 'PUBLICADA' ? 'OCULTA' : 'PUBLICADA')}
      />
      <Botao
        titulo={status === 'PUBLICADA' ? 'Salvar e publicar' : 'Salvar oculta'}
        carregando={ocupado}
        onPress={() => {
          void salvar();
        }}
      />
    </>
  );
}
