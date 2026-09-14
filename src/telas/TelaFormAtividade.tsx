import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { cores, espaco, tipo } from '../lib/tema';
import type { Atividade } from '../lib/tipos';
import { mascararDataHora } from '../lib/mascaras';
import { Aviso, Botao, Campo } from '../componentes/Ui';

type Props = {
  atividade: Atividade | null;
  autorId: string;
  onPronto: () => void;
  onCancelar: () => void;
};

export function TelaFormAtividade({ atividade, autorId, onPronto, onCancelar }: Props) {
  const editando = atividade !== null;

  const [titulo, setTitulo] = useState(atividade?.titulo ?? '');
  const [descricao, setDescricao] = useState(atividade?.descricao ?? '');
  const [quando, setQuando] = useState(paraCampo(atividade?.data_hora_prevista));
  const [vagas, setVagas] = useState(String(atividade?.vagas_totais ?? ''));
  const [carga, setCarga] = useState(String(atividade?.carga_horaria ?? ''));
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    setErro(null);

    const data = interpretarData(quando);
    const nVagas = Number(vagas);
    const nCarga = Number(carga);

    if (titulo.trim().length < 3) return setErro('O título precisa de ao menos 3 caracteres.');
    if (titulo.trim().length > 120) return setErro('O título pode ter no máximo 120 caracteres.');
    if (!descricao.trim()) return setErro('Descreva o que será feito na atividade.');
    if (!data) return setErro('Use o formato DD/MM/AAAA HH:MM na data.');
    // Só trava data no passado ao criar: editar uma atividade já realizada
    // (para corrigir descrição, por exemplo) não deve exigir mudar a data.
    if (!editando && data.getTime() <= Date.now()) {
      return setErro('A data precisa ser no futuro.');
    }
    if (!Number.isInteger(nVagas) || nVagas < 1 || nVagas > 500) {
      return setErro('Informe entre 1 e 500 vagas.');
    }
    if (!(nCarga > 0) || nCarga > 999.99) {
      return setErro('Informe a carga horária em horas (até 999,99).');
    }

    setOcupado(true);

    const campos = {
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      data_hora_prevista: data.toISOString(),
      vagas_totais: nVagas,
      carga_horaria: nCarga,
    };

    // O status não vem do formulário: tarefa da ONG nasce ABERTA, e a
    // política de RLS confere autor_id contra o usuário autenticado.
    const { error } = editando
      ? await supabase.from('atividades').update(campos).eq('id', atividade.id)
      : await supabase.from('atividades').insert({
          ...campos,
          tipo: 'TAREFA_ONG',
          status: 'ABERTA',
          autor_id: autorId,
        });

    setOcupado(false);

    if (error) {
      setErro(traduzErro(error.message));
      return;
    }

    onPronto();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: cores.fundo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onCancelar} hitSlop={12} style={{ marginBottom: espaco.md }}>
          <Text style={[tipo.apoio, { color: cores.folha, fontWeight: '600' }]}>Voltar</Text>
        </Pressable>

        <Text style={[tipo.titulo, { marginBottom: espaco.lg }]}>
          {editando ? 'Editar tarefa' : 'Publicar tarefa'}
        </Text>

        {erro ? <Aviso mensagem={erro} /> : null}

        <Campo rotulo="Título" value={titulo} onChangeText={setTitulo} />

        <Campo
          rotulo="Descrição"
          value={descricao}
          onChangeText={setDescricao}
          multiline
          numberOfLines={4}
          style={estilos.multilinha}
        />

        <Campo
          rotulo="Data e hora"
          value={quando}
          onChangeText={(texto) => setQuando(mascararDataHora(texto))}
          placeholder="DD/MM/AAAA HH:MM"
          dica="Formato DD/MM/AAAA HH:MM"
          keyboardType="numbers-and-punctuation"
        />

        <Campo rotulo="Vagas" value={vagas} onChangeText={setVagas} keyboardType="number-pad" />

        <Campo
          rotulo="Carga horária"
          value={carga}
          onChangeText={setCarga}
          dica="Em horas. Usada depois no certificado do voluntário."
          keyboardType="decimal-pad"
        />

        <Botao
          titulo={editando ? 'Salvar alterações' : 'Publicar'}
          onPress={salvar}
          carregando={ocupado}
        />

        <View style={{ height: espaco.sm }} />
        <Botao titulo="Cancelar" variante="contorno" onPress={onCancelar} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Converte ISO do banco para o formato exibido no campo. */
function paraCampo(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Lê DD/MM/AAAA HH:MM no fuso do aparelho. Devolve null se inválido. */
function interpretarData(texto: string): Date | null {
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;

  const [, dia, mes, ano, hora, minuto] = m.map(Number);
  const d = new Date(ano, mes - 1, dia, hora, minuto);

  // Rejeita datas que "transbordam", como 31/02.
  if (d.getDate() !== dia || d.getMonth() !== mes - 1) return null;
  return d;
}

function traduzErro(mensagem: string) {
  if (mensagem.includes('row-level security')) {
    return 'Sua conta não tem permissão para publicar tarefas. Só a gestão da ONG pode.';
  }
  return mensagem;
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, paddingTop: espaco.xl },
  multilinha: { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 },
});
