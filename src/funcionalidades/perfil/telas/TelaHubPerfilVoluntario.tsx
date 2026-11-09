import React from 'react';
import { CartaoSecao, HubPerfil, StatusPerfil } from '../componentes/PerfilSecoes';
import { SolicitarExclusao } from '../componentes/SolicitarExclusao';
import { useContextoPerfilVoluntario } from '../ContextoPerfilVoluntario';
import {
  SECOES_PERFIL,
  secaoCompleta,
  secoesPendentes,
  type SecaoPerfil as ChaveSecao,
} from '../regras';

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
  const pendentes = perfil ? secoesPendentes(perfil.dados, perfil.habilidades.length) : [];
  const total = SECOES_PERFIL.length;

  return (
    <HubPerfil
      nome={nome}
      papel="voluntário"
      sair={sair}
      erro={erro}
      carregando={carregando && !perfil}
      carregar={carregar}
    >
      {perfil ? (
        <>
          <StatusPerfil
            ok={perfil.elegivel}
            titulo={perfil.elegivel ? 'Cadastro completo' : 'Complete seu cadastro'}
            texto={
              perfil.elegivel
                ? 'Você já pode se candidatar às tarefas da instituição.'
                : pendentes.length
                  ? `Falta${pendentes.length > 1 ? 'm' : ''} ${pendentes.length} de ${total} seções para se candidatar às tarefas.`
                  : 'Confira os dados das seções; o servidor ainda não liberou as candidaturas.'
            }
            feitas={total - pendentes.length}
            total={total}
          />
          {SECOES_PERFIL.map(secao => (
            <CartaoSecao
              key={secao.chave}
              titulo={secao.titulo}
              resumo={secao.resumo}
              completa={secaoCompleta(secao.chave, perfil.dados, perfil.habilidades.length)}
              onPress={() => abrir(secao.chave)}
            />
          ))}
          <SolicitarExclusao />
        </>
      ) : null}
    </HubPerfil>
  );
}
