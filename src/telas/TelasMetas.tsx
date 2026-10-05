import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AbasFiltro, Aviso, Botao, Campo } from '../componentes/Ui';
import { CampoData } from '../componentes/CampoData';
import { CartaoFluxo, TelaFluxoVoluntariado as TelaFluxo } from '../componentes/TelaFluxoVoluntariado';
import { useDadosVoluntariado } from '../lib/useDadosVoluntariado';
import { useConfiguracaoInstituicao } from '../lib/useConfiguracaoInstituicao';
import { mensagemErro } from '../lib/voluntariado';
import { abrirWhatsApp } from '../lib/whatsapp';
import { mascararTelefone } from '../lib/mascaras';
import { cores, espaco, tipo } from '../lib/tema';
import { hojeIso, interpretarData, paraCampoData } from '../lib/regrasPerfil';
import { rotuloStatusMeta, rotuloStatusValidacao, type Meta, type TipoMeta } from '../lib/tipos';
import {
  alterarStatusMeta, carregarMeta, carregarPix, declararContribuicao, listarMetas, listarVoluntarios,
  minhasContribuicoesMetas, registrarRecebimento, rotuloTipoMeta, salvarMeta, validarContribuicao,
  type ContribuicaoComDoador,
} from '../lib/metas';
import {
  descreverProgresso, descreverQuantidade, interpretarQuantidade, metaFinalizada, percentualMeta, prazoVencido, recebendoContribuicoes,
} from '../lib/regrasMetas';

const dataCurta = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR');

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

function Progresso({ meta }: { meta: Meta }) {
  const percentual = percentualMeta(meta);
  return <View style={{ gap: espaco.xs }}>
    <View style={estilos.progressoTopo}>
      <Text style={estilos.valor}>{descreverProgresso(meta)}</Text>
      <Text style={tipo.apoio}>{percentual}%</Text>
    </View>
    <View style={estilos.trilha} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percentual }}>
      <View style={[estilos.preenchimento, { width: `${percentual}%` }]} />
    </View>
  </View>;
}

function Etiqueta({ meta }: { meta: Meta }) {
  return <Text style={estilos.etiqueta}>
    {meta.tipo === 'FINANCEIRA' ? 'EM DINHEIRO' : 'MATERIAL'} · {rotuloStatusMeta[meta.status].toUpperCase()}
  </Text>;
}

export function TelaMetas({ ehGestao, voltar, abrir, criar, minhas }: {
  ehGestao: boolean; voltar: () => void; abrir: (id: number) => void; criar: () => void; minhas: () => void;
}) {
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(listarMetas);
  const hoje = hojeIso();
  const [aba, setAba] = useState<'abertas' | 'finalizadas'>('abertas');
  const abertas = (dados ?? []).filter((m) => !metaFinalizada(m));
  const finalizadas = (dados ?? []).filter(metaFinalizada);
  const visiveis = aba === 'abertas' ? abertas : finalizadas;
  return <TelaFluxo titulo={ehGestao ? 'Metas e doações' : 'Contribuir'} voltar={voltar} erro={erro} carregando={carregando} atualizar={carregar}>
    <Text style={tipo.corpo}>
      {ehGestao
        ? 'Publique metas em dinheiro ou de materiais, confira as contribuições e registre o que receber.'
        : 'Apoie a horta com uma doação em dinheiro (PIX) ou com materiais. Só contam no total as doações confirmadas pela gestão.'}
    </Text>
    {ehGestao ? <Botao titulo="Nova meta" onPress={criar} /> : <Botao titulo="Minhas contribuições" variante="contorno" onPress={minhas} />}
    <AbasFiltro valor={aba} aoMudar={setAba} opcoes={[
      { valor: 'abertas', rotulo: 'Abertas', quantidade: dados ? abertas.length : undefined },
      { valor: 'finalizadas', rotulo: 'Finalizadas', quantidade: dados ? finalizadas.length : undefined },
    ]} />
    {dados && !visiveis.length ? <Text style={tipo.apoio}>
      {aba === 'abertas' ? 'Nenhuma meta aberta no momento.' : 'Nenhuma meta encerrada ou cancelada.'}
    </Text> : null}
    {visiveis.map((m) => <Pressable key={m.id} onPress={() => abrir(m.id)} accessibilityRole="button" accessibilityLabel={`${m.titulo}. ${descreverProgresso(m)}.`}>
      <CartaoFluxo>
        <Etiqueta meta={m} />
        <Text style={tipo.secao}>{m.titulo}</Text>
        <Progresso meta={m} />
        <Text style={tipo.apoio}>
          {m.data_limite ? `${prazoVencido(m, hoje) ? 'Prazo encerrado em' : 'Prazo:'} ${dataCurta(m.data_limite)}` : 'Sem prazo definido'}
        </Text>
      </CartaoFluxo>
    </Pressable>)}
  </TelaFluxo>;
}

export function TelaDetalheMeta({ id, ehGestao, usuarioId, voltar, editar, registrar, minhas }: {
  id: number; ehGestao: boolean; usuarioId: string; voltar: () => void; editar: () => void; registrar: () => void; minhas: () => void;
}) {
  const consulta = useCallback(() => carregarMeta(id), [id]);
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(consulta);
  const acao = useAcao();
  const meta = dados?.meta;
  const hoje = hojeIso();

  function mudarStatus(status: Meta['status'], titulo: string, texto: string) {
    Alert.alert(titulo, texto, [{ text: 'Voltar', style: 'cancel' }, {
      text: 'Confirmar', onPress: () => { void acao.executar(async () => { await alterarStatusMeta(id, status); await carregar(); }); },
    }]);
  }
  function conferir(c: ContribuicaoComDoador, aprovada: boolean) {
    Alert.alert(aprovada ? 'Confirmar contribuição?' : 'Recusar contribuição?',
      aprovada
        ? `Confirme só depois de conferir o recebimento de ${descreverQuantidade(c.quantidade_oferecida, meta!)}. O valor passa a contar no total.`
        : 'A contribuição não entra no total. O voluntário verá a recusa.',
      [{ text: 'Voltar', style: 'cancel' }, { text: aprovada ? 'Confirmar' : 'Recusar', style: aprovada ? 'default' : 'destructive',
        onPress: () => { void acao.executar(async () => { await validarContribuicao(c.id, usuarioId, aprovada, null); await carregar(); }); } }]);
  }

  return <TelaFluxo titulo="Detalhes da meta" voltar={voltar} erro={acao.erro ?? erro} carregando={carregando && !dados} atualizar={carregar}>
    {meta ? <>
      <CartaoFluxo>
        <Etiqueta meta={meta} />
        <Text style={tipo.secao}>{meta.titulo}</Text>
        <Text style={tipo.corpo}>{meta.descricao}</Text>
        <Progresso meta={meta} />
        <Text style={tipo.apoio}>
          {meta.data_limite ? `Prazo: ${dataCurta(meta.data_limite)}` : 'Sem prazo definido'} · só contam doações confirmadas pela gestão.
        </Text>
      </CartaoFluxo>
      {ehGestao
        ? <PainelGestao meta={meta} contribuicoes={dados.contribuicoes} ocupado={acao.ocupado} editar={editar}
            registrar={registrar} conferir={conferir} mudarStatus={mudarStatus} />
        : <PainelVoluntario meta={meta} contribuicoes={dados.contribuicoes} recebendo={recebendoContribuicoes(meta, hoje)}
            vencido={prazoVencido(meta, hoje)} usuarioId={usuarioId} aoDeclarar={carregar} minhas={minhas} />}
    </> : null}
  </TelaFluxo>;
}

function PainelGestao({ meta, contribuicoes, ocupado, editar, registrar, conferir, mudarStatus }: {
  meta: Meta; contribuicoes: ContribuicaoComDoador[]; ocupado: boolean; editar: () => void; registrar: () => void;
  conferir: (c: ContribuicaoComDoador, aprovada: boolean) => void;
  mudarStatus: (status: Meta['status'], titulo: string, texto: string) => void;
}) {
  const pendentes = contribuicoes.filter((c) => c.status_validacao === 'PENDENTE');
  const conferidas = contribuicoes.filter((c) => c.status_validacao !== 'PENDENTE');
  return <>
    <Botao titulo="Registrar doação recebida" onPress={registrar} desabilitado={ocupado} />
    <Text style={tipo.secao}>Para conferir{pendentes.length ? ` · ${pendentes.length}` : ''}</Text>
    {!pendentes.length ? <Text style={tipo.apoio}>Nenhuma contribuição aguardando conferência.</Text> : null}
    {pendentes.map((c) => <CartaoFluxo key={c.id}>
      <Text style={estilos.doador}>{c.usuarios?.nome ?? 'Voluntário'} · {descreverQuantidade(c.quantidade_oferecida, meta)}</Text>
      <Text style={tipo.apoio}>Informado em {dataHora(c.data_envio)}</Text>
      <View style={estilos.linha}>
        <View style={{ flex: 1 }}><Botao titulo="Confirmar" onPress={() => conferir(c, true)} desabilitado={ocupado} /></View>
        <View style={{ flex: 1 }}><Botao titulo="Recusar" variante="destrutivo" onPress={() => conferir(c, false)} desabilitado={ocupado} /></View>
      </View>
    </CartaoFluxo>)}
    <Text style={tipo.secao}>Histórico</Text>
    {!conferidas.length ? <Text style={tipo.apoio}>Nada conferido nesta meta ainda.</Text> : null}
    {conferidas.map((c) => <CartaoFluxo key={c.id}>
      <Text style={estilos.doador}>{c.usuarios?.nome ?? 'Voluntário'} · {descreverQuantidade(c.quantidade_oferecida, meta)}</Text>
      <Text style={tipo.apoio}>{rotuloStatusValidacao[c.status_validacao]}{c.validado_em ? ` em ${dataHora(c.validado_em)}` : ''}</Text>
      {c.observacao_validacao ? <Text style={tipo.apoio}>{c.observacao_validacao}</Text> : null}
    </CartaoFluxo>)}
    <Botao titulo="Editar meta" variante="contorno" onPress={editar} desabilitado={ocupado} />
    {meta.status === 'ABERTA' ? <>
      <Botao titulo="Encerrar meta" variante="contorno" desabilitado={ocupado} onPress={() => mudarStatus('ENCERRADA',
        'Encerrar meta?', 'Ela sai do mural e para de receber contribuições dos voluntários. O que já entrou continua registrado.')} />
      <Botao titulo="Cancelar meta" variante="destrutivo" desabilitado={ocupado} onPress={() => mudarStatus('CANCELADA',
        'Cancelar meta?', 'Use quando a meta não vai mais acontecer. As contribuições registradas são preservadas.')} />
    </> : <Botao titulo="Reabrir meta" variante="contorno" desabilitado={ocupado} onPress={() => mudarStatus('ABERTA',
      'Reabrir meta?', 'Ela volta ao mural e pode receber novas contribuições.')} />}
  </>;
}

function PainelVoluntario({ meta, contribuicoes, recebendo, vencido, usuarioId, aoDeclarar, minhas }: {
  meta: Meta; contribuicoes: ContribuicaoComDoador[]; recebendo: boolean; vencido: boolean; usuarioId: string;
  aoDeclarar: () => Promise<void>; minhas: () => void;
}) {
  const { configuracao } = useConfiguracaoInstituicao();
  const [pix, setPix] = useState<{ chave_pix: string | null; nome_beneficiario_pix: string | null } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [quantidade, setQuantidade] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const acao = useAcao();
  const financeira = meta.tipo === 'FINANCEIRA';

  useEffect(() => {
    if (!financeira) return;
    let ativo = true;
    carregarPix().then((r) => { if (ativo) setPix(r); }).catch(() => { if (ativo) setPix({ chave_pix: null, nome_beneficiario_pix: null }); });
    return () => { ativo = false; };
  }, [financeira]);

  async function copiar() {
    if (!pix?.chave_pix) return;
    await Clipboard.setStringAsync(pix.chave_pix);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }
  async function falar() {
    const numero = configuracao?.whatsapp;
    if (!numero) return;
    const mensagem = financeira
      ? `Olá! Vi a meta "${meta.titulo}" no app e tenho uma dúvida sobre a doação.`
      : `Olá! Vi a meta "${meta.titulo}" no app e quero contribuir com material. Como combinamos a entrega?`;
    if (!(await abrirWhatsApp(numero, mensagem))) {
      Alert.alert('Não foi possível abrir o WhatsApp', `Fale com a gestão pelo número ${mascararTelefone(numero)}.`);
    }
  }
  function declarar() {
    const valor = interpretarQuantidade(quantidade);
    if (valor === null) { Alert.alert('Valor inválido', 'Informe um valor positivo, com até duas casas decimais.'); return; }
    Alert.alert('Informar doação?', `Você informa que transferiu ${descreverQuantidade(valor, meta)}. A gestão confere no extrato antes de somar ao total.`, [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Informar', onPress: () => { void acao.executar(async () => {
        await declararContribuicao(meta.id, usuarioId, valor);
        setQuantidade(''); setSucesso(true); await aoDeclarar();
      }); } },
    ]);
  }

  return <>
    {!recebendo ? <CartaoFluxo><Text style={tipo.apoio}>
      {vencido && meta.data_limite ? `O prazo desta meta terminou em ${dataCurta(meta.data_limite)}. Se ainda quiser ajudar, fale com a gestão.`
        : 'Esta meta não está mais recebendo contribuições.'}
    </Text></CartaoFluxo> : financeira ? <>
      <Text style={tipo.secao}>Como apadrinhar</Text>
      <Text style={tipo.corpo}>1. Copie a chave PIX da instituição.{'\n'}2. Faça a transferência no app do seu banco.{'\n'}3. Volte aqui e informe o valor transferido.</Text>
      <CartaoFluxo>
        {pix === null ? <Text style={tipo.apoio}>Carregando chave PIX…</Text>
          : pix.chave_pix ? <>
            <Text style={tipo.apoio}>Chave PIX{pix.nome_beneficiario_pix ? ` · ${pix.nome_beneficiario_pix}` : ''}</Text>
            <Text style={estilos.chave} selectable>{pix.chave_pix}</Text>
            <Botao titulo={copiado ? 'Copiada!' : 'Copiar chave'} variante="contorno" onPress={() => { void copiar(); }} />
          </> : <Text style={tipo.apoio}>A chave PIX ainda não foi cadastrada pela gestão.</Text>}
      </CartaoFluxo>
      {acao.erro ? <Aviso mensagem={acao.erro} /> : null}
      <Campo rotulo="Valor transferido (R$)" value={quantidade} onChangeText={setQuantidade} keyboardType="decimal-pad" placeholder="Ex.: 25,00" />
      <Botao titulo="Informar doação" carregando={acao.ocupado} onPress={declarar} desabilitado={!pix?.chave_pix} />
      {sucesso ? <Text style={[tipo.corpo, { color: cores.folha }]}>Doação informada! A gestão vai conferir e confirmar.</Text> : null}
    </> : <>
      <Text style={tipo.secao}>Como ajudar</Text>
      <Text style={tipo.corpo}>Esta meta é de material. Combine com a gestão o que entregar e quando; ela registra a doação ao receber.</Text>
    </>}
    {configuracao?.whatsapp ? <Botao titulo="Falar com a gestão no WhatsApp" variante="contorno" onPress={() => { void falar(); }} /> : null}
    <Text style={tipo.secao}>Suas contribuições nesta meta</Text>
    {!contribuicoes.length ? <Text style={tipo.apoio}>Você ainda não contribuiu com esta meta.</Text> : null}
    {contribuicoes.map((c) => <CartaoFluxo key={c.id}>
      <Text style={estilos.doador}>{descreverQuantidade(c.quantidade_oferecida, meta)}</Text>
      <Text style={tipo.apoio}>{rotuloStatusValidacao[c.status_validacao]} · {dataHora(c.data_envio)}</Text>
      {c.observacao_validacao ? <Text style={tipo.apoio}>{c.observacao_validacao}</Text> : null}
    </CartaoFluxo>)}
    <Botao titulo="Minhas contribuições" variante="contorno" onPress={minhas} />
  </>;
}

export function TelaFormMeta({ id, voltar }: { id: number | null; voltar: () => void }) {
  const consulta = useCallback(async () => (id === null ? null : (await carregarMeta(id)).meta), [id]);
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(consulta);
  return <TelaFluxo titulo={id === null ? 'Nova meta' : 'Editar meta'} voltar={voltar} erro={erro} carregando={carregando} atualizar={carregar}>
    {!erro && !carregando ? <FormularioMeta key={dados?.id ?? 'nova'} meta={dados} voltar={voltar} /> : null}
  </TelaFluxo>;
}

function FormularioMeta({ meta, voltar }: { meta: Meta | null; voltar: () => void }) {
  const [tipoMeta, setTipoMeta] = useState<TipoMeta>(meta?.tipo ?? 'FINANCEIRA');
  const [titulo, setTitulo] = useState(meta?.titulo ?? '');
  const [descricao, setDescricao] = useState(meta?.descricao ?? '');
  const [unidade, setUnidade] = useState(meta?.unidade_medida ?? '');
  const [quantidade, setQuantidade] = useState(meta ? String(meta.quantidade_meta).replace('.', ',') : '');
  const [prazo, setPrazo] = useState(paraCampoData(meta?.data_limite ?? null));
  const acao = useAcao();
  // Com contribuições confirmadas, mudar o tipo trocaria reais por unidades no histórico.
  const tipoTravado = !!meta && meta.quantidade_arrecadada > 0;

  return <>
    {acao.erro ? <Aviso mensagem={acao.erro} /> : null}
    <Text style={estilos.rotulo}>Tipo de meta</Text>
    <View style={estilos.segmentos}>
      {(['FINANCEIRA', 'MATERIAL'] as TipoMeta[]).map((t) => <Pressable key={t} disabled={tipoTravado} onPress={() => setTipoMeta(t)}
        accessibilityRole="radio" accessibilityState={{ selected: tipoMeta === t, disabled: tipoTravado }}
        style={[estilos.segmento, tipoMeta === t && estilos.segmentoAtivo, tipoTravado && { opacity: 0.6 }]}>
        <Text style={[estilos.segmentoTexto, tipoMeta === t && estilos.segmentoTextoAtivo]}>{rotuloTipoMeta[t]}</Text>
      </Pressable>)}
    </View>
    {tipoTravado ? <Text style={[tipo.apoio, { marginBottom: espaco.md }]}>O tipo não muda depois de haver contribuições confirmadas.</Text> : null}
    <Campo rotulo="Título" value={titulo} onChangeText={setTitulo} maxLength={120} placeholder="Ex.: Kit de ferramentas novas" />
    <Campo rotulo="Por que precisamos disso" value={descricao} onChangeText={setDescricao} multiline numberOfLines={4} style={estilos.multilinha} />
    {tipoMeta === 'MATERIAL'
      ? <Campo rotulo="Unidade de medida" value={unidade} onChangeText={setUnidade} maxLength={30} placeholder="Ex.: kg, pacotes, unidades" />
      : null}
    <Campo rotulo={tipoMeta === 'FINANCEIRA' ? 'Valor da meta (R$)' : 'Quantidade necessária'} value={quantidade}
      onChangeText={setQuantidade} keyboardType="decimal-pad" />
    <CampoData rotulo="Prazo (opcional)" valorTexto={prazo} aoMudarTexto={setPrazo} />
    <Botao titulo="Salvar meta" carregando={acao.ocupado} onPress={() => { void acao.executar(async () => {
      const valor = interpretarQuantidade(quantidade);
      const prazoIso = prazo.trim() ? interpretarData(prazo) : null;
      if (titulo.trim().length < 3) throw new Error('O título precisa de ao menos 3 caracteres.');
      if (!descricao.trim()) throw new Error('Descreva a meta.');
      if (tipoMeta === 'MATERIAL' && !unidade.trim()) throw new Error('Informe a unidade de medida (ex.: kg, unidades).');
      if (valor === null) throw new Error('Informe a quantidade da meta: número positivo, com até duas casas decimais.');
      if (prazo.trim() && !prazoIso) throw new Error('Use o formato DD/MM/AAAA no prazo.');
      if (!meta && prazoIso && prazoIso < hojeIso()) throw new Error('O prazo precisa ser hoje ou uma data futura.');
      await salvarMeta(meta?.id ?? null, {
        titulo: titulo.trim(), descricao: descricao.trim(), tipo: tipoMeta,
        unidade_medida: tipoMeta === 'MATERIAL' ? unidade.trim() : null, quantidade_meta: valor, data_limite: prazoIso,
      });
      voltar();
    }); }} />
  </>;
}

export function TelaRegistrarRecebimento({ id, gestaoId, voltar }: { id: number; gestaoId: string; voltar: () => void }) {
  const consulta = useCallback(async () => {
    const [{ meta }, voluntarios] = await Promise.all([carregarMeta(id), listarVoluntarios()]);
    return { meta, voluntarios };
  }, [id]);
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(consulta);
  const [busca, setBusca] = useState('');
  const [doador, setDoador] = useState<{ id: string; nome: string } | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const acao = useAcao();
  const meta = dados?.meta;
  const filtrados = (dados?.voluntarios ?? [])
    .filter((v) => v.nome.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR'))).slice(0, 8);

  function confirmar() {
    if (!meta) return;
    const valor = interpretarQuantidade(quantidade);
    if (!doador) { Alert.alert('Quem doou?', 'Escolha o voluntário na lista.'); return; }
    if (valor === null) { Alert.alert('Quantidade inválida', 'Informe um número positivo, com até duas casas decimais.'); return; }
    Alert.alert('Registrar doação recebida?', `${descreverQuantidade(valor, meta)} de ${doador.nome}. Entra confirmada e soma ao total.`, [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Registrar', onPress: () => { void acao.executar(async () => {
        await registrarRecebimento({ metaId: meta.id, doadorId: doador.id, gestaoId, quantidade: valor, observacao: observacao.trim() || null });
        voltar();
      }); } },
    ]);
  }

  return <TelaFluxo titulo="Registrar doação recebida" voltar={voltar} erro={acao.erro ?? erro} carregando={carregando && !dados} atualizar={carregar}>
    {meta ? <>
      <Text style={tipo.apoio}>{meta.titulo} · {descreverProgresso(meta)}</Text>
      <Text style={tipo.corpo}>Para doações que a gestão já recebeu, em mãos ou no extrato. O registro entra confirmado.</Text>
      {doador ? <View style={estilos.escolhido}>
        <Text style={[tipo.corpo, { flex: 1 }]}>{doador.nome}</Text>
        <Pressable onPress={() => setDoador(null)} hitSlop={8} accessibilityRole="button">
          <Text style={[tipo.apoio, { color: cores.folha, fontWeight: '600' }]}>Trocar</Text>
        </Pressable>
      </View> : <>
        <Campo rotulo="Quem doou" value={busca} onChangeText={setBusca} placeholder="Digite parte do nome do voluntário" />
        {!filtrados.length ? <Text style={tipo.apoio}>Nenhum voluntário encontrado. O doador precisa ter conta no app.</Text> : null}
        {filtrados.map((v) => <Pressable key={v.id} onPress={() => setDoador(v)} accessibilityRole="button" style={estilos.opcao}>
          <Text style={tipo.corpo}>{v.nome}</Text>
        </Pressable>)}
      </>}
      <Campo rotulo={meta.tipo === 'FINANCEIRA' ? 'Valor recebido (R$)' : `Quantidade recebida (${meta.unidade_medida || 'un.'})`}
        value={quantidade} onChangeText={setQuantidade} keyboardType="decimal-pad" />
      <Campo rotulo="Observação (opcional)" value={observacao} onChangeText={setObservacao} maxLength={500} />
      <Botao titulo="Registrar" carregando={acao.ocupado} onPress={confirmar} />
    </> : null}
  </TelaFluxo>;
}

export function TelaMinhasContribuicoesMetas({ usuarioId, voltar, abrir }: { usuarioId: string; voltar: () => void; abrir: (id: number) => void }) {
  const consulta = useCallback(() => minhasContribuicoesMetas(usuarioId), [usuarioId]);
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(consulta);
  return <TelaFluxo titulo="Minhas contribuições" voltar={voltar} erro={erro} carregando={carregando} atualizar={carregar}>
    {dados?.length === 0 ? <Text style={tipo.apoio}>Você ainda não registrou contribuições.</Text> : null}
    {dados?.map((c) => <CartaoFluxo key={c.id}>
      <Text style={tipo.secao}>{c.metas_demandas?.titulo ?? 'Meta'}</Text>
      <Text style={estilos.doador}>{c.metas_demandas ? descreverQuantidade(c.quantidade_oferecida, c.metas_demandas) : c.quantidade_oferecida}</Text>
      <Text style={tipo.apoio}>{rotuloStatusValidacao[c.status_validacao]} · {dataHora(c.data_envio)}</Text>
      {c.observacao_validacao ? <Text style={tipo.apoio}>{c.observacao_validacao}</Text> : null}
      {c.metas_demandas ? <Botao titulo="Ver meta" variante="contorno" onPress={() => abrir(c.meta_id)} /> : null}
    </CartaoFluxo>)}
  </TelaFluxo>;
}

const estilos = StyleSheet.create({
  etiqueta: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: cores.tintaSuave },
  progressoTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: espaco.sm },
  valor: { fontSize: 15, fontWeight: '700', color: cores.tinta, flexShrink: 1 },
  trilha: { height: 8, borderRadius: 4, backgroundColor: cores.folhaClara, overflow: 'hidden' },
  preenchimento: { height: 8, borderRadius: 4, backgroundColor: cores.folha },
  doador: { fontSize: 15, fontWeight: '700', color: cores.tinta },
  linha: { flexDirection: 'row', gap: espaco.sm },
  chave: { fontSize: 16, fontWeight: '700', color: cores.tinta },
  rotulo: { fontSize: 13, fontWeight: '600', color: cores.tintaSuave, marginBottom: espaco.sm },
  multilinha: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },
  segmentos: { flexDirection: 'row', gap: espaco.sm, marginBottom: espaco.md },
  segmento: { flex: 1, borderWidth: 1.5, borderColor: cores.linha, borderRadius: 14, paddingVertical: 12, alignItems: 'center', backgroundColor: cores.fundo },
  segmentoAtivo: { borderColor: cores.folha, backgroundColor: cores.folhaClara },
  segmentoTexto: { fontSize: 13, fontWeight: '600', color: cores.tintaSuave },
  segmentoTextoAtivo: { color: cores.folha },
  escolhido: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm, borderWidth: 1, borderColor: cores.linha,
    borderRadius: 14, padding: espaco.md, backgroundColor: cores.mint },
  opcao: { paddingVertical: 12, paddingHorizontal: espaco.sm, borderBottomWidth: 1, borderBottomColor: cores.linha },
});
