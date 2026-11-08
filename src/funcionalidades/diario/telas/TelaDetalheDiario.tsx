import React, { useCallback } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { Text } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useAcao } from '@/compartilhado/hooks/useAcao';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { confirmarAcao, confirmarExclusao } from '@/compartilhado/utils/confirmar';
import { tipo } from '@/compartilhado/tema';
import { detalheDiario, excluirDiario, statusDiario } from '../api';
import { DataPublicacao } from '../componentes/DataPublicacao';
import { ImagemDiario } from '../componentes/ImagemDiario';

export function TelaDetalheDiario({
  id,
  voltar,
  editar,
}: {
  id: number;
  voltar: () => void;
  editar: () => void;
}) {
  const { ehGestao: gestao } = useSessaoAtual();
  const { dados, erro, carregando, carregar } = useConsulta(
    useCallback(() => detalheDiario(id), [id]),
  );
  const acao = useAcao();
  function mudarVisibilidade() {
    if (!dados) return;
    void acao.executar(async () => {
      await statusDiario(id, dados.status === 'PUBLICADA' ? 'OCULTA' : 'PUBLICADA', dados.revisao);
      await carregar();
    });
  }
  function excluir() {
    if (!dados) return;
    void acao.executar(async () => {
      await excluirDiario(id, dados.revisao);
      voltar();
    });
  }
  return (
    <TelaFluxo
      titulo="Publicação"
      voltar={voltar}
      erro={acao.erro ?? erro}
      carregando={carregando}
      atualizar={() => {
        acao.limpar();
        void carregar();
      }}
    >
      {dados ? (
        <>
          <Text style={tipo.titulo}>{dados.titulo}</Text>
          <DataPublicacao p={dados} />
          {dados.imagem_caminho ? <ImagemDiario caminho={dados.imagem_caminho} /> : null}
          <Text style={tipo.corpo}>
            {dados.texto ?? dados.descricao_curta ?? 'Relato não informado.'}
          </Text>
          {gestao ? (
            <>
              {dados.imagem_com_menores ? (
                <Text style={tipo.apoio}>
                  Imagem com crianças ou adolescentes · autorização dos responsáveis declarada.
                </Text>
              ) : null}
              <Botao titulo="Editar publicação" onPress={editar} desabilitado={acao.ocupado} />
              <Botao
                titulo={dados.status === 'PUBLICADA' ? 'Ocultar publicação' : 'Publicar novamente'}
                variante="contorno"
                carregando={acao.ocupado}
                onPress={() =>
                  confirmarAcao(
                    'Alterar visibilidade?',
                    dados.status === 'PUBLICADA'
                      ? 'A publicação deixará de aparecer para a comunidade.'
                      : 'A publicação ficará visível para usuários autenticados.',
                    'Confirmar',
                    () => {
                      mudarVisibilidade();
                    },
                  )
                }
              />
              <Botao
                titulo="Excluir publicação"
                variante="destrutivo"
                desabilitado={acao.ocupado}
                onPress={() =>
                  confirmarExclusao(
                    'Excluir publicação?',
                    `"${dados.titulo}" será apagada definitivamente${dados.imagem_caminho ? ', com a imagem' : ''}.${dados.status === 'PUBLICADA' ? ' Para só tirar do ar, use "Ocultar publicação".' : ''}`,
                    () => {
                      excluir();
                    },
                  )
                }
              />
            </>
          ) : null}
        </>
      ) : null}
    </TelaFluxo>
  );
}
