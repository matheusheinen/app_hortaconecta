import React, { useCallback, useRef, useState } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  carregarPerfilOng,
  salvarPerfilOng,
  type DadosPerfilOng,
  type PerfilOngCarregado,
} from './apiOng';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { avisarConfiguracaoAlterada } from '@/compartilhado/hooks/useConfiguracaoInstituicao';
import { ProvedorPerfilOng } from './ContextoPerfilOng';
import { TelaHubPerfilOng } from './telas/TelaHubPerfilOng';
import { TelaSecaoContaOng } from './telas/TelaSecaoContaOng';
import { TelaSecaoIdentidadeOng } from './telas/TelaSecaoIdentidadeOng';
import { TelaSecaoInstitucionalOng } from './telas/TelaSecaoInstitucionalOng';
import { TelaSecaoRecebimentoOng } from './telas/TelaSecaoRecebimentoOng';
import { TelaSecaoWhatsappOng } from './telas/TelaSecaoWhatsappOng';

export type ParametrosPerfilOng = {
  hub: undefined;
  identidade: undefined;
  conta: undefined;
  institucional: undefined;
  whatsapp: undefined;
  recebimento: undefined;
};

const Pilha = createNativeStackNavigator<ParametrosPerfilOng>();

export function PilhaPerfilOng() {
  const { usuarioId, nome, sair, recarregarPerfil } = useSessaoAtual();
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
      if ('nome_curto' in parcial || 'url_logo' in parcial) avisarConfiguracaoAlterada();
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
        <Pilha.Screen name="identidade">
          {({ navigation }) => <TelaSecaoIdentidadeOng voltar={() => navigation.goBack()} />}
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
