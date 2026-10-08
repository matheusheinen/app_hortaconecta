import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  carregarPerfilOng,
  salvarPerfilOng,
  type DadosPerfilOng,
  type PerfilOngCarregado,
} from './apiOng';
import { mensagemErro } from '@/compartilhado/utils/erros';
import {
  ProvedorPerfilOng,
  TelaHubPerfilOng,
  TelaSecaoContaOng,
  TelaSecaoInstitucionalOng,
  TelaSecaoRecebimentoOng,
  TelaSecaoWhatsappOng,
} from './telas/TelasPerfilOng';

export type ParametrosPerfilOng = {
  hub: undefined;
  conta: undefined;
  institucional: undefined;
  whatsapp: undefined;
  recebimento: undefined;
};

const Pilha = createNativeStackNavigator<ParametrosPerfilOng>();

type Props = {
  usuarioId: string;
  nome: string;
  sair: () => void;
  recarregarPerfil: (propagarErro?: boolean) => Promise<void>;
};

export function PilhaPerfilOng({ usuarioId, nome, sair, recarregarPerfil }: Props) {
  const [dados, setDados] = useState<PerfilOngCarregado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const sequencia = useRef(0);

  const carregar = useCallback(async () => {
    const atual = ++sequencia.current;
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await carregarPerfilOng(usuarioId);
      if (atual === sequencia.current) setDados(resultado);
    } catch (falha) {
      if (atual === sequencia.current) setErro(mensagemErro(falha));
    } finally {
      if (atual === sequencia.current) setCarregando(false);
    }
  }, [usuarioId]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
      return () => {
        sequencia.current++;
      };
    }, [carregar]),
  );

  const salvar = useCallback(
    async (parcial: Partial<DadosPerfilOng>) => {
      if (!dados) throw new Error('Perfil ainda não carregado.');
      await salvarPerfilOng(parcial);
      setDados({ ...dados, ...parcial });
      if ('nome' in parcial) await recarregarPerfil().catch(() => {});
    },
    [dados, recarregarPerfil],
  );

  const valor = { dados, erro, carregando, carregar: () => void carregar(), salvar };

  return (
    <ProvedorPerfilOng valor={valor}>
      <Pilha.Navigator screenOptions={{ headerShown: false }}>
        <Pilha.Screen name="hub">
          {({ navigation }) => (
            <TelaHubPerfilOng nome={nome} sair={sair} abrir={secao => navigation.navigate(secao)} />
          )}
        </Pilha.Screen>
        <Pilha.Screen name="conta">
          {({ navigation }) => <TelaSecaoContaOng voltar={() => navigation.goBack()} />}
        </Pilha.Screen>
        <Pilha.Screen name="institucional">
          {({ navigation }) => <TelaSecaoInstitucionalOng voltar={() => navigation.goBack()} />}
        </Pilha.Screen>
        <Pilha.Screen name="whatsapp">
          {({ navigation }) => <TelaSecaoWhatsappOng voltar={() => navigation.goBack()} />}
        </Pilha.Screen>
        <Pilha.Screen name="recebimento">
          {({ navigation }) => <TelaSecaoRecebimentoOng voltar={() => navigation.goBack()} />}
        </Pilha.Screen>
      </Pilha.Navigator>
    </ProvedorPerfilOng>
  );
}
