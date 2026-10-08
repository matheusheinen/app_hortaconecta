import React, { useCallback, useState } from 'react';
import { Text } from 'react-native';
import { Botao, Campo } from '../componentes/Ui';
import { CartaoFluxo, TelaFluxoVoluntariado } from '../componentes/TelaFluxoVoluntariado';
import { tipo } from '../lib/tema';
import { DIAS_SEMANA, PERIODOS_DIA } from '../lib/tipos';
import { disponibilidadeValida } from '../lib/regrasVoluntariado';
import { supabase } from '../lib/supabase';
import { carregarCandidatos, carregarDetalhe, mensagemErro } from '../lib/voluntariado';
import { type Candidato, rotuloInscricao } from '../lib/voluntariado.types';
import { useDadosVoluntariado } from '../lib/useDadosVoluntariado';

export function TelaCandidatosAtividade({
  atividadeId,
  usuarioId,
  voltar,
}: {
  atividadeId: number;
  usuarioId: string;
  voltar: () => void;
}) {
  const consulta = useCallback(async () => {
    const [detalhe, candidatos] = await Promise.all([
      carregarDetalhe(atividadeId),
      carregarCandidatos(atividadeId),
    ]);
    return { detalhe, candidatos };
  }, [atividadeId]);
  const { dados, erro, carregando, carregar } = useDadosVoluntariado(consulta);
  const [ocupado, setOcupado] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  async function decidir(id: number, decisao: 'APROVADA' | 'RECUSADA', motivo: string) {
    if (ocupado) return;
    setOcupado(true);
    setErroAcao(null);
    try {
      const { error } = await supabase.rpc('voluntariado_decidir', {
        p_inscricao: id,
        p_decisao: decisao,
        p_motivo: motivo,
      });
      if (error) throw error;
      await carregar();
    } catch (falha) {
      setErroAcao(mensagemErro(falha));
    } finally {
      setOcupado(false);
    }
  }
  const aberta =
    !!dados &&
    ['ABERTA', 'ENCERRADA'].includes(dados.detalhe.atividade.status) &&
    new Date(dados.detalhe.atividade.data_hora_prevista).getTime() > Date.now();
  return (
    <TelaFluxoVoluntariado
      titulo="Candidatos e participantes"
      voltar={voltar}
      erro={erroAcao ?? erro}
      carregando={carregando}
      atualizar={carregar}
    >
      {dados ? (
        <>
          <Text style={tipo.secao}>{dados.detalhe.atividade.titulo}</Text>
          <Text style={tipo.corpo}>
            {dados.detalhe.aprovados} aprovados de {dados.detalhe.atividade.vagas_totais} vagas
          </Text>
          {!aberta ? <Text style={tipo.apoio}>Triagem encerrada para esta atividade.</Text> : null}
          {!dados.candidatos.length ? (
            <Text style={tipo.apoio}>Nenhuma candidatura recebida.</Text>
          ) : null}
          {dados.candidatos.map(c => (
            <CartaoCandidato
              key={c.id}
              candidato={c}
              ocupado={ocupado}
              podeDecidir={
                aberta && c.usuario_id !== usuarioId && c.status_inscricao === 'PENDENTE'
              }
              decidir={decidir}
            />
          ))}
        </>
      ) : null}
    </TelaFluxoVoluntariado>
  );
}

function CartaoCandidato({
  candidato: c,
  ocupado,
  podeDecidir,
  decidir,
}: {
  candidato: Candidato;
  ocupado: boolean;
  podeDecidir: boolean;
  decidir: (id: number, decisao: 'APROVADA' | 'RECUSADA', motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const disponibilidade = disponibilidadeValida(c.disponibilidade_horarios)
    ? c.disponibilidade_horarios
    : [];
  return (
    <CartaoFluxo>
      <Text style={tipo.secao}>{c.nome}</Text>
      <Text style={tipo.corpo}>
        {rotuloInscricao[c.status_inscricao]} ·{' '}
        {c.presenca_confirmada ? 'Presença confirmada' : 'Sem check-in'}
      </Text>
      {c.checkin_em ? (
        <Text style={tipo.apoio}>{new Date(c.checkin_em).toLocaleString('pt-BR')}</Text>
      ) : null}
      <Text style={tipo.corpo}>Profissão: {c.profissao || 'Não informada'}</Text>
      {c.descricao ? <Text style={tipo.corpo}>{c.descricao}</Text> : null}
      <Text style={tipo.corpo}>Habilidades: {c.habilidades.join(', ') || 'Não informadas'}</Text>
      <Text style={tipo.corpo}>
        Disponibilidade:{' '}
        {disponibilidade
          .map(
            s =>
              `${DIAS_SEMANA.find(d => d.codigo === s.dia)?.rotulo} ${PERIODOS_DIA.find(p => p.codigo === s.periodo)?.rotulo}`,
          )
          .join(', ') || 'Não informada'}
      </Text>
      {c.motivo_decisao ? <Text style={tipo.apoio}>Observação: {c.motivo_decisao}</Text> : null}
      {podeDecidir ? (
        <>
          <Campo
            rotulo="Observação da decisão (opcional)"
            value={motivo}
            onChangeText={setMotivo}
            maxLength={500}
            editable={!ocupado}
          />
          <Botao
            titulo="Aprovar candidatura"
            desabilitado={ocupado}
            onPress={() => decidir(c.id, 'APROVADA', motivo)}
          />
          <Botao
            titulo="Recusar candidatura"
            variante="destrutivo"
            desabilitado={ocupado}
            onPress={() => decidir(c.id, 'RECUSADA', motivo)}
          />
        </>
      ) : null}
    </CartaoFluxo>
  );
}
