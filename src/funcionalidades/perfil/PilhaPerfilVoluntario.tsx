import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  carregarPerfilVoluntario,
  salvarPerfilVoluntario,
  type PerfilVoluntarioCarregado,
} from './apiVoluntario';
import { mensagemErro } from '@/funcionalidades/voluntariado/api';
import type { DadosPerfilVoluntario } from './regras';
import {
  ProvedorPerfilVoluntario,
  TelaHubPerfilVoluntario,
  TelaSecaoCadastro,
  TelaSecaoDadosPessoais,
  TelaSecaoDisponibilidade,
  TelaSecaoEndereco,
  TelaSecaoHabilidades,
} from './telas/TelasPerfilVoluntario';

export type ParametrosPerfilVoluntario = {
  hub: undefined;
  pessoais: undefined;
  cadastro: undefined;
  endereco: undefined;
  disponibilidade: undefined;
  habilidades: undefined;
};

const Pilha = createNativeStackNavigator<ParametrosPerfilVoluntario>();

type Props = {
  usuarioId: string;
  nome: string;
  sair: () => void;
  recarregarPerfil: (propagarErro?: boolean) => Promise<void>;
};

export function PilhaPerfilVoluntario({ usuarioId, nome, sair, recarregarPerfil }: Props) {
  const [perfil, setPerfil] = useState<PerfilVoluntarioCarregado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const sequencia = useRef(0);

  const carregar = useCallback(async () => {
    const atual = ++sequencia.current;
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await carregarPerfilVoluntario(usuarioId);
      if (atual === sequencia.current) setPerfil(resultado);
    } catch (falha) {
      if (atual === sequencia.current) setErro(mensagemErro(falha));
    } finally {
      if (atual === sequencia.current) setCarregando(false);
    }
  }, [usuarioId]);

  // Recarrega ao voltar para a aba; uma resposta antiga não sobrescreve a nova.
  useFocusEffect(
    useCallback(() => {
      void carregar();
      return () => {
        sequencia.current++;
      };
    }, [carregar]),
  );

  const salvar = useCallback(
    async (parcial: Partial<DadosPerfilVoluntario>, habilidades?: number[]) => {
      if (!perfil) throw new Error('Perfil ainda não carregado.');
      const escolhidas = habilidades ?? perfil.habilidades;
      const elegivel = await salvarPerfilVoluntario(parcial, escolhidas);
      setPerfil({
        ...perfil,
        dados: { ...perfil.dados, ...parcial },
        habilidades: escolhidas,
        elegivel,
      });
      // O nome também aparece no Início e nos cabeçalhos, que leem a sessão.
      if ('nome' in parcial) await recarregarPerfil().catch(() => {});
    },
    [perfil, recarregarPerfil],
  );

  const valor = { perfil, erro, carregando, carregar: () => void carregar(), salvar };

  return (
    <ProvedorPerfilVoluntario valor={valor}>
      <Pilha.Navigator screenOptions={{ headerShown: false }}>
        <Pilha.Screen name="hub">
          {({ navigation }) => (
            <TelaHubPerfilVoluntario
              nome={nome}
              sair={sair}
              abrir={secao => navigation.navigate(secao)}
            />
          )}
        </Pilha.Screen>
        <Pilha.Screen name="pessoais">
          {({ navigation }) => <TelaSecaoDadosPessoais voltar={() => navigation.goBack()} />}
        </Pilha.Screen>
        <Pilha.Screen name="cadastro">
          {({ navigation }) => <TelaSecaoCadastro voltar={() => navigation.goBack()} />}
        </Pilha.Screen>
        <Pilha.Screen name="endereco">
          {({ navigation }) => <TelaSecaoEndereco voltar={() => navigation.goBack()} />}
        </Pilha.Screen>
        <Pilha.Screen name="disponibilidade">
          {({ navigation }) => <TelaSecaoDisponibilidade voltar={() => navigation.goBack()} />}
        </Pilha.Screen>
        <Pilha.Screen name="habilidades">
          {({ navigation }) => <TelaSecaoHabilidades voltar={() => navigation.goBack()} />}
        </Pilha.Screen>
      </Pilha.Navigator>
    </ProvedorPerfilVoluntario>
  );
}
