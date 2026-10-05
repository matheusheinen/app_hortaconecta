import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Aviso, Botao } from './Ui';
import { Icone, type NomeIcone } from './Icone';
import { ImagemDiario } from './ImagemDiario';
import { cores } from '../lib/tema';
import { formatarHorasInicio, progressoMaterialInicio, type ResumoInicio } from '../lib/resumoInicio';

export type AcoesInicio = {
  nome: string;
  sair: () => void;
  aoIrParaAtividades: () => void;
  aoIrParaMetas: () => void;
  aoIrParaDiario: () => void;
  /** Ausente quando o recurso está fora do MVP (ver lib/escopoMvp). */
  aoIrParaCertificados?: () => void;
  aoIrParaOficinas?: () => void;
  aoPerfil: () => void;
  abrirAtividade: (id: number) => void;
  abrirMaterial: (id: number) => void;
  abrirPublicacao: (id: number) => void;
  minhasAtividades: () => void;
  minhasContribuicoes: () => void;
};

type PropsPainel = AcoesInicio & {
  resumo: ResumoInicio | null;
  erro: string | null;
  carregando: boolean;
  atualizar: () => void;
};

function CabecalhoSecao({ titulo, acao, onPress }: { titulo: string; acao: string; onPress: () => void }) {
  return <View style={estilos.secaoTopo}>
    <Text accessibilityRole="header" style={estilos.secaoTitulo}>{titulo}</Text>
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${acao}: ${titulo}`} style={estilos.verMais}>
      <Text style={estilos.verMaisTexto}>{acao}</Text><Icone nome="seta" tamanho={13} />
    </Pressable>
  </View>;
}

function Indicador({ icone, valor, titulo, cor, onPress, descricao }: {
  icone: NomeIcone; valor: string; titulo: string; cor: string; onPress: () => void; descricao: string;
}) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${titulo}: ${valor}. ${descricao}`}
    style={({ pressed }) => [estilos.indicador, pressed && estilos.pressionado]}>
    <Icone nome={icone} cor={cor} tamanho={21} />
    <Text style={estilos.indicadorValor}>{valor}</Text>
    <Text style={estilos.indicadorTitulo}>{titulo}</Text>
  </Pressable>;
}

function EstadoVazio({ icone, titulo, texto }: { icone: NomeIcone; titulo: string; texto: string }) {
  return <View style={estilos.vazio}>
    <View style={estilos.vazioIcone}><Icone nome={icone} tamanho={24} /></View>
    <View style={estilos.flex}><Text style={estilos.cartaoTitulo}>{titulo}</Text><Text style={estilos.apoio}>{texto}</Text></View>
  </View>;
}

function dataAtividade(iso: string, horas: number) {
  const data = new Date(iso);
  return `${data.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${horas.toLocaleString('pt-BR')}h`;
}

export function PainelInicioVoluntario({ nome, resumo, erro, carregando, atualizar, aoPerfil,
  aoIrParaAtividades, aoIrParaMetas, aoIrParaDiario, aoIrParaCertificados, aoIrParaOficinas,
  abrirAtividade, abrirMaterial, abrirPublicacao, minhasAtividades, minhasContribuicoes }: PropsPainel) {
  const material = resumo?.material;
  const publicacao = resumo?.publicacao;
  const progresso = material ? progressoMaterialInicio(material) : 0;
  const aguardando = carregando && !resumo;
  const numero = (valor: number | undefined) => valor === undefined ? '—' : valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  return <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}
    refreshControl={<RefreshControl refreshing={carregando} onRefresh={atualizar} tintColor={cores.folha} colors={[cores.folha]} />}>
    <View style={estilos.coluna}>
      <View style={estilos.cabecalho}>
        <View style={estilos.flex}>
          <Text style={estilos.boasVindas}>QUE BOM TER VOCÊ AQUI!</Text>
          <Text accessibilityRole="header" style={estilos.nome}>{nome.trim().split(/\s+/)[0] || 'Olá'} <Text style={estilos.aceno}>👋</Text></Text>
        </View>
        <Pressable onPress={aoPerfil} accessibilityRole="button" accessibilityLabel="Abrir meu perfil" style={({ pressed }) => [estilos.perfil, pressed && estilos.pressionado]}>
          <Icone nome="perfil" tamanho={23} />
        </Pressable>
      </View>

      <View style={estilos.indicadores}>
        <Indicador icone="relogio" valor={resumo ? formatarHorasInicio(resumo.horasRegistradas) : '—'} titulo="Horas previstas" cor="#628B9C"
          onPress={aoIrParaCertificados ?? minhasAtividades}
          descricao={`Carga prevista registrada no check-in das presenças confirmadas. ${aoIrParaCertificados ? 'Ver certificados.' : 'Ver histórico de participação.'}`} />
        <Indicador icone="check" valor={numero(resumo?.atividadesParticipadas)} titulo="Atividades" cor="#45B78A"
          onPress={minhasAtividades} descricao="Presenças confirmadas. Ver histórico de participação." />
        <Indicador icone="presente" valor={numero(resumo?.contribuicoesConfirmadas)} titulo="Contribuições" cor="#D49A4A"
          onPress={minhasContribuicoes} descricao="Entregas confirmadas. Ver minhas contribuições." />
      </View>

      {erro ? <View style={estilos.feedback}><Aviso mensagem={erro} /><Botao titulo="Tentar novamente" variante="contorno" onPress={atualizar} /></View> : null}
      {aguardando ? <View style={estilos.carregando}><ActivityIndicator color={cores.folha} /><Text style={estilos.apoio}>Carregando seu resumo…</Text></View> : null}
      {resumo?.perfilCompleto === false ? <Pressable onPress={aoPerfil} accessibilityRole="button" style={estilos.completar}>
        <Icone nome="perfil" tamanho={20} /><View style={estilos.flex}><Text style={estilos.completarTitulo}>Vamos completar seu perfil?</Text>
          <Text style={estilos.apoio}>Preencha seu cadastro para participar das atividades.</Text></View><Icone nome="seta" tamanho={18} />
      </Pressable> : null}

      <CabecalhoSecao titulo="EM DESTAQUE" acao="Ver todas" onPress={aoIrParaAtividades} />
      {resumo?.destaques.map(({ atividade, vagasDisponiveis }, indice) => {
        const oficina = atividade.tipo === 'OFICINA_AUTORAL';
        const azul = oficina || indice % 2 === 1;
        return <Pressable key={atividade.id} onPress={() => abrirAtividade(atividade.id)} accessibilityRole="button"
          accessibilityLabel={`${atividade.titulo}. ${vagasDisponiveis} vagas disponíveis. Ver atividade.`}
          style={({ pressed }) => [estilos.atividade, pressed && estilos.pressionado]}>
          <View style={[estilos.atividadeIcone, azul && estilos.iconeAzul]}><Icone nome={oficina ? 'oficina' : 'folha'} cor={azul ? '#397CD1' : '#2D9165'} tamanho={26} /></View>
          <View style={estilos.flex}>
            <View style={estilos.etiquetas}><View style={[estilos.etiqueta, azul && estilos.etiquetaAzul]}>
              <Text style={[estilos.etiquetaTexto, azul && estilos.textoAzul]}>{oficina ? 'Oficina' : 'Na comunidade'}</Text></View>
              <Text style={estilos.vagas}>{vagasDisponiveis} {vagasDisponiveis === 1 ? 'vaga' : 'vagas'}</Text></View>
            <Text numberOfLines={2} style={estilos.cartaoTitulo}>{atividade.titulo}</Text>
            <Text style={estilos.data}>{dataAtividade(atividade.data_hora_prevista, atividade.carga_horaria)}</Text>
          </View><Icone nome="seta" tamanho={17} cor={cores.tintaSuave} />
        </Pressable>;
      })}
      {resumo && resumo.destaques.length === 0 ? <EstadoVazio icone="folha" titulo="Novas oportunidades em breve" texto="As próximas atividades abertas aparecerão aqui." /> : null}

      <CabecalhoSecao titulo="PRECISAMOS DE" acao="Ver todas" onPress={aoIrParaMetas} />
      {material ? <Pressable onPress={() => abrirMaterial(material.id)} accessibilityRole="button"
        accessibilityLabel={`${material.nome}. ${progresso}% recebido. Quero contribuir.`}
        style={({ pressed }) => [estilos.material, pressed && estilos.pressionado]}>
        <View style={estilos.materialTopo}><View style={estilos.materialIcone}><Icone nome="caixa" tamanho={24} /></View>
          <View style={estilos.flex}><Text style={estilos.cartaoTitulo}>{material.nome}</Text><Text style={estilos.apoio}>
            {numero(material.quantidade_recebida)} de {numero(material.quantidade_necessaria)} recebidos</Text></View>
          <Text style={estilos.percentual}>{progresso}%</Text></View>
        <View style={estilos.progresso} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: progresso }} accessibilityLabel="Meta de materiais">
          <View style={[estilos.progressoPreenchido, { width: `${progresso}%` }]} /></View>
        <View style={estilos.contribuir}><Text style={estilos.contribuirTexto}>Quero contribuir</Text><Icone nome="seta" tamanho={14} /></View>
      </Pressable> : resumo ? <EstadoVazio icone="caixa" titulo="Tudo em dia por aqui" texto="Quando a instituição precisar de materiais, você verá aqui." /> : null}

      <CabecalhoSecao titulo="DIÁRIO" acao="Ver mais" onPress={aoIrParaDiario} />
      {publicacao ? <View style={estilos.diario}>
        {publicacao.imagem_caminho ? <ImagemDiario caminho={publicacao.imagem_caminho} /> : <View style={estilos.diarioSemFoto}>
          <Icone nome="livro" tamanho={35} /><Text style={estilos.diarioLegenda}>Histórias que fazem a diferença</Text></View>}
        <Pressable onPress={() => abrirPublicacao(publicacao.id)} accessibilityRole="button" accessibilityLabel={`Ler publicação: ${publicacao.titulo}`}
          style={({ pressed }) => [estilos.diarioConteudo, pressed && estilos.pressionado]}>
          <Text style={estilos.diarioData}>{new Date(publicacao.data_publicacao).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</Text>
          <Text style={estilos.diarioTitulo}>{publicacao.titulo}</Text>
          <Text style={estilos.apoio} numberOfLines={2}>{publicacao.texto ?? publicacao.descricao_curta ?? 'Acompanhe as novidades da instituição.'}</Text>
          <View style={estilos.diarioLer}><Text style={estilos.contribuirTexto}>Ler história</Text><Icone nome="seta" tamanho={14} /></View>
        </Pressable>
      </View> : resumo ? <EstadoVazio icone="livro" titulo="Nossa história continua" texto="Os novos relatos da instituição aparecerão no diário." /> : null}

      {aoIrParaOficinas || aoIrParaCertificados ? <View style={estilos.atalhos}>
        {aoIrParaOficinas ? <Pressable onPress={aoIrParaOficinas} accessibilityRole="button" style={({ pressed }) => [estilos.atalho, pressed && estilos.pressionado]}>
          <Icone nome="oficina" tamanho={23} /><Text style={estilos.atalhoTitulo}>Oficinas</Text><Text style={estilos.apoio}>Compartilhe saberes</Text>
        </Pressable> : null}
        {aoIrParaCertificados ? <Pressable onPress={aoIrParaCertificados} accessibilityRole="button" style={({ pressed }) => [estilos.atalho, pressed && estilos.pressionado]}>
          <Icone nome="certificado" tamanho={23} /><Text style={estilos.atalhoTitulo}>Certificados</Text><Text style={estilos.apoio}>Veja sua participação</Text>
        </Pressable> : null}
      </View> : null}
      <Text style={estilos.assinatura}>Pequenas ações. Um impacto que cresce.</Text>
    </View>
  </ScrollView>;
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.superficie },
  conteudo: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, alignItems: 'center' },
  coluna: { width: '100%', maxWidth: 560 },
  flex: { flex: 1, minWidth: 0 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  boasVindas: { fontSize: 10, fontWeight: '500', letterSpacing: 0.9, color: cores.folha, marginBottom: 5 },
  nome: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: cores.tinta, letterSpacing: -0.5 },
  aceno: { fontSize: 21 },
  perfil: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.fundo, alignItems: 'center', justifyContent: 'center' },
  indicadores: { flexDirection: 'row', gap: 10 },
  indicador: { flex: 1, minHeight: 104, borderWidth: 1, borderColor: cores.linha, borderRadius: 18, backgroundColor: cores.fundo, paddingHorizontal: 6, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  indicadorValor: { color: cores.folha, fontWeight: '700', fontSize: 21, marginTop: 9, marginBottom: 3 },
  indicadorTitulo: { color: cores.tintaSuave, fontSize: 11, lineHeight: 15, textAlign: 'center' },
  secaoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, marginBottom: 8, minHeight: 44 },
  secaoTitulo: { color: cores.tinta, fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  verMais: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 8 },
  verMaisTexto: { color: cores.folha, fontSize: 12 },
  atividade: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: cores.fundo, borderWidth: 1, borderColor: cores.linha, borderRadius: 18, padding: 14, marginBottom: 10 },
  atividadeIcone: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E0F5E8', alignItems: 'center', justifyContent: 'center' },
  iconeAzul: { backgroundColor: '#E6F0FF' },
  etiquetas: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 5 },
  etiqueta: { backgroundColor: '#E0F5E8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  etiquetaTexto: { color: '#247B53', fontSize: 10, fontWeight: '600' },
  etiquetaAzul: { backgroundColor: '#E6F0FF' },
  textoAzul: { color: '#397CD1' },
  vagas: { fontSize: 10, color: cores.tintaSuave },
  cartaoTitulo: { fontSize: 15, fontWeight: '600', color: cores.tinta, lineHeight: 20 },
  data: { fontSize: 11, lineHeight: 16, color: cores.tintaSuave, marginTop: 3 },
  apoio: { fontSize: 12, lineHeight: 18, color: cores.tintaSuave, marginTop: 3 },
  material: { backgroundColor: cores.fundo, borderWidth: 1, borderColor: cores.linha, borderRadius: 18, padding: 16 },
  materialTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  materialIcone: { width: 38, height: 38, borderRadius: 14, backgroundColor: cores.folhaClara, alignItems: 'center', justifyContent: 'center' },
  percentual: { fontSize: 13, fontWeight: '600', color: cores.folha },
  progresso: { height: 7, borderRadius: 4, backgroundColor: cores.folhaClara, overflow: 'hidden', marginTop: 16 },
  progressoPreenchido: { height: '100%', borderRadius: 4, backgroundColor: cores.folha },
  contribuir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 13 },
  contribuirTexto: { color: cores.folha, fontWeight: '600', fontSize: 12 },
  diario: { borderRadius: 18, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.fundo, overflow: 'hidden' },
  diarioSemFoto: { height: 130, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: cores.folhaClara },
  diarioLegenda: { color: cores.folha, fontSize: 13 },
  diarioConteudo: { padding: 18 },
  diarioData: { color: cores.tintaSuave, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  diarioTitulo: { color: cores.tinta, fontSize: 17, lineHeight: 23, fontWeight: '600', marginBottom: 4 },
  diarioLer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, minHeight: 30 },
  atalhos: { flexDirection: 'row', gap: 12, marginTop: 22 },
  atalho: { flex: 1, backgroundColor: cores.fundo, borderWidth: 1, borderColor: cores.linha, borderRadius: 18, padding: 16 },
  atalhoTitulo: { color: cores.tinta, fontSize: 14, fontWeight: '600', marginTop: 9 },
  assinatura: { fontSize: 11, color: cores.tintaSuave, textAlign: 'center', marginTop: 24 },
  feedback: { marginTop: 18 },
  carregando: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 18 },
  completar: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EEF2DF', padding: 16, borderRadius: 16, marginTop: 18 },
  completarTitulo: { color: cores.tinta, fontSize: 13, fontWeight: '600' },
  vazio: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 18, borderRadius: 18, backgroundColor: cores.fundo, borderWidth: 1, borderColor: cores.linha },
  vazioIcone: { width: 42, height: 42, borderRadius: 15, backgroundColor: cores.folhaClara, alignItems: 'center', justifyContent: 'center' },
  pressionado: { opacity: 0.75 },
});
