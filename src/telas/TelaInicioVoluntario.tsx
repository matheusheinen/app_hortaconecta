import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { cores, espaco, tipo } from '../lib/tema';
import { Aviso, Botao } from '../componentes/Ui';
import { useDadosVoluntariado } from '../lib/useDadosVoluntariado';
import { useConfiguracaoInstituicao } from '../lib/useConfiguracaoInstituicao';

type Props = {
  nome: string;
  sair: () => void;
  aoIrParaAtividades: () => void;
  aoIrParaMetas: () => void;
  aoIrParaDiario: () => void;
  aoIrParaCertificados: () => void;
  aoIrParaOficinas: () => void;
};

export function TelaInicioVoluntario({ nome, sair, aoIrParaAtividades, aoIrParaMetas, aoIrParaDiario, aoIrParaOficinas, aoIrParaCertificados }: Props) {
  const { configuracao } = useConfiguracaoInstituicao();
  const { dados: perfilCompleto, erro, carregando, carregar } = useDadosVoluntariado(
    useCallback(async () => {
      const { data, error } = await supabase.rpc('voluntariado_elegibilidade');
      if (error) throw error;
      return data;
    }, []),
  );

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={estilos.conteudo}>
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={tipo.titulo}>{configuracao?.nome_curto ?? 'Horta Conecta'}</Text>
          <Text style={tipo.apoio}>{nome} · voluntário</Text>
        </View>
        <Pressable onPress={sair} hitSlop={12}>
          <Text style={[tipo.apoio, { color: cores.folha, fontWeight: '600' }]}>Sair</Text>
        </Pressable>
      </View>

      {configuracao?.chamada ? (
        <Text style={[tipo.corpo, { marginTop: espaco.md }]}>{configuracao.chamada}</Text>
      ) : null}

      {carregando ? <Text style={tipo.apoio}>Verificando seu perfil...</Text> : null}
      {erro ? (
        <View style={estilos.aviso}>
          <Aviso mensagem={erro} />
          <Botao titulo="Tentar novamente" onPress={carregar} />
        </View>
      ) : null}
      {!carregando && !erro && perfilCompleto === false ? (
        <View style={estilos.aviso}>
          <Text style={[tipo.apoio, { color: cores.beterraba }]}>
            Complete seu cadastro (CPF, data de nascimento, profissão, disponibilidade e
            habilidades) na aba Perfil para poder se candidatar a tarefas e propor oficinas.
          </Text>
        </View>
      ) : null}

      <View style={estilos.cartao}>
        <Text style={tipo.secao}>Atividades</Text>
        <Text style={[tipo.apoio, { marginTop: espaco.xs, marginBottom: espaco.md }]}>
          Veja as tarefas abertas da horta e se candidate.
        </Text>
        <Botao titulo="Ver atividades" onPress={aoIrParaAtividades} />
      </View>

      <View style={estilos.cartao}>
        <Text style={tipo.secao}>Materiais</Text>
        <Text style={[tipo.apoio, { marginTop: espaco.xs, marginBottom: espaco.md }]}>
          Veja os materiais necessários e informe os itens que pretende entregar.
        </Text>
        <Botao titulo="Contribuir com materiais" onPress={aoIrParaMetas} />
      </View>

      <View style={estilos.cartao}>
        <Text style={tipo.secao}>Certificados</Text>
        <Botao titulo="Meus certificados" onPress={aoIrParaCertificados} />
      </View>

      <View style={estilos.cartao}>
        <Text style={tipo.secao}>Oficinas</Text>
        <Botao titulo="Ver propostas de oficinas" onPress={aoIrParaOficinas} />
      </View>

      <View style={estilos.cartao}>
        <Text style={tipo.secao}>Diário de Transparência</Text>
        <Botao titulo="Ver Diário" onPress={aoIrParaDiario} />
      </View>


    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.superficie },
  conteudo: { paddingBottom: espaco.xl },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: espaco.md,
    paddingHorizontal: espaco.lg,
    paddingTop: espaco.xl,
    paddingBottom: espaco.md,
    backgroundColor: cores.fundo,
  },
  aviso: {
    backgroundColor: '#FBEFF2',
    borderRadius: 8,
    padding: espaco.md,
    marginHorizontal: espaco.lg,
    marginTop: espaco.md,
  },
  cartao: {
    backgroundColor: cores.fundo,
    borderRadius: 10,
    padding: espaco.md,
    marginHorizontal: espaco.lg,
    marginTop: espaco.md,
    borderLeftWidth: 3,
    borderLeftColor: cores.folha,
  },
});
