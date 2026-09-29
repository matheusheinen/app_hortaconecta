import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text } from 'react-native';
import { Botao, Campo } from '../componentes/Ui';
import { CartaoFluxo, TelaFluxoVoluntariado as TelaFluxo } from '../componentes/TelaFluxoVoluntariado';
import { useDadosVoluntariado } from '../lib/useDadosVoluntariado';
import { detalheMaterial, listarMateriais, minhasContribuicoes } from '../lib/materiais';
import { quantidadeMaterial, rotuloMaterial } from '../lib/regrasMateriais';
import { supabase } from '../lib/supabase';
import { mensagemErro } from '../lib/voluntariado';
import { tipo } from '../lib/tema';
import type { ContribuicaoMaterial, SolicitacaoMaterial } from '../lib/materiais.types';

function useAcao() {
  const trava = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function executar(acao: () => Promise<void>) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro(null);
    try { await acao(); } catch (falha) { setErro(mensagemErro(falha)); }
    finally { trava.current = false; setOcupado(false); }
  }
  return { ocupado, erro, executar, limpar: () => setErro(null) };
}
function Quantidades({ s }: { s: SolicitacaoMaterial }) {
  return <>
    <Text style={tipo.apoio}>{rotuloMaterial[s.status]}</Text>
    <Text style={tipo.corpo}>Necessário: {s.quantidade_necessaria} unidades</Text>
    <Text style={tipo.corpo}>Recebido: {s.quantidade_recebida} unidades</Text>
    <Text style={tipo.corpo}>Restante: {s.quantidade_necessaria - s.quantidade_recebida} unidades</Text>
  </>;
}
function DadosContribuicao({ c }: { c: ContribuicaoMaterial }) {
  return <>
    {c.nome_usuario ? <Text style={tipo.secao}>{c.nome_usuario}</Text> : null}
    <Text style={tipo.corpo}>{c.quantidade} unidades · {rotuloMaterial[c.status]}</Text>
    <Text style={tipo.apoio}>Registrada em {new Date(c.criado_em).toLocaleString('pt-BR')}</Text>
    {c.decidido_em ? <Text style={tipo.apoio}>Atualizada em {new Date(c.decidido_em).toLocaleString('pt-BR')}</Text> : null}
    {c.observacao ? <Text style={tipo.apoio}>{c.observacao}</Text> : null}
  </>;
}
export function TelaMateriais({ ehGestao, voltar, abrir, criar, minhas }: {
  ehGestao: boolean; voltar: () => void; abrir: (id: number) => void; criar: () => void; minhas: () => void;
}) {
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(listarMateriais);
  return <TelaFluxo titulo={ehGestao ? 'Materiais' : 'Contribuir'} voltar={voltar} erro={erro} carregando={carregando} atualizar={carregar}>
    <Text style={tipo.corpo}>Contribua com materiais e itens físicos necessários à instituição.</Text>
    {ehGestao ? <Botao titulo="Nova solicitação" onPress={criar} /> : <Botao titulo="Minhas contribuições" onPress={minhas} />}
    {dados?.length === 0 ? <Text style={tipo.apoio}>Nenhuma solicitação disponível.</Text> : null}
    {dados?.map(s => <CartaoFluxo key={s.id}>
      <Text style={tipo.secao}>{s.nome}</Text>
      <Quantidades s={s} />
      <Botao titulo="Ver detalhes" variante="contorno" onPress={() => abrir(s.id)} />
    </CartaoFluxo>)}
  </TelaFluxo>;
}
export function TelaDetalheMaterial({ id, ehGestao, voltar, editar, minhas }: {
  id: number; ehGestao: boolean; voltar: () => void; editar: () => void; minhas: () => void;
}) {
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(useCallback(() => detalheMaterial(id), [id]));
  const [quantidade, setQuantidade] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const acao = useAcao();
  async function atualizar() { acao.limpar(); setSucesso(false); await carregar(); }
  async function decidir(c: ContribuicaoMaterial, status: 'CONFIRMADA' | 'CANCELADA') {
    await acao.executar(async () => {
      const { error } = await supabase.rpc('materiais_decidir', { p_contribuicao: c.id, p_status: status });
      if (error) throw error;
      await carregar();
    });
  }
  function confirmarDecisao(c: ContribuicaoMaterial, status: 'CONFIRMADA' | 'CANCELADA') {
    Alert.alert(status === 'CONFIRMADA' ? 'Confirmar entrega recebida?' : 'Cancelar contribuição?',
      status === 'CONFIRMADA' ? 'Confirme somente após receber as ' + c.quantidade + ' unidades. Esta confirmação é definitiva.' : 'Esta intenção será cancelada.',
      [{ text: 'Voltar', style: 'cancel' }, { text: 'Confirmar', onPress: () => { void decidir(c, status); } }]);
  }
  async function statusSolicitacao(status: string) {
    await acao.executar(async () => {
      const { error } = await supabase.rpc('materiais_status', { p_solicitacao: id, p_status: status });
      if (error) throw error;
      await carregar();
    });
  }
  const s = dados?.solicitacao;
  const aberta = s?.status === 'ABERTA' || s?.status === 'EM_ANDAMENTO';
  const pendente = dados?.contribuicoes.some(c => c.status === 'PENDENTE');
  return <TelaFluxo titulo="Detalhes do material" voltar={voltar} erro={acao.erro ?? erro} carregando={carregando} atualizar={atualizar}>
    {s ? <>
      <Text style={tipo.secao}>{s.nome}</Text>
      <Text style={tipo.corpo}>{s.descricao}</Text>
      <Quantidades s={s} />
      <Text style={tipo.apoio}>Criada em {new Date(s.criado_em).toLocaleString('pt-BR')}</Text>
      {ehGestao && aberta ? <>
        <Botao titulo="Editar solicitação" onPress={editar} desabilitado={acao.ocupado} />
        {s.status === 'ABERTA' ? <Botao titulo="Marcar em andamento" onPress={() => { void statusSolicitacao('EM_ANDAMENTO'); }} desabilitado={acao.ocupado} /> : null}
        <Botao titulo="Cancelar solicitação" variante="destrutivo" desabilitado={acao.ocupado} onPress={() => Alert.alert(
          'Cancelar solicitação?', 'As intenções pendentes serão canceladas. As entregas recebidas serão preservadas.',
          [{ text: 'Voltar', style: 'cancel' }, { text: 'Cancelar solicitação', style: 'destructive', onPress: () => { void statusSolicitacao('CANCELADA'); } }],
        )} />
      </> : null}
      {!ehGestao ? <>
        <Text style={tipo.apoio}>A intenção não reserva itens nem conta como entrega. Combine a entrega com a instituição. Somente a gestão confirma o recebimento.</Text>
        {aberta && !pendente ? <>
          <Campo rotulo="Quantidade que pretende fornecer (unidades)" keyboardType="number-pad" value={quantidade} onChangeText={setQuantidade} editable={!acao.ocupado} />
          <Botao titulo="Quero contribuir" carregando={acao.ocupado} onPress={() => { void acao.executar(async () => {
            const q = quantidadeMaterial(quantidade);
            const { error } = await supabase.rpc('materiais_contribuir', { p_solicitacao: id, p_quantidade: q });
            if (error) throw error;
            setQuantidade(''); setSucesso(true); await carregar();
          }); }} />
        </> : pendente ? <Text style={tipo.apoio}>Você já tem uma intenção pendente para este material.</Text> : null}
        {sucesso ? <Text style={tipo.corpo}>Contribuição registrada! Acompanhe em Minhas contribuições.</Text> : null}
        <Botao titulo="Minhas contribuições" variante="contorno" onPress={minhas} />
      </> : null}
      <Text style={tipo.secao}>{ehGestao ? 'Contribuições' : 'Suas contribuições neste material'}</Text>
      {dados.contribuicoes.length === 0 ? <Text style={tipo.apoio}>Nenhuma contribuição registrada.</Text> : null}
      {dados.contribuicoes.map(c => <CartaoFluxo key={c.id}>
        <DadosContribuicao c={c} />
        {c.status === 'PENDENTE' ? <>
          {ehGestao && aberta ? <Botao titulo="Confirmar recebimento" desabilitado={acao.ocupado} onPress={() => confirmarDecisao(c, 'CONFIRMADA')} /> : null}
          <Botao titulo="Cancelar contribuição" variante="contorno" desabilitado={acao.ocupado} onPress={() => confirmarDecisao(c, 'CANCELADA')} />
        </> : null}
      </CartaoFluxo>)}
    </> : null}
  </TelaFluxo>;
}
export function TelaMinhasContribuicoes({ voltar, abrir }: { voltar: () => void; abrir: (id: number) => void }) {
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(minhasContribuicoes);
  return <TelaFluxo titulo="Minhas contribuições" voltar={voltar} erro={erro} carregando={carregando} atualizar={carregar}>
    {dados?.length === 0 ? <Text style={tipo.apoio}>Você ainda não registrou contribuições de materiais.</Text> : null}
    {dados?.map(({ solicitacao: s, contribuicao: c }) => <CartaoFluxo key={c.id}>
      <Text style={tipo.secao}>{s.nome}</Text><DadosContribuicao c={c} />
      <Text style={tipo.apoio}>Solicitação: {rotuloMaterial[s.status]}</Text>
      <Botao titulo="Ver detalhes" onPress={() => abrir(s.id)} />
    </CartaoFluxo>)}
  </TelaFluxo>;
}
export function TelaFormMaterial({ id, voltar }: { id: number | null; voltar: () => void }) {
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(useCallback(async () => id === null ? null : (await detalheMaterial(id)).solicitacao, [id]));
  return <TelaFluxo titulo={id === null ? 'Nova solicitação' : 'Editar solicitação'} voltar={voltar} erro={erro} carregando={carregando} atualizar={carregar}>
    {!erro && !carregando ? <Formulario key={dados?.atualizado_em ?? 'novo'} s={dados} voltar={voltar} /> : null}
  </TelaFluxo>;
}
function Formulario({ s, voltar }: { s: SolicitacaoMaterial | null; voltar: () => void }) {
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);
  const [nome, setNome] = useState(s?.nome ?? '');
  const [descricao, setDescricao] = useState(s?.descricao ?? '');
  const [quantidade, setQuantidade] = useState(s ? String(s.quantidade_necessaria) : '');
  const acao = useAcao();
  return <>
    <Campo rotulo="Nome do material" value={nome} onChangeText={setNome} maxLength={120} editable={!acao.ocupado} />
    <Campo rotulo="Descrição e orientações de entrega" value={descricao} onChangeText={setDescricao} multiline maxLength={4000} editable={!acao.ocupado} />
    <Campo rotulo="Quantidade necessária (unidades)" value={quantidade} onChangeText={setQuantidade} keyboardType="number-pad" editable={!acao.ocupado} />
    <Text style={tipo.apoio}>As quantidades recebidas são calculadas a partir das entregas confirmadas.</Text>
    {acao.erro ? <Text style={tipo.corpo}>{acao.erro}</Text> : null}
    <Botao titulo="Salvar solicitação" carregando={acao.ocupado} onPress={() => { void acao.executar(async () => {
      if (nome.trim().length < 3 || !descricao.trim()) throw new Error('Informe nome com ao menos 3 caracteres e descrição.');
      const { data, error } = await supabase.rpc('materiais_salvar', {
        p_id: s?.id ?? null, p_nome: nome.trim(), p_descricao: descricao.trim(), p_quantidade: quantidadeMaterial(quantidade),
      });
      if (error) throw error;
      if (data === null) throw new Error('Não foi possível confirmar o salvamento.');
      // Sair da tela não cancela a transação; a resposta não deve navegar novamente.
      if (montado.current) voltar();
    }); }} />
  </>;
}
