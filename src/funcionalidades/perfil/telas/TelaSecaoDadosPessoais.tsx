import React, { useState } from 'react';
import { mascararTelefone } from '@/compartilhado/utils/mascaras';
import { Campo } from '@/compartilhado/componentes/Ui';
import { SecaoPerfil, estilosPerfil } from '../componentes/PerfilSecoes';
import { usePerfilVoluntario } from '../ContextoPerfilVoluntario';
import { validarConta } from '../regras';

export function TelaSecaoDadosPessoais({ voltar }: { voltar: () => void }) {
  const { perfil, salvar } = usePerfilVoluntario();
  const d = perfil.dados;
  const [nome, setNome] = useState(d.nome);
  const [telefone, setTelefone] = useState(mascararTelefone(d.telefone ?? ''));
  const [instagram, setInstagram] = useState(d.perfil_instagram ?? '');
  const [descricao, setDescricao] = useState(d.descricao ?? '');
  return (
    <SecaoPerfil
      titulo="Dados pessoais"
      voltar={voltar}
      salvar={async () => {
        const validacao = validarConta({ nome, telefone, instagram, descricao }, 'A apresentação');
        if ('erro' in validacao) return validacao.erro;
        await salvar(validacao.dados);
        return null;
      }}
    >
      <Campo rotulo="Nome" value={nome} onChangeText={setNome} />
      <Campo
        rotulo="Telefone"
        value={telefone}
        onChangeText={t => setTelefone(mascararTelefone(t))}
        placeholder="(51) 99999-9999"
        keyboardType="phone-pad"
      />
      <Campo
        rotulo="Instagram"
        value={instagram}
        onChangeText={setInstagram}
        autoCapitalize="none"
        placeholder="@seuperfil"
      />
      <Campo
        rotulo="Sobre você"
        value={descricao}
        onChangeText={setDescricao}
        multiline
        numberOfLines={3}
        style={estilosPerfil.multilinha}
        dica={`${descricao.trim().length}/500`}
      />
    </SecaoPerfil>
  );
}
