import React from 'react';
import { Text } from 'react-native';
import { CartaoSecao, HubPerfil, StatusPerfil, estilosPerfil } from '../componentes/PerfilSecoes';
import { useContextoPerfilOng } from '../ContextoPerfilOng';
import { SECOES_PERFIL_ONG, secaoOngCompleta, type SecaoPerfilOng } from '../apiOng';

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
  const pendencias = dados
    ? [
        !secaoOngCompleta('whatsapp', dados) && 'o WhatsApp',
        !secaoOngCompleta('recebimento', dados) && 'a chave PIX',
      ].filter(Boolean)
    : [];

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
                ? 'Perfil completo'
                : 'Complete o perfil da gestão'
            }
            texto={
              pendencias.length
                ? `Cadastre ${pendencias.join(' e ')} para que os voluntários consigam entrar em contato e doar.`
                : 'Os voluntários conseguem falar com a gestão e doar pelas metas em dinheiro.'
            }
            feitas={completas}
            total={SECOES_PERFIL_ONG.length}
          />
          {SECOES_PERFIL_ONG.map(secao => (
            <CartaoSecao
              key={secao.chave}
              titulo={secao.titulo}
              resumo={secao.resumo}
              completa={secaoOngCompleta(secao.chave, dados)}
              onPress={() => abrir(secao.chave)}
            />
          ))}
          <Text style={estilosPerfil.explicacao}>
            O nome oficial, as cores e o endereço da horta vêm da configuração institucional,
            administrada separadamente.
          </Text>
        </>
      ) : null}
    </HubPerfil>
  );
}
