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
import type { Meta, TipoMeta } from '../lib/tipos';
import { mascararData } from '../lib/mascaras';
import { Aviso, Botao, Campo } from '../componentes/Ui';

type Props = {
  meta: Meta | null;
  onPronto: () => void;
  onCancelar: () => void;
};

const rotuloTipo: Record<TipoMeta, string> = {
  FINANCEIRA: 'Financeira (PIX)',
  MATERIAL: 'Material (doação de itens)',
};

export function TelaFormMeta({ meta, onPronto, onCancelar }: Props) {
  const editando = meta !== null;

  const [titulo, setTitulo] = useState(meta?.titulo ?? '');
  const [descricao, setDescricao] = useState(meta?.descricao ?? '');
  const [tipoMeta, setTipoMeta] = useState<TipoMeta>(meta?.tipo ?? 'FINANCEIRA');
  const [unidadeMedida, setUnidadeMedida] = useState(meta?.unidade_medida ?? '');
  const [quantidadeMeta, setQuantidadeMeta] = useState(String(meta?.quantidade_meta ?? ''));
  const [dataLimite, setDataLimite] = useState(paraCampoData(meta?.data_limite));
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    setErro(null);

    const nQuantidade = Number(quantidadeMeta.replace(',', '.'));
    const dataLimiteIso = dataLimite.trim() ? interpretarData(dataLimite) : null;

    if (titulo.trim().length < 3) return setErro('O título precisa de ao menos 3 caracteres.');
    if (titulo.trim().length > 120) return setErro('O título pode ter no máximo 120 caracteres.');
    if (!descricao.trim()) return setErro('Descreva a meta.');
    if (tipoMeta === 'MATERIAL' && !unidadeMedida.trim()) {
      return setErro('Informe a unidade de medida (ex.: kg, unidades).');
    }
    if (!(nQuantidade > 0)) return setErro('Informe a quantidade da meta.');
    if (dataLimite.trim() && !dataLimiteIso) return setErro('Use o formato DD/MM/AAAA no prazo.');
    // Só trava prazo no passado ao criar, pelo mesmo motivo do formulário
    // de atividades: editar uma meta antiga não deve exigir mudar o prazo.
    if (!editando && dataLimiteIso && dataLimiteIso < hoje()) {
      return setErro('O prazo precisa ser hoje ou uma data futura.');
    }

    setOcupado(true);

    const campos = {
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      tipo: tipoMeta,
      unidade_medida: tipoMeta === 'MATERIAL' ? unidadeMedida.trim() : null,
      quantidade_meta: nQuantidade,
      data_limite: dataLimiteIso,
    };

    const { error } = editando
      ? await supabase.from('metas_demandas').update(campos).eq('id', meta.id)
      : await supabase.from('metas_demandas').insert(campos);

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
          {editando ? 'Editar meta' : 'Nova meta'}
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

        <Text style={estilos.rotulo}>Tipo</Text>
        <View style={estilos.alternador}>
          {(['FINANCEIRA', 'MATERIAL'] as TipoMeta[]).map((valor) => (
            <Pressable
              key={valor}
              onPress={() => setTipoMeta(valor)}
              style={[estilos.opcao, tipoMeta === valor && estilos.opcaoAtiva]}
            >
              <Text
                style={[estilos.opcaoTexto, tipoMeta === valor && estilos.opcaoTextoAtivo]}
              >
                {rotuloTipo[valor]}
              </Text>
            </Pressable>
          ))}
        </View>

        {tipoMeta === 'MATERIAL' ? (
          <Campo
            rotulo="Unidade de medida"
            value={unidadeMedida}
            onChangeText={setUnidadeMedida}
          />
        ) : null}

        <Campo
          rotulo={tipoMeta === 'FINANCEIRA' ? 'Meta em reais' : 'Quantidade da meta'}
          value={quantidadeMeta}
          onChangeText={setQuantidadeMeta}
          keyboardType="decimal-pad"
        />

        <Campo
          rotulo="Prazo (opcional)"
          value={dataLimite}
          onChangeText={(texto) => setDataLimite(mascararData(texto))}
          placeholder="DD/MM/AAAA"
          dica="Formato DD/MM/AAAA"
          keyboardType="numbers-and-punctuation"
        />

        <Botao
          titulo={editando ? 'Salvar alterações' : 'Criar meta'}
          onPress={salvar}
          carregando={ocupado}
        />

        <View style={{ height: espaco.sm }} />
        <Botao titulo="Cancelar" variante="contorno" onPress={onCancelar} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Data de hoje em YYYY-MM-DD, pra comparar direto com o prazo (mesmo formato). */
function hoje(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Converte a data (YYYY-MM-DD, vinda do banco) para o formato exibido no campo. */
function paraCampoData(iso?: string | null) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Lê DD/MM/AAAA e devolve YYYY-MM-DD, ou null se inválido. */
function interpretarData(texto: string): string | null {
  const m = texto.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  const [, dia, mes, ano] = m;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));

  // Rejeita datas que "transbordam", como 31/02.
  if (d.getDate() !== Number(dia) || d.getMonth() !== Number(mes) - 1) return null;
  return `${ano}-${mes}-${dia}`;
}

function traduzErro(mensagem: string) {
  if (mensagem.includes('row-level security')) {
    return 'Sua conta não tem permissão para gerenciar metas. Só a gestão da ONG pode.';
  }
  return mensagem;
}

const estilos = StyleSheet.create({
  conteudo: { padding: espaco.lg, paddingTop: espaco.xl },
  multilinha: { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 },
  rotulo: {
    fontSize: 13,
    fontWeight: '600',
    color: cores.tintaSuave,
    marginBottom: espaco.sm,
  },
  alternador: { flexDirection: 'row', gap: espaco.sm, marginBottom: espaco.md },
  opcao: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  opcaoAtiva: { borderColor: cores.folha, backgroundColor: cores.folhaClara },
  opcaoTexto: { fontSize: 13, fontWeight: '600', color: cores.tintaSuave, textAlign: 'center' },
  opcaoTextoAtivo: { color: cores.folha },
});
