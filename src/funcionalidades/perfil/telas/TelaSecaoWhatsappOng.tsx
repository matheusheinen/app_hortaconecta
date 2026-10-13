import React, { useState } from 'react';
import { Text } from 'react-native';
import { mascararTelefone } from '@/compartilhado/utils/mascaras';
import { Campo } from '@/compartilhado/componentes/Ui';
import { SecaoPerfil, estilosPerfil } from '../componentes/PerfilSecoes';
import { usePerfilOng } from '../ContextoPerfilOng';
import { validarWhatsapp } from '../regras';

export function TelaSecaoWhatsappOng({ voltar }: { voltar: () => void }) {
  const { dados, salvar } = usePerfilOng();
  const [whatsapp, setWhatsapp] = useState(mascararTelefone(dados.whatsapp ?? ''));
  return (
    <SecaoPerfil
      titulo="WhatsApp para voluntários"
      voltar={voltar}
      salvar={async () => {
        const validacao = validarWhatsapp(whatsapp);
        if ('erro' in validacao) return validacao.erro;
        await salvar(validacao.dados);
        return null;
      }}
    >
      <Text style={estilosPerfil.explicacao}>
        Este número aparece no botão {'"Falar com a gestão"'} das atividades. Use um número que a
        equipe acompanhe.
      </Text>
      <Campo
        rotulo="WhatsApp"
        value={whatsapp}
        onChangeText={t => setWhatsapp(mascararTelefone(t))}
        placeholder="(51) 99999-9999"
        keyboardType="phone-pad"
      />
    </SecaoPerfil>
  );
}
