import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Text, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { Botao } from '../componentes/Ui';
import { TelaFluxoVoluntariado } from '../componentes/TelaFluxoVoluntariado';
import { tipo } from '../lib/tema';
import { supabase } from '../lib/supabase';
import { gerarCheckin, mensagemErro } from '../lib/voluntariado';
import { lerQrCheckin } from '../lib/regrasVoluntariado';
import type { TokenCheckin } from '../lib/voluntariado.types';

export function TelaQrAtividade({
  atividadeId,
  voltar,
}: {
  atividadeId: number;
  voltar: () => void;
}) {
  const [token, setToken] = useState<TokenCheckin | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [agora, setAgora] = useState(Date.now());
  const geracao = useRef(0);
  const emFoco = useIsFocused();
  useFocusEffect(
    useCallback(() => {
      setToken(null);
      return () => {
        geracao.current++;
      };
    }, [atividadeId]),
  );
  useEffect(() => {
    if (!emFoco) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [emFoco]);
  async function gerar() {
    if (ocupado) return;
    const atual = ++geracao.current;
    setOcupado(true);
    setErro(null);
    setToken(null);
    try {
      const novo = await gerarCheckin(atividadeId);
      if (geracao.current === atual) {
        setToken(novo);
        setAgora(Date.now());
      }
    } catch (falha) {
      if (geracao.current === atual) setErro(mensagemErro(falha));
    } finally {
      setOcupado(false);
    }
  }
  const valido = token && new Date(token.expira_em).getTime() > agora;
  return (
    <TelaFluxoVoluntariado titulo="QR Code da atividade" voltar={voltar} erro={erro}>
      <Text style={tipo.corpo}>
        Exiba este código aos participantes no local. Somente voluntários com candidatura aprovada
        podem confirmar presença.
      </Text>
      <Text style={tipo.apoio}>
        Disponível de 30 minutos antes do início até o fim previsto. Gerar um novo código invalida o
        anterior.
      </Text>
      {valido && emFoco ? (
        <View style={{ alignItems: 'center', gap: 16, backgroundColor: '#FFFFFF', padding: 16 }}>
          <QRCode
            value={JSON.stringify({
              tipo: 'hortaconecta-checkin-v1',
              atividade_id: atividadeId,
              token: token.token,
            })}
            size={220}
            quietZone={12}
          />
          <Text style={tipo.apoio}>
            Válido até {new Date(token.expira_em).toLocaleTimeString('pt-BR')}
          </Text>
        </View>
      ) : token ? (
        <Text style={tipo.apoio}>Código expirado. Gere outro para continuar.</Text>
      ) : null}
      <Botao
        titulo={token ? 'Gerar novo QR Code' : 'Gerar QR Code'}
        onPress={gerar}
        carregando={ocupado}
      />
    </TelaFluxoVoluntariado>
  );
}

export function TelaCheckin({ atividadeId, voltar }: { atividadeId: number; voltar: () => void }) {
  const [permissao, pedirPermissao, consultarPermissao] = useCameraPermissions();
  const [appAtivo, setAppAtivo] = useState(AppState.currentState === 'active');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [pausado, setPausado] = useState(false);
  const trava = useRef(false);
  const emFoco = useIsFocused();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (estado) => {
      setAppAtivo(estado === 'active');
      if (estado === 'active' && emFoco) {
        void consultarPermissao().catch((falha) => setErro(mensagemErro(falha)));
      }
    });
    return () => subscription.remove();
  }, [consultarPermissao, emFoco]);
  async function ler(texto: string) {
    if (trava.current) return;
    trava.current = true;
    setPausado(true);
    setOcupado(true);
    setErro(null);
    try {
      const token = lerQrCheckin(texto, atividadeId);
      const { error } = await supabase.rpc('voluntariado_checkin', {
        p_atividade: atividadeId,
        p_token: token,
      });
      if (error) throw error;
      setConfirmado(true);
    } catch (falha) {
      setErro(mensagemErro(falha));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <TelaFluxoVoluntariado titulo="Confirmar presença" voltar={voltar} erro={erro}>
      {confirmado ? (
        <>
          <Text style={tipo.secao}>Presença confirmada!</Text>
          <Text style={tipo.corpo}>Sua participação está disponível no histórico.</Text>
          <Botao titulo="Voltar à atividade" onPress={voltar} />
        </>
      ) : (
        <>
          <Text style={tipo.corpo}>
            Aponte a câmera para o QR Code atual exibido pela gestão desta atividade.
          </Text>
          {!permissao ? (
            <Text style={tipo.apoio}>Verificando permissão da câmera...</Text>
          ) : !permissao.granted ? (
            <Botao
              titulo={
                permissao.canAskAgain ? 'Permitir acesso à câmera' : 'Abrir configurações da câmera'
              }
              onPress={() => {
                void (permissao.canAskAgain ? pedirPermissao() : Linking.openSettings()).catch(
                  (f) => setErro(mensagemErro(f)),
                );
              }}
            />
          ) : emFoco && appAtivo && !pausado ? (
            <CameraView
              style={{ height: 300, borderRadius: 10 }}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                void ler(data);
              }}
              onMountError={() => {
                setPausado(true);
                setErro('Não foi possível abrir a câmera. Verifique as permissões.');
              }}
            />
          ) : null}
          {ocupado ? <Text style={tipo.apoio}>Confirmando no servidor...</Text> : null}
          {pausado && !ocupado ? (
            <Botao
              titulo="Ler novamente"
              onPress={() => {
                trava.current = false;
                setErro(null);
                setPausado(false);
              }}
            />
          ) : null}
        </>
      )}
    </TelaFluxoVoluntariado>
  );
}
