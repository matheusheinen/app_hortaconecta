import React from 'react';
import { CartaoSecao, HubPerfil, StatusPerfil } from '../componentes/PerfilSecoes';
import { useContextoPerfilOng } from '../ContextoPerfilOng';
import { SECOES_PERFIL_ONG, secaoOngCompleta, type SecaoPerfilOng } from '../apiOng';

const simbolos: Record<SecaoPerfilOng, string> = {
  identidade: '🌱',
  conta: '👤',
  institucional: '📄',
  whatsapp: '☎',
  recebimento: '💸',
};

export function TelaHubPerfilOng({
  nome,
  sair,
  abrir,
}: {
  nome: string;
  sair: () => void;
  abrir: (secao: SecaoPerfilOng) => void;
}) {
  const { dados, erro, carregando, carregar } = useContextoPerfilOng();
  const completas = dados
    ? SECOES_PERFIL_ONG.filter(s => secaoOngCompleta(s.chave, dados)).length
    : 0;
  return (
    <HubPerfil
      nome={nome}
      papel="gestão da ONG"
      sair={sair}
      erro={erro}
      carregando={carregando && !dados}
      carregar={carregar}
    >
      {dados ? (
        <>
          <StatusPerfil
            ok={completas === SECOES_PERFIL_ONG.length}
            titulo={
              completas === SECOES_PERFIL_ONG.length
                ? 'Pronto para receber apoio'
                : 'Complete os dados da horta'
            }
            texto={
              completas === SECOES_PERFIL_ONG.length
                ? 'WhatsApp e PIX estão prontos para os voluntários.'
                : 'Complete os itens marcados como “Falta” abaixo.'
            }
            feitas={completas}
            total={SECOES_PERFIL_ONG.length}
          />
          {SECOES_PERFIL_ONG.map(secao => (
            <CartaoSecao
              key={secao.chave}
              titulo={secao.titulo}
              resumo={secao.resumo}
              simbolo={simbolos[secao.chave]}
              completa={secaoOngCompleta(secao.chave, dados)}
              onPress={() => abrir(secao.chave)}
            />
          ))}
        </>
      ) : null}
    </HubPerfil>
  );
}
