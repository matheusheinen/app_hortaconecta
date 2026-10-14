import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { Alert, Text } from 'react-native';
import { Botao, Campo, Aviso } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import {
  listarOficinas,
  detalheOficina,
  salvarOficina,
  cancelarOficina,
  decidirOficina,
} from '../api';
import { rotuloOficina, type CamposOficina } from '../regras';
import type { PropostaOficina } from '../tipos';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { tipo } from '@/compartilhado/tema';

export function TelaOficinas({
  voltar,
  abrir,
  criar,
}: {
  voltar: () => void;
  abrir: (id: number) => void;
  criar: () => void;
}) {
  const { ehGestao: gestao } = useSessaoAtual();
  const { dados, erro, carregando, carregar } = useConsulta(listarOficinas);
  return (
    <TelaFluxo
      titulo={gestao ? 'Propostas de oficinas' : 'Minhas oficinas'}
      voltar={voltar}
      erro={erro}
      carregando={carregando}
      atualizar={carregar}
    >
      <Text style={tipo.corpo}>
        Propostas para análise da instituição. Uma aprovação não agenda a oficina.
      </Text>
      {!gestao ? <Botao titulo="Nova proposta" onPress={criar} /> : null}
      {dados?.length === 0 ? <Text style={tipo.apoio}>Nenhuma proposta encontrada.</Text> : null}
      {dados?.map(p => (
        <CartaoFluxo key={p.id}>
          <Text style={tipo.secao}>{p.titulo}</Text>
          <Text style={tipo.apoio}>
            {rotuloOficina[p.status]} · {p.duracao_minutos} minutos
          </Text>
          <Text style={tipo.corpo}>{p.tema}</Text>
          <Text style={tipo.apoio}>{new Date(p.criado_em).toLocaleDateString('pt-BR')}</Text>
          <Botao titulo="Ver proposta" variante="contorno" onPress={() => abrir(p.id)} />
        </CartaoFluxo>
      ))}
    </TelaFluxo>
  );
}
export function TelaDetalheOficina({
  id,
  voltar,
  editar,
}: {
  id: number;
  voltar: () => void;
  editar: () => void;
}) {
  const { ehGestao: gestao, usuarioId } = useSessaoAtual();
  const {
    dados: p,
    erro,
    carregando,
    carregar,
  } = useConsulta(useCallback(() => detalheOficina(id), [id]));
  const [nota, setNota] = useState(''),
    [erroAcao, setErro] = useState<string | null>(null),
    [sucesso, setSucesso] = useState<string | null>(null),
    [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  async function agir(tipoAcao: 'APROVADA' | 'REJEITADA' | 'CANCELADA') {
    if (!p || trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro(null);
    setSucesso(null);
    try {
      if (tipoAcao === 'CANCELADA') await cancelarOficina(p);
      else await decidirOficina(p, tipoAcao, nota);
      setSucesso(tipoAcao === 'CANCELADA' ? 'Proposta cancelada.' : 'Decisão registrada.');
      setNota('');
      await carregar();
    } catch (f) {
      setErro(mensagemErro(f));
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  function confirmar(acao: 'APROVADA' | 'REJEITADA' | 'CANCELADA') {
    Alert.alert(
      acao === 'CANCELADA' ? 'Cancelar proposta?' : 'Registrar decisão?',
      'Esta ação encerra a edição da proposta.',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            void agir(acao);
          },
        },
      ],
    );
  }
  return (
    <TelaFluxo
      titulo="Proposta de oficina"
      voltar={voltar}
      erro={erroAcao ?? erro}
      carregando={carregando}
      atualizar={() => {
        setErro(null);
        setSucesso(null);
        void carregar();
      }}
    >
      {p ? (
        <>
          <Text style={tipo.titulo}>{p.titulo}</Text>
          <Text style={tipo.apoio}>
            {rotuloOficina[p.status]} · Autor: {p.nome_autor ?? 'Voluntário'}
          </Text>
          <Text style={tipo.apoio}>Enviada em {new Date(p.criado_em).toLocaleString('pt-BR')}</Text>
          <Text style={tipo.secao}>Descrição</Text>
          <Text style={tipo.corpo}>{p.descricao}</Text>
          <Text style={tipo.secao}>Tema</Text>
          <Text style={tipo.corpo}>{p.tema}</Text>
          <Text style={tipo.secao}>Objetivo</Text>
          <Text style={tipo.corpo}>{p.objetivo}</Text>
          <Text style={tipo.corpo}>Duração estimada: {p.duracao_minutos} minutos</Text>
          {p.conhecimentos ? (
            <>
              <Text style={tipo.secao}>Conhecimentos necessários</Text>
              <Text style={tipo.corpo}>{p.conhecimentos}</Text>
            </>
          ) : null}
          {p.observacoes ? (
            <>
              <Text style={tipo.secao}>Observações do autor</Text>
              <Text style={tipo.corpo}>{p.observacoes}</Text>
            </>
          ) : null}
          {p.decidido_em ? (
            <Text style={tipo.apoio}>
              Decisão da gestão em {new Date(p.decidido_em).toLocaleString('pt-BR')}
            </Text>
          ) : null}
          {p.observacao_decisao ? (
            <>
              <Text style={tipo.secao}>Observação da decisão</Text>
              <Text style={tipo.corpo}>{p.observacao_decisao}</Text>
            </>
          ) : null}
          {p.cancelado_em ? (
            <Text style={tipo.apoio}>
              Cancelada em {new Date(p.cancelado_em).toLocaleString('pt-BR')}
            </Text>
          ) : null}
          {p.status === 'APROVADA' ? (
            <Text style={tipo.corpo}>
              Proposta aprovada. A instituição poderá organizar esta oficina posteriormente.
            </Text>
          ) : null}
          {sucesso ? <Text style={tipo.corpo}>{sucesso}</Text> : null}
          {p.status === 'PENDENTE' && p.autor_id === usuarioId && !gestao ? (
            <>
              <Botao titulo="Editar proposta" onPress={editar} desabilitado={ocupado} />
              <Botao
                titulo="Cancelar proposta"
                variante="destrutivo"
                onPress={() => confirmar('CANCELADA')}
                desabilitado={ocupado}
              />
            </>
          ) : null}
          {p.status === 'PENDENTE' && gestao && p.autor_id !== usuarioId ? (
            <>
              <Campo
                rotulo="Observação da decisão (obrigatória ao rejeitar)"
                value={nota}
                onChangeText={setNota}
                multiline
                maxLength={2000}
                editable={!ocupado}
              />
              <Botao
                titulo="Aprovar proposta"
                onPress={() => confirmar('APROVADA')}
                desabilitado={ocupado}
              />
              <Botao
                titulo="Rejeitar proposta"
                variante="destrutivo"
                onPress={() => confirmar('REJEITADA')}
                desabilitado={ocupado}
              />
            </>
          ) : null}
          {ocupado ? <Text style={tipo.apoio}>Registrando...</Text> : null}
        </>
      ) : null}
    </TelaFluxo>
  );
}
export function TelaFormOficina({
  id,
  voltar,
  pronto,
  perfil,
}: {
  id: number | null;
  voltar: () => void;
  pronto: (id: number) => void;
  perfil: () => void;
}) {
  const { dados, erro, carregando, carregar } = useConsulta(
    useCallback(async () => (id === null ? null : detalheOficina(id)), [id]),
  );
  return (
    <TelaFluxo
      titulo={id === null ? 'Nova proposta' : 'Editar proposta'}
      voltar={voltar}
      erro={erro}
      carregando={carregando}
      atualizar={carregar}
    >
      {!erro && !carregando ? (
        dados && dados.status !== 'PENDENTE' ? (
          <Text style={tipo.apoio}>Esta proposta já foi finalizada e não pode ser editada.</Text>
        ) : (
          <Formulario
            key={dados?.revisao ?? 'nova'}
            proposta={dados}
            pronto={pronto}
            perfil={perfil}
          />
        )
      ) : null}
    </TelaFluxo>
  );
}
function Formulario({
  proposta,
  pronto,
  perfil,
}: {
  proposta: PropostaOficina | null;
  pronto: (id: number) => void;
  perfil: () => void;
}) {
  const [campos, setCampos] = useState<CamposOficina>({
    titulo: proposta?.titulo ?? '',
    descricao: proposta?.descricao ?? '',
    tema: proposta?.tema ?? '',
    objetivo: proposta?.objetivo ?? '',
    duracao: proposta ? String(proposta.duracao_minutos) : '',
    conhecimentos: proposta?.conhecimentos ?? '',
    observacoes: proposta?.observacoes ?? '',
  });
  const [erro, setErro] = useState<string | null>(null),
    [ocupado, setOcupado] = useState(false);
  const trava = useRef(false),
    montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);
  async function salvar() {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro(null);
    try {
      const id = await salvarOficina(proposta, campos);
      if (montado.current) {
        pronto(id);
        Alert.alert('Proposta salva', 'Acompanhe a análise em Minhas oficinas.');
      }
    } catch (f) {
      if (montado.current) setErro(mensagemErro(f));
    } finally {
      trava.current = false;
      if (montado.current) setOcupado(false);
    }
  }
  const campo = (chave: keyof CamposOficina, rotulo: string, max: number, multiline = false) => (
    <Campo
      key={chave}
      rotulo={rotulo}
      value={campos[chave]}
      onChangeText={valor => setCampos(c => ({ ...c, [chave]: valor }))}
      maxLength={max}
      multiline={multiline}
      editable={!ocupado}
      keyboardType={chave === 'duracao' ? 'number-pad' : 'default'}
      style={multiline ? { minHeight: 90, textAlignVertical: 'top' } : undefined}
    />
  );
  return (
    <>
      {erro ? <Aviso mensagem={erro} /> : null}
      {campo('titulo', 'Título', 120)}
      {campo('descricao', 'Descrição', 5000, true)}
      {campo('tema', 'Tema', 120)}
      {campo('objetivo', 'Objetivo', 2000, true)}
      {campo('duracao', 'Duração estimada em minutos (1 a 1.440)', 4)}
      {campo('conhecimentos', 'Conhecimentos necessários (opcional)', 2000, true)}
      {campo('observacoes', 'Observações adicionais (opcional)', 2000, true)}
      {!proposta ? (
        <>
          <Text style={tipo.apoio}>
            O envio exige perfil completo, habilidades e disponibilidade.
          </Text>
          <Botao
            titulo="Conferir meu perfil"
            variante="contorno"
            onPress={perfil}
            desabilitado={ocupado}
          />
        </>
      ) : null}
      <Botao
        titulo={proposta ? 'Salvar alterações' : 'Enviar proposta'}
        carregando={ocupado}
        onPress={() => {
          void salvar();
        }}
      />
    </>
  );
}
