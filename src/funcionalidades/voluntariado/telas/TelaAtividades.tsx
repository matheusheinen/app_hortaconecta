import React, { useState } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { memoTela } from '@/compartilhado/componentes/memoTela';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import {
  arquivarAtividade,
  excluirAtividade as excluirAtividadeApi,
  listarAtividades,
} from '../api';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { rotuloStatusAtividade, type Atividade } from '../tipos';
import { AbasFiltro, Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { abaDaAtividade, type AbaAtividades } from '../regras';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { confirmarExclusao } from '@/compartilhado/utils/confirmar';

type Props = {
  voltar: () => void;
  onNova: () => void;
  onEditar: (atividade: Atividade) => void;
  onDetalhe: (id: number) => void;
  onMinhas: () => void;
  onHistorico: () => void;
};

export const TelaAtividades = memoTela(function TelaAtividades({
  voltar,
  onNova,
  onEditar,
  onDetalhe,
  onMinhas,
  onHistorico,
}: Props) {
  const { ehGestao, convidado } = useSessaoAtual();
  const { dados, carregando, erro, carregar } = useConsulta(listarAtividades);
  const [aba, setAba] = useState<AbaAtividades>('abertas');
  const porAba = (alvo: AbaAtividades) =>
    (dados ?? []).filter(a => abaDaAtividade(a, ehGestao) === alvo);
  const abertas = porAba('abertas');
  // Finalizadas e arquivadas: a mais recente primeiro.
  const finalizadas = porAba('finalizadas').reverse();
  const arquivadas = porAba('arquivadas').reverse();
  const visiveis = aba === 'abertas' ? abertas : aba === 'finalizadas' ? finalizadas : arquivadas;

  async function arquivar(atividade: Atividade, arquivada: boolean) {
    try {
      await arquivarAtividade(atividade.id, arquivada);
      await carregar();
    } catch (falha) {
      avisar(
        arquivada ? 'Não foi possível arquivar' : 'Não foi possível restaurar',
        mensagemErro(falha),
      );
    }
  }

  function excluirAtividade(atividade: Atividade) {
    const mensagem = `"${atividade.titulo}" será removida. Atividades com candidaturas devem ser canceladas nos detalhes para preservar o histórico.`;

    const excluir = async () => {
      try {
        await excluirAtividadeApi(atividade.id);
        await carregar();
      } catch (falha) {
        avisar('Não foi possível excluir', mensagemErro(falha));
      }
    };

    confirmarExclusao('Excluir atividade', mensagem, excluir);
  }

  return (
    <TelaFluxo
      titulo={ehGestao ? 'Atividades' : 'Voluntariado'}
      voltar={voltar}
      erro={erro}
      carregando={carregando}
      atualizar={carregar}
    >
      <Text style={[tipo.corpo, estilos.descricaoPagina]}>
        {ehGestao
          ? 'Publique tarefas e oficinas, acompanhe as inscrições e registre a presença.'
          : convidado
            ? 'Veja mutirões e oficinas e descubra quando acontecem. Entre para se inscrever.'
            : 'Encontre mutirões e oficinas, veja quando acontecem e inscreva-se para participar.'}
      </Text>
      {ehGestao ? (
        <AcaoPrimaria simbolo="＋" titulo="Nova atividade" onPress={onNova} />
      ) : convidado ? null : (
        <View style={estilos.acessosRapidos}>
          <Pressable
            onPress={onMinhas}
            accessibilityRole="button"
            accessibilityLabel="Minhas inscrições"
            style={estilos.atalhoCurto}
          >
            <Text style={estilos.iconeAtalho}>✓</Text>
            <Text style={estilos.tituloAtalho}>Minhas inscrições</Text>
          </Pressable>
          <Pressable
            onPress={onHistorico}
            accessibilityRole="button"
            accessibilityLabel="Histórico de participação"
            style={estilos.atalhoCurto}
          >
            <Text style={estilos.iconeAtalho}>◷</Text>
            <Text style={estilos.tituloAtalho}>Meu histórico</Text>
          </Pressable>
        </View>
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
          ...(ehGestao
            ? [
                {
                  valor: 'arquivadas' as const,
                  rotulo: 'Arquivadas',
                  quantidade: dados ? arquivadas.length : undefined,
                },
              ]
            : []),
        ]}
      />
      {dados && !visiveis.length ? (
        <Text style={tipo.apoio}>
          {aba === 'arquivadas'
            ? 'Nenhuma atividade arquivada.'
            : aba === 'finalizadas'
              ? '✓  Nenhuma atividade finalizada por enquanto.'
              : ehGestao
                ? 'Nenhuma tarefa aberta. Publique uma para a comunidade se candidatar.'
                : '🌱  Nenhuma atividade aberta por enquanto.'}
        </Text>
      ) : null}
      {visiveis.map(a => (
        <CartaoFluxo key={a.id}>
          {/* Os botões de gestão ficam fora do Pressable: na web, botão dentro de botão é HTML inválido. */}
          <Pressable
            onPress={() => onDetalhe(a.id)}
            accessibilityRole="button"
            accessibilityLabel={`Ver detalhes de ${a.titulo}`}
            style={estilos.detalhe}
          >
            <View style={estilos.topoCartao}>
              <View style={estilos.etiquetaTipo}>
                <Text style={estilos.etiquetaTipoTexto}>
                  {a.tipo === 'OFICINA_AUTORAL' ? '✦ Oficina' : '🌱 Tarefa'}
                </Text>
              </View>
              <Text style={estilos.status}>{rotuloStatusAtividade[a.status]}</Text>
            </View>
            <Text style={estilos.tituloAtividade}>{a.titulo}</Text>
            <Text style={[tipo.corpo, estilos.descricaoAtividade]} numberOfLines={3}>
              {a.descricao}
            </Text>
            <View style={estilos.detalhesAtividade}>
              <View style={estilos.itemDetalhe}>
                <Text style={estilos.iconeDetalhe}>📅</Text>
                <Text style={estilos.textoDetalhe}>{formatarData(a.data_hora_prevista)}</Text>
              </View>
              <View style={estilos.itemDetalhe}>
                <Text style={estilos.textoDetalhe}>
                  👥 {a.vagas_totais} {a.vagas_totais === 1 ? 'vaga' : 'vagas'} · ⏱{' '}
                  {a.carga_horaria}h
                </Text>
              </View>
            </View>
          </Pressable>
          {ehGestao ? (
            <View style={estilos.acoes}>
              <AcaoMini simbolo="✎" titulo="Editar" onPress={() => onEditar(a)} />
              {aba !== 'abertas' ? (
                <AcaoMini
                  simbolo={aba === 'arquivadas' ? '↶' : '↓'}
                  titulo={aba === 'arquivadas' ? 'Restaurar' : 'Arquivar'}
                  onPress={() => void arquivar(a, aba !== 'arquivadas')}
                />
              ) : null}
              <AcaoMini
                simbolo="×"
                titulo="Excluir"
                destrutivo
                onPress={() => excluirAtividade(a)}
              />
            </View>
          ) : null}
        </CartaoFluxo>
      ))}
    </TelaFluxo>
  );
});

/** O react-native-web não implementa Alert; no navegador usa o do browser. */
function avisar(titulo: string, mensagem: string) {
  if (Platform.OS === 'web') {
    window.alert(`${titulo}\n\n${mensagem}`);
    return;
  }
  Alert.alert(titulo, mensagem);
}

function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const estilos = StyleSheet.create({
  descricaoPagina: { marginBottom: espaco.xs },
  acessosRapidos: { flexDirection: 'row', gap: espaco.sm, marginBottom: espaco.xs },
  atalhoCurto: {
    minHeight: 44,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.sm,
    paddingHorizontal: espaco.sm,
    paddingVertical: espaco.sm,
    borderRadius: 12,
    backgroundColor: cores.mint,
  },
  iconeAtalho: { color: cores.folha, fontSize: 15, fontWeight: '800' },
  tituloAtalho: { color: cores.folha, fontSize: 12, fontWeight: '700' },
  detalhe: { gap: espaco.sm },
  topoCartao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: espaco.sm,
  },
  etiquetaTipo: {
    backgroundColor: cores.folhaClara,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  etiquetaTipoTexto: { color: cores.folha, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  status: {
    color: cores.tintaSuave,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  tituloAtividade: { color: cores.tinta, fontSize: 19, lineHeight: 25, fontWeight: '700' },
  descricaoAtividade: { color: cores.tintaMedia },
  detalhesAtividade: { gap: espaco.sm },
  itemDetalhe: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  iconeDetalhe: { width: 20, fontSize: 14 },
  textoDetalhe: { color: cores.tintaSuave, fontSize: 13, flexShrink: 1 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm, marginTop: espaco.xs },
  botaoAcao: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: espaco.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espaco.sm,
    backgroundColor: cores.folha,
  },
  botaoAcaoTexto: { color: cores.fundo, fontSize: 14, fontWeight: '700' },
  acaoMini: {
    minHeight: 34,
    borderRadius: 9,
    backgroundColor: cores.mint,
    paddingHorizontal: espaco.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.xs,
  },
  acaoMiniTexto: { color: cores.folha, fontSize: 12, fontWeight: '700' },
  acaoMiniPerigo: { backgroundColor: cores.beterrabaClara },
  acaoMiniTextoPerigo: { color: cores.beterraba },
});

function AcaoPrimaria({
  simbolo,
  titulo,
  onPress,
}: {
  simbolo: string;
  titulo: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      style={({ pressed }) => [estilos.botaoAcao, pressed && { opacity: 0.72 }]}
    >
      <Text style={estilos.botaoAcaoTexto}>{simbolo}</Text>
      <Text style={estilos.botaoAcaoTexto}>{titulo}</Text>
    </Pressable>
  );
}

function AcaoMini({
  simbolo,
  titulo,
  onPress,
  destrutivo = false,
}: {
  simbolo: string;
  titulo: string;
  onPress: () => void;
  destrutivo?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      style={({ pressed }) => [
        estilos.acaoMini,
        destrutivo && estilos.acaoMiniPerigo,
        pressed && { opacity: 0.72 },
      ]}
    >
      <Text style={[estilos.acaoMiniTexto, destrutivo && estilos.acaoMiniTextoPerigo]}>
        {simbolo} {titulo}
      </Text>
    </Pressable>
  );
}
