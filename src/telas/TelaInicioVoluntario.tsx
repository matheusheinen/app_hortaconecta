import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { cores, espaco, tipo } from '../lib/tema';
import { Botao } from '../componentes/Ui';
import { useConfiguracaoInstituicao } from '../lib/useConfiguracaoInstituicao';

type Props = {
  nome: string;
  sair: () => void;
  aoIrParaAtividades: () => void;
  aoIrParaMetas: () => void;
};

export function TelaInicioVoluntario({ nome, sair, aoIrParaAtividades, aoIrParaMetas }: Props) {
  const { configuracao } = useConfiguracaoInstituicao();
  const [perfilCompleto, setPerfilCompleto] = useState<boolean | null>(null);

  useEffect(() => {
    let ativo = true;

    supabase.rpc('perfil_completo').then(({ data, error }) => {
      if (!ativo) return;
      if (error) console.warn('Falha ao verificar perfil:', error.message);
      setPerfilCompleto(data ?? null);
    });

    return () => {
      ativo = false;
    };
  }, []);

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

      {perfilCompleto === false ? (
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
        <Text style={tipo.secao}>Metas</Text>
        <Text style={[tipo.apoio, { marginTop: espaco.xs, marginBottom: espaco.md }]}>
          Veja as metas abertas da horta e copie a chave PIX para apadrinhar.
        </Text>
        <Botao titulo="Ver metas" onPress={aoIrParaMetas} />
      </View>

      <View style={estilos.cartao}>
        <Text style={tipo.secao}>Em desenvolvimento</Text>
        <Text style={[tipo.apoio, { marginTop: espaco.xs }]}>
          Diário de transparência e envio de comprovante de doação chegam nas próximas sprints.
        </Text>
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
