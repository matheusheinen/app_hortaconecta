import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { Text } from 'react-native';
import { apenasDigitos, validarCnpj, validarTelefone } from '../lib/validadores';
import { mascararCnpj, mascararTelefone } from '../lib/mascaras';
import { Campo } from '../componentes/Ui';
import { CampoData } from '../componentes/CampoData';
import {
  CartaoSecao,
  HubPerfil,
  SecaoPerfil,
  StatusPerfil,
  estilosPerfil,
} from '../componentes/PerfilSecoes';
import { hojeIso, interpretarData, paraCampoData } from '../lib/regrasPerfil';
import {
  SECOES_PERFIL_ONG,
  secaoOngCompleta,
  type DadosPerfilOng,
  type PerfilOngCarregado,
  type SecaoPerfilOng,
} from '../lib/perfilOng';

export type ContextoPerfilOng = {
  dados: PerfilOngCarregado | null;
  erro: string | null;
  carregando: boolean;
  carregar: () => void;
  salvar: (parcial: Partial<DadosPerfilOng>) => Promise<void>;
};

const Contexto = createContext<ContextoPerfilOng | null>(null);

export function ProvedorPerfilOng({
  valor,
  children,
}: {
  valor: ContextoPerfilOng;
  children: ReactNode;
}) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

function usePerfilOng() {
  const valor = useContext(Contexto);
  if (!valor?.dados) throw new Error('Perfil da gestão fora do provedor.');
  return { dados: valor.dados, salvar: valor.salvar };
}

export function TelaHubPerfilOng({
  nome,
  sair,
  abrir,
}: {
  nome: string;
  sair: () => void;
  abrir: (secao: SecaoPerfilOng) => void;
}) {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('Perfil da gestão fora do provedor.');
  const { dados, erro, carregando, carregar } = contexto;
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
        if (nome.trim().length < 2 || nome.trim().length > 120)
          return 'O nome precisa ter entre 2 e 120 caracteres.';
        if (telefone.trim() && !validarTelefone(telefone))
          return 'Telefone inválido. Informe DDD + número (10 ou 11 dígitos).';
        const insta = instagram.trim().replace(/^@/, '');
        if (insta && !/^[A-Za-z0-9._]{1,30}$/.test(insta))
          return 'Instagram inválido. Use só letras, números, ponto e underline.';
        if (descricao.trim().length > 500) return 'A descrição pode ter no máximo 500 caracteres.';
        await salvar({
          nome: nome.trim(),
          telefone: telefone.trim() ? apenasDigitos(telefone) : null,
          perfil_instagram: insta || null,
          descricao: descricao.trim() || null,
        });
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
        if (cnpj.trim() && !validarCnpj(cnpj)) return 'CNPJ inválido.';
        const iso = fundacao.trim() ? interpretarData(fundacao) : null;
        if (fundacao.trim() && !iso) return 'Use o formato DD/MM/AAAA na data de fundação.';
        if (iso && iso > hojeIso()) return 'A data de fundação não pode ser no futuro.';
        await salvar({
          cnpj: cnpj.trim() ? apenasDigitos(cnpj) : null,
          razao_social: razaoSocial.trim() || null,
          data_criacao: iso,
          responsavel_legal: responsavel.trim() || null,
        });
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

export function TelaSecaoWhatsappOng({ voltar }: { voltar: () => void }) {
  const { dados, salvar } = usePerfilOng();
  const [whatsapp, setWhatsapp] = useState(mascararTelefone(dados.whatsapp ?? ''));
  return (
    <SecaoPerfil
      titulo="WhatsApp para voluntários"
      voltar={voltar}
      salvar={async () => {
        if (whatsapp.trim() && !validarTelefone(whatsapp))
          return 'WhatsApp inválido. Informe DDD + número (10 ou 11 dígitos).';
        await salvar({ whatsapp: whatsapp.trim() ? apenasDigitos(whatsapp) : null });
        return null;
      }}
    >
      <Text style={estilosPerfil.explicacao}>
        Este número aparece no botão "Falar com a gestão" das atividades. Use um número que a equipe
        acompanhe.
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
        if (chave.trim().length > 140) return 'A chave PIX pode ter no máximo 140 caracteres.';
        if (
          beneficiario.trim() &&
          (beneficiario.trim().length < 2 || beneficiario.trim().length > 120)
        ) {
          return 'O nome do beneficiário precisa ter entre 2 e 120 caracteres.';
        }
        await salvar({
          chave_pix: chave.trim() || null,
          nome_beneficiario_pix: beneficiario.trim() || null,
        });
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
