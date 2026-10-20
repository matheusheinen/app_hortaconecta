import React, { useState } from 'react';
import { mascararCnpj } from '@/compartilhado/utils/mascaras';
import { paraCampoData } from '@/compartilhado/utils/datas';
import { Campo } from '@/compartilhado/componentes/Ui';
import { CampoData } from '@/compartilhado/componentes/CampoData';
import { SecaoPerfil } from '../componentes/PerfilSecoes';
import { usePerfilOng } from '../ContextoPerfilOng';
import { validarInstitucional } from '../regras';

export function TelaSecaoInstitucionalOng({ voltar }: { voltar: () => void }) {
  const { dados, salvar } = usePerfilOng();
  const [cnpj, setCnpj] = useState(mascararCnpj(dados.cnpj ?? ''));
  const [razaoSocial, setRazaoSocial] = useState(dados.razao_social ?? '');
  const [fundacao, setFundacao] = useState(paraCampoData(dados.data_criacao));
  const [responsavel, setResponsavel] = useState(dados.responsavel_legal ?? '');
  return (
    <SecaoPerfil
      titulo="Dados institucionais"
      voltar={voltar}
      salvar={async () => {
        const valores = validarInstitucional({ cnpj, razaoSocial, fundacao, responsavel });
        await salvar(valores);
        return null;
      }}
    >
      <Campo
        rotulo="CNPJ"
        value={cnpj}
        onChangeText={t => setCnpj(mascararCnpj(t))}
        placeholder="00.000.000/0000-00"
        keyboardType="number-pad"
      />
      <Campo rotulo="Razão social" value={razaoSocial} onChangeText={setRazaoSocial} />
      <CampoData
        rotulo="Data de fundação"
        valorTexto={fundacao}
        aoMudarTexto={setFundacao}
        maximo={new Date()}
      />
      <Campo rotulo="Responsável legal" value={responsavel} onChangeText={setResponsavel} />
    </SecaoPerfil>
  );
}
