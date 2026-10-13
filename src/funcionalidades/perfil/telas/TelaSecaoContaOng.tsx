import React, { useState } from 'react';
import { mascararTelefone } from '@/compartilhado/utils/mascaras';
import { Campo } from '@/compartilhado/componentes/Ui';
import { SecaoPerfil, estilosPerfil } from '../componentes/PerfilSecoes';
import { usePerfilOng } from '../ContextoPerfilOng';
import { validarConta } from '../regras';

export function TelaSecaoContaOng({ voltar }: { voltar: () => void }) {
  const { dados, salvar } = usePerfilOng();
  const [nome, setNome] = useState(dados.nome);
  const [telefone, setTelefone] = useState(mascararTelefone(dados.telefone ?? ''));
  const [instagram, setInstagram] = useState(dados.perfil_instagram ?? '');
  const [descricao, setDescricao] = useState(dados.descricao ?? '');
  return (
    <SecaoPerfil
      titulo="Conta e apresentação"
      voltar={voltar}
      salvar={async () => {
        const validacao = validarConta({ nome, telefone, instagram, descricao }, 'A descrição');
        if ('erro' in validacao) return validacao.erro;
        await salvar(validacao.dados);
        return null;
      }}
    >
      <Campo rotulo="Nome de exibição" value={nome} onChangeText={setNome} />
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
      />
      <Campo
        rotulo="Sobre a horta"
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
