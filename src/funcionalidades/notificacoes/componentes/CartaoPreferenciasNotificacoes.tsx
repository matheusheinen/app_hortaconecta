import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { avisar } from '@/compartilhado/utils/confirmar';
import { Icone } from '@/compartilhado/componentes/Icone';
import { listarPreferencias, salvarPreferencia } from '../api';
import type { CanalNotificacao, CategoriaNotificacao, PreferenciaNotificacao } from '../tipos';

const CATEGORIAS: Record<CategoriaNotificacao, string> = {
  VOLUNTARIADO: 'Atividades e candidaturas',
  CONTRIBUICOES: 'Contribuições e metas',
};
const CANAIS: Record<CanalNotificacao, string> = {
  push: 'no celular',
  email: 'por e-mail',
  whatsapp: 'pelo WhatsApp',
};

/**
 * Liga e desliga os avisos fora do app por categoria. O sino dentro do app sempre recebe tudo,
 * e avisos críticos (atividade cancelada) chegam mesmo com o push desligado. Se o servidor ainda
 * não tem as preferências instaladas, o cartão não aparece.
 */
export function CartaoPreferenciasNotificacoes() {
  const [preferencias, setPreferencias] = useState<PreferenciaNotificacao[] | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    listarPreferencias()
      .then(lista => ativo && setPreferencias(lista))
      .catch(() => ativo && setPreferencias([]));
    return () => {
      ativo = false;
    };
  }, []);

  if (!preferencias?.length) return null;

  async function alternar(p: PreferenciaNotificacao, valor: boolean) {
    const chave = `${p.categoria}:${p.canal}`;
    if (salvando) return;
    setSalvando(chave);
    const trocar = (ativo: boolean) =>
      setPreferencias(lista =>
        (lista ?? []).map(x =>
          x.categoria === p.categoria && x.canal === p.canal ? { ...x, ativo } : x,
        ),
      );
    trocar(valor);
    try {
      await salvarPreferencia(p.categoria, p.canal, valor);
    } catch (falha) {
      trocar(!valor);
      avisar('Não foi possível salvar', mensagemErro(falha));
    } finally {
      setSalvando(null);
    }
  }

  return (
    <View style={estilos.cartao}>
      <View style={estilos.cabecalho}>
        <Icone nome="sino" tamanho={20} cor={cores.folha} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={estilos.titulo}>Notificações</Text>
          <Text style={tipo.apoio}>
            O sino do app mostra tudo. Escolha o que também chega fora dele.
          </Text>
        </View>
      </View>
      {preferencias.map(p => {
        const rotulo = `${CATEGORIAS[p.categoria] ?? p.categoria} ${CANAIS[p.canal] ?? p.canal}`;
        return (
          <View key={`${p.categoria}:${p.canal}`} style={estilos.linha}>
            <Text style={[tipo.apoio, { flex: 1, color: cores.tinta }]}>{rotulo}</Text>
            <Switch
              value={p.ativo}
              disabled={salvando !== null}
              onValueChange={valor => void alternar(p, valor)}
              trackColor={{ true: cores.folha }}
              accessibilityLabel={rotulo}
            />
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: espaco.sm,
    padding: espaco.md,
    backgroundColor: cores.fundo,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
  titulo: { fontSize: 15, fontWeight: '700', color: cores.tinta },
  linha: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
});
