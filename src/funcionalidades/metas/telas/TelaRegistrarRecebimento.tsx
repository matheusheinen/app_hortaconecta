import React, { useCallback, useState } from 'react';
import { useSessaoAtual } from '@/funcionalidades/autenticacao/ContextoSessao';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Botao, Campo } from '@/compartilhado/componentes/Ui';
import { TelaFluxo } from '@/compartilhado/componentes/TelaFluxo';
import { useAcao } from '@/compartilhado/hooks/useAcao';
import { useConsulta } from '@/compartilhado/hooks/useConsulta';
import { avisar, confirmarAcao } from '@/compartilhado/utils/confirmar';
import { cores, espaco, tipo } from '@/compartilhado/tema';
import { carregarMeta, listarVoluntarios, registrarRecebimento } from '../api';
import { SeletorComprovante, type ComprovanteEscolhido } from '../componentes/SeletorComprovante';
import { descreverProgresso, descreverQuantidade, interpretarQuantidade } from '../regras';

export function TelaRegistrarRecebimento({ id, voltar }: { id: number; voltar: () => void }) {
  const { usuarioId: gestaoId } = useSessaoAtual();
  const consulta = useCallback(async () => {
    const [{ meta }, voluntarios] = await Promise.all([carregarMeta(id), listarVoluntarios()]);
    return { meta, voluntarios };
  }, [id]);
  const { dados, erro, carregando, carregar } = useConsulta(consulta);
  const [busca, setBusca] = useState('');
  const [doador, setDoador] = useState<{ id: string; nome: string } | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  const [comprovante, setComprovante] = useState<ComprovanteEscolhido | null>(null);
  const acao = useAcao();
  const meta = dados?.meta;
  const filtrados = (dados?.voluntarios ?? [])
    .filter(v =>
      v.nome.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')),
    )
    .slice(0, 8);

  function confirmar() {
    if (!meta) return;
    const valor = interpretarQuantidade(quantidade);
    if (!doador) {
      avisar('Quem doou?', 'Escolha o voluntário na lista.');
      return;
    }
    if (valor === null) {
      avisar('Quantidade inválida', 'Informe um número positivo, com até duas casas decimais.');
      return;
    }
    confirmarAcao(
      'Registrar doação recebida?',
      `${descreverQuantidade(valor, meta)} de ${doador.nome}. Entra confirmada e soma ao total.`,
      'Confirmar',
      () => {
        void acao.executar(async () => {
          await registrarRecebimento({
            metaId: meta.id,
            doadorId: doador.id,
            gestaoId,
            quantidade: valor,
            observacao: observacao.trim() || null,
            comprovanteBase64: comprovante?.base64 ?? null,
          });
          voltar();
        });
      },
    );
  }

  return (
    <TelaFluxo
      titulo="Registrar doação recebida"
      voltar={voltar}
      erro={acao.erro ?? erro}
      carregando={carregando && !dados}
      atualizar={carregar}
    >
      {meta ? (
        <>
          <Text style={tipo.apoio}>
            {meta.titulo} · {descreverProgresso(meta)}
          </Text>
          <Text style={tipo.corpo}>
            Para doações que a gestão já recebeu, em mãos ou no extrato. O registro entra
            confirmado.
          </Text>
          {doador ? (
            <View style={estilos.escolhido}>
              <Text style={[tipo.corpo, { flex: 1 }]}>{doador.nome}</Text>
              <Pressable onPress={() => setDoador(null)} hitSlop={8} accessibilityRole="button">
                <Text style={[tipo.apoio, { color: cores.folha, fontWeight: '600' }]}>Trocar</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Campo
                rotulo="Quem doou"
                value={busca}
                onChangeText={setBusca}
                placeholder="Digite parte do nome do voluntário"
              />
              {!filtrados.length ? (
                <Text style={tipo.apoio}>
                  Nenhum voluntário encontrado. O doador precisa ter conta no app.
                </Text>
              ) : null}
              {filtrados.map(v => (
                <Pressable
                  key={v.id}
                  onPress={() => setDoador(v)}
                  accessibilityRole="button"
                  style={estilos.opcao}
                >
                  <Text style={tipo.corpo}>{v.nome}</Text>
                </Pressable>
              ))}
            </>
          )}
          <Campo
            rotulo={
              meta.tipo === 'FINANCEIRA'
                ? 'Valor recebido (R$)'
                : `Quantidade recebida (${meta.unidade_medida || 'un.'})`
            }
            value={quantidade}
            onChangeText={setQuantidade}
            keyboardType="decimal-pad"
          />
          <Campo
            rotulo="Observação (opcional)"
            value={observacao}
            onChangeText={setObservacao}
            maxLength={500}
          />
          <SeletorComprovante
            valor={comprovante}
            aoMudar={setComprovante}
            desabilitado={acao.ocupado}
          />
          <Botao titulo="Confirmar doação" carregando={acao.ocupado} onPress={confirmar} />
        </>
      ) : null}
    </TelaFluxo>
  );
}

const estilos = StyleSheet.create({
  escolhido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espaco.sm,
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: 14,
    padding: espaco.md,
    backgroundColor: cores.mint,
  },
  opcao: {
    paddingVertical: 12,
    paddingHorizontal: espaco.sm,
    borderBottomWidth: 1,
    borderBottomColor: cores.linha,
  },
});
