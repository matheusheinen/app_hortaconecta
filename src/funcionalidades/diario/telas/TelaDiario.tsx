import React, { useCallback, useMemo, useState } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { memoTela } from '@/compartilhado/componentes/memoTela';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { usePaginasDiario } from '../usePaginasDiario';
import { DataPublicacao } from '../componentes/DataPublicacao';
import { ImagemDiario } from '../componentes/ImagemDiario';
import { listarAutoresDiario } from '../api';
import type { AutorPublicacao } from '../tipos';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';

export const TelaDiario = memoTela(function TelaDiario({
  voltar,
  abrir,
  criar,
}: {
  voltar: () => void;
  abrir: (id: number) => void;
  criar: () => void;
}) {
  const { ehGestao: gestao } = useSessaoAtual();
  const {
    itens: dados,
    temMais,
    erro,
    carregando,
    carregandoMais,
    carregar,
    carregarMais,
  } = usePaginasDiario();
  const idsAutores = useMemo(
    () => [...new Set((dados ?? []).map(p => p.autor_id))].sort(),
    [dados],
  );
  const chaveAutores = idsAutores.join(',');
  const consultarAutores = useCallback(
    () => listarAutoresDiario(chaveAutores ? chaveAutores.split(',') : []),
    [chaveAutores],
  );
  const { dados: autores } = useConsulta(consultarAutores);
  const autoresPorId = useMemo(
    () => new Map((autores ?? []).map(autor => [autor.id, autor] as const)),
    [autores],
  );
  return (
    <TelaFluxo
      titulo="Diário de Transparência"
      voltar={voltar}
      erro={erro}
      carregando={carregando}
      atualizar={carregar}
    >
      <Text style={[tipo.corpo, estilos.descricaoPagina]}>
        Acompanhe os avanços, as ações e as histórias da horta em relatos da equipe.
      </Text>
      {gestao ? (
        <Pressable
          onPress={criar}
          accessibilityRole="button"
          accessibilityLabel="Criar publicação"
          style={({ pressed }) => [estilos.criar, pressed && estilos.pressionado]}
        >
          <Text style={estilos.simboloCriar}>＋</Text>
          <Text style={estilos.textoCriar}>Nova publicação</Text>
        </Pressable>
      ) : null}
      {dados?.length === 0 ? (
        <Text style={[tipo.apoio, estilos.vazio]}>
          🌱 Ainda não há relatos. As novidades da horta aparecem aqui.
        </Text>
      ) : null}
      {dados?.map(p => (
        <CartaoFluxo key={p.id}>
          {p.imagem_caminho ? <ImagemDiario caminho={p.imagem_caminho} altura={156} /> : null}
          {autoresPorId.has(p.autor_id) ? (
            <AssinaturaAutor autor={autoresPorId.get(p.autor_id)!} />
          ) : null}
          <Pressable
            onPress={() => abrir(p.id)}
            accessibilityRole="button"
            accessibilityLabel={`Ler publicação: ${p.titulo}`}
            style={({ pressed }) => [estilos.conteudo, pressed && estilos.pressionado]}
          >
            <Text style={estilos.tituloPublicacao}>{p.titulo}</Text>
            <DataPublicacao p={p} />
            <Text style={tipo.corpo} numberOfLines={3}>
              {p.texto ?? p.descricao_curta ?? 'Relato não informado.'}
            </Text>
            <View style={estilos.acaoLer}>
              <Text style={estilos.linkLer}>Ler relato</Text>
              <Text style={estilos.setaLer}>›</Text>
            </View>
          </Pressable>
        </CartaoFluxo>
      ))}
      {temMais ? (
        <Pressable
          onPress={() => void carregarMais()}
          accessibilityRole="button"
          accessibilityLabel="Carregar publicações anteriores"
          accessibilityState={{ disabled: carregandoMais, busy: carregandoMais }}
          disabled={carregandoMais}
          style={({ pressed }) => [
            estilos.carregarMais,
            pressed && !carregandoMais && estilos.pressionado,
          ]}
        >
          {carregandoMais ? <ActivityIndicator color={cores.folha} /> : null}
          <Text style={estilos.linkLer}>
            {carregandoMais ? 'Carregando…' : 'Ver publicações anteriores'}
          </Text>
        </Pressable>
      ) : null}
    </TelaFluxo>
  );
});

function AssinaturaAutor({ autor }: { autor: AutorPublicacao }) {
  const [falhou, setFalhou] = useState(false);
  const iniciais = autor.nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte[0])
    .join('')
    .toLocaleUpperCase('pt-BR');
  return (
    <View style={estilos.assinatura}>
      <View style={estilos.avatar}>
        <Text style={estilos.iniciais}>{iniciais || 'HC'}</Text>
        {autor.foto_url && !falhou ? (
          <Image
            source={{ uri: autor.foto_url }}
            style={estilos.imagemAutor}
            resizeMode="cover"
            accessibilityLabel={`Foto de ${autor.nome}`}
            onError={() => setFalhou(true)}
          />
        ) : null}
      </View>
      <Text style={estilos.nomeAutor} numberOfLines={1}>
        {autor.nome}
      </Text>
      <Text style={estilos.rotuloAutor}>publicou</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  descricaoPagina: { marginBottom: espaco.xs },
  criar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.sm,
    borderRadius: 12,
    backgroundColor: cores.folha,
  },
  simboloCriar: { color: cores.fundo, fontSize: 18, fontWeight: '700' },
  textoCriar: { color: cores.fundo, fontSize: 14, fontWeight: '700' },
  vazio: { paddingVertical: espaco.sm },
  conteudo: { gap: espaco.sm },
  tituloPublicacao: { ...tipo.secao, fontSize: 17, lineHeight: 23 },
  acaoLer: { flexDirection: 'row', alignItems: 'center', gap: espaco.xs, marginTop: espaco.xs },
  linkLer: { color: cores.folha, fontSize: 13, fontWeight: '700' },
  setaLer: { color: cores.folha, fontSize: 20 },
  carregarMais: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.sm,
    borderRadius: 12,
    backgroundColor: cores.mint,
  },
  pressionado: { opacity: 0.72 },
  assinatura: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: cores.folhaClara,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iniciais: { color: cores.folha, fontSize: 11, fontWeight: '700' },
  imagemAutor: { position: 'absolute', width: 30, height: 30, top: 0, left: 0 },
  nomeAutor: {
    color: cores.tinta,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 180,
    flexShrink: 1,
  },
  rotuloAutor: { color: cores.tintaSuave, fontSize: 12 },
});
