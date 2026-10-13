import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Aviso, Botao, Campo } from '@/compartilhado/componentes/Ui';
import { CampoData } from '@/compartilhado/componentes/CampoData';
import { TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useAcao } from '@/compartilhado/hooks/useAcao';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { hojeIso, interpretarData, paraCampoData } from '@/compartilhado/utils/datas';
import type { Meta, TipoMeta } from '../tipos';
import { carregarMeta, rotuloTipoMeta, salvarMeta } from '../api';
import { interpretarQuantidade } from '../regras';

export function TelaFormMeta({ id, voltar }: { id: number | null; voltar: () => void }) {
  const consulta = useCallback(
    async () => (id === null ? null : (await carregarMeta(id)).meta),
    [id],
  );
  const { dados, erro, carregando, carregar } = useConsulta(consulta);
  return (
    <TelaFluxo
      titulo={id === null ? 'Nova meta' : 'Editar meta'}
      voltar={voltar}
      erro={erro}
      carregando={carregando}
      atualizar={carregar}
    >
      {!erro && !carregando ? (
        <FormularioMeta key={dados?.id ?? 'nova'} meta={dados} voltar={voltar} />
      ) : null}
    </TelaFluxo>
  );
}

function FormularioMeta({ meta, voltar }: { meta: Meta | null; voltar: () => void }) {
  const [tipoMeta, setTipoMeta] = useState<TipoMeta>(meta?.tipo ?? 'FINANCEIRA');
  const [titulo, setTitulo] = useState(meta?.titulo ?? '');
  const [descricao, setDescricao] = useState(meta?.descricao ?? '');
  const [unidade, setUnidade] = useState(meta?.unidade_medida ?? '');
  const [quantidade, setQuantidade] = useState(
    meta ? String(meta.quantidade_meta).replace('.', ',') : '',
  );
  const [prazo, setPrazo] = useState(paraCampoData(meta?.data_limite ?? null));
  const acao = useAcao();
  // Com contribuições confirmadas, mudar o tipo trocaria reais por unidades no histórico.
  const tipoTravado = !!meta && meta.quantidade_arrecadada > 0;

  return (
    <>
      {acao.erro ? <Aviso mensagem={acao.erro} /> : null}
      <Text style={estilos.rotulo}>Tipo de meta</Text>
      <View style={estilos.segmentos}>
        {(['FINANCEIRA', 'MATERIAL'] as TipoMeta[]).map(t => (
          <Pressable
            key={t}
            disabled={tipoTravado}
            onPress={() => setTipoMeta(t)}
            accessibilityRole="radio"
            accessibilityState={{ selected: tipoMeta === t, disabled: tipoTravado }}
            style={[
              estilos.segmento,
              tipoMeta === t && estilos.segmentoAtivo,
              tipoTravado && { opacity: 0.6 },
            ]}
          >
            <Text style={[estilos.segmentoTexto, tipoMeta === t && estilos.segmentoTextoAtivo]}>
              {rotuloTipoMeta[t]}
            </Text>
          </Pressable>
        ))}
      </View>
      {tipoTravado ? (
        <Text style={[tipo.apoio, { marginBottom: espaco.md }]}>
          O tipo não muda depois de haver contribuições confirmadas.
        </Text>
      ) : null}
      <Campo
        rotulo="Título"
        value={titulo}
        onChangeText={setTitulo}
        maxLength={120}
        placeholder="Ex.: Kit de ferramentas novas"
      />
      <Campo
        rotulo="Por que precisamos disso"
        value={descricao}
        onChangeText={setDescricao}
        multiline
        numberOfLines={4}
        style={estilos.multilinha}
      />
      {tipoMeta === 'MATERIAL' ? (
        <Campo
          rotulo="Unidade de medida"
          value={unidade}
          onChangeText={setUnidade}
          maxLength={30}
          placeholder="Ex.: kg, pacotes, unidades"
        />
      ) : null}
      <Campo
        rotulo={tipoMeta === 'FINANCEIRA' ? 'Valor da meta (R$)' : 'Quantidade necessária'}
        value={quantidade}
        onChangeText={setQuantidade}
        keyboardType="decimal-pad"
      />
      <CampoData rotulo="Prazo (opcional)" valorTexto={prazo} aoMudarTexto={setPrazo} />
      <Botao
        titulo="Salvar meta"
        carregando={acao.ocupado}
        onPress={() => {
          void acao.executar(async () => {
            const valor = interpretarQuantidade(quantidade);
            const prazoIso = prazo.trim() ? interpretarData(prazo) : null;
            if (titulo.trim().length < 3)
              throw new Error('O título precisa de ao menos 3 caracteres.');
            if (!descricao.trim()) throw new Error('Descreva a meta.');
            if (tipoMeta === 'MATERIAL' && !unidade.trim())
              throw new Error('Informe a unidade de medida (ex.: kg, unidades).');
            if (valor === null)
              throw new Error(
                'Informe a quantidade da meta: número positivo, com até duas casas decimais.',
              );
            if (prazo.trim() && !prazoIso) throw new Error('Use o formato DD/MM/AAAA no prazo.');
            if (!meta && prazoIso && prazoIso < hojeIso())
              throw new Error('O prazo precisa ser hoje ou uma data futura.');
            await salvarMeta(meta?.id ?? null, {
              titulo: titulo.trim(),
              descricao: descricao.trim(),
              tipo: tipoMeta,
              unidade_medida: tipoMeta === 'MATERIAL' ? unidade.trim() : null,
              quantidade_meta: valor,
              data_limite: prazoIso,
            });
            voltar();
          });
        }}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  rotulo: { fontSize: 13, fontWeight: '600', color: cores.tintaSuave, marginBottom: espaco.sm },
  segmentos: { flexDirection: 'row', gap: espaco.sm, marginBottom: espaco.md },
  segmento: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: cores.linha,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: cores.fundo,
  },
  segmentoAtivo: { borderColor: cores.folha, backgroundColor: cores.folhaClara },
  segmentoTexto: { fontSize: 13, fontWeight: '600', color: cores.tintaSuave },
  segmentoTextoAtivo: { color: cores.folha },
  multilinha: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12 },
});
