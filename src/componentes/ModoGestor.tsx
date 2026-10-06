import React, { createContext, useContext, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { cores, espaco, tipo } from '../lib/tema';
import { mensagemErro } from '../lib/voluntariado';
import { Icone } from './Icone';

export type ModoGestor = { ativo: boolean; alternar: (gestor: boolean) => Promise<void> };

const Contexto = createContext<ModoGestor | null>(null);
export const ProvedorModoGestor = Contexto.Provider;

/** Interruptor do perfil: só aparece para quem é da gestão (provedor ausente = oculto). */
export function CartaoModoGestor() {
  const modo = useContext(Contexto);
  const [trocando, setTrocando] = useState(false);
  if (!modo) return null;
  async function trocar(gestor: boolean) {
    if (trocando || !modo) return;
    setTrocando(true);
    try { await modo.alternar(gestor); }
    catch (falha) { Alert.alert('Não foi possível trocar o modo', mensagemErro(falha)); }
    finally { setTrocando(false); }
  }
  return (
    <View style={estilos.cartao}>
      <Icone nome="perfil" tamanho={20} cor={cores.folha} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={estilos.titulo}>Modo gestor</Text>
        <Text style={tipo.apoio}>
          {modo.ativo ? 'Desative para usar o app como voluntário.' : 'Ative para voltar à gestão da ONG.'}
        </Text>
      </View>
      <Switch
        value={modo.ativo}
        disabled={trocando}
        onValueChange={trocar}
        trackColor={{ true: cores.folha }}
        accessibilityLabel="Modo gestor"
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    flexDirection: 'row', alignItems: 'center', gap: espaco.sm, padding: espaco.md,
    backgroundColor: cores.fundo, borderRadius: 18, borderWidth: 1, borderColor: cores.linha,
  },
  titulo: { fontSize: 15, fontWeight: '700', color: cores.tinta },
});
