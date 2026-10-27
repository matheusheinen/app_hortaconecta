import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { cores, tipo } from '@/compartilhado/tema';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { useAcao } from '@/compartilhado/hooks/useAcao';
import { listarNotificacoes, marcarNotificacaoLida, marcarTodasLidas } from '../api';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { useNotificacoes } from '../ContextoNotificacoes';
import { destinoNotificacao } from '../destino';
import { abrirDestino } from '../navegacao';
import type { Notificacao } from '../tipos';

export function TelaNotificacoes({ voltar }: { voltar: () => void }) {
  const { ehGestao } = useSessaoAtual();
  const { versao, naoLidas, recarregar } = useNotificacoes();
  // A lista é refeita ao focar a tela e a cada notificação recebida.
  const consulta = useCallback(() => listarNotificacoes(), []);
  const { dados, erro, carregando, carregar } = useConsulta(consulta);
  const acao = useAcao();
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    void carregar();
  }, [versao, carregar]);

  async function abrir(notificacao: Notificacao) {
    await acao.executar(async () => {
      if (!notificacao.lida_em) {
        await marcarNotificacaoLida(notificacao.id);
        await Promise.all([carregar(), recarregar()]);
      }
    });
    const destino = destinoNotificacao(notificacao, ehGestao);
    // Sem destino próprio (alvo apagado), fica na lista em vez de empilhar a mesma tela.
    if (destino.tela !== 'notificacoes') abrirDestino(destino);
  }

  const itens = dados ?? [];
  return (
    <TelaFluxo
      titulo="Notificações"
      voltar={voltar}
      erro={erro ?? acao.erro}
      carregando={carregando}
      atualizar={carregar}
    >
      {!itens.length ? <Text style={tipo.apoio}>Você ainda não tem notificações.</Text> : null}
      {naoLidas > 0 ? (
        <Botao
          titulo="Marcar todas como lidas"
          variante="contorno"
          carregando={acao.ocupado}
          onPress={() => {
            void acao.executar(async () => {
              await marcarTodasLidas();
              await Promise.all([carregar(), recarregar()]);
            });
          }}
        />
      ) : null}
      {itens.map(n => (
        <Pressable
          key={n.id}
          onPress={() => {
            void abrir(n);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${n.lida_em ? '' : 'Não lida. '}${n.titulo}. ${n.corpo}`}
          style={({ pressed }) => [
            estilos.cartao,
            !n.lida_em && estilos.naoLida,
            pressed && estilos.pressionado,
          ]}
        >
          <View style={estilos.linha}>
            {!n.lida_em ? <View style={estilos.ponto} /> : null}
            <Text style={[tipo.secao, estilos.titulo]}>{n.titulo}</Text>
          </View>
          <Text style={tipo.corpo}>{n.corpo}</Text>
          <Text style={tipo.apoio}>{new Date(n.criado_em).toLocaleString('pt-BR')}</Text>
        </Pressable>
      ))}
    </TelaFluxo>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: 6,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.fundo,
  },
  naoLida: { borderColor: cores.folha },
  pressionado: { opacity: 0.75 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { flex: 1 },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: cores.folha },
});
