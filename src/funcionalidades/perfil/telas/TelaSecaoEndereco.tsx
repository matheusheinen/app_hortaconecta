import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { apenasDigitos } from '@/compartilhado/utils/validadores';
import { Campo } from '@/compartilhado/componentes/Ui';
import { SecaoPerfil, estilosPerfil } from '../componentes/PerfilSecoes';
import { usePerfilVoluntario } from '../ContextoPerfilVoluntario';
import { buscarCep } from '../apiVoluntario';
import { mascararCep, validarEndereco } from '../regras';

export function TelaSecaoEndereco({ voltar }: { voltar: () => void }) {
  const { perfil, salvar } = usePerfilVoluntario();
  const d = perfil.dados;
  const [cep, setCep] = useState(mascararCep(d.cep ?? ''));
  const [logradouro, setLogradouro] = useState(d.logradouro ?? '');
  const [numero, setNumero] = useState(d.numero ?? '');
  const [complemento, setComplemento] = useState(d.complemento ?? '');
  const [bairro, setBairro] = useState(d.bairro ?? '');
  const [cidade, setCidade] = useState(d.cidade ?? '');
  const [uf, setUf] = useState(d.uf ?? '');
  const [buscando, setBuscando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);

  /** Busca assim que os 8 dígitos chegam; sem resposta, segue o preenchimento manual. */
  async function aoMudarCep(texto: string) {
    const mascarado = mascararCep(texto);
    setCep(mascarado);
    setRecado(null);
    if (apenasDigitos(mascarado).length !== 8) return;
    setBuscando(true);
    const encontrado = await buscarCep(mascarado);
    setBuscando(false);
    if (!encontrado) {
      setRecado('Não encontramos esse CEP. Você pode preencher o endereço à mão.');
      return;
    }
    if (encontrado.logradouro) setLogradouro(encontrado.logradouro);
    if (encontrado.bairro) setBairro(encontrado.bairro);
    setCidade(encontrado.cidade);
    setUf(encontrado.uf);
  }

  return (
    <SecaoPerfil
      titulo="Endereço"
      voltar={voltar}
      salvar={async () => {
        const validacao = validarEndereco({
          cep,
          logradouro,
          numero,
          complemento,
          bairro,
          cidade,
          uf,
        });
        if ('erro' in validacao) return validacao.erro;
        await salvar(validacao.dados);
        return null;
      }}
    >
      <Text style={estilosPerfil.explicacao}>
        Logradouro, número e cidade são necessários para se candidatar. Você pode salvar e completar
        depois.
      </Text>
      <Campo
        rotulo="CEP"
        value={cep}
        onChangeText={aoMudarCep}
        placeholder="00000-000"
        keyboardType="number-pad"
        maxLength={9}
        dica={
          buscando
            ? 'Buscando endereço…'
            : (recado ?? 'Digite o CEP para preencher o restante automaticamente.')
        }
      />
      <Campo
        rotulo="Logradouro"
        value={logradouro}
        onChangeText={setLogradouro}
        placeholder="Rua, avenida ou estrada"
      />
      <View style={estilosPerfil.linha}>
        <View style={{ flex: 1 }}>
          <Campo rotulo="Número" value={numero} onChangeText={setNumero} placeholder="Nº ou s/n" />
        </View>
        <View style={{ flex: 2 }}>
          <Campo rotulo="Complemento" value={complemento} onChangeText={setComplemento} />
        </View>
      </View>
      <Campo rotulo="Bairro" value={bairro} onChangeText={setBairro} />
      <View style={estilosPerfil.linha}>
        <View style={{ flex: 3 }}>
          <Campo rotulo="Cidade" value={cidade} onChangeText={setCidade} />
        </View>
        <View style={{ flex: 1 }}>
          <Campo
            rotulo="UF"
            value={uf}
            onChangeText={t => setUf(t.toUpperCase())}
            placeholder="RS"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={2}
          />
        </View>
      </View>
    </SecaoPerfil>
  );
}
