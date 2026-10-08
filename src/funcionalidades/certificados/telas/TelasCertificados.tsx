import React, { useCallback, useRef, useState } from 'react';
import { Share, Text } from 'react-native';
import { Botao } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { listarCertificados, detalheCertificado, emitirCertificado } from '../api';
import { textoCertificado } from '../texto';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { tipo } from '@/compartilhado/tema';

export function TelaCertificados({
  gestao,
  voltar,
  abrir,
}: {
  gestao: boolean;
  voltar: () => void;
  abrir: (id: string) => void;
}) {
  const { dados, erro, carregando, carregar } = useConsulta(listarCertificados);
  const [falha, setFalha] = useState<string | null>(null),
    [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  async function emitir(id: number) {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setFalha(null);
    try {
      const certificado = await emitirCertificado(id);
      await carregar();
      abrir(certificado);
    } catch (e) {
      setFalha(mensagemErro(e));
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  return (
    <TelaFluxo
      titulo={gestao ? 'Certificados emitidos' : 'Meus certificados'}
      voltar={voltar}
      carregando={carregando}
      erro={falha ?? erro}
      atualizar={() => {
        setFalha(null);
        void carregar();
      }}
    >
      <Text style={tipo.apoio}>
        Presença confirmada por check-in. A carga horária é prevista, não uma medição de horas
        realizadas.
      </Text>
      {dados && !dados.emitidos.length && !dados.disponiveis.length ? (
        <Text style={tipo.corpo}>Nenhum certificado disponível.</Text>
      ) : null}
      {!gestao
        ? dados?.disponiveis.map(c => (
            <CartaoFluxo key={c.participacao_id}>
              <Text style={tipo.secao}>{c.atividade}</Text>
              <Text style={tipo.corpo}>
                {new Date(c.data_atividade).toLocaleDateString('pt-BR')} ·{' '}
                {c.carga_horaria_prevista}h previstas
              </Text>
              <Text style={tipo.apoio}>Disponível para emissão.</Text>
              <Botao
                titulo={ocupado ? 'Emitindo...' : 'Emitir e visualizar'}
                desabilitado={ocupado}
                onPress={() => {
                  void emitir(c.participacao_id);
                }}
              />
            </CartaoFluxo>
          ))
        : null}
      {dados?.emitidos.map(c => (
        <CartaoFluxo key={c.id}>
          <Text style={tipo.secao}>{c.atividade}</Text>
          {gestao ? <Text style={tipo.corpo}>{c.nome_voluntario}</Text> : null}
          <Text style={tipo.corpo}>
            {new Date(c.data_atividade).toLocaleDateString('pt-BR')} · {c.carga_horaria_prevista}h
            previstas
          </Text>
          <Text style={tipo.apoio}>
            Emissão: {new Date(c.emitido_em).toLocaleDateString('pt-BR')}
          </Text>
          <Text selectable style={tipo.apoio}>
            HC-{c.id}
          </Text>
          <Botao titulo="Visualizar certificado" onPress={() => abrir(c.id)} />
        </CartaoFluxo>
      ))}
    </TelaFluxo>
  );
}
export function TelaCertificado({ id, voltar }: { id: string; voltar: () => void }) {
  const { dados, erro, carregando, carregar } = useConsulta(
    useCallback(() => detalheCertificado(id), [id]),
  );
  const [falha, setFalha] = useState<string | null>(null),
    [ocupado, setOcupado] = useState(false);
  async function compartilhar() {
    if (!dados || ocupado) return;
    setOcupado(true);
    setFalha(null);
    try {
      await Share.share({ title: 'Certificado Horta Conecta', message: textoCertificado(dados) });
    } catch {
      setFalha('Não foi possível compartilhar. Tente novamente.');
    } finally {
      setOcupado(false);
    }
  }
  return (
    <TelaFluxo
      titulo="Certificado de participação"
      voltar={voltar}
      carregando={carregando}
      erro={falha ?? erro}
      atualizar={() => {
        setFalha(null);
        void carregar();
      }}
    >
      {dados ? (
        <>
          <CartaoFluxo>
            <Text selectable style={tipo.corpo}>
              {textoCertificado(dados)}
            </Text>
          </CartaoFluxo>
          <Text style={tipo.apoio}>Compartilhamento em texto, sem PDF ou assinatura digital.</Text>
          <Botao
            titulo="Compartilhar texto do certificado"
            desabilitado={ocupado}
            onPress={() => {
              void compartilhar();
            }}
          />
        </>
      ) : null}
    </TelaFluxo>
  );
}
