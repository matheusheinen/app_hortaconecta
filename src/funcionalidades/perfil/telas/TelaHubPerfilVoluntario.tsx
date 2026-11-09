import React from 'react';
import { CartaoSecao, HubPerfil } from '../componentes/PerfilSecoes';
import { SolicitarExclusao } from '../componentes/SolicitarExclusao';
import { useContextoPerfilVoluntario } from '../ContextoPerfilVoluntario';
import { SECOES_PERFIL, secaoCompleta, type SecaoPerfil as ChaveSecao } from '../regras';

const simbolos: Record<ChaveSecao, string> = {
  pessoais: '👤',
  cadastro: '🪪',
  endereco: '📍',
  disponibilidade: '🗓',
  habilidades: '🧰',
};

export function TelaHubPerfilVoluntario({
  nome,
  sair,
  abrir,
}: {
  nome: string;
  sair: () => void;
  abrir: (secao: ChaveSecao) => void;
}) {
  const { perfil, erro, carregando, carregar } = useContextoPerfilVoluntario();

  return (
    <HubPerfil
      nome={nome}
      papel="voluntário"
      sair={sair}
      erro={erro}
      carregando={carregando && !perfil}
      carregar={carregar}
      antesModoGestor={<SolicitarExclusao />}
    >
      {perfil ? (
        <>
          {SECOES_PERFIL.map(secao => (
            <CartaoSecao
              key={secao.chave}
              titulo={secao.titulo}
              resumo={secao.resumo}
              simbolo={simbolos[secao.chave]}
              completa={secaoCompleta(secao.chave, perfil.dados, perfil.habilidades.length)}
              onPress={() => abrir(secao.chave)}
            />
          ))}
        </>
      ) : null}
    </HubPerfil>
  );
}
