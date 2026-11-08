import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Aviso, Botao, Campo } from '@/compartilhado/componentes/Ui';
import { LogoInstituicao } from '@/compartilhado/componentes/LogoInstituicao';
import { mensagemErro } from '@/compartilhado/utils/erros';
import { tipo } from '@/compartilhado/tema';
import { SecaoPerfil, estilosPerfil } from '../componentes/PerfilSecoes';
import { usePerfilOng } from '../ContextoPerfilOng';
import { selecionarLogo } from '../imagemLogo';
import { validarIdentidade } from '../regras';

/** B28: nome e logotipo da instituição, lidos por todos em `configuracao_instituicao`. */
export function TelaSecaoIdentidadeOng({ voltar }: { voltar: () => void }) {
  const { dados, salvar } = usePerfilOng();
  const [nomeCurto, setNomeCurto] = useState(dados.nome_curto);
  const [nomeCompleto, setNomeCompleto] = useState(dados.nome_completo);
  const [logo, setLogo] = useState(dados.url_logo);
  const [erroLogo, setErroLogo] = useState<string | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);

  async function escolherLogo() {
    if (escolhendo) return;
    setEscolhendo(true);
    setErroLogo(null);
    try {
      const novo = await selecionarLogo();
      if (novo) setLogo(novo);
    } catch (falha) {
      setErroLogo(mensagemErro(falha));
    } finally {
      setEscolhendo(false);
    }
  }

  return (
    <SecaoPerfil
      titulo="Nome e logotipo da instituição"
      voltar={voltar}
      salvar={async () => {
        const valores = validarIdentidade({ nomeCurto, nomeCompleto });
        await salvar({ ...valores, url_logo: logo });
        return null;
      }}
    >
      <Text style={estilosPerfil.explicacao}>
        O nome curto e o logotipo aparecem no início do app para a gestão e para quem entra como
        convidado. O nome completo é usado em textos formais.
      </Text>
      <Campo
        rotulo="Nome curto"
        value={nomeCurto}
        onChangeText={setNomeCurto}
        maxLength={40}
        placeholder="Horta Comunitária"
      />
      <Campo
        rotulo="Nome completo"
        value={nomeCompleto}
        onChangeText={setNomeCompleto}
        maxLength={120}
        placeholder="Centro Ocupacional Bruno José Campos"
      />
      <Text style={tipo.corpo}>Logotipo</Text>
      {erroLogo ? <Aviso mensagem={erroLogo} /> : null}
      <View style={{ alignItems: 'flex-start', marginVertical: 8 }}>
        {logo ? (
          <LogoInstituicao url={logo} tamanho={96} />
        ) : (
          <Text style={tipo.apoio}>Nenhum logotipo cadastrado.</Text>
        )}
      </View>
      <Text style={tipo.apoio}>
        Prefira PNG com fundo transparente. A imagem é reduzida para 256 px no aparelho.
      </Text>
      <Botao
        titulo={logo ? 'Trocar logotipo' : 'Escolher logotipo'}
        variante="contorno"
        carregando={escolhendo}
        onPress={() => {
          void escolherLogo();
        }}
      />
      {logo ? (
        <Botao titulo="Remover logotipo" variante="contorno" onPress={() => setLogo(null)} />
      ) : null}
    </SecaoPerfil>
  );
}
