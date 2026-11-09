import React from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { memoTela } from '@/compartilhado/componentes/memoTela';
import { Text } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { tipo } from '@/compartilhado/tema';
import { usePaginasDiario } from '../usePaginasDiario';
import { DataPublicacao } from '../componentes/DataPublicacao';
import { ImagemDiario } from '../componentes/ImagemDiario';

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
  return (
    <TelaFluxo
      titulo="Diário de Transparência"
      voltar={voltar}
      erro={erro}
      carregando={carregando}
      atualizar={carregar}
    >
      {gestao ? <Botao titulo="Criar publicação" onPress={criar} /> : null}
      {dados?.length === 0 ? (
        <Text style={tipo.apoio}>Nenhuma publicação disponível no momento.</Text>
      ) : null}
      {dados?.map(p => (
        <CartaoFluxo key={p.id}>
          {p.imagem_caminho ? <ImagemDiario caminho={p.imagem_caminho} /> : null}
          <Text style={tipo.secao}>{p.titulo}</Text>
          <DataPublicacao p={p} />
          <Text style={tipo.corpo} numberOfLines={3}>
            {p.texto ?? p.descricao_curta ?? 'Relato não informado.'}
          </Text>
          <Botao titulo="Ler publicação" variante="contorno" onPress={() => abrir(p.id)} />
        </CartaoFluxo>
      ))}
      {temMais ? (
        <Botao
          titulo="Carregar mais publicações"
          variante="contorno"
          carregando={carregandoMais}
          onPress={() => {
            void carregarMais();
          }}
        />
      ) : null}
    </TelaFluxo>
  );
});
