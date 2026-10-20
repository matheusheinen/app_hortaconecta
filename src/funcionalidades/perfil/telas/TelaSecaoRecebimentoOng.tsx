import React, { useState } from 'react';
import { Text } from 'react-native';
import { Campo } from '@/compartilhado/componentes/Ui';
import { SecaoPerfil, estilosPerfil } from '../componentes/PerfilSecoes';
import { usePerfilOng } from '../ContextoPerfilOng';
import { validarRecebimento } from '../regras';

export function TelaSecaoRecebimentoOng({ voltar }: { voltar: () => void }) {
  const { dados, salvar } = usePerfilOng();
  const disponivel = dados.pixDisponivel;
  const [chave, setChave] = useState(dados.chave_pix ?? '');
  const [beneficiario, setBeneficiario] = useState(dados.nome_beneficiario_pix ?? '');
  return (
    <SecaoPerfil
      titulo="Recebimento de doações (PIX)"
      voltar={voltar}
      salvar={async () => {
        if (!disponivel)
          return 'O servidor ainda não tem o campo de PIX da instituição. Avise quem administra o Supabase.';
        const valores = validarRecebimento({ chave, beneficiario });
        await salvar(valores);
        return null;
      }}
    >
      <Text style={estilosPerfil.explicacao}>
        A chave aparece para os voluntários nas metas em dinheiro. O pagamento acontece fora do app;
        a gestão confere as doações informadas no extrato antes de confirmá-las.
      </Text>
      {!disponivel ? (
        <Text style={estilosPerfil.explicacao}>
          Esta seção fica disponível depois que a atualização do banco for aplicada no Supabase.
        </Text>
      ) : null}
      <Campo
        rotulo="Chave PIX"
        value={chave}
        onChangeText={setChave}
        autoCapitalize="none"
        placeholder="CNPJ, e-mail, telefone ou chave aleatória"
        editable={disponivel}
      />
      <Campo
        rotulo="Nome do beneficiário"
        value={beneficiario}
        onChangeText={setBeneficiario}
        editable={disponivel}
      />
    </SecaoPerfil>
  );
}
