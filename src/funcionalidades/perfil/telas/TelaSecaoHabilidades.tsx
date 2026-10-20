import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { cores, espaco } from '@/compartilhado/tema';
import { OpcaoMarcavel, SecaoPerfil, estilosPerfil } from '../componentes/PerfilSecoes';
import { usePerfilVoluntario } from '../ContextoPerfilVoluntario';

export function TelaSecaoHabilidades({ voltar }: { voltar: () => void }) {
  const { perfil, salvar } = usePerfilVoluntario();
  const [selecionadas, setSelecionadas] = useState<number[]>(perfil.habilidades);
  const categorias = [...new Set(perfil.catalogo.map(h => h.categoria ?? 'Outras'))];
  const alternar = (id: number) =>
    setSelecionadas(atual => (atual.includes(id) ? atual.filter(h => h !== id) : [...atual, id]));
  return (
    <SecaoPerfil
      titulo="Habilidades"
      voltar={voltar}
      salvar={async () => {
        await salvar({}, selecionadas);
        return null;
      }}
    >
      {perfil.catalogo.length === 0 ? (
        <Text style={estilosPerfil.explicacao}>
          Nenhuma habilidade cadastrada pela gestão ainda.
        </Text>
      ) : (
        categorias.map(categoria => (
          <View key={categoria} style={{ marginBottom: espaco.md }}>
            <Text style={estilos.categoria}>{categoria}</Text>
            <View style={estilosPerfil.opcoes}>
              {perfil.catalogo
                .filter(h => (h.categoria ?? 'Outras') === categoria)
                .map(h => (
                  <OpcaoMarcavel
                    key={h.id}
                    rotulo={h.nome_habilidade}
                    ativa={selecionadas.includes(h.id)}
                    onPress={() => alternar(h.id)}
                  />
                ))}
            </View>
          </View>
        ))
      )}
    </SecaoPerfil>
  );
}

const estilos = StyleSheet.create({
  categoria: { fontSize: 13, fontWeight: '700', color: cores.tintaSuave, marginBottom: espaco.sm },
});
