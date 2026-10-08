import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '@/servicos/supabase';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import type { Atividade } from '../tipos';
import type { Habilidade } from '@/compartilhado/tipos';
import { mascararDataHora } from '@/compartilhado/utils/mascaras';
import { Botao, Campo } from '@/compartilhado/componentes/Ui';
import { CartaoFluxo, TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { interpretarCarga, interpretarDataHora } from '../regras';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { carregarAreasAtividade, salvarAreasAtividade } from '../areasAtividade';

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
  const [catalogo, setCatalogo] = useState<Habilidade[]>([]);
  const [areas, setAreas] = useState<number[]>([]);
  const [areasOriginais, setAreasOriginais] = useState<number[]>([]);
  const [avisoAreas, setAvisoAreas] = useState<string | null>(null);

  // Áreas são opcionais: se a carga falhar, a tarefa continua editável sem elas.
  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const [lista, marcadas] = await Promise.all([
          supabase.from('habilidades').select('*').order('categoria').order('nome_habilidade'),
          atividade ? carregarAreasAtividade(atividade.id) : Promise.resolve([]),
        ]);
        if (lista.error) throw lista.error;
        if (!ativo) return;
        setCatalogo(lista.data ?? []);
        setAreas(marcadas);
        setAreasOriginais(marcadas);
      } catch (falha) {
        if (ativo) setAvisoAreas(`Não foi possível carregar as áreas: ${mensagemErro(falha)}`);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [atividade]);

  function alternarArea(id: number) {
    setAreas(atual => (atual.includes(id) ? atual.filter(a => a !== id) : [...atual, id]));
  }

  async function salvar() {
    setErro(null);

    if (ocupado) return;
    const data = interpretarDataHora(quando);
    const nVagas = Number(vagas);
    const nCarga = interpretarCarga(carga);

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
    if (nCarga === null) {
      return setErro('Informe a carga horária em horas (até 999,99).');
    }

    setOcupado(true);
    try {
      const campos = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        data_hora_prevista: data.toISOString(),
        vagas_totais: nVagas,
        carga_horaria: nCarga,
      };

      // O status não vem do formulário: tarefa da ONG nasce ABERTA, e a
      // política de RLS confere autor_id contra o usuário autenticado.
      const { error, data: gravada } = editando
        ? await supabase
            .from('atividades')
            .update(campos)
            .eq('id', atividade.id)
            .select('id')
            .single()
        : await supabase
            .from('atividades')
            .insert({
              ...campos,
              tipo: 'TAREFA_ONG',
              status: 'ABERTA',
              autor_id: autorId,
            })
            .select('id')
            .single();
      if (error) throw error;
      if (!gravada) throw new Error('A atividade não foi salva. Recarregue e tente novamente.');
      if (!avisoAreas) {
        try {
          await salvarAreasAtividade(gravada.id, areasOriginais, areas);
        } catch (falha) {
          Alert.alert(
            'Tarefa salva',
            `As áreas não foram atualizadas: ${mensagemErro(falha)} Edite a tarefa para tentar de novo.`,
          );
        }
      }
      onPronto();
    } catch (falha) {
      setErro(traduzErro(mensagemErro(falha)));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TelaFluxo
        titulo={editando ? 'Editar tarefa' : 'Publicar tarefa'}
        voltar={onCancelar}
        erro={erro}
      >
        <Text style={tipo.apoio}>
          Após a primeira candidatura, título, data, horário e carga horária ficam protegidos no
          servidor. Descrição e vagas continuam editáveis dentro das regras.
        </Text>
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
          onChangeText={texto => setQuando(mascararDataHora(texto))}
          placeholder="DD/MM/AAAA HH:MM"
          dica="Formato DD/MM/AAAA HH:MM"
          keyboardType="numbers-and-punctuation"
        />

        <Campo rotulo="Vagas" value={vagas} onChangeText={setVagas} keyboardType="number-pad" />

        <Campo
          rotulo="Carga horária"
          value={carga}
          onChangeText={setCarga}
          dica="Carga horária prevista, não medida. Preservada após a primeira candidatura."
          keyboardType="decimal-pad"
        />

        <CartaoFluxo>
          <Text style={tipo.secao}>Áreas da tarefa (opcional)</Text>
          <Text style={tipo.apoio}>
            Usadas para sugerir a tarefa a voluntários com habilidades da mesma área. Sem área
            marcada, a sugestão considera só a disponibilidade.
          </Text>
          {avisoAreas ? <Text style={tipo.apoio}>{avisoAreas}</Text> : null}
          <View style={estilos.chips}>
            {catalogo.map(h => {
              const ativo = areas.includes(h.id);
              return (
                <Pressable
                  key={h.id}
                  onPress={() => alternarArea(h.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ativo }}
                  accessibilityLabel={h.nome_habilidade}
                  style={[estilos.chip, ativo && estilos.chipAtivo]}
                >
                  <Text style={[estilos.chipTexto, ativo && estilos.chipTextoAtivo]}>
                    {h.nome_habilidade}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </CartaoFluxo>

        <Botao
          titulo={editando ? 'Salvar alterações' : 'Publicar tarefa'}
          onPress={salvar}
          carregando={ocupado}
        />
      </TelaFluxo>
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
function traduzErro(mensagem: string) {
  if (mensagem.includes('row-level security')) {
    return 'Sua conta não tem permissão para publicar tarefas. Só a gestão da ONG pode.';
  }
  return mensagem;
}

const estilos = StyleSheet.create({
  multilinha: { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espaco.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: 20,
    paddingHorizontal: espaco.md,
    paddingVertical: espaco.xs + 2,
  },
  chipAtivo: { borderColor: cores.folha, backgroundColor: cores.folhaClara },
  chipTexto: { fontSize: 13, fontWeight: '600', color: cores.tintaSuave },
  chipTextoAtivo: { color: cores.folha },
});
