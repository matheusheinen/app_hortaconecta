import React, { useState } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { memoTela } from '@/compartilhado/componentes/memoTela';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AbasFiltro } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { formatarDataCurta, hojeIso } from '@/compartilhado/utils/datas';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { contarPendentes, listarMetas } from '../api';
import { descreverProgresso, metaFinalizada, prazoVencido } from '../regras';
import { rotuloStatusMeta } from '../tipos';
import { ProgressoMeta } from '../componentes/IndicadoresMeta';

/** Entrada da fila de conferência, com a contagem de pendentes quando ela carrega. */
function BotaoFila({ fila }: { fila: () => void }) {
  const { dados } = useConsulta(contarPendentes);
  return (
    <Pressable
      onPress={fila}
      accessibilityRole="button"
      accessibilityLabel="Conferir doações pendentes"
      style={({ pressed }) => [estilos.fila, pressed && { opacity: 0.72 }]}
    >
      <Text style={estilos.iconeFila}>◷</Text>
      <Text style={estilos.textoFila}>Conferir doações{dados === null ? '' : ` · ${dados}`}</Text>
      <Text style={estilos.setaFila}>›</Text>
    </Pressable>
  );
}

export const TelaMetas = memoTela(function TelaMetas({
  voltar,
  abrir,
  criar,
  minhas,
  fila,
}: {
  voltar: () => void;
  abrir: (id: number) => void;
  criar: () => void;
  minhas: () => void;
  fila: () => void;
}) {
  const { ehGestao, convidado } = useSessaoAtual();
  const { dados, erro, carregando, carregar } = useConsulta(listarMetas);
  const hoje = hojeIso();
  const [aba, setAba] = useState<'abertas' | 'finalizadas'>('abertas');
  const abertas = (dados ?? []).filter(m => !metaFinalizada(m));
  const finalizadas = (dados ?? []).filter(metaFinalizada);
  const visiveis = aba === 'abertas' ? abertas : finalizadas;
  return (
    <TelaFluxo
      titulo={ehGestao ? 'Metas e doações' : 'Contribuir'}
      voltar={voltar}
      erro={erro}
      carregando={carregando}
      atualizar={carregar}
    >
      <Text style={[tipo.corpo, estilos.descricaoPagina]}>
        {ehGestao
          ? 'Crie metas de dinheiro ou materiais e acompanhe o que a comunidade já doou.'
          : convidado
            ? 'Veja o que a horta precisa. Entre para registrar sua contribuição.'
            : 'Ajude com PIX ou materiais. Toque em uma meta para ver a chave PIX ou combinar a entrega.'}
      </Text>
      {ehGestao ? (
        <>
          <AcaoPrimaria onPress={criar} />
          <BotaoFila fila={fila} />
        </>
      ) : convidado ? null : (
        <Pressable
          onPress={minhas}
          accessibilityRole="button"
          accessibilityLabel="Ver minhas contribuições"
          style={estilos.atalhoCurto}
        >
          <Text style={estilos.iconeAtalho}>♥</Text>
          <Text style={estilos.tituloAtalho}>Minhas contribuições</Text>
        </Pressable>
      )}
      <AbasFiltro
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { valor: 'abertas', rotulo: 'Abertas', quantidade: dados ? abertas.length : undefined },
          {
            valor: 'finalizadas',
            rotulo: 'Finalizadas',
            quantidade: dados ? finalizadas.length : undefined,
          },
        ]}
      />
      {dados && !visiveis.length ? (
        <Text style={[tipo.apoio, estilos.vazio]}>
          {aba === 'abertas'
            ? ehGestao
              ? '🌱  Ainda não há metas abertas. Crie uma para receber apoio.'
              : '🌱  Sem metas abertas por enquanto. Volte para ver as próximas necessidades.'
            : '✓  Nenhuma meta encerrada ainda.'}
        </Text>
      ) : null}
      {visiveis.map(m => (
        <Pressable
          key={m.id}
          onPress={() => abrir(m.id)}
          accessibilityRole="button"
          accessibilityLabel={`${m.titulo}. ${descreverProgresso(m)}.`}
        >
          <CartaoFluxo>
            <View style={estilos.topoMeta}>
              <Text style={estilos.etiqueta}>
                {m.tipo === 'FINANCEIRA' ? '💰 Dinheiro' : '📦 Material'}
              </Text>
              <Text style={estilos.statusMeta}>{rotuloStatusMeta[m.status]}</Text>
            </View>
            <Text style={estilos.tituloMeta}>{m.titulo}</Text>
            <Text style={tipo.corpo} numberOfLines={3}>
              {m.descricao}
            </Text>
            <ProgressoMeta meta={m} />
            <View style={estilos.rodapeMeta}>
              <Text style={estilos.iconePrazo}>📅</Text>
              <Text style={tipo.apoio}>
                {m.data_limite
                  ? `${prazoVencido(m, hoje) ? 'Prazo encerrado' : 'Até'} ${formatarDataCurta(m.data_limite)}`
                  : 'Sem prazo definido'}
              </Text>
              <Text style={estilos.acaoMeta}>›</Text>
            </View>
          </CartaoFluxo>
        </Pressable>
      ))}
    </TelaFluxo>
  );
});

const estilos = StyleSheet.create({
  descricaoPagina: { marginBottom: espaco.xs },
  fila: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    paddingHorizontal: espaco.md,
    borderRadius: 12,
    backgroundColor: cores.areia,
  },
  iconeFila: { color: cores.terra, fontSize: 16 },
  textoFila: { color: cores.terra, fontSize: 13, fontWeight: '700', flex: 1 },
  setaFila: { color: cores.terra, fontSize: 22 },
  atalhoCurto: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    paddingHorizontal: espaco.sm,
    paddingVertical: espaco.sm,
    borderRadius: 12,
    backgroundColor: cores.folhaClara,
  },
  iconeAtalho: { color: cores.folha, fontSize: 14 },
  tituloAtalho: { color: cores.folha, fontSize: 12, fontWeight: '700' },
  vazio: { paddingVertical: espaco.sm },
  topoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  etiqueta: { color: cores.folha, fontSize: 12, fontWeight: '700' },
  statusMeta: { color: cores.tintaSuave, fontSize: 11 },
  tituloMeta: { color: cores.tinta, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  rodapeMeta: { flexDirection: 'row', alignItems: 'center', gap: espaco.xs, marginTop: espaco.xs },
  iconePrazo: { color: cores.tintaSuave, fontSize: 15 },
  acaoMeta: { color: cores.folha, fontSize: 20, fontWeight: '600', marginLeft: 'auto' },
  botaoPrimario: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: cores.folha,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.sm,
  },
  simboloBotao: { color: cores.fundo, fontSize: 18, fontWeight: '700' },
  textoBotao: { color: cores.fundo, fontSize: 14, fontWeight: '700' },
});

function AcaoPrimaria({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Criar meta"
      style={({ pressed }) => [estilos.botaoPrimario, pressed && { opacity: 0.72 }]}
    >
      <Text style={estilos.simboloBotao}>＋</Text>
      <Text style={estilos.textoBotao}>Criar meta</Text>
    </Pressable>
  );
}
