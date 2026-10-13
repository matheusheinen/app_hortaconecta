import React, { useState } from 'react';
import { Text } from 'react-native';
import { mascararCpf } from '@/compartilhado/utils/mascaras';
import { paraCampoData } from '@/compartilhado/utils/datas';
import { Campo } from '@/compartilhado/componentes/Ui';
import { CampoData } from '@/compartilhado/componentes/CampoData';
import { SecaoPerfil, estilosPerfil } from '../componentes/PerfilSecoes';
import { usePerfilVoluntario } from '../ContextoPerfilVoluntario';
import { validarCadastroVoluntario } from '../regras';

export function TelaSecaoCadastro({ voltar }: { voltar: () => void }) {
  const { perfil, salvar } = usePerfilVoluntario();
  const d = perfil.dados;
  const [cpf, setCpf] = useState(mascararCpf(d.cpf ?? ''));
  const [nascimento, setNascimento] = useState(paraCampoData(d.data_nascimento));
  const [profissao, setProfissao] = useState(d.profissao ?? '');
  return (
    <SecaoPerfil
      titulo="Cadastro de voluntário"
      voltar={voltar}
      salvar={async () => {
        const validacao = validarCadastroVoluntario({ cpf, nascimento, profissao });
        if ('erro' in validacao) return validacao.erro;
        await salvar(validacao.dados);
        return null;
      }}
    >
      <Text style={estilosPerfil.explicacao}>
        Estes dados ficam visíveis apenas para você e para a gestão da instituição.
      </Text>
      <Campo
        rotulo="CPF"
        value={cpf}
        onChangeText={t => setCpf(mascararCpf(t))}
        placeholder="000.000.000-00"
        keyboardType="number-pad"
      />
      <CampoData
        rotulo="Data de nascimento"
        valorTexto={nascimento}
        aoMudarTexto={setNascimento}
        maximo={new Date()}
      />
      <Campo rotulo="Profissão" value={profissao} onChangeText={setProfissao} />
    </SecaoPerfil>
  );
}
