import React, { useState } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { memoTela } from '@/compartilhado/componentes/memoTela';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { excluirAtividade as excluirAtividadeApi, listarAtividades } from '../api';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { rotuloStatusAtividade, type Atividade } from '../tipos';
import { AbasFiltro, Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { atividadeFinalizada } from '../regras';
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
  const [aba, setAba] = useState<'abertas' | 'finalizadas'>('abertas');
  const abertas = (dados ?? []).filter(a => !atividadeFinalizada(a.status));
  // Finalizadas: a mais recente primeiro.
  const finalizadas = (dados ?? []).filter(a => atividadeFinalizada(a.status)).reverse();
  const visiveis = aba === 'abertas' ? abertas : finalizadas;

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
      <Text style={tipo.corpo}>
        {ehGestao
          ? 'Publique tarefas para a comunidade, acompanhe as candidaturas e registre a presença no dia.'
          : convidado
            ? 'Veja as tarefas da horta. Para se candidatar, crie uma conta.'
            : 'Candidate-se às tarefas da horta e acompanhe suas participações. As horas confirmadas viram certificado.'}
      </Text>
      {ehGestao ? (
        <Botao titulo="Publicar tarefa" onPress={onNova} />
      ) : convidado ? null : (
        <>
          <Botao titulo="Minhas candidaturas" onPress={onMinhas} />
          <Botao titulo="Histórico de participação" variante="contorno" onPress={onHistorico} />
        </>
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
        <Text style={tipo.apoio}>
          {aba === 'finalizadas'
            ? 'Nenhuma atividade realizada, cancelada ou recusada.'
            : ehGestao
              ? 'Nenhuma tarefa aberta. Publique uma para a comunidade se candidatar.'
              : 'Nenhuma tarefa aberta no momento. Quando a horta publicar, ela aparece aqui.'}
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
            <Text style={estilos.etiqueta}>
              {a.tipo === 'OFICINA_AUTORAL' ? 'OFICINA' : 'TAREFA'} ·{' '}
              {rotuloStatusAtividade[a.status].toUpperCase()}
            </Text>
            <Text style={tipo.secao}>{a.titulo}</Text>
            <Text style={tipo.corpo} numberOfLines={3}>
              {a.descricao}
            </Text>
            <Text style={tipo.apoio}>
              {formatarData(a.data_hora_prevista)} · {a.vagas_totais}{' '}
              {a.vagas_totais === 1 ? 'vaga' : 'vagas'} · {a.carga_horaria}h
            </Text>
          </Pressable>
          {ehGestao ? (
            <View style={estilos.acoes}>
              <View style={{ flex: 1 }}>
                <Botao titulo="Editar" variante="contorno" onPress={() => onEditar(a)} />
              </View>
              <View style={{ flex: 1 }}>
                <Botao titulo="Excluir" variante="destrutivo" onPress={() => excluirAtividade(a)} />
              </View>
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
  etiqueta: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: cores.tintaSuave },
  detalhe: { gap: espaco.sm },
  acoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.xs },
});
