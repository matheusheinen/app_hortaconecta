import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Aviso, Botao } from '@/compartilhado/componentes/Ui';
import { SinoNotificacoes } from '@/funcionalidades/notificacoes/componentes/SinoNotificacoes';
import { Icone } from '@/compartilhado/componentes/Icone';
import { cores } from '@/compartilhado/tema';
import type { AtividadeComVagas } from '@/funcionalidades/voluntariado/tipos';
import type { ResumoInicio } from '../regras';
import { AtalhosInicio } from './AtalhosInicio';
import { CartaoAtividadeInicio } from './CartaoAtividadeInicio';
import { CartaoDiarioInicio } from './CartaoDiarioInicio';
import { CartaoMetaInicio } from './CartaoMetaInicio';
import { IndicadoresInicio } from './IndicadoresInicio';
import { CabecalhoSecao, EstadoVazio } from './SecaoInicio';
import { estilosInicio } from './estilosInicio';

/** Navegação que a pilha do Início entrega às telas. */
export type AcoesInicio = {
  aoIrParaAtividades: () => void;
  aoIrParaMetas: () => void;
  aoIrParaDiario: () => void;
  aoNotificacoes: () => void;
  /** Ausente quando o recurso está fora do MVP (ver compartilhado/escopoMvp.ts). */
  aoIrParaCertificados?: () => void;
  aoIrParaOficinas?: () => void;
  aoPerfil: () => void;
  abrirAtividade: (id: number) => void;
  abrirMeta: (id: number) => void;
  abrirPublicacao: (id: number) => void;
  minhasAtividades: () => void;
  minhasContribuicoes: () => void;
};

type PropsPainel = AcoesInicio & {
  nome: string;
  resumo: ResumoInicio | null;
  /** Tarefas que combinam com disponibilidade e áreas; vazio esconde a seção. */
  sugestoes?: AtividadeComVagas[];
  erro: string | null;
  carregando: boolean;
  atualizar: () => void;
};

/** Início do voluntário: monta os blocos na ordem do design; cada bloco é um componente. */
export function PainelInicioVoluntario({
  nome,
  resumo,
  sugestoes = [],
  erro,
  carregando,
  atualizar,
  aoPerfil,
  aoNotificacoes,
  aoIrParaAtividades,
  aoIrParaMetas,
  aoIrParaDiario,
  aoIrParaCertificados,
  aoIrParaOficinas,
  abrirAtividade,
  abrirMeta,
  abrirPublicacao,
  minhasAtividades,
  minhasContribuicoes,
}: PropsPainel) {
  const meta = resumo?.meta;
  const publicacao = resumo?.publicacao;
  const aguardando = carregando && !resumo;
  // Não repete no bloco de sugestões o que já aparece em destaque.
  const emDestaque = new Set(resumo?.destaques.map(({ atividade }) => atividade.id));
  const sugestoesExtras = sugestoes.filter(atividade => !emDestaque.has(atividade.id));

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      refreshControl={
        <RefreshControl
          refreshing={carregando}
          onRefresh={atualizar}
          tintColor={cores.folha}
          colors={[cores.folha]}
        />
      }
    >
      <View style={estilos.coluna}>
        <View style={estilos.cabecalho}>
          <View style={estilosInicio.flex}>
            <Text accessibilityRole="header" style={estilos.nome}>
              {nome.trim() ? `Olá, ${nome.trim().split(/\s+/)[0]}` : 'Olá!'}{' '}
              <Text style={estilos.aceno}>🌱</Text>
            </Text>
            <Text style={estilos.boasVindas}>O que acontece na horta, num só lugar.</Text>
          </View>
          <SinoNotificacoes onPress={aoNotificacoes} />
          <Pressable
            onPress={aoPerfil}
            accessibilityRole="button"
            accessibilityLabel="Abrir meu perfil"
            style={({ pressed }) => [estilos.perfil, pressed && estilosInicio.pressionado]}
          >
            <Icone nome="perfil" tamanho={23} />
          </Pressable>
        </View>

        <IndicadoresInicio
          resumo={resumo}
          aoIrParaCertificados={aoIrParaCertificados}
          minhasAtividades={minhasAtividades}
          minhasContribuicoes={minhasContribuicoes}
        />

        {erro ? (
          <View style={estilos.feedback}>
            <Aviso mensagem={erro} />
            <Botao titulo="Tentar novamente" variante="contorno" onPress={atualizar} />
          </View>
        ) : null}
        {aguardando ? (
          <View style={estilos.carregando}>
            <ActivityIndicator color={cores.folha} />
            <Text style={estilosInicio.apoio}>Carregando seu resumo…</Text>
          </View>
        ) : null}
        {resumo?.perfilCompleto === false ? (
          <Pressable onPress={aoPerfil} accessibilityRole="button" style={estilos.completar}>
            <Icone nome="perfil" tamanho={20} />
            <View style={estilosInicio.flex}>
              <Text style={estilos.completarTitulo}>Vamos completar seu perfil?</Text>
              <Text style={estilosInicio.apoio}>
                Preencha seu cadastro para participar das atividades.
              </Text>
            </View>
            <Icone nome="seta" tamanho={18} />
          </Pressable>
        ) : null}

        <CabecalhoSecao titulo="Atividades abertas" acao="Ver todas" onPress={aoIrParaAtividades} />
        {resumo?.destaques.map(({ atividade, vagasDisponiveis }, indice) => (
          <CartaoAtividadeInicio
            key={atividade.id}
            atividade={atividade}
            vagasDisponiveis={vagasDisponiveis}
            azul={indice % 2 === 1}
            abrir={abrirAtividade}
          />
        ))}
        {resumo && resumo.destaques.length === 0 ? (
          <EstadoVazio
            icone="folha"
            titulo="Sem atividades abertas"
            texto="As próximas oportunidades aparecem aqui."
          />
        ) : null}

        {resumo && sugestoesExtras.length ? (
          <>
            <CabecalhoSecao
              titulo="Sugestões para você"
              acao="Ver todas"
              onPress={aoIrParaAtividades}
            />
            <Text style={[estilosInicio.apoio, estilos.explicacaoSugestoes]}>
              Combinam com a sua disponibilidade e as áreas em que você quer ajudar.
            </Text>
            {sugestoesExtras.map(atividade => (
              <CartaoAtividadeInicio
                key={atividade.id}
                atividade={atividade}
                azul={false}
                etiqueta="Combina com você"
                vagasDisponiveis={Math.max(0, atividade.vagas_totais - atividade.vagas_ocupadas)}
                abrir={abrirAtividade}
              />
            ))}
          </>
        ) : null}

        <CabecalhoSecao titulo="A horta precisa" acao="Ver metas" onPress={aoIrParaMetas} />
        {meta ? (
          <CartaoMetaInicio meta={meta} abrir={abrirMeta} />
        ) : resumo ? (
          <EstadoVazio
            icone="caixa"
            titulo="Tudo em dia por aqui"
            texto="Quando a instituição abrir uma meta de doação, você verá aqui."
          />
        ) : null}

        <CabecalhoSecao titulo="Novidades da horta" acao="Ler mais" onPress={aoIrParaDiario} />
        {publicacao ? (
          <CartaoDiarioInicio publicacao={publicacao} abrir={abrirPublicacao} />
        ) : resumo ? (
          <EstadoVazio
            icone="livro"
            titulo="Nossa história continua"
            texto="Os novos relatos da instituição aparecerão no diário."
          />
        ) : null}

        <AtalhosInicio
          aoIrParaOficinas={aoIrParaOficinas}
          aoIrParaCertificados={aoIrParaCertificados}
        />
      </View>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.superficie },
  conteudo: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, alignItems: 'center' },
  coluna: { width: '100%', maxWidth: 560 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  boasVindas: { fontSize: 12, color: cores.tintaSuave, marginTop: 2 },
  nome: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: cores.tinta,
    letterSpacing: -0.5,
  },
  aceno: { fontSize: 21 },
  perfil: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.fundo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  explicacaoSugestoes: { marginTop: -6, marginBottom: 10 },
  feedback: { marginTop: 18 },
  carregando: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingTop: 18,
  },
  completar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: cores.oliva,
    padding: 16,
    borderRadius: 16,
    marginTop: 18,
  },
  completarTitulo: { color: cores.tinta, fontSize: 13, fontWeight: '600' },
});
